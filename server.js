const path = require('path');
const publicPath = path.join(__dirname, '/public');
const express = require('express');
const fileUpload = require('express-fileupload');
let app = express();

const WebSocketServer = require('websocket').server;
const http = require('http');

let server = http.createServer(app);
const port = process.env.PORT || 80;
const bodyParser = require('body-parser');

app.use(express.static(publicPath));
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());
app.use(fileUpload());

//MongoDB set up
const mongoose = require('mongoose');

//mongoose maintains connection with mongodb over time
mongoose.connect('mongodb://localhost:27017/task_queue', {useNewUrlParser: true});

let Task = mongoose.model('task_queue', {
    problemType: {
        type: String
    },
    data: {
        type: String
    },
    completed: {
        type: Boolean,
        default: false
    }
});

//Once a user submits a task to the server
app.post('/problem', function (req, res) {
    //Parse the task to get the problem type and input data
    let prob = req.body.problem;
    let input;
    if (prob === "Merge Sort") {
        let file = req.files.array;
        input = file.data.toString();
        console.log(`problem: ${prob}`);
        console.log(input);
    } else {
        input = req.body.numberOfPoints;
        console.log(input);
    }
    let newTask = new Task({
        problemType: prob,
        data: input
    });

    newTask.save().then((document) => {
        console.log('Task added to queue', document);
    }, (err) => {
        console.log('Unable to add task to queue');
    });
    res.send(`<h1>${prob} Submitted</h1>`);
});

server.listen(port, function() {
    console.log((new Date().toISOString().replace('T', ' ').substr(0, 19)) + ` Server is listening on port ${port}`);
});

/*WebSocketServer will be used to connect with IOS clients*/
let wsServer = new WebSocketServer({
    httpServer: server,
    // You should not use autoAcceptConnections for production
    // applications, as it defeats all standard cross-origin protection
    // facilities built into the protocol and the browser.  You should
    // *always* verify the connection's origin and decide whether or not
    // to accept it.
    autoAcceptConnections: false
});

function originIsAllowed(origin) {
    // put logic here to detect whether the specified origin is allowed.
    return true;
}

wsServer.on('request', function(request) {
    if (!originIsAllowed(request.origin)) {
        // Make sure we only accept requests from an allowed origin
        request.reject();
        console.log((new Date()) + ' Connection from origin ' + request.origin + ' rejected.');
        return;
    }

    let connection = request.accept('echo-protocol', request.origin);
    console.log((new Date()) + ' Connection from ' + request.remoteAddress +' accepted.');
    connection.on('message', function(message) {

    });
    connection.on('close', function(reasonCode, description) {
        console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected.');
    });

});