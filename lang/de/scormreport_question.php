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
 * Strings for component 'scormreport_question', language 'de'
 *
 * @package   scormreport_question
 * @copyright 2021 onwards Robin Tschudi
 * @license   http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

$string['pluginname'] = "Einzelfragenauswertung";
$string['report_scorm'] = "SCORM Auswertung";
$string['report'] = "Auswertung";
$string['report_for'] = "Auswertung für ";
$string['average'] = "Durchschnitt";
$string['best'] = "Bester Schnitt";
$string['worst'] = "Schlechtester Schnitt";
$string['question'] = "Frage";
$string['answers'] = "Antworten";
$string['averagescore'] = "Durschnittliche Punktzahl";
$string['passing'] = "Momentane Bestehensquote";
$string['edit'] = "Bestehensgrenzen anpassen";
$string['passinggrade'] = "Bestehensgrenze";
$string['norawscore'] = "Ihr SCORM Paket hat keine Punkte gestpeichert, entweder sind noch keine Antworten vorhanden oder sie müssen ihr SCORM Paket konfigurieren um score_raw zu unterstützen".
$string['notice_unanswered_questions_scorm'] = "SCORM gibt nur informationen zu Antworten auf Fragen an Moodle weiter, \
insbesondere gibt SCORM keine Informationen über noch nicht beantwortete Fragen weiter. <br>" .
                                                "Daher können einzelne Fragen in der unteren Übersicht fehlen, falls diese noch nicht von Studenten beantwortet wurden.";
$string['notice_not_submitted_answers_scorm'] = "Bei Fragen mit festen Antwortmöglichkeiten gibt SCORM nur diejenigen Optionen an Moodle weiter die entweder von mindestens" .
                                                 " einem Studenten gewählt wurden, oder aber als richtige Antwort eingestellt wurden.<br>" .
                                                 "Antwortsoptionen die diese Kriterien nicht erfüllen, können daher leider nicht visualisiert," .
                                                 " oder in die Auswertung der Frage miteinbezogen werden.";
$string['select_editor'] = "SCORM Editor wählen";
