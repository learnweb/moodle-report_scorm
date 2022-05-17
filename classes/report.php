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
/**
 * Core Report class of heatmap reporting plugin
 *
 * @package    scormreport_heatmap
 * @copyright  2021 Robin Tschudi
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

namespace scormreport_heatmap;

defined('MOODLE_INTERNAL') || die();
require_once("$CFG->dirroot/mod/scorm/locallib.php");

use context_module;
use core\chart_series;


/**
 * Main class to control the heatmap reporting
 *
 * @package    scormreport_heatmap
 * @copyright  2021 Robin Tschudi
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

class report extends \mod_scorm\report {

    const PLUGINNAME = 'scormreport_heatmap';
    const TOKEN_CORRECT = 'token_correct';
    const TOKEN_FALSE = 'token_false';

    public static function parse_percent_truefalse ($data) {
        return ((int) $data['result'] == 'correct') * 100;
    }

    // Since scorm doesn't tell us all the options we'll have to rely on the students answers.
    public static function parse_percent_choice($data) {
        $response = explode(',', $data['student_response']);
        $options = array();
        foreach ($data['correct_responses'] as $correctresponsestring) {
            $correctresponses = explode(',', $correctresponsestring);
            $totalno = count($correctresponses);
            $correctno = 0;
            foreach ($response as $studentresponse) {
                if (!in_array($studentresponse, $correctresponses)) {
                    $totalno++;
                } else {
                    $correctno++;
                }
            }
            array_push($options, ($correctno * 100 / $totalno));
        }
        return max($options);
    }

    public static function parse_percentage_common($data) {
        return $data['result'] === 'correct' ? 100 : 0;
    }

    public static function parse_data_to_percent($data) {
        $parseddata = array();
        foreach ($data as $uid => $attempt) {
            $parseddata[$uid] = array();
            foreach ($attempt as $key => $questiondata) {
                $type = str_replace('-', '', $questiondata['type']);
                $callbackname = 'parse_percent_' . $type;
                // if (method_exists(self::class, $callbackname)) {
                    $parsed = self::parse_percentage_common($questiondata);
                    $parseddata[$uid][$key] = $parsed;
                // }
            }
        }
        return $parseddata;
    }

    public static function get_average($data) {
        $count = count($data);
        if ($count == 0) {
            return array (0);
        } else {
            $rowcount = count($data[array_keys($data)[0]]);
        }
        $sums = array();
        for ($i = 0; $i < $rowcount; $i++) {
            $sums[] = 0;
        }
        foreach ($data as $datapoint) {
            for ($i = 0; $i < $rowcount; $i++) {
                $sums[$i] = $datapoint[$i] + $sums[$i];
            }
        }
        return array_map(function($x) use ($count) {
            return $x / $count;
        }, $sums);
    }

    public static function get_categories ($data, $numofcategories = 10) {
        $barnumber = count($data[array_keys($data)[0]]);
        $divider = 100 / ($numofcategories - 1);
        $catarray = array();
        for ($i = 0; $i < $numofcategories; $i++) {
            $catarray[] = array();
            for ($j = 0; $j < $barnumber; $j++) {
                $catarray[$i][$j] = 0;

            }
        }
        foreach ($data as $attempt) {
            for ($j = 0; $j < $barnumber; $j++) {
                $section = $attempt[$j] / $divider;
                $catarray[$section][$j]++;
            }
        }
        return array_map(function ($cat) use ($data) {
            return array_map(function ($val) use ($data) {
                return $val * 100 / count($data);
            }, $cat);
        }, $catarray);
    }

    private static function dehex ($num) {
        return str_pad((dechex(max(0, min(256, $num)))), 2, '0', STR_PAD_LEFT);
    }

    public static function get_colors($data) {
        return array_map(function($catarray) {
            return array_map(function($percent) {
                $blue = 128 + (242 - 128) * (100 - $percent) / 100;
                $redgreen = 229 * (100 - $percent) / 100;
                return '#' . self::dehex($redgreen) . self::dehex($redgreen) . self::dehex($blue);
            }, $catarray);
        }, $data);
    }

    public static function get_chart ($scormid, $numofregions) {
        $regionwidth = 100 / $numofregions;
        $rawdata = self::get_data($scormid);
        $attemptsize = count($rawdata);
        $parsedata = self::parse_data_to_percent($rawdata);
        $categorybararray = self::get_categories($parsedata, $numofregions);
        $colorarray = self::get_colors($categorybararray);
        $averagearray = self::get_average($parsedata);
        $numberarray = array();
        for ($i = 0; $i < count($averagearray); $i++) {
            array_push($numberarray, $i);
        }

        $chart = new \core\chart_bar(); // Create a bar chart instance.
        $series1 = new \core\chart_series(get_string('average', self::PLUGINNAME), $averagearray);
        $series1->set_type(\core\chart_series::TYPE_LINE);
        $chart->add_series($series1);
        $barseries = array();
        for ($i = 0; $i < $numofregions; $i++) {
            $barseries[] = new \core\chart_series('', [$regionwidth, $regionwidth, $regionwidth]);
            $barseries[$i]->set_color($colorarray[$i]);
            $chart->add_series($barseries[$i]);
        }
        $chart->set_stacked(true);
        $chart->set_labels(array_map(function ($i) {
            return get_string('question', self::PLUGINNAME) . " " . ($i + 1);
        }, $numberarray));
        $chart->get_yaxis(0, true)->set_max(100);
        $chart->get_yaxis(0, true)->set_stepsize($regionwidth);
        $chart->set_legend_options(['display' => false]);
        return $chart;
    }

    public static function get_all_users ($scormid) {
        global $DB;
        $sql = "SELECT DISTINCT userid FROM {scorm_scoes_track} WHERE scormid = ? ORDER BY userid";
        $useridrecords = $DB->get_records_sql($sql, array($scormid));
        $userids = [];
        foreach ($useridrecords as $useridobject) {
            $userids[] = $useridobject->userid;
        }
        return $userids;
    }

    public static function get_best_attempt_for_user ($scormid, $userid) {
        $attempts = [scorm_get_tracks($scormid, (int) $userid)];
        $maxscore = null;
        $bestattempt = null;
        foreach ($attempts as $attempt) {
            if (!$attempt || !property_exists($attempt, 'status') || $attempt->status !== 'completed') {
                continue;
            }
            if ($maxscore === null || $maxscore < $attempt->score_raw) {
                $bestattempt = $attempt;
                $maxscore = $attempt->score_raw;
            }
        }
        return $bestattempt;
    }

    private static function write_to_keychain(&$array, $keychain, $value, $operation) {
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

    public static function get_user_scores ($scormid) {
        $users = self::get_all_users($scormid);
        $scores = [];
        foreach ($users as $user) {
            $attempt = self::get_best_attempt_for_user($scormid, $user);
            if ($attempt && property_exists($attempt, 'score_raw')) {
                $scores[] = $attempt->score_raw;
            }
        }
        return $scores;
    }

    public static function get_user_interactions ($scormid) {
        $users = self::get_all_users($scormid);
        $questiondata = [];
        foreach ($users as $user) {
            $attempt = self::get_best_attempt_for_user($scormid, $user);
            if (!$attempt) {
                continue;
            }
            $interactiondata = [];
            foreach ($attempt as $key => $value) {
                $matches = [];
                if (preg_match('/cmi\.interactions\.([0-9]*)(.*)/', $key, $matches)) {
                    $key = $matches[1];
                    // This is data for a specific question.
                    if (!array_key_exists($key, $interactiondata)) {
                        $interactiondata[$key] = [];
                    }
                    $keychain = explode('.', $matches[2]);
                    if (count($keychain) <= 1) {
                        continue;
                    }
                    array_shift($keychain);
                    $array = &$interactiondata[$key];
                    $val = $value;
                    $operation = "write";
                    self::write_to_keychain($array, $keychain, $val, $operation);
                }
            }
            $questiondata[$user] = $interactiondata;
        }
        return $questiondata;
    }

    public static function refine_by_result ($data) {
        $refineddata = [
            'percentages' => [],
            'displaytype' => "boolean"
        ];
        foreach ($data['result'] as $result) {
            $refineddata['percentages'][] = ($result == 'correct') ? 1 : 0;
        }
        return $refineddata;
    }

    public static function refine_by_response ($data) {
        $allanswers = [];
        foreach ($data['learner_responses'] as $responses) {
            if ($responses === self::TOKEN_CORRECT || $responses === self::TOKEN_FALSE) {
                continue;
            }
            $allanswers = array_unique(array_merge($allanswers, $responses));
        }
        $refineddata = [
            'percentages' => [],
            'displaytype' => 'spectrum',
        ];
        $correctresponse = $data['correct_response'];
        $allanswers = array_unique(array_merge($correctresponse, $allanswers));
        foreach ($data['learner_responses'] as $responses) {
            if ($responses == self::TOKEN_CORRECT) {
                $percentage = 1;
            } else if ($responses === self::TOKEN_FALSE) {
                $percentage = 0;
            } else {
                $errors = count(array_merge(array_diff($responses, $correctresponse), array_diff($correctresponse, $responses)));
                $percentage = 1 - ((double)$errors / (double)count($allanswers));
            }
            array_push($refineddata['percentages'], $percentage);
        }
        return $refineddata;
    }

    public static function refine_by_question ($userdata) {
        $refineddata = [];
        foreach ($userdata as $userinteractions) {
            foreach ($userinteractions as $interaction) {
                // For some reason SCORM developers decided it was a good idea to append every id with the attempt number.
                // Reference: https://community.articulate.com/discussions/articulate-storyline/question-id-s-and-sequencing
                $id = implode('_', explode('_', $interaction['id'], -2));
                $type = $interaction['type'];
                if (!array_key_exists($id, $refineddata)) {
                    $refineddata[$id] = [
                        'description' => array_key_exists('description', $interaction) ? $interaction['description'] : '',
                        'id' => $id,
                        'type' => $type,
                        'correct_response' => array_key_exists('correct_responses', $interaction) ?
                            explode('[,]', $interaction['correct_responses'][0]['pattern']) :
                            null,
                        'learner_responses' => [],
                        'result' => [],
                        'manual_refine' => false,
                    ];
                }
                if ($refineddata[$id]['description'] === '' && array_key_exists('description', $interaction)) {
                    $refineddata[$id]['description'] = $interaction['description'];
                }
                if (array_key_exists('learner_response', $interaction)) {
                    $learnerresponse = explode('[,]', $interaction['learner_response']);
                    $refineddata[$id]['manual_refine'] = true;
                    array_push($refineddata[$id]['learner_responses'], $learnerresponse);
                } else {
                    $token = $interaction['result'] === "correct" ? self::TOKEN_CORRECT : self::TOKEN_FALSE;
                    array_push($refineddata[$id]['learner_responses'], $token);
                }
                array_push($refineddata[$id]['result'], $interaction['result']);
            }
        }
        return $refineddata;
    }

    public static function insert_percentage_data($data) {
        $chartdata = [];
        foreach ($data as $question) {
            if (array_key_exists('learner_responses', $question) &&
                array_key_exists('correct_response', $question) &&
                $question['learner_responses'] && $question['correct_response'] && $question['manual_refine']) {
                $refineddata = self::refine_by_response($question);
            } else {
                $refineddata = self::refine_by_result($question);
            }
            $refineddata['description'] = $question['description'];
            $refineddata['id'] = $question['id'];
            $refineddata['type'] = $question['type'];
            $refineddata['total'] = count($question['result']);
            $refineddata['correct'] = count(array_filter($question['result'], function($data) {
                return $data === 'correct';
            }));
            $chartdata[] = $refineddata;
        }
        return $chartdata;
    }

    public static function prepare_plotly_data ($data) {
        $plotlydata = [
            'labels' => [],
            'values' => []
        ];
        $x = 0;
        foreach ($data as $question) {
            if ($x > 1) {
                break;
            }
            $x++;
            $name = $question['id'];
            foreach ($question['percentages'] as $percentage) {
                array_push($plotlydata['labels'], $name);
                array_push($plotlydata['values'], $percentage);
            }
        }
        return $plotlydata;
    }

    public static function get_data($scormid) {
        $questiondata = self::get_user_interactions($scormid);
        $refdata = self::refine_by_question($questiondata);
        $percentdata = self::insert_percentage_data($refdata);
        $plotlydata = self::prepare_plotly_data($percentdata);
        return $percentdata;
    }

    /**
     * Displays the full report.
     *
     * @param \stdClass $scorm full SCORM object
     * @param \stdClass $cm - full course_module object
     * @param \stdClass $course - full course object
     * @param string $download - type of download being requested
     * @return void
     */
    public function display($scorm, $cm, $course, $download) {
        global $DB, $OUTPUT, $PAGE;
        /* $sectioncount = optional_param('sectioncount', 10, PARAM_INT);
        $chart = self::get_chart($scorm->id, $sectioncount);
        echo $OUTPUT->render($chart);
        echo $OUTPUT->render_from_template('scormreport_heatmap/precision_slider', array('scormid' => required_param('id', PARAM_INT)));
        $contextmodule = context_module::instance($cm->id);
        */
        // $chart = new \core\chart_bar();
        // echo $OUTPUT->render($chart);
        $userscores = self::get_user_scores($scorm->id);
        $average = number_format(array_sum(array_filter($userscores)) / count($userscores), 2);
        $roundedaverage = max(0, min(100, round($average)));
        echo $OUTPUT->render_from_template('scormreport_heatmap/report', ['averagepercentage' => $average, 'roundedaverage' => $roundedaverage]);
        $refineddata = self::get_data($scorm->id);
        $PAGE->requires->js_call_amd('scormreport_heatmap/report_view', 'init', array($refineddata, $userscores));
    }
}
