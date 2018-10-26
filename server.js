const path = require('path');   //Load in Path
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