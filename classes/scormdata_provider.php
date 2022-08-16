<?php
// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Moodle is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Moodle.  If not, see <http://www.gnu.org/licenses/>.
namespace scormreport_question;

defined('MOODLE_INTERNAL') || die();
require_once("$CFG->dirroot/mod/scorm/locallib.php");

// This class is a cache for scormdata.
class scormdata_provider {

    public function __construct($scormid) {
        $this->scormid = $scormid;
        $this->scos = [];
        $this->load_scos();
    }

    public function get_sco_questiondata () {
        $questiondata = [];
        // Loop over all SCO's of this SCORM and return their questiondata in an array.
        // For the difference between SCOs and SCORM see load_scos.
        foreach ($this->scos as $sco) {
            $questiondata[$sco->scoid]['questions'] = $sco->get_questiondata();
            $questiondata[$sco->scoid]['title'] = $sco->title;
        }
        return $questiondata;
    }

    public function get_sco_userscores () {
        $scores = [];
        // Loop over all SCO's in this SCORM and merge the scores that are provided.
        // For the difference between SCOs and SCORM see load_scos.
        // TODO: dont just merge but add up / find new average for scores from the same user across SCOs.
        // TODO: find out if users are even identical across SCOs.
        foreach ($this->scos as $sco) {
            $scores = array_merge($scores, $sco->get_user_scores());
        }
        return $scores;
    }

    // A scorm module may consist of one or multiple sharable content objects (SCOs). These scos hold the actual data.
    // this function retrives the scos connected to a scorm packet and intitalizes their data.
    public function load_scos() {
        global $DB;
        $scos = $DB->get_records('scorm_scoes', array("scorm" => $this->scormid), 'sortorder, id');
        foreach ($scos as $scodata) {
            $scoid = $scodata->id;
            // SCO stands for sharable content object. In theory those are learning modules for a scorm module.
            // However scorm also stores a bunch of metadata and nothing else in some of them.
            // These SCOS have the SCO type org.
            // Therefore for a SCO to be a SCO we actually care about, one needs to check whether the SCO has its type set to 'sco'.
            if ($scodata->scormtype === 'sco') {
                $this->scos[$scoid] = new scodata_provider($scoid, $scodata->title);
            }
        }
    }

}

// Class to cache data for a SCO.
// this class has two main public methods:
// get_user_scores returns an array of user scores.
// get_user_interactions returns an array of userinteractions within the SCO.
class scodata_provider {

    private const TOKEN_CORRECT = 'correct';
    private const TOKEN_FALSE = 'false';
    private const TOKEN_NEUTRAL = 'neutral';

    public function __construct($scoid, $title) {
        $this->title = $title;
        $this->scoid = $scoid;
        $this->userids = null;
        $this->attempts = [];
        $this->interactions = [];
        $this->scores = null;
        $this->questiondata = null;
    }

    public function get_user_scores () {
        // If scores are already present return them.
        if (!is_null($this->scores)) {
            return $this->scores;
        }
        // If attempts have not been loaded yet, load them (follow this for flow).
        if (is_null($this->attempts)) {
            $this->load_user_attempts();
        }
        $scores = [];
        // Loop over all attempts and push their score_raw property into the scores array.
        foreach ($this->attempts as $attempt) {
            if ($attempt && property_exists($attempt, 'score_raw')) {
                $scores[] = $attempt->score_raw;
            }
        }
        return $scores;
    }

    public function get_questiondata () {
        // If there is no questiondata yet, load it.
        if (is_null($this->questiondata)) {
            $this->load_questiondata();
            $this->infuse_questiondata_with_percentages();
        }
        return $this->questiondata;
    }

    public function get_user_interactions () {
        if (is_null($this->interactions)) {
            $this->load_user_interactions();
        }
        return $this->interactions;
    }

