import {exception as displayException} from 'core/notification';
import Templates from 'core/templates';
import ModalFactory from 'core/modal_factory';
import Passmodal from 'scormreport_heatmap/modal_passgrade';


const group_by_scene = (vals) => {
    let groups = {};

    vals.forEach((questiondata) => {
        let id = questiondata.id;
        try {
            let key = id.split('_')[0];
            if (!(key in groups)) {
                groups[key] = {'data': [], 'id': key};
            }
            groups[key].data.push(questiondata);
        } catch (e) {
            let key = 'default';
            if (!(key in groups)) {
                groups[key] = {'data': []};
            }
            groups[key].data.push(questiondata);
        }
    });
    // Shows wrong ident, even tough ident is correct.
    // @codingStandardsIgnoreStart
    for (let key in groups) {
        let best = 0;
        let worst = 1;
        let sum = 0;
        let answersum = 0;
        for (let question of groups[key].data) {
            let percentage = question.correct / question.total;
            if (percentage > best) {
                best = percentage;
            }
            if (percentage < worst) {
                worst = percentage;
            }
            answersum += question.total;
            sum += percentage;
        }
        let average = sum / groups[key].data.length;
        groups[key].statistics = {
            answers: answersum,
            average: average
        };
    }
    // @codingStandardsIgnoreEnd
    return groups;
};

const add_single_question_plotly = (questiondata, appendidentifier) => {
    let questiontext = '';
    if ('description' in questiondata) {
        questiontext = questiondata.description.trim() === '' ? questiondata.id : questiondata.description;
    } else {
        questiontext = questiondata.id;
    }
    let singletrace = {
        y0: "   ",
        x: questiondata.percentages,

        span: [0, 1],
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
        orientation: "h"
    };
    let layout = {
        yaxis: {
            zeroline: false,
        },
        violinmode: "overlay",
    };
    let context = {'id': questiondata.id, title: questiontext, answers: questiondata.total};
    Templates.renderForPromise('scormreport_heatmap/plotlysection', context).then(({html, js}) => {
        Templates.appendNodeContents(appendidentifier, html, js);
        window.Plotly.newPlot('scormreport_heatmap_section_' + questiondata.id, [singletrace], layout);
        return true;
    }).catch(ex => displayException(ex));
};

const add_single_question_boolean = (questiondata, appendidentifier) => {
    let questiontext = "";
    if ('description' in questiondata) {
        questiontext = questiondata.description.trim() === '' ? questiondata.id : questiondata.description;
    } else {
        questiontext = questiondata.id;
    }

    let correct = questiondata.correct;
    let total = questiondata.total;
    let percentage = correct * 100 / total;
    let displaypercentage = Math.max(Math.min(100, Math.round(percentage)), 0);
    let context = {
        'id': questiondata.id,
        'title': questiontext,
        'answers': questiondata.total,
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
    if (questiondata.displaytype === "spectrum" && !single_yesno_val) {
        add_single_question_plotly(questiondata, `#${idprefix}_hiddencontent`);
    } else {
        add_single_question_boolean(questiondata, `#${idprefix}_hiddencontent`);
    }
};

const draw_passingquota_for_threshold = (threshold, userscores) => {
    let passing = 0;
    for (let score of userscores) {
        if (score >= threshold) {
            passing++;
        }
    }
    let percentage = passing * 100 / userscores.length;
    percentage = Math.max(0, Math.min(Math.round(percentage), 100));
    let percentagecircle = $('#scormreport_heatmap_passingcontainer > .c100');
    percentagecircle.removeClass((index, classname) => {
        return (classname.match('p[0-9]{1,3}'));
    });
    percentagecircle.addClass(`p${percentage}`);
    let circletext = $('#scormreport_heatmap_passingcontainer > .c100 > .percentagecircledefaulttext');
    // @codingStandardsIgnoreStart
    circletext.text(`${percentage}%`); //eslint-disable-line
    // @codingStandardsIgnoreEnd
};

const init_projected_passings = (userscores) => {
    $('#scormreport_heatmap_settings').click(() => {
        ModalFactory.create({
            'type': Passmodal.TYPE,
        }).then((modal) => {
            modal.savepressedcallback = () => {
                let passtreshold = parseFloat($('#inputpercentage').val());
                if (isNaN(passtreshold)) {
                    return;
                }
                draw_passingquota_for_threshold(passtreshold, userscores);
                modal.hide();
            };
            modal.show();
            return true;
        }).catch(ex => displayException(ex));
    });
    draw_passingquota_for_threshold(50, userscores);
};

export const init = (vals, userscores) => {
    init_projected_passings(userscores);
    let sections = group_by_scene(vals);
    for (let section in sections) {
        let sectiondata = sections[section];
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
                    add_question(questiondata, idprefix);
                }
                return true;
            })
            .catch(ex => displayException(ex));

    }
};

export const oneinallchart = (vals) => {
    let traces = [];
    vals.forEach(function (val) {
        let trace = {
            text: val.id,
            span: [0, 1],
            spanmode: 'manual',
            meanline: {
                visible: true,
            },
            points: 'all',
            pointpos: 0,
            box: {
                visible: true,
            },
            jitter: 0,
            scalemmode: 'count',
            showlegend: true,
            type: 'violin',
            name: val.id,
            y0: val.id,
            x: val.percentages,
            orientation: 'h'
        };
        traces.push(trace);
    });
    var layout = {
        title: "Auswertung SCORM",
        yaxis: {
            zeroline: false,
        },
        violinmode: "overlay",
    };
    var checkExist = setInterval(function() {
        if ($('.chartjs-render-monitor').length) {
            clearInterval(checkExist);
            let height = vals.length * 200;
            // $('.chart-area')[0].setAttribute("style",`height:${height}px`);
            // $('.chart-area')[0].style.height = `${height}px`;
            window.Plotly.newPlot($('.chart-area')[0].id, traces, layout);
            $('.chart-image')[0].remove();
        }
    }, 100);
};

/*
var data = [{
        type: 'violin',
        x: labels,
        y: values,
        span: [0, 1],
        spanmode: 'manual',
        points: 'none',
        legendgroup: 'Yes',
        scalegroup: 'Yes',
        boxpoints: true,
        line: {
            color: 'green',
        },
        meanline: {
            visible: true
        },
        transforms: [{
            type: 'groupby',
            groups: labels,
        }],
        violinmode: 'overlay'
    }];
 */