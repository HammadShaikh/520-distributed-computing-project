/*const path = require('path');   //Load in Path
const publicPath = path.join(__dirname, '/public'); //Have relative a path
const http = require('http');

const express = require('express'); //Load in Express

//Socket IO library
let socketIO = new require('socket.io');

//Configure the server to run on port provided by heroku or, if doesnt exist, use 3000
const port = process.env.PORT || 3000;

let app = express();    //Express app, web framework

let server = http.createServer(app);
let io = socketIO(server);

app.use(express.static(publicPath));

let numdevices = 0;
//When a client connects
io.on('connection', (socket) => {
    numdevices++;
    let now = new Date().toString();
    let log = `${now}: User Connected`;
    console.log(log);
    io.emit('newConnection', {
       number: numdevices.toString()
    });
    socket.on('newProblem', (problem) => {
        console.log("New Problem Received: ", problem);
    });
    socket.on('disconnect', () => {
        numdevices--;
        let now = new Date().toString();
        let log = `${now}: User Disconnected`;
        console.log(log);
    });
});

//Listen on a port
server.listen(port, () => {
    console.log(`Server is listening to port ${port}`);
});
*/
let WebSocketServer = require('websocket').server;
let http = require('http');

let server = http.createServer(function(request, response) {
    console.log((new Date()) + ' Received request for ' + request.url);
    response.writeHead(404);
    response.end();
});
const port = process.env.PORT || 3000;

server.listen(port, function() {
    console.log((new Date()) + `Server is listening on port ${port}`);
});

wsServer = new WebSocketServer({
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
    console.log((new Date()) + ' Connection accepted.');
    connection.on('message', function(message) {
        if (message.type === 'utf8') {
            console.log('Received Message: ' + message.utf8Data);
            connection.sendUTF(message.utf8Data);
        }
        else if (message.type === 'binary') {
            console.log('Received Binary Message of ' + message.binaryData.length + ' bytes');
            connection.sendBytes(message.binaryData);
        }
    });
    connection.on('close', function(reasonCode, description) {
        console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected.');
    });
});