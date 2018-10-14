//Load in Path
const path = require('path');
//Have relative a path
const publicPath = path.join(__dirname, '../public');
//Load in Express
const express = require('express');
//Load in hbs
const hbs = require('hbs');

//Configure the server to run on port provided by heroku or, if doesnt exist, use 3000
const port = process.env.PORT || 3000;
//Express app
var app = express();
//Set the view engine to hbs
app.set('view engine', 'hbs');
//Middleware
app.use(express.static(publicPath));

//Create middleware that logs time when someone connects to server
app.use((req, res, next) => {
    var now = new Date().toString();
    var log = `${now}: ${req.method} ${req.url}`;
    //To inject variables using ${var} wrap the whole thing is back ticks(`) not single(')/double(") quotes
    console.log(log);
    next();
});
//When the root folder of the server is accessed
app.get('/', (req, res) => {
    res.send('Testing');
});

//Listen on a port
app.listen(port, () => {
    console.log(`Server is listening to port ${port}`);
});