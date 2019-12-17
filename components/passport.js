const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;

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

module.exports = {
	passport
}