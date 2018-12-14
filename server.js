const path = require('path');
const publicPath = path.join(__dirname, '/public');
const express = require('express');
const fileUpload = require('express-fileupload');
let app = express();

const WebSocketServer = require('websocket').server;
//const WebSocket = require('ws');
const http = require('http');

let server = http.createServer(app);
const port = process.env.PORT || 3000;
const bodyParser = require('body-parser');

app.use(express.static(publicPath));
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());
app.use(fileUpload());



//MongoDB set up
const mongoose = require('mongoose');

let clients = [];

//mongoose maintains connection with mongodb over time

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/task_queue', {useNewUrlParser: true});

//Set up Collection models for task_queue and clients
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

let Client = mongoose.model('clients', {
    ipAddress: {
        type: String
    },
    status: {
        type: String,
        default: 'unavailable'
    },
    connection: {
        type: String,
        default: 'disconnected'
    },
    listIndex: {
        type: Number
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
        //console.log(input);
    }

    let newTask = new Task({
        problemType: prob,
        data: input
    });
    let id;
    newTask.save().then((document) => {
        console.log('Task added to queue', document);
        func(document.id);
        res.send(`<h1>${document.id}</h1>`);
    }, (err) => {
        res.send(`<h1> Something Went Wrong /h1>`);
        console.log('Unable to add task to queue');
    });
});

app.get('/problem/:probId', function (req, res) {
    //console.log(req.params.probId);

    Task.findOne({_id: req.params.probId}).then((task) => {
       if (!task) {
           return res.send(`<h1>Problem Not Found</h1>`);
       } else {
           res.send(`<h1>${task}</h1>`);
       }
    });
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

    let connection = request.accept('distributed-protocol', request.origin);
    Client.findOne({ipAddress: request.remoteAddress}).then((client) => {
        //If client does not exist in database, add it. else do nothing
       if (client == null) {
           let index = clients.push(connection) - 1;
           let newClient = new Client({
               ipAddress: request.remoteAddress,
               status: 'unavailable',
               connection: 'connected',
               listIndex: index
           });

           newClient.save().then( (document) => {
               console.log('Client added to client database', document);
           }, (err) => {
               console.log('Unable to add client to database');
           });
       }
    });

    console.log((new Date()) + ' Connection from ' + request.remoteAddress +' accepted.');

    //connection.send(JSON.stringify({type: 'monte carlo', data: '100000'}));
    connection.on('message', function(message) {
        console.log(`Received the following message from ${request.remoteAddress}: ${message.utf8Data}`);
        if (message.utf8Data === 'AVAILABLE') {
            Client.findOneAndUpdate({ipAddress: connection.remoteAddress}, {status: 'available'});
        } else if (message.utf8Data === 'UNAVAILABLE') {
            Client.findOneAndUpdate({ipAddress: connection.remoteAddress}, {status: 'unavailable'});
        }
    });

    // function sendMessage(problem, data) {
    //     connection.send(JSON.stringify({type: problem, data: data}));
    // }

    connection.on('close', function(reasonCode, description) {
        //When client disconnects, update its info in the DB
        //Client.findOneAndUpdate({ipAddress: connection.remoteAddress}, {status: 'unavailable', connection: 'disconnected'});
        Client.find({ipAddress: connection.remoteAddress}, (err, doc) => {
            doc.status = 'unavailable';
            doc.connection = 'disconnected';
        });
        console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected.');
    });

});

function func(taskId) {
    Client.find({status: 'available'}).then((client) => {
        if (!client) {
            return console.log('No client available');
        } else {
            if (client.length === 0)
                return console.log('No Clients Available');
            console.log(client.length);

        }
    });
}