define(['jquery', 'core/ajax'], function ($, ajax) {

    var init = function (scormid) {
        var params = {
            "scormid": 1,
            "numofsections": 100
        };
        /*ajax.call([
            {methodname: 'scormreport_heatmap_fetchmap', args: params}
        ])[0].done(function (response) {
            window.console.log(response);
        }).fail(function (ex) {
            window.console.log('Getting heatmap failed: ');
            window.console.log(ex);
        });*/
        const xhttp = new XMLHttpRequest();
        xhttp.onload = function () {
            $('#chartwrapper').html(xhttp.responseText);
        };
        xhttp.open('POST', 'report/heatmap/fetchmap.php', true);
        xhttp.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
        xhttp.send('scormid=1&numofsections=100');
    };

    return {
        init: init
    };
});
