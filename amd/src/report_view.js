import {exception as displayException} from 'core/notification';
import Templates from 'core/templates';



// A popular editor names questions SceneX_SlideY_QUESTIONTYPE.
// Some other editors just group like SlideX_id.
// This function groups questions based on their scene or slide.
const group_by_scene = (scormdata) => {
    let scochartdata = {};
    for (let scoid in scormdata) {
        scochartdata[scoid] = {};
        let scodata = scormdata[scoid].questions;
        let scotitle = scormdata[scoid].title;
        let groups = {};

        // This editor groups sets of questions in scenes, so first we sort the questions into their scenes.
        Object.values(scodata).forEach((questiondata) => {
            let id = questiondata.id;
            try {
                let scenename = id.split('_')[0];
                if (!(scenename in groups)) {
                    groups[scenename] = {'data': [], 'id': scenename};
                }
                groups[scenename].data.push(questiondata);
            } catch (e) {
                // If a question names do not follow the above convention we catch them in a "default" scene.
                let scenename = 'default';
                if (!(scenename in groups)) {
                    groups[scenename] = {'data': [], 'id': 'default'};
                }
                groups[scenename].data.push(questiondata);
            }
        });
        // Shows wrong ident, even tough ident is correct.
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
        scochartdata[scoid].groups = groups;
        scochartdata[scoid].title = scotitle;
    }
    // @codingStandardsIgnoreEnd
    return scochartdata;
};

const add_single_question_unscored_default = (questiondata, appendidentifier) => {
    let questiontext = '';
    // Ideally we would like to display the Question Students answered, however sometimes this is not possible.
    // In that case showing the ID gives more information than showing a blank space.
    if ('description' in questiondata) {
        questiontext = questiondata.description.trim() === '' ? questiondata.id : questiondata.description;
    } else {
        questiontext = questiondata.id;
    }
    let context = {
        'lines': questiondata.learner_responses,
        'title': questiontext,
        'id': questiondata.id,
        'answers': questiondata.total_answers,
    };
    Templates.renderForPromise('scormreport_heatmap/unscored_default_table', context).then(({html, js}) => {
        // Create new table of all resposes
        Templates.appendNodeContents(appendidentifier, html, js); // Append it to the current toggleable scene.
        return true;
    }).catch(ex => displayException(ex));
};


const add_single_question_plotly_unscored_numeric = (questiondata, appendidentifier) => {
    let questiontext = '';
    // Ideally we would like to display the Question Students answered, however sometimes this is not possible.
    // In that case showing the ID gives more information than showing a blank space.
    if ('description' in questiondata) {
        questiontext = questiondata.description.trim() === '' ? questiondata.id : questiondata.description;
    } else {
        questiontext = questiondata.id;
    }
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
    Templates.renderForPromise('scormreport_heatmap/plotlysection', context).then(({html, js}) => { // Ceate new plotly wrapper.
        Templates.appendNodeContents(appendidentifier, html, js); // Append it to the current toggleable scene.
        window.Plotly.newPlot('scormreport_heatmap_section_' + questiondata.id, data); // Add plotly graph.
        return true;
    }).catch(ex => displayException(ex));
};

// This function injects a plotly-plot into the html element with id appendidentifier.
const add_single_question_plotly = (questiondata, appendidentifier) => {
    let questiontext = '';
    // Ideally we would like to display the Question Students answered, however sometimes this is not possible.
    // In that case showing the ID gives more information than showing a blank space.
    if ('description' in questiondata) {
        questiontext = questiondata.description.trim() === '' ? questiondata.id : questiondata.description;
    } else {
        questiontext = questiondata.id;
    }
    let singletrace = {
        y0: " ", // This is the label for an individual violin plot. Since we only display one per question we dont need a title.
        x: questiondata.percentages,

        span: [0, 1], // manually crops anything above 100% and below 0%.
        spanmode: "manual",
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
        orientation: "h" // makes it horizontal
    };
    let layout = {
        yaxis: {
            zeroline: false,
        },
        violinmode: "overlay",
    };
    let context = {'id': questiondata.id, title: questiontext, answers: questiondata.total_answers};
    Templates.renderForPromise('scormreport_heatmap/plotlysection', context).then(({html, js}) => { // Ceate new plotly wrapper.
        Templates.appendNodeContents(appendidentifier, html, js); // Append it to the current toggleable scene.
        window.Plotly.newPlot('scormreport_heatmap_section_' + questiondata.id, [singletrace], layout); // Add plotly graph.
        return true;
    }).catch(ex => displayException(ex));
};

