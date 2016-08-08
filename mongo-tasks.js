exports.initialize = function (app, settings, util) {
    var mongo = require('ringo-mongodb');
    var moment = require('./bower_components/moment/moment.js');
    var client = new mongo.MongoClient('localhost', 27017);
    var db = client.getDB('schedulogy');
    var tasks = db.getCollection('task');
    exports.tasks = tasks;

    exports.haveFloating = function (btime, userId) {
        var toReturn = false;
        util.log.debug('haveFloating starts');
        var userIdInMongo = new Packages.org.bson.types.ObjectId(userId);
        tasks.find({user: userIdInMongo, type: 'floating'}).forEach(function (floatingTask) {
            toReturn = toReturn || (!floatingTask.data.start) || (floatingTask.data.start >= btime) || floatingTask.data.dirty;
        });

        util.log.debug('haveFloating finishes: ' + toReturn);
        return toReturn;
    };

    exports.getProblemJson = function (btime, utcOffset, userId) {
        var btime_startOfDay = moment.unix(btime).startOf('day').add((settings.startSlot + utcOffset) * settings.minGranularity, 'm').unix();
        var userIdInMongo = new Packages.org.bson.types.ObjectId(userId);
        util.log.debug('getProblemJson starts with btime = ' + moment.unix(btime).toString() + ', user = ' + userId);
        var toReturn = {};
        toReturn.Problem = {};
        toReturn.Problem.General = {};
        toReturn.Problem.General.DaysPerWeek = settings.weeks * settings.daysPerWeek;
        toReturn.Problem.General.SlotsPerDay = settings.hoursPerDay * settings.slotsPerHour;
        toReturn.Problem.Resources = [{TimePreferences: []}];
        // The actual BTime is imposed as a hard preference.
        var counter = 0;
        var bTimeActualSlot = util.timeToSlot(btime, btime_startOfDay);
        for (var i = 0; i < bTimeActualSlot; i++) {
            toReturn.Problem.Resources[0].TimePreferences[counter++] = {s: i};
        }
        tasks.find({user: userIdInMongo, type: {$in: ['fixed', 'fixedAllDay']}}).forEach(function (fixedTask) {
            util.cdir(fixedTask.data);
            // Skipping past tasks.
            var start = fixedTask.data.start;
            var end = util.getUnixEnd(fixedTask.data);
            if (end > btime) {
                var leftBound = Math.max(0, util.timeToSlot(start, btime_startOfDay));
                var rightBound = util.timeToSlot(end, btime_startOfDay);
                for (var i = leftBound; i < rightBound; i++) {
                    util.log.debug('- adding hard resource time: ' + i);
                    toReturn.Problem.Resources[0].TimePreferences[counter++] = {s: i};
                }
            }
        });
        toReturn.Problem.Activities = [];
        toReturn.Problem.Dependencies = [];
        counter = 0;
        var counterDeps = 0;
        tasks.find({user: userIdInMongo, type: 'floating'}).forEach(function (floatingTask) {
            var toPrint = floatingTask.data;
            toPrint.startString = moment.unix(floatingTask.data.start).toString();
            toPrint.diffBTime = toPrint.start - btime;
            util.cdir(toPrint);
            // Skipping past tasks. But not skipping unscheduled tasks.
            var scheduleTask = (!floatingTask.data.start) || (floatingTask.data.start >= btime) || floatingTask.data.dirty;
            if (scheduleTask) {
                var dueInteger = util.timeToSlot(floatingTask.data.due, btime_startOfDay);

                toReturn.Problem.Activities[counter++] = {
                    Length: floatingTask.data.dur,
                    id: floatingTask.id,
                    TimePreferences: [{
                            Type: "Due",
                            Value: dueInteger
                        }]
                };
                util.cdir(toReturn.Problem.Activities[counter - 1]);
                // Dependencies:
                if (floatingTask.data.needs) {
                    // Slot when all fixed prerequisites are done.
                    // During evalution, care must be taken not to have due < maxFixedPrerequisite.
                    var maxFixedPrerequisite = 0;
                    floatingTask.data.needs.forEach(function (prerequisiteTaskId) {
                        var prerequisiteTask = tasks.findOne(new Packages.org.bson.types.ObjectId(prerequisiteTaskId));
                        if (!prerequisiteTask) {
                            util.log.error('Error: prerequisite not exists: ' + prerequisiteTaskId);
                            return;
                        }
                        util.log.debug('- dependency:');
                        util.cdir(prerequisiteTask);
                        // Skipping past tasks.
                        var preq_end = util.getUnixEnd(prerequisiteTask.data);
                        if (['fixed', 'fixedAllDay'].indexOf(prerequisiteTask.data.type) > -1) {
                            var fixedPrerequisite = Math.max(0, util.timeToSlot(preq_end, btime_startOfDay));
                            maxFixedPrerequisite = Math.max(maxFixedPrerequisite, fixedPrerequisite);
                        } else if (prerequisiteTask.data.type === 'floating') {
                            toReturn.Problem.Dependencies[counterDeps++] = {
                                id: counterDeps.toString(),
                                FirstActivity: prerequisiteTaskId,
                                SecondActivity: floatingTask.id
                            };
                            util.log.debug('-- float dependency:');
                            util.cdir(toReturn.Problem.Dependencies[counterDeps - 1]);
                        }
                    });
                    if (maxFixedPrerequisite > 0) {
                        toReturn.Problem.Activities[counter - 1].TimePreferences[1] = {
                            Type: "CanStart",
                            Value: maxFixedPrerequisite
                        };
                        util.log.debug('- fixed deps: ' + maxFixedPrerequisite);
                    }
                }
            }
        });
        util.cdir(toReturn);
        return toReturn;
    };
    exports.storeSlnData = function (outputJsonString, btime) {
        util.log.debug('storeSlnData starts with btime = ' + moment.unix(btime).toString() + '.');
        var outputJson = JSON.parse(outputJsonString);
        var solArray = outputJson.solution;
        solArray.forEach(function (solutionEl) {
            var start = util.slotToTime(solutionEl.StartTime, btime);
            tasks.update({_id: new Packages.org.bson.types.ObjectId(solutionEl.id)}, {$set: {start: start.toString(), dirty: false}});
        });
    };

    exports.markFixedAsNonDirty = function (userId) {
        // Very important - Ringo.js MongoDB driver does not support updates with option {multi: true}, so we need to update one-by-one.
        tasks.find({user: userId, type: {$in: ['fixed', 'fixedAllDay']}}).forEach(function (task) {
            task.data.dirty = false;
            tasks.save(task.data);
        });
    };

    var constraintsUtilArray = [];
    // For a single task, calculate the amount of time necessary to complete all its dependencies.
    // While not counting durations of tasks that are (already) in constraintsUtilArray and at the same time updating the array.
    var getStartConstraintFromDeps = function (task, btime) {
        util.log.debug('getStartConstraintFromDeps starts with task = ' + task.title + ', btime = ' + moment.unix(btime).toString() + '.');
        var toReturn = 0;
        task.needs && task.needs.forEach(function (prerequisiteTaskId) {
            var prerequisiteTask = tasks.findOne(new Packages.org.bson.types.ObjectId(prerequisiteTaskId));
            if (!prerequisiteTask) {
                util.log.error('Error: prerequisite not exists: ' + prerequisiteTaskId);
                return;
            }

            util.log.debug('* getStartConstraintFromDeps - a prerequisite: ' + prerequisiteTask.data.title + '.');
            if ((constraintsUtilArray.indexOf(prerequisiteTaskId) === -1) && util.getUnixEnd(prerequisiteTask.data) > btime) {
                constraintsUtilArray.push(prerequisiteTaskId);
                toReturn += util.getUnixDuration(prerequisiteTask.data) + getStartConstraintFromDeps(prerequisiteTask.data, btime);
                if (prerequisiteTask.data.type !== 'floating')
                    toReturn += (prerequisiteTask.data.start - btime);
                util.log.debug('* getStartConstraintFromDeps - current toReturn: ' + toReturn + '.');
            }
        });
	util.log.debug('getStartConstraintFromDeps finishes with: ' + toReturn);
        return toReturn;
    };
    // For a single task, calculate the amount of time (in hours now) necessary to complete:
    // - all its dependencies
    // - all tasks with due date before this task (with dependencies)
    // - all fixed tasks which have to occur before due - dur
    var getStartConstraint = function (task, taskId, btime, clear) {
        util.log.debug('getStartConstraint starts with task = ' + task.title + ', btime = ' + moment.unix(btime).toString() + '.');
        var toReturn = 0;
        if (clear)
            constraintsUtilArray = [];
        // This is for the case that task itself is not stored in DB.
        if (!taskId || constraintsUtilArray.indexOf(taskId) === -1) {
            toReturn += getStartConstraintFromDeps(task, btime);
            if (toReturn)
                util.log.debug('* getStartConstraint - current toReturn: ' + toReturn + '.');
            constraintsUtilArray.push(taskId);
        }

        tasks.find({due: {$lte: task.due}, type: 'floating'}).forEach(function (taskWithLeqDue) {
            if (constraintsUtilArray.indexOf(taskWithLeqDue.id) === -1) {
                toReturn += getStartConstraintFromDeps(taskWithLeqDue.data, btime);
                if (toReturn)
                    util.log.debug('* getStartConstraint - current toReturn: ' + toReturn + '.');
                constraintsUtilArray.push(taskId);
            }
        });
        tasks.find({start: {$lte: task.due}, type: {$in: ['fixed', 'fixedAllDay']}}).forEach(function (taskWithLeqStart) {
            if (constraintsUtilArray.indexOf(taskWithLeqStart.id) === -1) {
                toReturn += getStartConstraintFromDeps(taskWithLeqStart.data, btime);
                if (toReturn)
                    util.log.debug('* getStartConstraint - current toReturn: ' + toReturn + '.');
                constraintsUtilArray.push(taskId);
            }
        });
	util.log.debug('getStartConstraint finishes with: ' + toReturn);
        return toReturn;
    };
    // For a single task, calculate the earliest time when this task must be done to satisfy all dependencies:
    // all dependent fixed tasks (NOT supported now, only floating tasks can be dependent)
    // all dependent floating tasks
    // all of them with dependencies (through getStartConstraint)
    var getEndConstraint = function (task, taskId, btime) {
        util.log.debug('getEndConstraint starts with task = ' + task.title + ', btime = ' + moment.unix(btime).toString() + '.');
        var toReturn = null;
        constraintsUtilArray = [taskId];
        var dependentTasks = taskId ? tasks.find({needs: taskId}).toArray() : task.blocks;
        dependentTasks.forEach(function (dependentTask) {
            util.log.debug('* getEndConstraint - found dependent task: ' + dependentTask.data.title + '.');
            var depLatestStartTimestartTime = util.getUnixStart(dependentTask);
            util.log.debug('* getEndConstraint - dependent task latest start: ' + moment.unix(depLatestStartTimestartTime).toString() + '.');
            depLatestStartTimestartTime -= getStartConstraint(dependentTask.data, dependentTask.id, btime, false);
            util.log.debug('* getEndConstraint - dependent task latest start (with its deps): ' + moment.unix(depLatestStartTimestartTime).toString() + '.');
            if (!toReturn || (depLatestStartTimestartTime < toReturn))
                toReturn = depLatestStartTimestartTime;
        });
        util.log.debug('getEndConstraint finishes with: ' + toReturn);
        return toReturn;
    };
    // This function assumes that all tasks are not-dirty, and are correctly stored in the DB.
    exports.recalculateConstraint = function (task, taskId, btime, save) {
        util.log.debug('recalculateConstraint starts with task = ' + task.title + ', btime = ' + moment.unix(btime).toString() + '.');
        if (util.getUnixEnd(task) > btime) {
            var startConstraint = getStartConstraint(task, taskId, btime, true);
            var endConstraint = getEndConstraint(task, taskId, btime);
            var constraint = {
                start: startConstraint ? moment.unix(parseInt(btime) + startConstraint).toISOString() : null,
                end: endConstraint ? moment.unix(endConstraint).toISOString() : null
            };

            if (save) {
                task.constraint = constraint;
                tasks.update({_id: new Packages.org.bson.types.ObjectId(taskId)}, task);
            }

            util.log.debug('recalculateConstraint finishes with constraints [' + constraint.start + ' - ' + constraint.end + '].');
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

    exports.resetTasks = function (tasksToResetTo, userId) {
        var userIdInMongo = new Packages.org.bson.types.ObjectId(userId);
        tasksToResetTo.forEach(function (rollbackTask) {
            tasks.update({_id: rollbackTask._id, user: userIdInMongo}, rollbackTask.data);
        });
    };

    exports.removeTasks = function (searchObject, userId) {
        var userIdInMongo = new Packages.org.bson.types.ObjectId(userId);
        searchObject.user = userIdInMongo;
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
        return toReturn;
    };
};
