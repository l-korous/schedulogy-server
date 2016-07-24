exports.initialize = function (app, settings, util) {
    var mongo = require('ringo-mongodb');
    var moment = require('./bower_components/moment/moment.js');
    var client = new mongo.MongoClient('localhost', 27017);
    var db = client.getDB('schedulogy');
    var tasks = db.getCollection('task');
    exports.tasks = tasks;

    var getEnd = function (task) {
        // unix time is in seconds
        return task.start + (settings.msGranularity * task.dur * (task.type === 'fixedAllDay' ? (86400000 / settings.msGranularity) : 1) / 1000.);
    };

    exports.getProblemJson = function (btime, userId) {
        var userIdInMongo = new Packages.org.bson.types.ObjectId(userId);
        util.clog('getProblemJson starts with btime = ' + moment.unix(btime).toString() + ', user = ' + userId);
        var toReturn = {};
        toReturn.Problem = {};
        toReturn.Problem.General = {};
        toReturn.Problem.General.DaysPerWeek = settings.daysPerWeek;
        toReturn.Problem.General.SlotsPerDay = settings.hoursPerDay;
        toReturn.Problem.Resources = [{TimePreferences: []}];
        var counter = 0;
        tasks.find({user: userIdInMongo, type: {$in: ['fixed', 'fixedAllDay']}}).forEach(function (fixedTask) {
            util.clog('Fixed task:');
            util.cdir(fixedTask.data, true);
            // Skipping past tasks.
            var start = fixedTask.data.start;
            var end = getEnd(fixedTask.data);
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
        tasks.find({user: userIdInMongo, type: 'floating'}).forEach(function (floatingTask) {
            util.clog('Floating task:');
            util.cdir(floatingTask.data, true);
            // Skipping past tasks. But not skipping unscheduled tasks.
            var scheduleTask = (!floatingTask.data.start) || (floatingTask.data.start > btime) || floatingTask.data.dirty;
            if (scheduleTask) {
                var dueInteger = util.timeToSlot(floatingTask.data.due, btime);

                // Now this task might be due sooner, if there is a fixed dependency on it:
                // Fixed tasks being dependent are not supported so far.
                // tasks.find({needs: floatingTask.id, type: {$in: ['fixed', 'fixedAllDay']}}).forEach(function (dependentTask) {
                //     dueInteger = Math.min(dueInteger, util.timeToSlot(dependentTask.data.start, btime));
                // });

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
                if (floatingTask.data.needs) {
                    // Slot when all fixed prerequisites are done.
                    // During evalution, care must be taken not to have due < maxFixedPrerequisite.
                    var maxFixedPrerequisite = 0;
                    floatingTask.data.needs.forEach(function (prerequisiteTaskId) {
                        var prerequisiteTask = tasks.findOne(new Packages.org.bson.types.ObjectId(prerequisiteTaskId));
                        if (!prerequisiteTask) {
                            util.clog('Error: prerequisite not exists: ' + prerequisiteTaskId);
                            return;
                        }
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
                                FirstActivity: prerequisiteTaskId,
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
    exports.storeSlnData = function (outputJsonString, btime, userId) {
        util.clog('storeSlnData starts with btime = ' + moment.unix(btime).toString() + '.');
        var outputJson = JSON.parse(outputJsonString);
        var solArray = outputJson.solution;
        solArray.forEach(function (solutionEl) {
            var start = util.slotToTime(solutionEl.StartTime, btime);
            tasks.update({_id: new Packages.org.bson.types.ObjectId(solutionEl.id)}, {$set: {start: start.toString(), dirty: false}});
        });
        // Also mark all fixed tasks as not-dirty.
        var userIdInMongo = new Packages.org.bson.types.ObjectId(userId);
        tasks.update({user: userIdInMongo, type: {$in: ['fixed', 'fixedAllDay']}}, {$set: {dirty: false}});
    };

    var constraintsUtilArray = [];
    // For a single task, calculate the amount of time necessary to complete all its dependencies.
    // While not counting durations of tasks that are (already) in constraintsUtilArray and at the same time updating the array.
    var getStartConstraintFromDeps = function (task, btime) {
        util.clog('getStartConstraintFromDeps starts with task = ' + task.title + ', btime = ' + moment.unix(btime).toString() + '.');
        var toReturn = 0;
        task.needs && task.needs.forEach(function (prerequisiteTaskId) {
            var prerequisiteTask = tasks.findOne(new Packages.org.bson.types.ObjectId(prerequisiteTaskId));
            if (!prerequisiteTask) {
                util.clog('Error: prerequisite not exists: ' + prerequisiteTaskId);
                return;
            }

            util.clog('* getStartConstraintFromDeps - a prerequisite: ' + prerequisiteTask.data.title + '.');
            if ((constraintsUtilArray.indexOf(prerequisiteTaskId) === -1) && getEnd(prerequisiteTask.data) > btime) {
                constraintsUtilArray.push(prerequisiteTaskId);
                toReturn += (prerequisiteTask.data.type === 'fixedAllDay' ? (settings.hoursPerDay * prerequisiteTask.data.dur) : prerequisiteTask.data.dur) + getStartConstraintFromDeps(prerequisiteTask.data, btime);
                util.clog('* getStartConstraintFromDeps - current toReturn: ' + toReturn + '.');
            }
        });
        return toReturn;
    };
    // For a single task, calculate the amount of time (in hours now) necessary to complete:
    // - all its dependencies
    // - all tasks with due date before this task (with dependencies)
    // - all fixed tasks which have to occur before due - dur
    var getStartConstraint = function (task, taskId, btime, clear) {
        util.clog('getStartConstraint starts with task = ' + task.title + ', btime = ' + moment.unix(btime).toString() + '.');
        var toReturn = 0;
        if (clear)
            constraintsUtilArray = [];
        // This is for the case that task itself is not stored in DB.
        if (!taskId || constraintsUtilArray.indexOf(taskId) === -1) {
            toReturn += getStartConstraintFromDeps(task, btime);
            constraintsUtilArray.push(taskId);
        }

        tasks.find({due: {$lte: task.due}, type: 'floating'}).forEach(function (taskWithLeqDue) {
            if (constraintsUtilArray.indexOf(taskWithLeqDue.id) === -1) {
                toReturn += getStartConstraintFromDeps(taskWithLeqDue.data, btime);
                constraintsUtilArray.push(taskId);
            }
        });
        tasks.find({start: {$lte: task.due}, type: {$in: ['fixed', 'fixedAllDay']}}).forEach(function (taskWithLeqStart) {
            if (constraintsUtilArray.indexOf(taskWithLeqStart.id) === -1) {
                toReturn += getStartConstraintFromDeps(taskWithLeqStart.data, btime);
                constraintsUtilArray.push(taskId);
            }
        });
        if (toReturn > 0)
            return moment.unix(btime).add(toReturn, 'h').toISOString();
        else
            return null;
    };
    // For a single task, calculate the earliest time when this task must be done to satisfy all dependencies:
    // all dependent fixed tasks
    // all dependent floating tasks
    // all of them with dependencies (through getStartConstraint)
    var getEndConstraint = function (task, taskId, btime) {
        util.clog('getEndConstraint starts with task = ' + task.title + ', btime = ' + moment.unix(btime).toString() + '.');
        var toReturn = null;
        constraintsUtilArray = [taskId];
        var dependentTasks = taskId ? tasks.find({needs: taskId}).toArray() : task.blocks;
        dependentTasks.forEach(function (dependentTask) {
            util.clog('* getEndConstraint - found dependent task: ' + dependentTask.data.title + '.');
            var depLatestStartTimestartTime = dependentTask.data.type === 'floating' ? dependentTask.data.due - (settings.msGranularity / 1000) : dependentTask.data.start;
            util.clog('* getEndConstraint - dependent task latest start: ' + moment.unix(depLatestStartTimestartTime).toString() + '.');
            depLatestStartTimestartTime -= getStartConstraint(dependentTask.data, dependentTask.id, btime, false) * (settings.msGranularity / 1000);
            util.clog('* getEndConstraint - dependent task latest start (with its deps): ' + moment.unix(depLatestStartTimestartTime).toString() + '.');
            if (!toReturn || (depLatestStartTimestartTime < toReturn))
                toReturn = depLatestStartTimestartTime;
        });
        if (toReturn)
            toReturn = moment.unix(toReturn).toISOString();
        util.clog('getEndConstraint finishes with: ' + toReturn + '.');
        return toReturn;
    };
    // This function assumes that all tasks are not-dirty, and are correctly stored in the DB.
    exports.recalculateConstraint = function (task, taskId, btime, save) {
        util.clog('recalculateConstraint starts with task = ' + task.title + ', btime = ' + moment.unix(btime).toString() + '.');
        if (getEnd(task) > btime) {
            var constraint = {
                start: getStartConstraint(task, taskId, btime, true),
                end: getEndConstraint(task, taskId, btime)
            };

            if (save) {
                task.constraint = constraint;
                tasks.update({_id: new Packages.org.bson.types.ObjectId(taskId)}, task);
            }

            util.clog('recalculateConstraint finishes with constraints [' + constraint.start + ' - ' + constraint.end + '].');
            return constraint;
        }
    };
    // This function assumes that all tasks are not-dirty, and are correctly stored in the DB.
    exports.recalculateConstraints = function (btime, userId) {
        var userIdInMongo = new Packages.org.bson.types.ObjectId(userId);
        tasks.find({user: userIdInMongo}).forEach(function (task) {
            exports.recalculateConstraint(task.data, task.id, btime, true);
        });
    };
    exports.storeTask = function (task, userId, tasksToBeDirtied) {
        // TODO validation (timezone - all incoming tasks should be in UTC)
        if (task._id) {
            task._id = new Packages.org.bson.types.ObjectId(task._id);
            tasksToBeDirtied.push({_id: task._id, data: tasks.findOne(task._id).data});
        }

        task.dirty = true;
        task.user = new Packages.org.bson.types.ObjectId(userId);
        tasks.save(task);

        task.blocks && task.blocks.forEach(function (dependentTaskId) {
            var dependentTask = tasks.findOne(new Packages.org.bson.types.ObjectId(dependentTaskId));
            tasksToBeDirtied.push({_id: new Packages.org.bson.types.ObjectId(dependentTaskId), data: dependentTask.data});
            var index = dependentTask.data.needs.findIndex(function (dep) {
                return dep === task._id;
            });
            dependentTask.data.needs.splice(index, 1);
            dependentTask.data.needs.push(task._id.toString());
            tasks.update({_id: new Packages.org.bson.types.ObjectId(dependentTaskId)}, dependentTask.data);
        });
    };
    exports.removeTask = function (task_id) {
        // TODO validation (timezone - all incoming tasks should be in UTC)

        tasks.find({needs: task_id}).forEach(function (dependentTask) {
            var index = dependentTask.data.needs.findIndex(function (dep) {
                return dep === task_id;
            });
            dependentTask.data.needs.splice(index, 1);
            tasks.update({_id: new Packages.org.bson.types.ObjectId(dependentTask.id)}, dependentTask.data);
        });

        tasks.remove({_id: new Packages.org.bson.types.ObjectId(task_id)});
    };
    exports.removeTasks = function (searchObject) {
        tasks.find(searchObject).forEach(function (task) {
            exports.removeTask(task.id);
        });
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

            task.data.blocks = [];
            tasks.find({needs: task.id}).forEach(function (dependentTask) {
                task.data.blocks.push(dependentTask.id);
            });

            toReturn += task.toJSON();
        });
        toReturn += "]}";
        util.clog(toReturn);
        return toReturn;
    };
};