// This function adds a circle with the questiondatas percentage to the appendidentifier.
const add_single_question_boolean = (questiondata, appendidentifier) => {
    let questiontext = "";
    if ('description' in questiondata) {
        questiontext = questiondata.description.trim() === '' ? questiondata.id : questiondata.description;
    } else {
        questiontext = questiondata.id;
    }

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
    Templates.renderForPromise('scormreport_heatmap/plotlysection', context).then(
        ({html, js}) => {
            Templates.appendNodeContents(appendidentifier, html, js);
            return true;
    }).catch(ex => displayException(ex));
};

// This function gets passed a question and the idprefix of a collapsible topic where that questions data should be visualized.
// We differentiate values with binary true/false decisisons and those that lie on a spectrum.
// If the spectrum includes only true and false values (100% and 0%) we treat it as a true/false decisison.
const add_question = (questiondata, idprefix) => {
    if (questiondata.displaytype === "spectrum" && questiondata.percentages.length > 0) {
        let previous = questiondata.percentages[0];
        var single_yesno_val = previous === 1 || previous === 0;
        if (single_yesno_val) {
            for (let percentage of questiondata.percentages) {
                if (previous !== percentage) {
                    single_yesno_val = false;
                    break;
                }
            }
        }
    }
    let appendidentifier = `#${idprefix}_hiddencontent`;
    if (questiondata.displaytype === "manual_scored" && !single_yesno_val) {
        add_single_question_plotly(questiondata, appendidentifier);
    } else if (questiondata.displaytype === "result_scored") {
        add_single_question_boolean(questiondata, appendidentifier);
    } else if (questiondata.displaytype === "numeric_unscored") {
        add_single_question_plotly_unscored_numeric(questiondata, appendidentifier);
    } else if (questiondata.displaytype === "default_unscored") {
        add_single_question_unscored_default(questiondata, appendidentifier);
    }
};



export const init = (questiondata) => {

    // Group the questiondata into sections.
    // This is done in js over php to allow for a future setting that specifies the used editor.
    let sections = group_by_scene(questiondata);

    // The below if / else sections are very similar.
    // The first is used when there is only one SCO in the SCORM. This is the case most of the time.
    // The else part basically wraps the one-SCO version into one additional collapsible sections per sco.
    if (Object.keys(sections).length === 1) {
        sections = sections[Object.keys(sections)[0]];
        // Fetch sections from the sectionobject.
        for (let section in sections.groups) {
            // Append a collapsible section with infos about the section of questions.
            let sectiondata = sections.groups[section];
            let idprefix = `scormreport_heatmap_${section}`;
            let context = {
                'id_prefix': idprefix,
                'title': section,
                'answers': sectiondata.statistics.answers,
                'average': (sectiondata.statistics.average * 100).toFixed(2),
            };
            Templates.renderForPromise('scormreport_heatmap/collapsible_topic', context)
                .then(({html, js}) => {
                    Templates.appendNodeContents('#scormreport_heatmap_container', html, js);
                    for (let questiondata of sectiondata.data) {
                        // Add the questiongraphs/visaulizers to the collapsible section.
                        add_question(questiondata, idprefix);
                    }
                    return true;
                })
                .catch(ex => displayException(ex));

        }
    } else {
        for (let scoid of Object.keys(sections)) {
            let scodata = sections[scoid];
            let context = {
                'id_prefix': `scormreport_heatmap_scosection${scoid}`,
                'title': `${scodata.title}`,
            };
            Templates.renderForPromise('scormreport_heatmap/collapsible_topic', context)
                .then(({html, js}) => {
                    Templates.appendNodeContents('#scormreport_heatmap_container', html, js);
                    for (let section in scodata.groups) {
                        let sectiondata = scodata.groups[section];
                        let idprefix = `scormreport_heatmap_${section}`;
                        let context = {
                            'id_prefix': idprefix,
                            'title': section,
                            'answers': sectiondata.statistics.answers,
                            'average': (sectiondata.statistics.average * 100).toFixed(2),
                        };
                        Templates.renderForPromise('scormreport_heatmap/collapsible_topic', context)
                            .then(({html, js}) => {
                                Templates.appendNodeContents(`#scormreport_heatmap_scosection${scoid}_hiddencontent`, html, js);
                                for (let questiondata of sectiondata.data) {
                                    add_question(questiondata, idprefix);
                                }
                                return true;
                            }).catch(ex => displayException(ex));

                    }
                }).catch(ex => displayException(ex));
        }
    }
};