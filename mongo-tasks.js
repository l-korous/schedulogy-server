exports.initialize = function (settings, util, db, notifications, moment) {
    var tasks = db.getCollection('task');
    var resources = db.getCollection('resource');

    var floatingTaskIsUnscheduled = function (floatingTask, btime) {
        if (util.getUnixEnd(floatingTask) <= btime) {
            util.log.debug('floatingTaskIsUnscheduled for: ' + floatingTask.title + ' : false - end <= btime');
            return false;
        }

        if (floatingTask.dirty) {
            util.log.debug('floatingTaskIsUnscheduled for: ' + floatingTask.title + ' : true - dirty');
            return true;
        }
        if (!floatingTask.start) {
            util.log.debug('floatingTaskIsUnscheduled for: ' + floatingTask.title + ' : true - no start');
            return true;
        }

        util.log.debug('floatingTaskIsUnscheduled for: ' + floatingTask.title + ' : false - default');
        return false;
    };

    exports.mustSchedule = function (btime, tenantId) {
        util.log.debug('mustSchedule starts');

        var toReturn = false;
        var unscheduledFloating = false;
        var scheduledFloating = false;
        var dirtyFixed = false;

        tasks.find({tenant: tenantId, type: 'task'}).forEach(function (floatingTask) {
            var currentTaskIsUnscheduled = floatingTaskIsUnscheduled(floatingTask.data, btime);
            if (currentTaskIsUnscheduled) {
                floatingTask.data.dirty = true;
                tasks.update({_id: new Packages.org.bson.types.ObjectId(floatingTask.data._id)}, floatingTask.data);
                var floatingDirtyUtilArray = [];
                exports.markFloatingDirtyViaDependence(floatingTask.data, floatingDirtyUtilArray, btime);
            }
            unscheduledFloating = unscheduledFloating || currentTaskIsUnscheduled;

            scheduledFloating = scheduledFloating || (floatingTask.data.start >= btime);
        });

        if (!unscheduledFloating) {
            // $gte: btime is a bug probably in the Mongo driver.
            tasks.find({tenant: tenantId, type: 'event', start: {$gte: btime - 1}}).forEach(function (fixedTask) {
                dirtyFixed = dirtyFixed || fixedTask.data.dirty;
            });
            if (dirtyFixed && scheduledFloating)
                toReturn = true;
        }
        else
            toReturn = true;

        util.log.debug('mustSchedule finishes: ' + toReturn);
        return toReturn;
    };

    var getGeneralJson = function () {
        var toReturn = {
            DaysPerWeek: settings.weeks * settings.daysPerWeek,
            SlotsPerDay: settings.hoursPerDay * settings.slotsPerHour
        };
        return toReturn;
    };

    var getPrimaryResourceConstraints = function (btime, btime_startOfWeekOffset, resource) {
        var toReturn = {};
        toReturn.btimeOffset = btime_startOfWeekOffset;
        toReturn.weekStart = resource.constraints ? resource.constraints[0].value_since - 1 : 0;
        toReturn.weekEnd = resource.constraints ? resource.constraints[0].value_until - 1 : 6;
        toReturn.dayStart = resource.constraints ? resource.constraints[1].value_since : 0;
        toReturn.dayEnd = resource.constraints ? resource.constraints[1].value_until : settings.endSlot;
        toReturn.utcOffset = (moment.tz.zone(resource.timeZone).offset(btime) / settings.minuteGranularity);
        return toReturn;
    };

    var getResourcesJson = function (btime, btime_startOfDay, btime_startOfWeekOffset, tenantIdInMongo) {
        var toReturn = [];
        resources.find({tenant: tenantIdInMongo}).forEach(function (resource) {
            var resData = getPrimaryResourceConstraints(btime, btime_startOfWeekOffset, resource.data);

            // This fills the basic constrains on the resource level.
            var timePreferences = [];

            // The actual BTime is imposed as a hard preference.
            var bTimeActualSlot = util.timeToSlot(btime, btime_startOfDay);
            for (var i = 0; i < bTimeActualSlot; i++)
                timePreferences.push(i);

            // $gte: btime is a bug probably in the Mongo driver.
            tasks.find({resource: resource.id, type: 'event'}).forEach(function (fixedTask) {
                var end = util.getUnixEnd(fixedTask.data);
                if (end > btime) {
                    util.log.debug('Fixed task to TimePreferences: ' + fixedTask.data.title);
                    var start = fixedTask.data.start;

                    // start might be before btime_startOfDay, that is why we need to use the max fn.
                    var leftBound = Math.max(0, util.timeToSlot(start, btime_startOfDay));
                    var rightBound = util.timeToSlot(end, btime_startOfDay);
                    // This has a very important implication - if leftBound === rightBound, then we do not add anything.
                    // This applies for tasks, that fall out of this Resource constrainted days/times.
                    for (var i = leftBound; i < rightBound; i++) {
                        timePreferences.push(i);
                    }
                }
            });

            tasks.find({resource: resource.id, type: 'task'}).forEach(function (floatingTask) {
                // We are interested here in floating tasks that will NOT be scheduled - they need to be respected though - no other task can be scheduled in their slots.
                var scheduleTask = floatingTaskIsUnscheduled(floatingTask.data, btime);
                // 
                if (!scheduleTask) {
                    util.log.debug('Floating task to TimePreferences: ' + floatingTask.data.title);
                    var start = floatingTask.data.start;
                    var end = util.getUnixEnd(floatingTask.data);

                    // start might be before btime_startOfDay, that is why we need to use the max fn.
                    var leftBound = Math.max(0, util.timeToSlot(start, btime_startOfDay));
                    var rightBound = util.timeToSlot(end, btime_startOfDay);
                    // This has a very important implication - if leftBound === rightBound, then we do not add anything.
                    // This applies for tasks, that fall out of this Resource constrainted days/times.
                    for (var i = leftBound; i < rightBound; i++) {
                        timePreferences.push(i);
                    }
                }
            });

            resData['id'] = resource.id;
            resData['name'] = resource.data.user ? resource.data.user.toString() : resource.data.name;
            resData['tp'] = timePreferences;

            toReturn.push(resData);
        });

        return toReturn;
    };

    var getActivitiesAndDependenciesJson = function (btime, btime_startOfDay, tenantIdInMongo) {
        var toReturn = {
            Activities: [],
            Dependencies: []
        };

        tasks.find({tenant: tenantIdInMongo, type: 'task'}).forEach(function (floatingTask) {
            // Skipping past tasks. But not skipping unscheduled tasks.
            var scheduleTask = floatingTaskIsUnscheduled(floatingTask.data, btime);
            if (scheduleTask) {
                var dueInteger = util.timeToSlot(floatingTask.data.due, btime_startOfDay);
                var activity = {
                    l: floatingTask.data.dur * (floatingTask.data.allDay ? settings.hoursPerDay * settings.slotsPerHour : 1),
                    allDay: floatingTask.data.allDay,
                    id: floatingTask.id,
                    ar: [],
                    tp: [{
                            t: "d",
                            v: dueInteger
                        }]
                };

                for (var i = 0; i < floatingTask.data.admissibleResources.length; i++) {
                    activity.ar.push(floatingTask.data.admissibleResources[i].toString());
                }

                // Dependencies:
                if (floatingTask.data.needs) {
                    // Slot when all fixed prerequisites are done.
                    // During evalution, care must be taken not to have due < maxFixedPrerequisite.
                    var maxFixedPrerequisite = 0;
                    floatingTask.data.needs.forEach(function (prerequisiteTaskId) {
                        var prerequisiteTask = tasks.findOne(new Packages.org.bson.types.ObjectId(prerequisiteTaskId));
                        if (!prerequisiteTask)
                            util.log.error('Error: prerequisite: ' + prerequisiteTaskId + ' not exists for task: ' + floatingTask.data.title);
                        else if (util.getUnixEnd(prerequisiteTask.data) > btime) {
                            util.log.debug('-- dependency: ' + JSON.stringify(prerequisiteTask));
                            // Skipping past tasks.
                            var preq_end = util.getUnixEnd(prerequisiteTask.data);
                            if (prerequisiteTask.data.type === 'event') {
                                var fixedPrerequisite = Math.max(0, util.timeToSlot(preq_end, btime_startOfDay));
                                maxFixedPrerequisite = Math.max(maxFixedPrerequisite, fixedPrerequisite);
                            } else if (prerequisiteTask.data.type === 'task') {
                                var dependency = {
                                    id: prerequisiteTaskId + floatingTask.id,
                                    f: prerequisiteTaskId,
                                    s: floatingTask.id
                                };
                                util.log.debug('-- float dependency:' + JSON.stringify(dependency));
                                toReturn.Dependencies.push(dependency);
                            }
                        }
                    });
                    if (maxFixedPrerequisite > 0) {
                        activity.tp[1] = {
                            t: "cs",
                            v: maxFixedPrerequisite
                        };
                        util.log.debug('-- fixed deps: ' + maxFixedPrerequisite);
                    }
                }

                toReturn.Activities.push(activity);
            }
        });

        return toReturn;
    };

    exports.getProblemJson = function (btime, btime_startOfDay, btime_startOfWeekOffset, tenantId) {
        util.log.debug('getProblemJson starts with btime = ' + moment.unix(btime).toString() + ', tenant = ' + tenantId + ', btime_startOfDay = ' + moment.unix(btime_startOfDay).toString());

        var toReturn = {};
        toReturn.Problem = {};
        toReturn.Problem.General = getGeneralJson();
        toReturn.Problem.Resources = getResourcesJson(btime, btime_startOfDay, btime_startOfWeekOffset, tenantId);

        var ActivitiesAndDependencies = getActivitiesAndDependenciesJson(btime, btime_startOfDay, tenantId);
        toReturn.Problem.Activities = ActivitiesAndDependencies.Activities;
        toReturn.Problem.Dependencies = ActivitiesAndDependencies.Dependencies;

        util.cdir(toReturn);
        return toReturn;
    };

    exports.storeSlnData = function (outputJsonString, btime_startOfDay) {
        util.log.debug('storeSlnData starts with btime_startOfDay = ' + moment.unix(btime_startOfDay).toString() + '.');
        var outputJson = JSON.parse(outputJsonString);
        var solArray = outputJson.solution;
        solArray.forEach(function (solutionEl) {
            var start = util.slotToTime(solutionEl.StartTime, btime_startOfDay);
            // TODO - This will have to be changed if we start supporting multiple resources per task.
            var task = tasks.findOne({_id: new Packages.org.bson.types.ObjectId(solutionEl.id)});
            task.data.resource = solutionEl.Resource;
            task.data.start = parseInt(start);
            // This is very important - only for floating tasks we store the end, and we only do that to be able to detect overlaps
            // between new / changed fixed tasks and floating tasks to identify those floating tasks that need to be recalculated.
            task.data.end = util.getUnixEnd(task.data);
            task.data.dirty = false;
            tasks.save(task.data);
            notifications.reinit(task.data);
        });
    };

    exports.markFixedAsNonDirty = function (tenantId) {
        // Very important - Ringo.js MongoDB driver does not support updates with option {multi: true}, so we need to update one-by-one.
        tasks.find({tenant: tenantId, type: {$in: ['reminder', 'event']}}).forEach(function (task) {
            task.data.dirty = false;
            tasks.update({_id: new Packages.org.bson.types.ObjectId(task.data._id)}, task.data);
        });
    };

    // For a single ***floating*** task, calculate the maximum end time of all fixed prerequisites (WITH transitivity).
    // addOwnDur - if I should return with my own duration. Usually false for the root element, true for other.
    var getStartConstraintFromFixedDeps = function (task, btime, addOwnDur) {
        util.log.debug('getStartConstraintFromFixedDeps starts with task = ' + (task.title ? task.title : '(new)' + task.type) + ', btime = ' + moment.unix(btime).toString() + '.');

        if (task.type !== 'task')
            return util.getUnixEnd(task);
        else {
            var taskCanStartNoEarlierThan = btime;
            task.needs && task.needs.forEach(function (prerequisiteTaskId) {
                var prerequisiteTask = tasks.findOne(new Packages.org.bson.types.ObjectId(prerequisiteTaskId));
                if (!prerequisiteTask) {
                    util.log.error('Error: prerequisite not exists for: ' + (task.title ? task.title : '(new)' + task.type));
                    return;
                }

                if (util.getUnixEnd(prerequisiteTask.data) > btime) {
                    taskCanStartNoEarlierThan = Math.max(taskCanStartNoEarlierThan, getStartConstraintFromFixedDeps(prerequisiteTask.data, btime, true));
                }
            });
            if (addOwnDur)
                taskCanStartNoEarlierThan += util.getUnixDuration(task);

            util.log.debug('getStartConstraintFromFixedDeps finishes with: ' + taskCanStartNoEarlierThan);
            return taskCanStartNoEarlierThan;
        }
    };

    // See getStartConstraintFromFixedDeps
    var getStartConstraint = function (task, btime) {
        if (task.type !== 'task')
            util.log.error('getStartConstraint called for a !floating Task.');

        util.log.debug('getStartConstraint starts with task = ' + (task.title ? task.title : '(new) ' + task.type) + ', due: ' + moment.unix(task.due).toString() + ', btime = ' + moment.unix(btime).toString() + '.');

        var toReturn = getStartConstraintFromFixedDeps(task, btime, false);
        util.log.debug('getStartConstraint finishes with: ' + toReturn);
        return toReturn;
    };

    // For a single task, calculate the earliest time when this task must be done to satisfy all dependencies:
    // all dependent fixed tasks (NOT supported now, only floating tasks can be dependent)
    // all dependent floating tasks (WITHOUT dependencies)
    var getEndConstraint = function (task, btime) {
        util.log.debug('getEndConstraint starts with task = ' + (task.title ? task.title : '(new) ' + task.type) + ', btime = ' + moment.unix(btime).toString() + '.');
        var toReturn = null;

        var dependentTasks = [];

        if (task.blocks) {
            var blockOIDs = [];

            task.blocks.forEach(function (bl) {
                blockOIDs.push(new Packages.org.bson.types.ObjectId(bl));
            });
            dependentTasks = tasks.find({_id: {$in: blockOIDs}}).toArray();
        }

        dependentTasks.forEach(function (dependentTask) {
            util.log.debug('* getEndConstraint - found dependent task: ' + dependentTask.data.title + '.');
            var depLatestStartTime = util.getUnixStart(dependentTask.data);
            util.log.debug('* getEndConstraint - dependent task latest start: ' + moment.unix(depLatestStartTime).toString() + '.');
            if (!toReturn || (depLatestStartTime < toReturn))
                toReturn = depLatestStartTime;
        });
        util.log.debug('getEndConstraint finishes with: ' + toReturn);
        return toReturn;
    };

    exports.recalculateConstraint = function (task, btime, save) {
        util.log.debug('recalculateConstraint starts with task = ' + (task.title ? task.title : '(new) ' + task.type) + ', btime = ' + moment.unix(btime).toString() + '.');
        if (util.getUnixEnd(task) > btime) {
            // TODO This means that for fixed tasks, we do not have prerequisites, or any bound on start.
            var startConstraint = task.type === 'task' ? getStartConstraint(task, btime, true) : null;
            var endConstraint = getEndConstraint(task, btime);
            var constraint = {
                start: startConstraint ? moment.unix(startConstraint).toISOString() : null,
                end: endConstraint ? moment.unix(endConstraint).toISOString() : null
            };

            if (save) {
                task.constraint = constraint;
                tasks.update({_id: new Packages.org.bson.types.ObjectId(task._id)}, task);
            }

            util.log.debug('recalculateConstraint (' + task.title + ') : [' + constraint.start + ' - ' + constraint.end + '].');
            return constraint;
        }
        else
            return {
                start: null,
                end: null
            };
    };

    exports.recalculateConstraints = function (btime, tenantId) {
        // $gte: having to have "-1" here is a bug probably in the Mongo driver.
        tasks.find({tenant: tenantId, start: {$gte: btime - 1}}).forEach(function (task) {
            exports.recalculateConstraint(task.data, btime, true);
        });
    };

    exports.getSingleTask = function (object) {
        return tasks.findOne(object);
    };

    exports.getTasks = function (object) {
        var _tasks = tasks.find(object);
        var toReturn = [];
        _tasks.forEach(function (task) {
            toReturn.push(task.data);
        });
        return toReturn;
    };

    exports.markFloatingDirtyViaDependence = function (task, floatingDirtyUtilArray, btime) {
        util.log.debug('markFloatingDirtyViaDependence starts : ' + task.title);

        var isInUtilArray = function (taskId) {
            return floatingDirtyUtilArray.indexOf(taskId) > -1;
        };

        task.blocks && task.blocks.forEach(function (dependentTaskId) {
            var dependentTask = tasks.findOne(new Packages.org.bson.types.ObjectId(dependentTaskId));
            if (dependentTask.data.type === 'task' && !isInUtilArray(dependentTaskId)) {
                if (util.getUnixEnd(dependentTask.data) > btime) {
                    floatingDirtyUtilArray.push(dependentTaskId);
                    dependentTask.data.dirty = true;
                    tasks.update({_id: new Packages.org.bson.types.ObjectId(dependentTaskId)}, dependentTask.data);
                    exports.markFloatingDirtyViaDependence(dependentTask.data, floatingDirtyUtilArray, btime);
                }
            }
        });

        task.needs && task.needs.forEach(function (prerequisiteTaskId) {
            var prerequisiteTask = tasks.findOne(new Packages.org.bson.types.ObjectId(prerequisiteTaskId));
            if (prerequisiteTask.data.type === 'task' && !isInUtilArray(prerequisiteTaskId)) {
                if (util.getUnixEnd(prerequisiteTask.data) > btime) {
                    floatingDirtyUtilArray.push(prerequisiteTaskId);
                    prerequisiteTask.data.dirty = true;
                    tasks.update({_id: new Packages.org.bson.types.ObjectId(prerequisiteTaskId)}, prerequisiteTask.data);
                    exports.markFloatingDirtyViaDependence(prerequisiteTask.data, floatingDirtyUtilArray, btime);
                }
            }
        });
    };

    exports.markFloatingDirtyViaOverlap = function (unixStart, unixEnd, resourceId) {
        util.log.debug('markFloatingDirtyViaOverlap starts : ' + moment.unix(unixStart).toString() + ', ' + moment.unix(unixEnd).toString() + ', ' + resourceId);

        var markDirty = function (task) {
            task.data.dirty = true;
            tasks.update({_id: task.data._id}, task.data);
        };

        // The -/+ 1 are here to be on the safe-side, there is something fishy with this Mongo client for these operators.
        tasks.find({type: 'task', dirty: false, resource: resourceId, start: {$lte: unixStart + 1}, end: {$gte: unixStart - 1}}).forEach(function (task) {
            markDirty(task);
            util.log.debug('Marked as dirty: ' + task.data.title);
        });

        // The -/+ 1 are here to be on the safe-side, there is something fishy with this Mongo client for these operators.
        tasks.find({type: 'task', dirty: false, resource: resourceId, start: {$gte: unixStart - 1}, end: {$lte: unixEnd + 1}}).forEach(function (task) {
            markDirty(task);
            util.log.debug('Marked as dirty: ' + task.data.title);
        });

        // The -/+ 1 are here to be on the safe-side, there is something fishy with this Mongo client for these operators.
        tasks.find({type: 'task', dirty: false, resource: resourceId, start: {$lte: unixEnd + 1}, end: {$gte: unixEnd - 1}}).forEach(function (task) {
            markDirty(task);
            util.log.debug('Marked as dirty: ' + task.data.title);
        });
    };

    function isDirty(task, oldTask) {
        if (oldTask.type !== task.type)
            return true;
        if (oldTask.allDay !== task.allDay)
            return true;
        else if (oldTask.type === 'task') {
            if (oldTask.due !== task.due)
                return true;
            else if (oldTask.dur !== task.dur)
                return true;
            else if (JSON.stringify(oldTask.admissibleResources) !== JSON.stringify(task.admissibleResources))
                return true;
            else if (JSON.stringify(oldTask.needs) !== JSON.stringify(task.needs))
                return true;
            else if (JSON.stringify(oldTask.blocks) !== JSON.stringify(task.blocks))
                return true;
        }
        else {
            if (oldTask.start !== task.start)
                return true;
            else if (oldTask.dur !== task.dur)
                return true;
            else if (JSON.stringify(oldTask.resource) !== JSON.stringify(task.resource))
                return true;
            else if (JSON.stringify(oldTask.blocks) !== JSON.stringify(task.blocks))
                return true;
        }
        return false;
    }

    function isDirtyRepetition(task, oldTask) {
        if (!oldTask)
            return (task.repetition && !task.repetition._id);
        if (oldTask.repetition && !task.repetition)
            return true;
        if (!oldTask.repetition && task.repetition)
            return true;
        if (JSON.stringify(oldTask.repetition) !== JSON.stringify(task.repetition))
            return true;
        return false;
    }

    function processRepetition(task, oldTask, tenantId, userId, btime) {
        if (oldTask && oldTask.repetition)
            exports.removeTasks({'repetition._id': oldTask.repetition._id, _id: {$ne: task._id}});
        
        if (task.repetition) {
            if (task.repetition.frequency === 'Daily') {
                var nextDay = task.start + 86400;
                while (nextDay <= task.repetition.end) {
                    task.start = nextDay;
                    task._id = null;
                    exports.storeTask(task, tenantId, userId, btime);
                    nextDay = task.start + 86400;
                }
            }
            
            if (task.repetition.frequency === 'Weekly') {
                var nextWeek = task.start + (86400 * 7);
                while (nextWeek <= task.repetition.end) {
                    task.start = nextWeek;
                    task._id = null;
                    exports.storeTask(task, tenantId, userId, btime);
                    nextWeek = task.start + (86400 * 7);
                }
            }
            
            if (task.repetition.frequency === 'Monthly') {
                var nextMonth = moment.unix(task.start).add(1, 'month');
                while (nextMonth <= task.repetition.end) {
                    task.start = nextMonth;
                    task._id = null;
                    exports.storeTask(task, tenantId, userId, btime);
                    nextMonth = moment.unix(task.start).add(1, 'month');
                }
            }
        }
    }

    exports.storeTask = function (task, tenantId, userId, btime) {
        var oldTask = null;
        // Update
        if (task._id) {
            task._id = new Packages.org.bson.types.ObjectId(task._id);
            oldTask = tasks.findOne(task._id).data;
            task.dirty = isDirty(task, oldTask);
        }
        // New task
        else {
            task.dirty = (task.type !== 'reminder');
            if (task.type === 'reminder' && (!task.done))
                task.done = false;
        }

        task.tenant = tenantId;
        task.user = userId;

        // By default, users use their own single resource.
        if (!task.admissibleResources && task.type === 'task') {
            task.admissibleResources = [];
            task.admissibleResources.push(resources.findOne({type: 'user', user: task.user}).id);
        }

        // Figuring out if we have a dirty repetition needs to come before setting the repetition._id to something as
        // we use it for deduction: (!oldTask && task.repetition._id => not dirty), which corresponds to new tasks that are created in processRepetition.
        var dirtyRepetition = isDirtyRepetition(task, oldTask);
        console.log('dirtyRepetition: ' + dirtyRepetition);
        // This needs to be done here, so that we already then save the task with correct repetition id.
        if (task.repetition && !task.repetition._id)
            task.repetition._id = new Packages.org.bson.types.ObjectId().toString();
        
        tasks.save(task);

        // TODO - this replicates some work done by the next block, nothing dramatic, but could be improved.
        // We need to have a special array for the recursivity to work properly.
        if (task.dirty && task.type !== 'reminder') {
            var floatingDirtyUtilArray = [];
            exports.markFloatingDirtyViaDependence(task, floatingDirtyUtilArray, btime);
            if (task.type !== 'task')
                exports.markFloatingDirtyViaOverlap(task.start, util.getUnixEnd(task), task.resource);
        }

        task.blocks && task.blocks.forEach(function (dependentTaskId) {
            var dependentTask = tasks.findOne(new Packages.org.bson.types.ObjectId(dependentTaskId));
            var index = dependentTask.data.needs.findIndex(function (dep) {
                return dep === task._id;
            });
            dependentTask.data.needs.splice(index, 1);
            dependentTask.data.needs.push(task._id.toString());
            tasks.update({_id: new Packages.org.bson.types.ObjectId(dependentTaskId)}, dependentTask.data);
        });

        // Send notifications - for non-floating tasks (in case of floating we do not yet know the resource to send the notification to)
        // For floating this is done after solving (as of 20160903 - in this file, in fn storeSlnData).
        if (task.type === 'reminder' && task.done)
            notifications.remove(task._id.toString());
        else if (task.type !== 'task')
            notifications.reinit(task);

        // The processing needs to come after, because we will be modifying the task.
        if(dirtyRepetition)
            processRepetition(task, oldTask, tenantId, userId, btime);
    };

    exports.saveTaskFast = function (task) {
        try {
            if (!task._id)
                util.log.error('Missing task._id in saveTaskFast');
            else {
                task._id = new Packages.org.bson.types.ObjectId(task._id);
                var oldTask = tasks.findOne(task._id).data;
                for (var key in oldTask) {
                    if ((!task[key]) && task[key] !== false) {
                        task[key] = oldTask[key];
                    }
                }
            }
            tasks.save(task);
            return 'ok';
        }
        catch (e) {
            util.log.error('saveTaskFast:' + e);
            return 'fail';
        }
    };

    exports.removeTask = function (taskId) {
        tasks.find({needs: taskId}).forEach(function (dependentTask) {
            var index = dependentTask.data.needs.findIndex(function (dep) {
                return dep === taskId;
            });
            dependentTask.data.needs.splice(index, 1);
            tasks.update({_id: new Packages.org.bson.types.ObjectId(dependentTask.id)}, dependentTask.data);
        });

        tasks.find({blocks: taskId}).forEach(function (prerequisiteTask) {
            var index = prerequisiteTask.data.blocks.findIndex(function (dep) {
                return dep === taskId;
            });
            prerequisiteTask.data.blocks.splice(index, 1);
            tasks.update({_id: new Packages.org.bson.types.ObjectId(prerequisiteTask.id)}, prerequisiteTask.data);
        });

        tasks.remove({_id: new Packages.org.bson.types.ObjectId(taskId)});

        notifications.remove(taskId);
    };

    exports.removeTasks = function (searchObject, tenantId) {
        searchObject.tenant = tenantId;
        tasks.find(searchObject).forEach(function (task) {
            exports.removeTask(task.id);
        });
    };

    exports.getClientJson = function (tenantId, btime) {
        var tasksArray = [];
        var dirtyTasks = [];
        var resourceNames = {};

        tasks.find({tenant: tenantId, dirty: false}).forEach(function (task) {
            task.data.blocks = [];
            tasks.find({needs: task.id}).forEach(function (dependentTask) {
                task.data.blocks.push(dependentTask.id);
            });

            if (!resourceNames[task.data.resource]) {
                var resource = resources.findOne(new Packages.org.bson.types.ObjectId(task.data.resource));
                // Resource might have been deleted, in that case, either resourceName has been stored directly for the task, or it is empty.
                if (resource)
                    resourceNames[task.data.resource] = resource.data.name;
            }

            if (task.data.resource && resourceNames[task.data.resource])
                task.data.resourceName = resourceNames[task.data.resource];

            tasksArray.push(task);
        });

        tasks.find({tenant: tenantId, type: 'task', dirty: true, due: {$gte: btime - 1}}).forEach(function (task) {
            task.data.blocks = [];
            tasks.find({needs: task.id}).forEach(function (dependentTask) {
                task.data.blocks.push(dependentTask.id);
            });

            if (task.data.resource) {
                if (!resourceNames[task.data.resource]) {
                    var resource = resources.findOne(new Packages.org.bson.types.ObjectId(task.data.resource));
                    // Resource might have been deleted, in that case, either resourceName has been stored directly for the task, or it is empty.
                    if (resource)
                        resourceNames[task.data.resource] = resource.data.name;
                }

                if (resourceNames[task.data.resource])
                    task.data.resourceName = resourceNames[task.data.resource];
            }
            dirtyTasks.push(task);
        });

        var toReturn = "{\"tasks\": [";
        var first_task = true;
        tasksArray.forEach(function (task) {
            if (!first_task)
                toReturn += ",";
            else
                first_task = false;

            toReturn += task.toJSON();
        });

        toReturn += "], \"dirtyTasks\": [";
        first_task = true;
        dirtyTasks.forEach(function (task) {
            if (!first_task)
                toReturn += ",";
            else
                first_task = false;

            toReturn += task.toJSON();
        });

        toReturn += "]}";
        return toReturn;
    };
};
