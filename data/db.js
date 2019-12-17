var Datastore = require('nedb')

db = new Datastore({ filename: './data/store.db', autoload: true });

module.exports = {
	db
}