var Datastore = require('nedb')

class Database {
	constructor() {
		this.db = new Datastore({ filename: '../data/database/store.db', autoload: true });
	}

	findById(id) {
		return new Promise((resolve, reject) => {
			this.db.findOne({ _id: id }, (err, doc) => {
				if (err) {
					reject(err)
				} else {
					resolve(doc)
				}
			})

		})
	}

	findAll() {
		return new Promise((resolve, reject) => {
			this.db.find({}, (err, docs) => {
				if (err) {
					reject(err)
				} else {
					resolve(docs)
				}
			})

		})
	}

	findByEmail(email) {
		return new Promise((resolve, reject) => {
			this.db.findOne({ email: email }, (err, doc) => {
				if (err) {
					reject(err)
				} else {
					resolve(doc)
				}
			})

		})
	}

	insertUser(user) {
		return new Promise((resolve, reject) => {
			this.db.insert(doc, (err, savedDoc) => {
				if (err) {
					reject(err)
				} else {
					resolve(savedDoc)
				}
			})

		})

	}

	updateUserById(id, update) {
		return new Promise((resolve, reject) => {
			this.db.update({ _id: id }, update, { returnUpdatedDocs: true }, function (affectedDocument) {
				resolve(affectedDocument)
			})
		})
	}

	removeAll() {
		return new Promise((resolve, reject) => {
			this.db.remove({}, { multi: true }, function (err, numRemoved) {
				err ? reject(err) : resolve(numRemoved);

			});
		});
	}
}

module.exports = {
	Database: Database
}