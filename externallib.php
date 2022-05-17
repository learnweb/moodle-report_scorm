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
defined('MOODLE_INTERNAL') || die();

require_once("$CFG->libdir/externallib.php");
require_once(__DIR__ . "/report.php");

/**
 * name of the plugin...
 */
const PLUGINNAME = 'scormreport_heatmap';

/**
 * external api for ajax calls
 * @package scormreport_heatmap
 */
class scormreport_heatmap_external extends external_api {

    /**
     * Returns description of method parameters
     * @return external_function_parameters
     */
    public static function fetchmap_parameters() {
        return new external_function_parameters(
            array(
                'scormid' => new external_value(PARAM_INT, 'scormid', VALUE_REQUIRED),
                'numofsections' => new external_value(PARAM_INT, 'knockoutdate', VALUE_REQUIRED),
            )
        );
    }

    /**
     * Returns description of method parameters
     * @return \external_value
     */
    public static function fetchmap_returns() {
        return new \external_value(PARAM_RAW, 'Chart to render');
    }

    /**
     * Returns a chart to display for the user
     * @param $scormid int
     * @param $numofsections int
     * @return string
     * @throws coding_exception
     */
    public static function fetchmap($scormid, $numofsections) {
        global $OUTPUT;
        return $OUTPUT->render(\scormreport_heatmap\report::get_chart($scormid, $numofsections));
    }
}