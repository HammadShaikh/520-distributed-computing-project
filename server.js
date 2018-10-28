const path = require('path');
const publicPath = path.join(__dirname, '/public');
const express = require('express');
let app = express();
app.use(express.static(publicPath));
let WebSocketServer = require('websocket').server;
let http = require('http');

let server = http.createServer(app);
const port = process.env.PORT || 3000;

server.listen(port, function() {
    console.log((new Date()) + ` Server is listening on port ${port}`);
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