import {exception as displayException} from 'core/notification';
import Templates from 'core/templates';
import $ from 'jquery';

// Our plugin focusses on the Articulate and ispringx editor of SCORM
// These editors (and many others) prepend their questions with a grouping identifier like SceneX or SlideX.
// This function is grouping the questions by using these identifiers.
const group_questions = (scormdata) => {
    let scormchartdata = {};
    // Iterate over all sco objects of the SCROM packet.
    for (let scoid in scormdata) {
        // Initalize a section for this sco to store data in inside of the scormchartdata array.
        scormchartdata[scoid] = {};
        let scodata = scormdata[scoid].questions;
        let scotitle = scormdata[scoid].title;
        let groups = {};

        // Loop over all Questions in this sco, try to identify their groupname and insert them into that groups data section.
        // The question object also holds an id field that is equal to its name.
        Object.values(scodata).forEach((questiondata) => {
            let id = questiondata.id;
            try {
                let groupname = id.split('_')[0];
                if (!(groupname in groups)) {
                    groups[groupname] = {'data': [], 'id': groupname};
                }
                groups[groupname].data.push(questiondata);
            } catch (e) {
                // If a question names do not follow the above convention we catch them in a "default" group.
                let groupname = 'default';
                if (!(groupname in groups)) {
                    groups[groupname] = {'data': [], 'id': 'default'};
                }
                groups[groupname].data.push(questiondata);
            }
        });
        // Shows wrong ident, even tough ident is correct. possibly because of the nested lambdas.
        // @codingStandardsIgnoreStart

        // Now we build some statistics for those groups.
        // We find the average perfomance as well as worst and best performing questions.
        // Best and worst performing questions are currently not used for design choices and therefore not returned.
        for (let key in groups) {
            let best = 0;
            let worst = 1;
            let sum = 0;
            let answersum = 0;
            for (let question of groups[key].data) {
                let percentage = question.correct_answers / question.total_answers;
                if (percentage > best) {
                    best = percentage;
                }
                if (percentage < worst) {
                    worst = percentage;
                }
                answersum += question.total_answers;
                sum += percentage;
            }
            let average = sum / groups[key].data.length;
            groups[key].statistics = {
                answers: answersum,
                average: average
            };
        }
        // Finally we push the gathered data into the scormchartdata object.
        scormchartdata[scoid].groups = groups;
        scormchartdata[scoid].title = scotitle;
    }
    // @codingStandardsIgnoreEnd
    return scormchartdata;
};

// Renders a table that displays answers given by students individually.
const add_single_question_unscored_default = (questiondata, appendidentifier, editor) => {
    let questiontext = get_title_for_editor[editor](questiondata);
    let context = {
        title: questiontext,
        id_prefix: `unscored_table_switch_${questiondata.id}`,
        answers: questiondata.total_answers,
        identlevel: 1
    };
    Templates.renderForPromise('scormreport_question/collapsible_topic', context).then(({html, js}) => {
        Templates.appendNodeContents(appendidentifier, html, js);
        let context = {
            'lines': questiondata.learner_responses,
            'id': questiondata.id,
        };
        Templates.renderForPromise('scormreport_question/unscored_default_table', context).then(({html}) => {
            // Create new table of all resposes for some reason appendNodeContents does not work here.
            $(`#unscored_table_switch_${questiondata.id}_hiddencontent`).html(html);
            return true;
        }).catch(ex => displayException(ex));
        return true;
    }).catch(ex => displayException(ex));
};

// Renders a bar diagramm to show the distribution of numerical answers to a non-scored question.
const add_single_question_plotly_unscored_numeric = (questiondata, appendidentifier, editor) => {
    let questiontext = get_title_for_editor[editor](questiondata);
    let countscores = {};
    for (let scorearray of questiondata.learner_responses) {
        for (let score of scorearray) {
            score = parseFloat(score);
            if (!(score in countscores)) {
                countscores[score] = 0;
            }
            countscores[score] = countscores[score] + 1;
        }
    }
    let scorelevels = Object.keys(countscores);
    let scoremax = Math.max(...scorelevels);
    let scoremin = Math.min(...scorelevels);
    let x = [];
    let y = [];
    for (let i = scoremin; i <= scoremax; i++) {
        x.push(i);
        y.push(i in scorelevels ? countscores[i] : 0);
    }
    let data = [{
        x: x,
        y: y,
        type: 'bar'
    }];
    let context = {'id': questiondata.id, title: questiontext, answers: questiondata.total_answers};
    Templates.renderForPromise('scormreport_question/plotlysection', context).then(({html, js}) => { // Ceate new plotly wrapper.
        Templates.appendNodeContents(appendidentifier, html, js); // Append it to the current toggleable scene.
        window.Plotly.newPlot('scormreport_question_section_' + questiondata.id, data); // Add plotly graph.
        return true;
    }).catch(ex => displayException(ex));
};

