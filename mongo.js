exports.initialize = function (app, settings, util) {
    var mongo = require('ringo-mongodb');

    var moment = require('./bower_components/moment/moment.js');

    var client = new mongo.MongoClient('localhost', 27017);
    var db = client.getDB('scheduler');
    var tasks = db.getCollection('task');

    exports.tasks = tasks;

    exports.getProblemJson = function (btime) {
        util.clog('getProblemJson starts with btime = ' + btime.toString());
        // First, potentially fix btime
        tasks.find({}).toArray().some(function (task) {
            var start = moment(task.data.starts);
            var end = start.clone().add(settings.msGranularity * task.data.duration, 'ms');
            if ((end > btime) && start <= btime) {
                util.clog('Shifting btime from: ' + btime.toString() + ' to: ' + end);
                btime = end;
                // Return right away, as there can't be more than one task right now.
                // This means that one resource can have just one task at a time
                // ... plus we have only one resource.
                return true;
            }
        });

        var toReturn = {};
        toReturn.Problem = {};
        toReturn.Problem.General = {};
        toReturn.Problem.General.DaysPerWeek = settings.daysPerWeek;
        toReturn.Problem.General.SlotsPerDay = settings.hoursPerDay;
        toReturn.Problem.Resources = [{TimePreferences: []}];
        var counter = 0;
        tasks.find({type: 'fixed'}).forEach(function (fixedTask) {
            util.clog('Fixed task:');
            util.cdir(fixedTask.data, true);

            // Skipping past tasks.
            var start = moment(fixedTask.data.starts);
            var end = start.clone().add(settings.msGranularity * fixedTask.data.duration, 'ms');
            if (end > btime) {
                var leftBound = Math.max(0, util.timeToSlot(start, btime));
                var rightBound = util.timeToSlot(end, btime);
                for (var i = leftBound; i < rightBound; i++) {
                    util.clog('- adding hard resource time: ' + i);
                    toReturn.Problem.Resources[0].TimePreferences[counter++] = {s: i};
                }
            }
        });
        toReturn.Problem.Activities = [];
        toReturn.Problem.Dependencies = [];
        counter = 0;
        var counterDeps = 0;
        tasks.find({type: 'floating'}).forEach(function (floatingTask) {
            util.clog('Floating task:');
            util.cdir(floatingTask.data, true);

            // Skipping past tasks. But not skipping unscheduled tasks.
            var scheduleTask = !floatingTask.data.starts;
            if (!scheduleTask) {
                var start = moment(floatingTask.data.starts);
                if (start > btime)
                    scheduleTask = true;
            }

            if (scheduleTask) {
                var dueInteger = util.timeToSlot(moment(floatingTask.data.due), btime);
                toReturn.Problem.Activities[counter++] = {
                    Length: floatingTask.data.duration,
                    id: floatingTask.id,
                    Name: floatingTask.data.name,
                    TimePreferences: [{
                            Type: "Due",
                            Value: dueInteger
                        }]
                };
                util.clog('- adding activity:');
                util.cdir(toReturn.Problem.Activities[counter - 1], true);

                // Dependencies:
                if (floatingTask.data.dependencies) {
                    // Slot when all fixed prerequisites are done.
                    // During evalution, care must be taken not to have due < maxFixedPrerequisite.
                    var maxFixedPrerequisite = 0;
                    floatingTask.data.dependencies.forEach(function (dependencyId) {
                        var prerequisiteTask = tasks.findOne(new Packages.org.bson.types.ObjectId(dependencyId));

                        util.clog('- dependency:');
                        util.cdir(prerequisiteTask, true);

                        // Skipping past tasks.
                        var preq_start = moment(prerequisiteTask.data.starts);
                        var preq_end = preq_start.clone().add(settings.msGranularity * prerequisiteTask.data.duration, 'ms');
                        if (preq_end > btime) {
                            if (prerequisiteTask.data.type === 'fixed') {
                                var fixedPrerequisite = util.timeToSlot(preq_end, btime);
                                maxFixedPrerequisite = Math.max(maxFixedPrerequisite, fixedPrerequisite);
                            } else if (prerequisiteTask.data.type === 'floating') {
                                toReturn.Problem.Dependencies[counterDeps++] = {
                                    id: counterDeps.toString(),
                                    FirstActivity: dependencyId,
                                    SecondActivity: floatingTask.data._id
                                };
                                util.clog('-- float dependency:');
                                util.cdir(toReturn.Problem.Dependencies[counterDeps - 1], true);
                            }
                        }
                    });

                    if (maxFixedPrerequisite > 0) {
                        toReturn.Problem.Activities[counter - 1].TimePreferences[1] = {
                            Type: "CanStart",
                            Value: maxFixedPrerequisite
                        };

                        util.clog('- fixed deps: ' + maxFixedPrerequisite);
                    }
                }
            }
        });
        util.cdir(toReturn, true);
        return toReturn;
    };

    exports.storeSlnData = function (outputJsonString, btime) {
        var outputJson = JSON.parse(outputJsonString);
        var solArray = outputJson.solution;
        solArray.forEach(function (solutionEl) {
            var starts = util.slotToTime(solutionEl.StartTime, btime);
            console.log(starts);
            tasks.update({_id: new Packages.org.bson.types.ObjectId(solutionEl.id)}, {$set: {starts: starts.toString(), dirty: false}});

        });
    };

    exports.storeTask = function (task) {
        // TODO validation (timezone - all incoming tasks should be in UTC)
        if (task.dependencies) {
            for (var i = 0; i < task.dependencies.length; i++) {
                var dependency = task.dependencies[i];
                task.dependencies[i] = mongo.tasks.findOne(new Packages.org.bson.types.ObjectId(dependency));
            }
        }

        if (task._id)
            task._id = new Packages.org.bson.types.ObjectId(task._id);

        task.dirty = true;
        tasks.save(task);
    };

    exports.getClientJson = function () {
        var toReturn = "{\"tasks\": [";
        var first_task = true;
        tasks.find().forEach(function (task) {
            if (!first_task)
                toReturn += ",";
            else
                first_task = false;

            toReturn += task.toJSON();
        });
        toReturn += "]}";
        util.clog(toReturn);
        return toReturn;
    };
};