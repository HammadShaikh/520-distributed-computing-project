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

    problemType: {  //Monte Carlo or Merge Sort
        type: String
    },
    data: {     //A number, or comma-separated values
        type: String
    },
    dataSize: {     //Used with Merge Sort, keeps track of the length of list
        type: Number
    },
    status: {   //incomplete, in progress, complete
        type: String,
        default: 'incomplete'
    },
    startTime: {    //Recorded in milliseconds when distributing task to clients
        type: Number,
        default: null
    },
    endTime: {      //Recording in milliseconds when recieving the final sub-task from client
        type: Number,
        default: null
    },
    pointsGenerated: {  //For Monte Carlo, Keeps a sum of all the inner points generated by clients so far
        type: Number,
        default: 0
    },
    nodes: {    //Keeps track of the number of clients currently working on the task
        type: Number,
        default: 0
    },
    mcSolution: {   //Stores the Monte Carlo solution
        type: Number,
        default: null
    },
    msSolution: {   //Stores the Merge Sort solution
        type: [Number]
    },
    partitionLeft: {    //if client drops connection while working on data, this field will hold that data so that next client and work on it
        type: String,
        default: ""
    }
});

let Client = mongoose.model('clients', {
    ipAddress: {
        type: String
    },
    status: {   //unavailable, available. toggles by client or when it takes in a job
        type: String,
        default: 'unavailable'
    },
    connection: {   //connected, disconnected
        type: String,
        default: 'disconnected'
    },
    listIndex: {    //the index in the array of connection where this corresponding connection obj lies
        type: Number
    },
    workingOn: {    //Current task that it is working on
        type: String,
        default: null
    },
    probId: {   //The ID of the task it is working on
        type: String,
        default: null
    },
    dataDistributed: {  //The actual sub task that it is processing, used to keep
        type: String,
        default: ""
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
    delegate();
});

app.get('/problem/:probId', function (req, res) {
    //console.log(req.params.probId);
    //Checks if the task exists in the DB based on the ID, if so updates the user on it current status
    Task.findOne({_id: req.params.probId}).then((task) => {
       if (!task) {
           return res.send(`<h1>Problem Not Found</h1>`);
       } else {
           let name = task.problemType;
           if (task.status === 'complete') {
               res.send(`<h1>${task.problemType} Solution: ${(name === 'Monte Carlo') ? task.mcSolution : task.msSolution}</h1><h4>Time Allotted: ${task.endTime - task.startTime} milliseconds</h4>`);
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

            //console.log(`Received the following message from ${request.remoteAddress}: ${message.utf8Data}`);
            Client.findOne({ipAddress: request.remoteAddress}).then((client) => {
                if (client.workingOn === 'Monte Carlo') {
                    Task.findOneAndUpdate({_id: client.probId}, {$inc: {nodes: -1, pointsGenerated: Number(message.utf8Data)}}, {new: true}, (err, doc) => {
                        if(err) {return console.log('error updating', err);}

                        if (doc.nodes === 0 && doc.partitionLeft === "") {
                            let res = (4*doc.pointsGenerated)/doc.data;
                            Task.updateOne({_id: client.probId}, {mcSolution: res, status: 'complete', endTime: new Date().getTime()}, (err, doc) => {});
                        }

                    });
                } else {
                    let sortedArray = message.utf8Data.split(",").map((val) => {return Number(val);});
                    Task.findOneAndUpdate({_id: client.probId}, {$inc: {nodes: -1}, $push: {msSolution: sortedArray}}, {new: true}, (err, doc) => {
                        if(err) {return console.log('error updating', err);}

                        if (doc.nodes === 0 && doc.partitionLeft === "") {
                            let finalArray = doc.msSolution.sort((a, b) => {return a-b;});

                            Task.updateOne({_id: doc._id}, {msSolution: finalArray, status: 'complete', endTime: new Date().getTime()}, (err, doc) => {});
                        }
                    });
                }

            });

            Client.updateOne({ipAddress: request.remoteAddress}, {status : 'available', workingOn: "", probId: "", dataDistributed: ""}, (err, raw) => {
                if (err) {

                }
            });
        }
    });

    connection.on('close', function(reasonCode, description) {

        //When client disconnects, If it was working on a task, set the task to incomplete and save the
        Client.findOne({ipAddress: request.remoteAddress}, (err, client) => {
           if (err) {return console.log(`Client ${request.remoteAddress} disconnected, could not locate record in Database.`);}
           console.log('ondisconnect: ', client.workingOn);
           if (client.workingOn === 'Monte Carlo' || client.workingOn === 'Merge Sort') {
                Task.findOne({_id: client.probId}, (err, task) => {
                    if (!err) {

                        let partitionlft = (task.partitionLeft === "" ? Number(task.partitionLeft) + Number(client.dataDistributed) : task.partitionLeft + client.dataDistributed);
                        console.log('Task reset to incomplete, partitionLeft: ', partitionlft);
                        Task.updateOne({_id: task._id}, { partitionLeft: partitionlft, status: 'incomplete', $set : {nodes: 0}}, (err, doc) => {
                            if (err) {console.log('error on disconnect');}
                            console.log('partitionLeft updated, ', doc.status);
                        });
                    }
                });
           }
        });
        Client.updateOne({ipAddress: request.remoteAddress}, {status : 'unavailable', connection : 'disconnected', workingOn: "", dataDistributed: "", probId: ""}, (err, raw) => {
            if (err) {return console.log(`Client ${request.remoteAddress} disconnected, could not locate record in Database.`);}
        });
        console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected.');
    });

});

function delegate() {
    console.log('delegating...');
    Task.find({status: 'incomplete'}).sort({_id: 1}).then((tasks) => {
        console.log(tasks);
        //If incomplete tasks exist
        if (tasks.length) {

            //Check if clients are available to accept tasks
            Client.find({status: 'available'}).then((clnts) => {
                if (!clnts || clnts.length === 0) {
                    return console.log("No Clients Available At The Moment.");
                } else {
                    let partition;  //Used to store partitions of Monte Carlo for each client available
                    let json;   //JSON object to be modified and sent to the clients
                    let arrayOfPartitions = [[], []]; //Used to store partitions of merge sort, size depends on # of clients available

                    //If task happens to be Monte Carlo, figure out the partitions and build JSON Object
                    if (tasks[0].problemType === 'Monte Carlo') {
                        let points = Number((tasks[0].partitionLeft !== "") ? tasks[0].partitionLeft : tasks[0].data);
                        console.log('points: ', points);
                        partition = (clnts.length === 1 ? points : Math.floor(points/clnts.length));
                        json = {
                            problem: 'Monte Carlo',
                            data: String(partition)
                        };

                    } else {
                        //Convert string of numbers into an array of numbers
                        let arr = ((tasks[0].partitionLeft !== "") ? tasks[0].partitionLeft : tasks[0].data).split(",").map((val) => {return Number(val);});
                        console.log('array: ', arr);
                        console.log('Uniformly Distributing Array...');
                        let partitionToEachClient = [];

                        //Uniformly distribute array to each client
                        for (let i = 0; i < clnts.length; i++)
                            partitionToEachClient[i] = tasks[0].dataSize/clnts.length;
                        for (let j = 0; j < tasks[0].dataSize%clnts.length; j++)
                            partitionToEachClient[j]++;

                        let startIndex = 0;
                        let endIndex = 0;
                        for (let k = 0; k < clnts.length; k++) {
                            endIndex += partitionToEachClient[k];
                            arrayOfPartitions[k] = arr.slice(startIndex, endIndex);
                            startIndex = endIndex;
                        }
                    }

                    Task.updateOne({_id: tasks[0]._id}, {status: 'in progress', nodes: clnts.length, startTime: new Date().getTime(), partitionLeft: ""}, (err, raw) => {});
                    for (let i = 0; i < clnts.length; i++) {
                        if (tasks[0].problemType === 'Monte Carlo') {
                            console.log(`Sending ${partition} points to ${clnts[i].ipAddress}`);
                            Client.updateOne({ipAddress: clnts[i].ipAddress}, {workingOn : 'Monte Carlo', status: 'unavailable', probId: tasks[0]._id, dataDistributed: String(partition)}, (err, doc) => {});
                        } else {
                            let strArray = arrayOfPartitions[i].toString();
                            console.log(`Sending an array partition to ${clnts[i].ipAddress}`);
                            Client.updateOne({ipAddress: clnts[i].ipAddress}, {workingOn : 'Merge Sort', status: 'unavailable', probId: tasks[0]._id, dataDistributed: strArray}, (err, doc) => {});
                            json = {
                                problem: "Merge Sort",
                                data: strArray
                            };

                        }
                        clients[clnts[i].listIndex].send(JSON.stringify(json));
                    }

                }
            });
        } else {
            console.log('No Problems Submitted At The Moment.');
        }
    });
}

setInterval(delegate, 5000);