// Renders a plotly violin plot for a scored question to represent the distribution of Student scores.
// Students are scored on a scale from 0 to 100 points to represent the corectness of their answer.
const add_single_question_plotly_scored_violin = (questiondata, appendidentifier, editor) => {
    let questiontext = get_title_for_editor[editor](questiondata);
    let singletrace = {
        y0: " ", // This is the label for an individual violin plot. Since we only display one per question we dont need a title.
        x: questiondata.percentages,

        span: [0, 1], // Manually crops anything above 100% and below 0%.
        spanmode: "manual", // Required for above definition to take effect.
        meanline: {
            "visible": true
        },
        points: 'all',
        pointpos: 0,
        box: {
            'visible': true
        },
        jitter: 0,
        scalemode: "count",
        type: "violin",
        orientation: "h" // Makes it horizontal
    };
    let layout = {
        yaxis: {
            zeroline: false,
        },
        xaxis: {
            range: [0, 1],
            tickformat: ',.0%' // Telling plotly to format the x axis as percentage.
        },
        violinmode: "overlay",
    };
    let context = {'id': questiondata.id, title: questiontext, answers: questiondata.total_answers};
    Templates.renderForPromise('scormreport_question/plotlysection', context).then(({html, js}) => { // Ceate new plotly wrapper.
        Templates.appendNodeContents(appendidentifier, html, js); // Append it to the current toggleable scene.
        window.Plotly.newPlot('scormreport_question_section_' + questiondata.id, [singletrace], layout); // Add plotly graph.
        return true;
    }).catch(ex => displayException(ex));
};

// Renders a circle for a boolean scored question that was either 100% correct or 100% false for all students.
// The circle represents the amount of students that got it right vs the total amount.
const add_single_question_boolean = (questiondata, appendidentifier, editor) => {
    let questiontext = get_title_for_editor[editor](questiondata);

    let correct = questiondata.correct_answers;
    let total = questiondata.total_answers;
    let percentage = correct * 100 / total;
    let displaypercentage = Math.max(Math.min(100, Math.round(percentage)), 0);
    let context = {
        'id': questiondata.id,
        'title': questiontext,
        'answers': questiondata.total_answers,
        'percentage': displaypercentage,
        'correct': correct,
        'total': total
    };
    Templates.renderForPromise('scormreport_question/scored_binary_section', context).then(
        ({html, js}) => {
            Templates.appendNodeContents(appendidentifier, html, js);
            return true;
    }).catch(ex => displayException(ex));
};

// This function gets passed a question and the idprefix of a collapsible topic where that questions data should be visualized.
const add_question = (questiondata, idprefix, editor) => {
    let onlyboolvals = false;
    if (questiondata.displaytype === "manual_scored" && questiondata.percentages.length > 0) {
        onlyboolvals = true;
        for (let percentage of questiondata.percentages) {
            if (percentage !== 0 && percentage !== 1) {
                onlyboolvals = false;
                break;
            }
        }
    }
    // The appendidentifier is the jquery selector used to append the questions visualization to.
    let appendidentifier = `#${idprefix}_hiddencontent`;
    // We differentiate between four types of questions.
    // Questions that are scored can either be:.
    if (questiondata.displaytype === "result_scored" || onlyboolvals) {
        // ... result based. This means the question is either answered right or wrong.
        // As such visualization is based on the percentage of correct students.
        add_single_question_boolean(questiondata, appendidentifier, editor);
    } else if (questiondata.displaytype === "manual_scored") {
        // ... manually scored. This means that students answers lie on a spectrum that determines their "correctness"
        // To visualize this students answers are aggreagted in a violin plot.
        add_single_question_plotly_scored_violin(questiondata, appendidentifier, editor);
    } else if (questiondata.displaytype === "numeric_unscored") {
        // Or Questions can be unscored.
        // If the Question has only numeric answers we visualize their distribution in a Bar chart instead of a violin chart
        // ...this is possible because these answers usually dont vary alot and are all integers unlike percentages.
        add_single_question_plotly_unscored_numeric(questiondata, appendidentifier, editor);
    } else if (questiondata.displaytype === "default_unscored") {
        // If the question is not scored and not numeric it's most likely a free-text answer.
        // In that case we just display all the students answers.
        add_single_question_unscored_default(questiondata, appendidentifier, editor);
    }
};

// @codingStandardsIgnoreStart
/* eslint-disable */
// coding standards recognize regex as mathematical operands.
// Also expects whitespace before/after optional chaining operand ? which is semantically incorrect.

