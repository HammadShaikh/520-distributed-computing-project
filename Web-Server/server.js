//Load in Express
const express = require('express');
//Load in hbs
const hbs = require('hbs');
//To write to file, load filesystem
const fs = require('fs');

//Express app
var app = express();
//Set the view engine to hbs
app.set('view engine', 'hbs');
//Middleware
app.use(express.static(__dirname + '/public'));

//Create middleware that logs time when someone connects to server
app.use((req, res, next) => {
    var now = new Date().toString();
    var log = `${now}: ${req.method} ${req.url}`;
    //To inject variables using ${var} wrap the whole thing is back ticks(`) not single(')/double(") quotes
    console.log(log);
    fs.appendFile('server.log', log + '\n', (err) => {
        if (err) {
            console.log('Unable to append to server.log')
        }
    });
    next();
});
//When the root folder of the server is accessed
app.get('/', (req, res) => {
    res.render('test.hbs', {
        p: 'body text'
    })
});

//Listen on port 3000
app.listen(3000, () => {
    console.log('Server is listening to port 3000');
});