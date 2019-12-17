var express = require('express');
var exphbs = require('express-handlebars');
var Datastore = require('nedb')
const uuid = require('uuid/v4')
const session = require('express-session')
const bodyParser = require('body-parser');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcrypt-nodejs');
const dotenv = require('dotenv').config();
const FileStore = require('session-file-store')(session);
const moment = require('moment');
const request = require('request');

if (dotenv.error) {
	throw dotenv.error
}

var app = express();

var steps = [];

db = new Datastore({ filename: './data/database/store.db', autoload: true });

// configure passport.js to use the local strategy
passport.use(new LocalStrategy(
	{ usernameField: 'email' },
	(email, password, done) => {
		console.log('Inside local strategy callback')
		db.find({ email: email }, (err, docs) => {
			if (err || docs.length === 0) {
				console.log(err);
				return done(null, false, { message: "user not found" })
			}

			var user = docs[0]
			console.log(password + " " + user.password);
			
			if (email === user.email && bcrypt.compareSync(password, user.password)) {
				console.log('Local strategy returned true')
				return done(null, user)
			}
			else {
				return done(null, false, { message: "wrong username or password" })
			}

		})

	}
));

// tell passport how to serialize the user
passport.serializeUser((user, done) => {
	done(null, user._id);
});

passport.deserializeUser((id, done) => {
	db.find({ _id: id }, (err, docs) => {
		
		if (err || docs.length === 0) {
			console.log(err);
			done(err, false)
		}
		var user = docs[0]
		user._id === id ? user : false;
		done(null, user)
	})
});

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

app.get('/', function (req, res) {
	console.log('Inside the homepage callback function')
	console.log(req.sessionID)
	res.render('index');
});

app.get('/login', (req, res) => {
	req.isAuthenticated() ? res.redirect('steps/personal') : res.render('login');
})

app.post('/login', (req, res, next) => {
	console.log('Inside POST /login callback')
	passport.authenticate('local', (err, user, info) => {
		if (info) {
			console.log("Info: " + info.message);
		}
		// if (err) { return next(err); }
		if (!user) { return res.redirect('/login'); }
		req.login(user, (err) => {

			if (err) { return next(err); }
			return res.redirect('/steps/personal');
		})
	})(req, res, next);
})

app.get('/logout', (req, res) => {
	if (req.isAuthenticated()) {
		req.session.destroy()
		res.redirect('/');
	} else {
		res.redirect('/login')
	}
})

app.get('/privacy', function (req, res) {
	res.render('privacy');
});

app.get('/steps/personal', (req, res) => {
	if (req.isAuthenticated()) {
		steps = req.user.steps.slice();
		steps.forEach(step => {
			step.date = moment(step.date).format('L')
		});
		res.render('personal', {
			name: req.user.name,
			steps: steps,
		})
	} else {
		res.redirect('/login')
	}
})

app.get('/steps/all', (req, res) => {
	if (req.isAuthenticated()) {
		req.
		res.send('you hit the authentication endpoint\n')
	} else {
		res.redirect('/login')
	}
})

var retrieveSteps = () => {
	const bearer = process.env.BEARER;

	var options = {
		method: 'POST',
		url: 'https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate',
		headers:
		{
			Authorization: 'Bearer ' + bearer,
			'Content-Type': 'application/json'
		},
		body:
		{
			aggregateBy:
				[{
					dataTypeName: 'com.google.step_count.delta',
					dataSourceId: 'derived:com.google.step_count.delta:com.google.android.gms:estimated_steps'
				}],
			bucketByTime: { durationMillis: 86400000 },
			startTimeMillis: 1574006475506,
			endTimeMillis: 1576598475506
		},
		json: true
	};

	request(options, function (error, response, body) {
		if (error) throw new Error(error);

		console.log(body);

		console.log("done");
		
	});
}

var init = () => {

	retrieveSteps();
	db.remove({}, { multi: true }, function (err, numRemoved) {
		console.log("removed: " + numRemoved);
		
	});
	steps = [
		{
			date: new Date().getTime(),
			step: 1000
		},
		{
			date: new Date().setMonth(10).valueOf(),
			step: 2000
		}
	]

	doc = {
		name: 'Felix',
		email: 'test@test.com',
		password: bcrypt.hashSync('password'),
		steps: steps,
	}
	db.insert(doc, (err, savedDoc) => {

		err ? console.log(err) : console.log(savedDoc);
	});
} 

// tell the server what port to listen on
app.listen(process.env.PORT, () => {
	init();
	console.log('Listening on port ' + process.env.PORT)
}); 