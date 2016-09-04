exports.initialize = function () {
    var mongo = require('ringo-mongodb');
    var client = new mongo.MongoClient('localhost', 27017);
    exports.db = client.getDB('schedulogy');
};