exports.initialize = function (app, settings, util) {
    var mongo = require('ringo-mongodb');

    var moment = require('./bower_components/moment/moment.js');

    var client = new mongo.MongoClient('localhost', 27017);
    var db = client.getDB('scheduler');
    var tasks = db.getCollection('task');

    exports.tasks = tasks;

    exports.getProblemJson = function (btime) {
        util.clog('getProblemJson starts with btime = ' + btime.toString());
        var toReturn = {};
        toReturn.Problem = {};
        toReturn.Problem.General = {};
        toReturn.Problem.General.DaysPerWeek = settings.daysPerWeek;
        toReturn.Problem.General.SlotsPerDay = settings.hoursPerDay;
        toReturn.Problem.Resources = [{TimePreferences: []}];
        var counter = 0;
        tasks.find({type: {$in: ['fixed', 'fixedAllDay']}}).forEach(function (fixedTask) {
            util.clog('Fixed task:');
            util.cdir(fixedTask.data, true);

            // Skipping past tasks.
            var start = moment(fixedTask.data.start);
            var end = start.clone().add(settings.msGranularity * fixedTask.data.dur * (fixedTask.data.type === 'fixedAllDay' ? (86400000 / 36e5) : 1), 'ms');
            if (end > btime) {
                var leftBound = Math.max(1, util.timeToSlot(start, btime));
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
            var scheduleTask = !floatingTask.data.start || floatingTask.data.dirty;
            if (!scheduleTask) {
                var start = moment(floatingTask.data.start);
                if (start > btime)
                    scheduleTask = true;
            }

            if (scheduleTask) {
                var dueInteger = util.timeToSlot(moment(floatingTask.data.due), btime);
                toReturn.Problem.Activities[counter++] = {
                    Length: floatingTask.data.dur,
                    id: floatingTask.id,
                    TimePreferences: [{
                            Type: "Due",
                            Value: dueInteger
                        }]
                };
                util.clog('- adding activity:');
                util.cdir(toReturn.Problem.Activities[counter - 1], true);

                // Dependencies:
                if (floatingTask.data.deps) {
                    // Slot when all fixed prerequisites are done.
                    // During evalution, care must be taken not to have due < maxFixedPrerequisite.
                    var maxFixedPrerequisite = 0;
                    floatingTask.data.deps.forEach(function (dependencyId) {
                        var prerequisiteTask = tasks.findOne(new Packages.org.bson.types.ObjectId(dependencyId));

                        util.clog('- dependency:');
                        util.cdir(prerequisiteTask, true);

                        // Skipping past tasks.
                        var preq_start = moment(prerequisiteTask.data.start);
                        var preq_end = preq_start.clone().add(settings.msGranularity * prerequisiteTask.data.dur * (prerequisiteTask.data.type === 'fixedAllDay' ? (86400000 / 36e5) : 1), 'ms');
                        if (preq_end > btime) {
                            if (prerequisiteTask.data.type === 'fixed') {
                                var fixedPrerequisite = util.timeToSlot(preq_end, btime);
                                maxFixedPrerequisite = Math.max(maxFixedPrerequisite, fixedPrerequisite);
                            } else if (prerequisiteTask.data.type === 'floating') {
                                toReturn.Problem.Dependencies[counterDeps++] = {
                                    id: counterDeps.toString(),
                                    FirstActivity: dependencyId,
                                    SecondActivity: floatingTask.id
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
        util.clog('storeSlnData starts with btime = ' + btime.toString() + '.');
        var outputJson = JSON.parse(outputJsonString);
        var solArray = outputJson.solution;
        solArray.forEach(function (solutionEl) {
            var start = util.slotToTime(solutionEl.StartTime, btime);
            tasks.update({_id: new Packages.org.bson.types.ObjectId(solutionEl.id)}, {$set: {start: start.toString(), dirty: false}});

        });
    };

    exports.storeTask = function (task) {
        // TODO validation (timezone - all incoming tasks should be in UTC)
        if (task._id)
            task._id = new Packages.org.bson.types.ObjectId(task._id);

        task.dirty = true;
        tasks.save(task);
    };

    exports.removeTask = function (task_id) {
        // TODO validation (timezone - all incoming tasks should be in UTC)
        // TODO DEV-22

        tasks.remove({_id: new Packages.org.bson.types.ObjectId(task_id)});
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