// This function trys to predict what editor was used to create the SCROM packet.
const predict_editor = (scormdata) => {
    for (let sco of Object.values(scormdata)) {
        for (let question of Object.values(sco.questions)) {
            if (question.description !== "") {
                // The articulate editor typically puts the questions text in the description.
                return "articulate";
            } else if (question.id.match(/Slide\d+_Q_[^_]*_(?:\d*_)?_?((?<!__).*)/)?.length || 0 > 1) {
                // The ispringz editor puts the Questionname in the id of the question and follows a very specific format.
                return "ispringz";
            }
        }
    }
    return "default";
};

// Callback map to get a title for a set editor.
// The x?.y || z syntax returns x.y if it exists and isn't falsy otherwise it returns z
// The ?. can be chained in that case none of them shall be falsy to return x.y
const get_title_for_editor = {
    'articulate': (questiondata) => questiondata.description !== "" ? questiondata.description.trim() : questiondata.id,
    'ispringz': ((questiondata) => questiondata.id.match(/Slide\d+_Q_[^_]*_(?:\d*_)?_?((?<!__).*)/)?.[1]?.replaceAll('_', ' ')
        || get_title_for_editor['default'](questiondata)),
    'default': (questiondata) => questiondata.id
};
/* eslint-enable */
// @codingStandardsIgnoreEnd

const init_editor_choser = (scormdata, predicted_editor) => {
    // Change the dropdown to have the predicted editor selected.
    $('#scormreport_question_choose_editor').val(predicted_editor);
    // Define onchange callback for the editor selection dropdown.
    $('#scormreport_question_choose_editor').change(() => {
        let editor = $('#scormreport_question_choose_editor').val().toLowerCase();
        if (!(editor in get_title_for_editor)) {
            editor = "default";
        }
        for (let sco of Object.values(scormdata)) {
            for (let question of Object.values(sco.questions)) {
                // Set new title for questionsections (plotly and circle).
                $(`#scormreport_question_sectionwrapper_${question.id} > div > h2`).text(get_title_for_editor[editor](question));
                // @codingStandardsIgnoreStart Coding standards doesn't like = without whitespaces.
                // Also change the title for tables. (unscored non-numeric questions)
                $(`label[for=unscored_table_switch_${question.id}_switch]`).text(get_title_for_editor[editor](question));
                // @codingStandardsIgnoreEnd
            }
        }
        return 0;
    });
};

export const init = (questiondata) => {

    // Group the questiondata into sections.
    // This is done in js over php to allow for a future setting that specifies the used editor.
    let sections = group_questions(questiondata);

    // Predict what editor we are using.
    let editor = predict_editor(questiondata);

    // The below if / else sections are very similar.
    // The first is used when there is only one SCO in the SCORM. This is the case most of the time.
    // The else part basically wraps the one-SCO version into one additional collapsible section per sco.
    if (Object.keys(sections).length === 1) {
        sections = sections[Object.keys(sections)[0]];
        // Fetch sections from the sectionobject.
        for (let section in sections.groups) {
            // Append a collapsible section with statistical information about the students' performance in this section.
            let sectiondata = sections.groups[section];
            let idprefix = `scormreport_question_${section}`;
            let context = {
                'id_prefix': idprefix,
                'title': section,
                'answers': sectiondata.statistics.answers,
                'average': (sectiondata.statistics.average * 100).toFixed(2),
            };
            Templates.renderForPromise('scormreport_question/collapsible_topic', context)
                .then(({html, js}) => {
                    Templates.appendNodeContents('#scormreport_question_container', html, js);
                    for (let questiondata of sectiondata.data) {
                        // Add the questiongraphs/visaulizers to the collapsible section.
                        add_question(questiondata, idprefix, editor);
                    }
                    return true;
                })
                .catch(ex => displayException(ex));

        }
    } else {
        for (let scoid of Object.keys(sections)) {
            let scodata = sections[scoid];
            let context = {
                'id_prefix': `scormreport_question_scosection${scoid}`,
                'title': `${scodata.title}`,
            };
            Templates.renderForPromise('scormreport_question/collapsible_topic', context)
                .then(({html, js}) => {
                    Templates.appendNodeContents('#scormreport_question_container', html, js);
                    for (let section in scodata.groups) {
                        let sectiondata = scodata.groups[section];
                        let idprefix = `scormreport_question_${section}`;
                        let context = {
                            'id_prefix': idprefix,
                            'title': section,
                            'answers': sectiondata.statistics.answers,
                            'average': (sectiondata.statistics.average * 100).toFixed(2),
                        };
                        Templates.renderForPromise('scormreport_question/collapsible_topic', context)
                            .then(({html, js}) => {
                                Templates.appendNodeContents(`#scormreport_question_scosection${scoid}_hiddencontent`, html, js);
                                for (let questiondata of sectiondata.data) {
                                    add_question(questiondata, idprefix, editor);
                                }
                                return true;
                            }).catch(ex => displayException(ex));

                    }
                }).catch(ex => displayException(ex));
        }
    }
    init_editor_choser(questiondata, editor);
};