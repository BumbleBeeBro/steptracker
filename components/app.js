var express = require('express');
var exphbs = require('express-handlebars');
const session = require('express-session')
const uuid = require('uuid/v4')
const bodyParser = require('body-parser');
const FileStore = require('session-file-store')(session);
var express = require('express');
var exphbs = require('express-handlebars');
const passport = require('./passport');


var app = express();

app.engine('handlebars', exphbs());
app.set('view engine', 'handlebars');

app.use(express.static('public'));

app.use(bodyParser.urlencoded({ extended: false }))

// parse application/json
app.use(bodyParser.json())

// add & configure middleware
app.use(session({
	genid: (req) => {
		console.log('Inside the session middleware')
		console.log(req.sessionID)
		return uuid() // use UUIDs for session IDs
	},
	// store: new Datastore({ filename: './data/sessions.db', autoload: true }),
	store: new FileStore(),
	secret: process.env.APP_SECRET,
	resave: false,
	saveUninitialized: true
}));

app.use(passport.initialize());
app.use(passport.session());

module.exports = {
	app
}