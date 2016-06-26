exports.initialize = function (app) {
    var mongo = require('ringo-mongodb');
    var client = new mongo.MongoClient('localhost', 27017);
    var db = client.getDB('scheduler');
    var tasks = db.getCollection('task');
    var taskDependencies = db.getCollection('taskDependencies');

    exports.tasks = tasks;
    exports.taskDependencies = taskDependencies;
    
    var getInputJson = function() {
    };
    
    var saveOutputJson = function() {
    };
};