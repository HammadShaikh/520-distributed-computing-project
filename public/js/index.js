$(document).ready(function() {

    let socket = io();

    socket.on('connect', function() {
        console.log("Connected to server.");
    });

    socket.on('newConnection', function(data) {
        //console.log(data);
        console.log('New device connected to server, total # of devices:', data);
    });

    socket.on('disconnect', function() {
        console.log("Disconnected from server.")
    });

    $('#form').on('submit', function (e) {
        e.preventDefault();
        let $problem = $("input[name='problem'][type='radio']:checked");
        if($problem.length > 0) {
            socket.emit('newProblem', {
                name: $problem.val(),
                input: ($problem.val() == "Monte Carlo" ? $('#montecarlo-input').val() : $('#mergesort-input').val())
            });
            console.log("Problem Emitted.", $problem.val());
        }
    });
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
});
