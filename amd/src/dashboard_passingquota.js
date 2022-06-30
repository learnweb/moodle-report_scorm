import {exception as displayException} from 'core/notification';
import ModalFactory from 'core/modal_factory';
import Passmodal from 'scormreport_heatmap/modal_passgrade';
import $ from 'jquery';

// This function updates the passing percentage circle to reflect the passigquota for a given threshold.
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
    // The percentage is controlled via a css class, first we remove all previous percentages.
    percentagecircle.removeClass((index, classname) => {
        return (classname.match('p[0-9]{1,3}'));
    });
    // Now we add the new css class for the current threshold.
    percentagecircle.addClass(`p${percentage}`);
    let circletext = $('#scormreport_heatmap_passingcontainer > .c100 > .percentagecircledefaulttext');
    // @codingStandardsIgnoreStart
    // And update the text in the circle.
    circletext.text(`${percentage}%`); //eslint-disable-line
    // @codingStandardsIgnoreEnd
};

// This function prepares a modal that is shown when the settings icon next to the passing percentage circle is pressed.
// It also initializes the passing percentage circle to display data for a threshold of 50%.
export const init = (userscores) => {
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
        $('#scormreport_heatmap_settings').click(() => {
            modal.show();
        });
        return true;
    }).catch(ex => displayException(ex));
    draw_passingquota_for_threshold(50, userscores);
};