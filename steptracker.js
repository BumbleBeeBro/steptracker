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
const { google } = require('googleapis');
require('log-timestamp');

if (dotenv.error) {
	throw dotenv.error
}

const oauth2Client = new google.auth.OAuth2(
	process.env.CLIENT_ID,
	process.env.CLIENT_SECRET,
	process.env.REDIRECT_URL
);

const scopes = [
	'https://www.googleapis.com/auth/fitness.activity.read',
];

const url = oauth2Client.generateAuthUrl({
	// 'online' (default) or 'offline' (gets refresh_token)
	access_type: 'offline',

	// If you only need one scope you can pass it as a string
	scope: scopes
});

// set auth as a global default
google.options({
	auth: oauth2Client
});



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

app.get('/callback', (req, res) => {
	var code = req.query.code
	console.log(code);

	oauth2Client.getToken(code).then((tokens) => {
		console.log(tokens);
		oauth2Client.setCredentials(tokens);
	})
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

app.get('/steps/personal', async (req, res) => {

	await retrieveSteps(req.user);

	db.findOne({_id: req.user._id}, (err, doc) => {
		console.log(doc);
		
	})

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
		res.send('you hit the authentication endpoint\n')
	} else {
		res.redirect('/login')
	}
})

app.get('/oauth/start', (req, res) => {
	//res.render("authorization-start");
	res.redirect(url)
})

app.get('/oauth/redirect', async (req, res) => {
	if (req.isAuthenticated()) {
		const { tokens } = await oauth2Client.getToken(req.query.code)

		console.log(req.user);

		if (tokens.refresh_token) {
			db.update({ _id: req.user._id }, {
				$set: {
					fitTokens: tokens,
					fitExpiresIn: tokens.expiry_date,
				}
			}, {}, function () {
				res.send('you did it!')
			});
		} else {
			db.update({ _id: req.user._id }, {
				$set: {
					fitTokens: tokens,
				}
			}, {}, function () {
				res.send('you did it!')
			});
		}
	} else {
		res.redirect('/login')
	}
})


app.get('/oauth/revoke', (req, res) => {
	oauth2Client.setCredentials(req.user.fitTokens);
	oauth2Client.revokeCredentials(function (err, body) {
		console.log(body);
		
		res.send("Permissions revoked");
	});
})


var retrieveSteps = (user) => {

	let currentDate = new Date();

	currentDate.setHours(0, 0, 0, 0);

	//this morning at 00:00
	var endTimeMillis = currentDate.getTime();

	//last week
	var startTimeMillis = currentDate.setDate(currentDate.getDate() - 7)

	var auth = oauth2Client.setCredentials(user.fitTokens)

	if (user.lastUpdate) {
		var startTimeMillis = user.lastUpdate;
	}

	const fitness = google.fitness({ version: 'v1', auth })

	fitness.users.dataset.aggregate({
		userId: 'me',
		requestBody: {
			aggregateBy:
				[{
					dataTypeName: 'com.google.step_count.delta',
					dataSourceId: 'derived:com.google.step_count.delta:com.google.android.gms:estimated_steps'
				}],
			bucketByTime: { durationMillis: 86400000 },
			startTimeMillis,
			endTimeMillis
		}
	}).then(res => {
		stepsToAdd = [];

		res.data.bucket.forEach((day) => {
			stepsToAdd.push({date: parseInt(day.startTimeMillis), step: day.dataset[0].point[0].value[0].intVal})
		})

		console.log(stepsToAdd);
		

		db.update({ _id: user._id }, {
			$push: {
				steps: { $each: stepsToAdd }
			}, $set: {lastUpdate: endTimeMillis}
		}, {}, function () {
		});
	})
}

var init = () => {

	db.remove({}, { multi: true }, function (err, numRemoved) {
		console.log("removed: " + numRemoved);

	});

	doc = {
		name: 'Felix',
		username: 'BumbleBeeBro',
		email: 'test@test.com',
		password: bcrypt.hashSync('password'),
		fitTokens: null,
		refresh: null,
		lastUpdate: null,
		steps:  [],
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