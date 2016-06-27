exports.initialize = function (app, settings, utilities) {
    var mongo = require('ringo-mongodb');
    var client = new mongo.MongoClient('localhost', 27017);
    var db = client.getDB('scheduler');
    var tasks = db.getCollection('task');

    exports.tasks = tasks;

    exports.getInputJson = function () {
        var toReturn = {};
        toReturn.Problem = {};
        toReturn.Problem.General = {};
        toReturn.Problem.General.DaysPerWeek = 5;
        toReturn.Problem.General.SlotsPerDay = 8;
        toReturn.Resources = [{TimePreferences: []}];
        var counter = 0;
        tasks.find({type: 'fixed', /* starts + len < now() */}).forEach(function (fixedTask) {
            // starts -> integer
            // from max(start, now()) until start + length:
            // - add hard timepreference for int:
            toReturn.Resources[0].TimePreferences[counter++] = 999;
        });

        toReturn.Activities = [];
        toReturn.Dependencies = [];
        counter = 0;
        var counterDeps = 0;
        tasks.find({type: 'floating', /* starts + len < now() */}).forEach(function (floatingTask) {
            // Due -> integer
            var dueInteger = asdf();

            toReturn.Activities[counter++] = {
                Length: floatingTask.duration,
                id: floatingTask._id,
                TimePreferences: [{
                        Type: "Due",
                        Value: dueInteger
                    }]
            };

            // Dependencies:
            if (floatingTask.dependencies) {
                // Slot when all fixed prerequisites are done.
                // During evalution, care must be taken not to have due < maxFixedPrerequisite.
                var maxFixedPrerequisite = 0;
                floatingTask.dependencies.forEach(function (dependencyId) {
                    var prerequisiteTask = tasks.findOne(new Packages.org.bson.types.ObjectId(dependencyId));
                    // v minulosti neresim (if minulost, skip)
                    if (prerequisiteTask.type === 'fixed') {
                        // Starts + length -> integer
                        // maxFixedPrerequisite poresit
                    } else if (prerequisiteTask.type === 'floating') {
                        toReturn.Dependencies[counterDeps++] = {
                            id: counterDeps.toString(),
                            FirstActivity: dependencyId,
                            SecondActivity: floatingTask._id
                        };
                    }
                });

                toReturn.Activities[counter].TimePreferences[1] = {
                    Type: "CanStart",
                    Value: maxFixedPrerequisite
                };
            }
        });
        console.log(JSON.stringify(toReturn, null, 4));
        return toReturn;
    };

    exports.saveOutputJson = function (outputJson) {
        var solArray = outputJson.sln;
        solArray.forEach(function (solutionEl) {
            var task = tasks.findOne(new Packages.org.bson.types.ObjectId(solutionEl.id));
            task.starts = utilities.slotToTime(solutionEl.s);
            tasks.save(task);
        });
    };
    
    exports.generateClientJson = function() {
        var toReturn = {tasks : []};
        var counter = 0;
        tasks.find().forEach(function (task) {
            toReturn.tasks[counter++] = task;
        });

        toReturn.Activities = [];
        toReturn.Dependencies = [];
        counter = 0;
        var counterDeps = 0;
        tasks.find({type: 'floating', /* starts + len < now() */}).forEach(function (floatingTask) {
            // Due -> integer
            var dueInteger = asdf();

            toReturn.Activities[counter++] = {
                Length: floatingTask.duration,
                id: floatingTask._id,
                TimePreferences: [{
                        Type: "Due",
                        Value: dueInteger
                    }]
            };

            // Dependencies:
            if (floatingTask.dependencies) {
                // Slot when all fixed prerequisites are done.
                // During evalution, care must be taken not to have due < maxFixedPrerequisite.
                var maxFixedPrerequisite = 0;
                floatingTask.dependencies.forEach(function (dependencyId) {
                    var prerequisiteTask = tasks.findOne(new Packages.org.bson.types.ObjectId(dependencyId));
                    // v minulosti neresim (if minulost, skip)
                    if (prerequisiteTask.type === 'fixed') {
                        // Starts + length -> integer
                        // maxFixedPrerequisite poresit
                    } else if (prerequisiteTask.type === 'floating') {
                        toReturn.Dependencies[counterDeps++] = {
                            id: counterDeps.toString(),
                            FirstActivity: dependencyId,
                            SecondActivity: floatingTask._id
                        };
                    }
                });

                toReturn.Activities[counter].TimePreferences[1] = {
                    Type: "CanStart",
                    Value: maxFixedPrerequisite
                };
            }
        });
        console.log(JSON.stringify(toReturn, null, 4));
        return toReturn;
    };
};