    // This function is inserting percentage data for questions.
    // Since during the original developement of this plugin only scorm questions that had correct and wrong answers
    // ... were considered this was developed as a core feature of the plugin.
    // TODO move this to javascript so it can be enabled and disabled based on the scormpacket provided.
    public function infuse_questiondata_with_percentages() {
        if (is_null($this->questiondata)) {
            $this->load_questiondata();
        }
        foreach ($this->questiondata as &$question) {
            // There are questions that are not meant to be rated such as feedback questions.
            // A neutral result indicates that this question is not meant to be rated.
            // If this is the case, the refinetype field will have an empty value.
            if (empty($question['refinetype'])) {
                // If there are learner responses, we want to display the question regardless.
                // Otherwise this means that there are only neutral results and no responses.
                // In that case we have nothing to visualize for this question.
                if ($question['learner_responses']) {
                    $question['displaytype'] = 'numeric_unscored';
                    // Check if all answers are numeric. If not set the displaytype to default.
                    foreach ($question['learner_responses'] as $responses) {
                        foreach ($responses as $response) {
                            if (!is_numeric($response)) {
                                $question['displaytype'] = 'default_unscored';
                                // Break both foreachs.
                                break 2;
                            }
                        }
                    }
                }
            } else if (array_key_exists('learner_responses', $question) &&
                array_key_exists('correct_response', $question) &&
                $question['learner_responses'] &&
                $question['correct_response'] &&
                $question['refinetype'] === 'manual_scored') {
                // If the question is set to be refined check if it fits the criteria to use a custom scoring pattern.
                // The custom scoring pattern calculates the differences between correct response pattern and the actual ansers.
                $percentages = $this->get_percentages_by_response($question);
                $question['percentages'] = $percentages;
                $question['displaytype'] = 'manual_scored';
            } else if ($question['refinetype'] === 'result_scored') {
                $question['displaytype'] = 'result_scored';
            }
        }
    }

    public function load_questiondata () {
        // If there is no interactiondata loaded yet, load it.
        if (empty($this->interactions)) {
            $this->load_user_interactions();
        }
        $refineddata = &$this->questiondata;
        $refineddata = [];
        foreach ($this->interactions as $userinteractions) {
            foreach ($userinteractions as $interaction) {
                // An interaction has a unique id for an attempt.
                // This id is (somewhat) identical to the Question id that was answered.
                if (!array_key_exists('id', $interaction)) {
                    // Every interaction is supposed to have an id field, this method relies on unique ids.
                    continue;
                }
                // For some reason some SCORM editors decided it was a good idea to append every id with the attempt number.
                // Some other editors generate a random number and append it to the slide number, then append this
                // ... with the Questions text to build an id.
                // Below if else trys to cut the attempt count from the id to prevent the same question having multiple ids.
                // Reference: https://community.articulate.com/discussions/articulate-storyline/question-id-s-and-sequencing.
                if (preg_match('/.*_\d+_\d+/', $interaction['id'])) {
                    $id = implode('_', explode('_', $interaction['id'], -2));
                } else {
                    $id = $interaction['id'];
                }
                // If the question the current interaction belongs to has not been initialized, initialize it.
                if (!array_key_exists($id, $refineddata)) {
                    $refineddata[$id] = [
                        // Depending on editor and SCORM version a description might be passed.
                        // This description is usually the questions text.
                        'description' => array_key_exists('description', $interaction) ? $interaction['description'] : '',
                        'id' => $id,
                        'type' => array_key_exists('type', $interaction) ? $interaction['type'] : 'unknown',
                        'correct_response' => array_key_exists('correct_responses', $interaction) ?
                            explode('[,]', $interaction['correct_responses'][0]['pattern']) :
                            null,
                        // Refinetype controls what callback will later be used to determine the "correctnessness" of an answer.
                        // A question featuring correct_responses and learner_responses will be evaluated on a spectrum...
                        // ... based on the amount of wrong responses given.
                        // If it has results that are either 'correct' or 'false' it will be evaluated based on the results data.
                        // ... given it is not being evaluated on a spectrum.
                        // If it has all results set to neutral it will not be refined as this indicates its an unscored question.
                        'refinetype' => '',
                        'total_answers' => 0,
                        'correct_answers' => 0,
                        'displaytype' => null,
                        'learner_responses' => [],
                        // TODO plural.
                        'result' => [],
                    ];
                }
                // Sometimes the description field will be missing in some interactions but present in others.
                // This might have to do with whether the interaction was aborted during an attempt.
                if ($refineddata[$id]['description'] === '' && array_key_exists('description', $interaction)) {
                    $refineddata[$id]['description'] = $interaction['description'];
                }
                // If there are learner responses push them.
                if (array_key_exists('learner_response', $interaction)) {
                    $learnerresponse = explode('[,]', $interaction['learner_response']);
                    $refineddata[$id]['learner_responses'][] = $learnerresponse;
                }
                // If there are also exists a correct response pattern set refinetype to be scored manually.
                if (array_key_exists('learner_response', $interaction) and array_key_exists('correct_responses', $interaction)) {
                    if ($refineddata[$id]['refinetype'] !== 'manual_scored') {
                        $refineddata[$id]['refinetype'] = 'manual_scored';
                    }
                }
                $refineddata[$id]['total_answers'] += 1;

                // If there are results, tally them up.
                if (array_key_exists('result', $interaction)) {
                    $result = $interaction['result'];
                    if ($result == self::TOKEN_CORRECT) {
                        $refineddata[$id]['correct_answers'] += 1;
                    }
                    // If the result is not neutral set the question to be visualized with a scored approach.
                    if ($result !== self::TOKEN_NEUTRAL) {
                        if ($refineddata[$id]['refinetype'] == '') {
                            $refineddata[$id]['refinetype'] = 'result_scored';
                        }
                    }
                    $refineddata[$id]['result'][] = $result;
                }
            }
        }
    }

