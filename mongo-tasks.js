exports.initialize = function (app, settings, util) {
    var mongo = require('ringo-mongodb');
    var moment = require('./bower_components/moment/moment.js');
    var client = new mongo.MongoClient('localhost', 27017);
    var db = client.getDB('scheduler');
    var tasks = db.getCollection('task');
    exports.tasks = tasks;

    var getEnd = function (task) {
        // unix time is in seconds
        return task.start + (settings.msGranularity * task.dur * (task.type === 'fixedAllDay' ? (86400000 / settings.msGranularity) : 1) / 1000.);
    };

    exports.getProblemJson = function (btime) {
        util.clog('getProblemJson starts with btime = ' + moment.unix(btime).toString());
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
            var start = fixedTask.data.start;
            var end = getEnd(fixedTask.data);
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
            var scheduleTask = floatingTask.data.start || (floatingTask.data.start > btime) || floatingTask.data.dirty;
            if (scheduleTask) {
                var dueInteger = util.timeToSlot(floatingTask.data.due, btime);

                // Now this task might be due sooner, if there is a fixed dependency on it:
                tasks.find({deps: floatingTask.id, type: {$in: ['fixed', 'fixedAllDay']}}).forEach(function (dependentTask) {
                    dueInteger = Math.min(dueInteger, util.timeToSlot(dependentTask.data.start, btime));
                });

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
                        var preq_end = getEnd(prerequisiteTask.data);
                        if (['fixed', 'fixedAllDay'].indexOf(prerequisiteTask.data.type) > -1) {
                            var fixedPrerequisite = Math.max(0, util.timeToSlot(preq_end, btime));
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
        util.clog('storeSlnData starts with btime = ' + moment.unix(btime).toString() + '.');
        var outputJson = JSON.parse(outputJsonString);
        var solArray = outputJson.solution;
        solArray.forEach(function (solutionEl) {
            var start = util.slotToTime(solutionEl.StartTime, btime);
            tasks.update({_id: new Packages.org.bson.types.ObjectId(solutionEl.id)}, {$set: {start: start.toString(), dirty: false}});
        });
    };

    var constraintsUtilArray = [];
    // For a single task, calculate the amount of time necessary to complete all its dependencies.
    // While not counting durations of tasks that are (already) in constraintsUtilArray and at the same time updating the array.
    var getStartConstraintFromDeps = function (task, btime) {
        util.clog('getStartConstraintFromDeps starts with task = ' + task.title + ', btime = ' + moment.unix(btime) + '.');
        var toReturn = 0;
        task.deps.forEach(function (prerequisiteTaskId) {
            var prerequisiteTask = tasks.findOne(new Packages.org.bson.types.ObjectId(prerequisiteTaskId));
            if ((constraintsUtilArray.indexOf(prerequisiteTaskId) === -1) && getEnd(prerequisiteTask) > btime) {
                constraintsUtilArray.push(prerequisiteTaskId);
                toReturn += (prerequisiteTask.type === 'fixedAllDay' ? (settings.hoursPerDay * prerequisiteTask.dur) : prerequisiteTask.dur) + getStartConstraintFromDeps(prerequisiteTask, btime);
            }
        });
        return toReturn;
    };
    // For a single task, calculate the amount of time (in hours now) necessary to complete:
    // - all its dependencies
    // - all tasks with due date before this task (with dependencies)
    // - all fixed tasks which have to occur before due - dur
    var getStartConstraint = function (task, btime, clear) {
        util.clog('getStartConstraint starts with task = ' + task.title + ', btime = ' + moment.unix(btime) + '.');
        var toReturn = 0;
        if (clear)
            constraintsUtilArray = [];
        tasks.find({due: {$lte: task.due}, type: 'floating'}).forEach(function (taskWithLeqDue) {
            if (constraintsUtilArray.indexOf(taskWithLeqDue.id) === -1)
                toReturn += getStartConstraintFromDeps(taskWithLeqDue.data, btime);
        });
        tasks.find({start: {$lte: task.due}, type: {$in: ['fixed', 'fixedAllDay']}}).forEach(function (taskWithLeqStart) {
            if (constraintsUtilArray.indexOf(taskWithLeqStart.id) === -1)
                toReturn += getStartConstraintFromDeps(taskWithLeqStart.data, btime);
        });
        return toReturn;
    };
    // For a single task, calculate the earliest time when this task must be done to satisfy all dependencies:
    // all dependent fixed tasks
    // all dependent floating tasks
    // all of them with dependencies (through getStartConstraint)
    var getEndConstraint = function (task, btime) {
        util.clog('getEndConstraint starts with task = ' + task.data.title + ', btime = ' + moment.unix(btime) + '.');
        var toReturn = null;
        constraintsUtilArray = [];
        tasks.find({deps: task.id}).forEach(function (dependentTask) {
            util.clog('* getEndConstraint - found dependent task: ' + dependentTask.data.title + '.');
            var startTime = dependentTask.data.type === 'floating' ? dependentTask.data.due - (settings.msGranularity / 1000) : dependentTask.data.start;
            startTime -= getStartConstraint(dependentTask.data, task, false) * (settings.msGranularity / 1000);
            if (!toReturn || (startTime < toReturn))
                toReturn = startTime;
        });
        if (!toReturn)
            toReturn = moment.unix(btime).add(settings.weeks, 'w').unix();
        return toReturn;
    };
    // This function assumes that all tasks are not-dirty, and are correctly stored in the DB.
    exports.recalculateConstraints = function (btime) {
        var toSave = [];
        tasks.find({}).forEach(function (task) {
            if (getEnd(task.data) > btime) {
                var constraint = {
                    start: moment.unix(btime).add(getStartConstraint(task.data, btime, true), 'h').toISOString(),
                    end: getEndConstraint(task, btime)
                };

                if (constraint.end)
                    constraint.end = moment.unix(constraint.end).toISOString();

                task.data.constraint = constraint;

                tasks.update({_id: new Packages.org.bson.types.ObjectId(task.id)}, task.data);
            }
        });
    };
    exports.storeTask = function (task, userId) {
        // TODO validation (timezone - all incoming tasks should be in UTC)
        if (task._id)
            task._id = new Packages.org.bson.types.ObjectId(task._id);
        task.dirty = true;
        task.user = new Packages.org.bson.types.ObjectId(userId);
        tasks.save(task);
    };
    exports.removeTask = function (task_id) {
        // TODO validation (timezone - all incoming tasks should be in UTC)

        tasks.find({deps: task_id}).forEach(function (dependentTask) {
            var index = dependentTask.data.deps.findIndex(function (dep) {
                return dep === task_id;
            });
            dependentTask.data.deps.splice(index, 1);
            tasks.update({_id: new Packages.org.bson.types.ObjectId(dependentTask.id)}, dependentTask.data);
        });

        tasks.remove({_id: new Packages.org.bson.types.ObjectId(task_id)});
    };
    exports.getClientJson = function (userId) {
        var toReturn = "{\"tasks\": [";
        var first_task = true;
        var userIdInMongo = new Packages.org.bson.types.ObjectId(userId);
        tasks.find({user: userIdInMongo}).forEach(function (task) {
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