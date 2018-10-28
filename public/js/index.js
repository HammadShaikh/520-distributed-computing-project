$(document).ready(function () {
    "use strict";
    // window.WebSocket = window.WebSocket || window.MozWebSocket;
    //
    // let connection = connectToServer();
    //
    // connection.onopen = function () {
    //     console.log('Connection with server established.');
    //     //connection.send("I have connected to you.");
    // };
    //
    // connection.onclose = function () {
    //     console.log('Disconnected from server.');
    //
    // };
    //
    // connection.onmessage = function (data) {
    //     console.log(data.data);
    // };

    // $('#form').on('submit', function (e) {
    //     e.preventDefault();
    //     let problem = $("input[name='problem'][type='radio']:checked").val();
    //     let data, file, fr;
    //     if (problem === "Monte Carlo")
    //         data = $("#montecarlo-input").val();
    //     else {
    //        data = $("#mergesort-input");
    //        }
    //     //console.log(problem + ": " + data);
    //     if(problem.length > 0) {
    //         let jsonObj = {
    //             name: problem.toString(),
    //             input: data
    //         };
    //         let str = JSON.stringify(jsonObj);
    //         //console.log(str);
    //         connection.send(str);
    //         console.log("Problem Emitted.", str);
    //     }
    // });
    $('#montecarlo').on('click', function() {
        $('#montecarlo-input').removeAttr('disabled');
        $('#mergesort-input').attr('disabled', true);
        $('#btn-submit').removeAttr('disabled');
    });
    $('#mergesort').on('click', function() {
        $('#mergesort-input').removeAttr('disabled');
        $('#montecarlo-input').attr('disabled', true);
        $('#btn-submit').removeAttr('disabled');
    });
    
    // function connectToServer() {
    //     return new WebSocket('ws://localhost:3000', 'echo-protocol');
    // }
});