    public function load_user_interactions () {
        /*
         * SCO data is stored by using the cmi model.
         * In the cmi model hierarchical structures are saved by saving the individual values and their "path".
         * So if you had a structure somewhat like:
         * cmi ->
         *      interactions (array) ->
         *          0 ->
         *              result -> correct
         *          1 ->
         *              result -> false
         * the corrosponding cmi structure would create the following two records:
         * cmi.interactions.0.result: correct
         * cmi.interactions.1.result: false
         * ...
         * Please note that in SCORM data gets prefixed with cmi, there does not have to exist a cmi object.
         * For example in the above example interactions could be at the topmost level.
         * Additionally depending on the scorm version and editor used dots may be totally or partially replaced with underscores.
         * ...
         * Every time a student starts a quiz an ATTEMPT is created.
         * Moodle provides a way of retrieving these attempts and returns their related cmi encoded data.
         * If a student answered a question during the attempt an INTERACTION is created.
         * These interactions provide data which usually include information like whether the answer was correct.
         * ...
         * This function retrieves the interaction records from the cmi data and loads them into a more practical array structure.
         */
        // If there are no attempts loaded yet, load them.
        if (empty($this->attempts)) {
            $this->load_user_attempts();
        }

        // Fields in SCORMs data model have been renamed for newer verstions.
        // This is a list of fields that need renaming to be backwards compatible.
        $cmisubstitutions = [
            'student_response' => 'learner_response',
        ];

        foreach ($this->attempts as $attempt) {
            $interactiondata = [];
            // The cmi data of an attempt is provided as associative array where the key is the "path" and value the value.
            // Interaction records aren't guaranteed to be in order.
            foreach ($attempt as $path => $value) {
                $matches = [];
                if (preg_match('/cmi[._]interactions[._]([0-9]*)(.*)/', $path, $matches)) {
                    // The above regex will place the interaction number in that attempt in $matches[1] and the path in $matches[2].
                    $interactionnum = $matches[1];
                    if (!array_key_exists($interactionnum, $interactiondata)) {
                        $interactiondata[$interactionnum] = [];
                    }
                    $cmipath = explode('.', $matches[2]);
                    // Sanity check.
                    // If the cmi path is only one long this would mean it only contains "cmi" as full path.
                    // This would not make sense as cmi is only a prefix and can't hold a value itself.
                    if (count($cmipath) <= 1) {
                        // In that case try again with an underscore
                        $cmipath = explode('_', $matches[2]);
                        if (count($cmipath) <= 1) {
                            // If that fails, ignore the record, something went wrong.
                            continue;
                        }
                    }
                    // Removes the cmi prefix that would introduce an unecessary dimension to the reconstructed array.
                    array_shift($cmipath);

                    foreach ($cmisubstitutions as $find => $replace) {
                        foreach ($cmipath as &$key) {
                            if ($key === $find) {
                                $key = $replace;
                            }
                        }
                    }

                    $array = &$interactiondata[$interactionnum];
                    $val = $value;
                    $operation = "write";
                    // Write to keychain simply writes a value to a bunch of associative arrays to a "path".
                    // It also creates any arrays that do not exist along that path.
                    self::write_to_keychain($array, $cmipath, $val, $operation);
                }
            }
            $this->interactions[] = $interactiondata;
        }
    }

