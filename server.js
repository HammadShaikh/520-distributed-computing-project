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
let index;
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
    dataSize: {
        type: Number
    },
    status: {   //incomplete, in progress, complete
        type: String,
        default: 'incomplete'
    },
    startTime: {
        type: Number,
        default: null
    },
    endTime: {
        type: Number,
        default: null
    },
    pointsGenerated: {
        type: Number,
        default: 0
    },
    nodes: {
        type: Number,
        default: 0
    },
    mcSolution: {
        type: Number,
        default: null
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
    },
    workingOn: {
        type: String,
        default: null
    },
    probId: {
        type: String,
        default: null
    }
});


//Once a user submits a task to the server
app.post('/problem', function (req, res) {
    //Parse the task to get the problem type and input data
    let prob = req.body.problem;
    let input;
    let size;

    if (prob === "Merge Sort") {
        let file = req.files.array;
        input = file.data.toString();
        size = input.split(",").map((val) => {return Number(val);}).length;
    } else {
        input = req.body.numberOfPoints.toString();
        console.log(input);
    }

    let newTask = new Task({
        problemType: prob,
        data: input,
        dataSize: (prob === 'Merge Sort' ? size : null)    //If merge sort, then store size of array, otherwise its useless
    });

    newTask.save().then((document) => {
        console.log('Task added to queue', document);


        res.send(`<h1>Problem Submitted, <a href="https://safe-castle-90261.herokuapp.com/problem/${document.id}">Click Here</a> To Check Progress.</h1>`);


    }, (err) => {
        res.send(`<h1> Something Went Wrong </h1>`);
        console.log('Unable to add task to queue');
    });

});

app.get('/problem/:probId', function (req, res) {
    //console.log(req.params.probId);

    Task.findOne({_id: req.params.probId}).then((task) => {
       if (!task) {
           return res.send(`<h1>Problem Not Found</h1>`);
       } else {
           if (task.status === 'complete') {
               res.send(`<h1>Monte Carlo Solution: ${task.mcSolution}</h1><h4>Time Allotted: ${task.endTime - task.startTime} milliseconds</h4>`);
           } else if (task.status === 'in progress') {
               res.send(`<h1>Waiting on ${task.nodes} node(s) to return results. Please refresh the page in a moment.</h1>`);
           } else {
               res.send(`<h1>Problem Still In Queue, Waiting For Clients to become Available.</h1>`);
           }

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
        index = clients.push(connection) - 1;
        //If client does not exist in database, add it. else do nothing
       if (client == null) {

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
       } else {
           Client.updateOne({ipAddress: request.remoteAddress}, {connection : 'connected', listIndex: index}, (err, raw) => {
               if (err) {

               }
           });
       }
    });

    console.log((new Date()) + ' Connection from ' + request.remoteAddress +' accepted.');


    //clients[index].send(JSON.stringify({type: 'monte carlo', data: '100000'}));
    connection.on('message', function(message) {

        if (message.utf8Data === 'AVAILABLE') {
            console.log(connection.remoteAddress + ' is now available to receive problems');
            Client.updateOne({ipAddress: request.remoteAddress}, {status : 'available'}, (err, raw) => {
                if (err) {

                }
            });

        } else if (message.utf8Data === 'UNAVAILABLE') {
            console.log(connection.remoteAddress + ' is now unavailable to receive problems');
            Client.updateOne({ipAddress: request.remoteAddress}, {status : 'unavailable'}, (err, raw) => {
                if (err) {

                }
            });
        } else {

            console.log(`Received the following message from ${request.remoteAddress}: ${message.utf8Data}`);
            Client.findOne({ipAddress: request.remoteAddress}).then((client) => {
                if (client.workingOn === 'Monte Carlo') {
                    Task.findOneAndUpdate({_id: client.probId}, {$inc: {nodes: -1, pointsGenerated: Number(message.utf8Data)}}, {new: true}, (err, doc) => {
                        if(err) {return console.log('error updating', err);}
                        //Task.findOne({_id: client.workingOn})

                        if (doc.nodes === 0) {
                            let res = (4*doc.pointsGenerated)/doc.data;
                            Task.updateOne({_id: client.probId}, {mcSolution: res, status: 'complete', endTime: new Date().getTime()}, (err, doc) => {

                            });
                        }
                        console.log('after updating..\n', doc);
                    });
                } else {

                }

            });

            Client.updateOne({ipAddress: request.remoteAddress}, {status : 'available'}, (err, raw) => {
                if (err) {

                }
            });
        }
    });

    connection.on('close', function(reasonCode, description) {
        //When client disconnects, update its info in the DB
        //Client.findOneAndUpdate({ipAddress: connection.remoteAddress}, {status: 'unavailable', connection: 'disconnected'});
        Client.updateOne({ipAddress: request.remoteAddress}, {status : 'unavailable', connection : 'disconnected'}, (err, raw) => {
            if (err) {
                return;
            }
        });
        console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected.');
    });

});

function delegate() {
    console.log('delegating...');
    Task.find({status: 'incomplete'}).then((tasks) => {
        //console.log(tasks);
        if (tasks.length) {
            Client.find({status: 'available'}).then((clnts) => {
                if (!clnts || clnts.length === 0) {
                    return console.log("No Clients Available At The Moment.");
                } else {
                    let partition;
                    let json;
                    let arrayOfPartitions = [[], []]; //Used to store partitions of merge sort, size depends on # of clients available
                    if (tasks[0].problemType === 'Monte Carlo') {
                        let points = Number(tasks[0].data);
                        partition = (clnts.length === 1 ? points : Math.floor(points/clnts.length));
                        json = {
                            problem: 'Monte Carlo',
                            data: String(partition)
                        };
                        //Merge Sort
                    } else {
                        let arr = tasks[0].data.split(",").map((val) => {return Number(val);});
                        if (tasks[0].size % 2 == 0) {
                            let partitionSize = tasks[0].size/clnts.length;
                            let startIndex = 0;
                            let endIndex = partitionSize;
                            for (let i = 0; i < clnts.length; i++) {
                                arrayOfPartitions[i] = arr.slice(startIndex, endIndex);
                                startIndex = endIndex;
                                endIndex += partitionSize;
                            }
                        } else {

                        }
                        json = {
                          problem: 'Merge Sort',
                          data: tasks[0].data
                        };
                    }

                    Task.updateOne({_id: tasks[0]._id}, {status: 'in progress', nodes: clnts.length, startTime: new Date().getTime()}, (err, raw) => {
                        if(err) {}
                    });
                    for (let i = 0; i < clnts.length; i++) {
                        if (tasks[0].problemType === 'Monte Carlo') {
                            console.log(`Sending ${partition} points to ${clnts[i].ipAddress}`);
                            Client.updateOne({ipAddress: clnts[i].ipAddress}, {workingOn : 'Monte Carlo', status: 'unavailable', probId: tasks[0]._id}, (err, doc) => {
                                if (err) {

                                }
                            });
                        } else {
                            console.log(`Sending array partition to ${clnts[i].ipAddress}`);
                            Client.updateOne({ipAddress: clnts[i].ipAddress}, {workingOn : 'Merge Sort', status: 'unavailable', probId: tasks[0]._id}, (err, doc) => {
                                if (err) {

                                }
                            });
                            json.data = arrayOfPartitions[i].toString();

                        }
                        clients[clnts[i].listIndex].send(JSON.stringify(json));
                        console.log('sending ', JSON.stringify(json));
                    }

                }
            });
        } else {
            console.log('No Problems Submitted At The Moment.');
        }
    });
}

setInterval(delegate, 5000);