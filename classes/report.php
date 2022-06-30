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
require_once("$CFG->dirroot/mod/scorm/report/heatmap/classes/scormdata_provider.php");

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
        global $OUTPUT, $PAGE;
        $provider = new scormdata_provider($scorm->id);
        $questiondata = $provider->get_sco_questiondata();
        $scoredata = $provider->get_sco_userscores();
        if (count($scoredata) == 0) {
            $average = 0;
            $showdashboard = 0;
        } else {
            $average = number_format(array_sum(array_filter($scoredata)) / count($scoredata), 2);
            $showdashboard = 1;
        }
        $roundedaverage = max(0, min(100, round($average)));
        echo $OUTPUT->render_from_template('scormreport_heatmap/report', ['averagepercentage' => $average, 'roundedaverage' => $roundedaverage, 'showdashboard' => $showdashboard]);
        $PAGE->requires->js_call_amd('scormreport_heatmap/dashboard_passingquota', 'init', array($scoredata));
        $PAGE->requires->js_call_amd('scormreport_heatmap/report_view', 'init', array($questiondata));
    }
}