    private function get_percentages_by_response ($data) {
        // This function trys to give a better estimate of the answers "correctness" instead of only using passed/failed.
        // It first trys to rebuild all possible answers.
        // Then it check what answers were given and gives points for correctly given answers AND correctly NOT given answers.
        // After that it devides the points by the amount of answers possible to get the percent of answers that were correct.
        // So if a question had answers a, b, c, d with correct answers a, d and a student answered a, b it would score it 50%...
        // ... because the student answered a amd c correctly but failed at b and d.

        // SCORM does not provide us with all answers that were possible to choose in multiple-choice questions.
        // However we can somewhat reconstruct them by looking at all the answers students gave. Given a large enough
        // ...studentcount that should be relatively accurate.
        $allanswers = [];
        foreach ($data['learner_responses'] as $responses) {
            $allanswers = array_unique(array_merge($allanswers, $responses));
        }
        $percentages = [];
        // This function is only called if correct_response exists.
        $correctresponse = $data['correct_response'];
        $allanswers = array_unique(array_merge($correctresponse, $allanswers));
        foreach ($data['learner_responses'] as $responses) {
            // If the response is not 'correct' or 'false' we simply look at all answers and wether they should've been checked or not.
            // We can then calculate the amount of errors made and use that as our errorpercentile.
            $errors = count(array_merge(array_diff($responses, $correctresponse), array_diff($correctresponse, $responses)));
            $percentage = 1 - ((double)$errors / (double)count($allanswers));
            $percentages[] = $percentage;
        }
        return $percentages;
    }

    private function load_all_users () {
        global $DB;
        // Fetch the userids of this sco from the database.
        $sql = "SELECT DISTINCT userid FROM {scorm_scoes_track} WHERE scoid = ? ORDER BY userid";
        $this->userids = $DB->get_fieldset_sql($sql, array($this->scoid));
    }

    private function load_user_attempts() {
        // If users aren't loaded yet, load userids into the $userids array.
        if (is_null($this->userids)) {
            $this->load_all_users();
        }
        // Loop over users and get their best attempt (follow for flow).
        foreach ($this->userids as $userid) {
            $this->load_best_attempt_for_user($userid);
        }
    }

    private function load_best_attempt_for_user ($userid) {
        // The function sorm_get_tracks returns all attempts a user has in this sco.
        // This is called a track because it represents a single tracking instance.
        // This function also takes care of SOME of the differences in labeling and reporting between SCORM versions.
        $attempts = [scorm_get_tracks($this->scoid, (int) $userid)];
        $maxscore = null;
        $bestattempt = null;
        // Loop over all attempts of this user and find the one with the highest score among the completed attempts.
        foreach ($attempts as $attempt) {
            if (!$attempt || !property_exists($attempt, 'status') || $attempt->status !== 'completed') {
                continue;
            }
            if ($maxscore === null || $maxscore < $attempt->score_raw) {
                $bestattempt = $attempt;
                $maxscore = $attempt->score_raw;
            }
        }
        // If there are completed attempts push the best of them into the attempt array.
        if ($bestattempt) {
            $this->attempts[$userid] = $bestattempt;
        }
    }

    /*
     * Writes the provided value to a number of keys in an associative array, creating non-existent sub-arrays on the way.
     * If operation is set to "push" instead of "write", the value will be pushed into an array instead.
     */
    private static function write_to_keychain(&$array, $keychain, $value, $operation = "write") {
        $key = array_shift($keychain);
        if (count($keychain) === 0) {
            if ($operation === "write") {
                $array[$key] = $value;
            } else if ($operation === "push") {
                if (!array_key_exists($key, $array)) {
                    $array[$key] = [];
                }
                $array[$key][] = $value;
            }
            return;
        }
        if (!array_key_exists($key, $array)) {
            $array[$key] = [];
        }
        self::write_to_keychain($array[$key], $keychain, $value, $operation);
    }

}
