exports.initialize = function (settings, scheduler, mailer, db, util, moment) {
    var tasks = db.getCollection('task');
    var resources = db.getCollection('resource');
    var users = db.getCollection('user');

    var resourceToData = {};

    var addToResourceToData = function (task) {
        var toReturn = {};
        var resource = resources.findOne({_id: new Packages.org.bson.types.ObjectId(task.resource)});
        if (resource) {
            toReturn.timeZone = resource.data.timeZone;
            if (resource.data.type === 'user') {
                var user = users.findOne({_id: new Packages.org.bson.types.ObjectId(resource.data.user)});
                if (user) {
                    toReturn.email = user.data.email;
                    resourceToData[task.resource] = toReturn;
                    return toReturn;
                } else
                    util.log.error('User for a resource ' + task.resource + ' not found.');
            } else {
                if (resource.data.email) {
                    toReturn.email = resource.data.email;
                    resourceToData[task.resource] = toReturn;
                    return toReturn;
                } else
                    util.log.error('Resource ' + resource._id.toString() + ' does not have e-mail.');
            }
        }
        util.log.error('Resource ' + task.resource + ' not found.');
    };

    var init = function () {
        var currentTime = moment().unix();
        tasks.find({type: {$in: ['task', 'event']}, dirty: false, start: {$gte: currentTime - 1}}).forEach(function (task) {
            exports.reinit(task.data);
        });
        tasks.find({type: 'reminder'}).forEach(function (task) {
            if (!task.data.done)
                exports.reinit(task.data);
        });
        scheduler.logState();
    };

    var createTitle = function (task, timeZone) {
        if (task.type === 'reminder')
            return task.title;
        else {
            var utcOffset = moment.tz.zone(timeZone).offset(task.start);
            var startTime = moment.unix(task.start).utc().add(-utcOffset, 'm');
            return task.title + ' - ' + startTime.format(settings.notificationFormat);
        }
    };

    var createBody = function (task) {
        var toReturn = task.title + '\r\n\r\n';
        if (task.desc)
            toReturn += task.desc + '\r\n\r\n';
        toReturn += 'See in SCHEDULOGY - ' + settings.notificationUrl + '.';
        return toReturn;
    };

    var getTimestampsFromNotificationsAttribute = function (task) {
        var toReturn = [];
        if (task.notifications) {
            task.notifications.forEach(function (notification) {
                switch (notification.timeUnit) {
                    case 'minutes':
                        toReturn.push(task.start - (notification.amount * 60));
                        break;
                    case 'hours':
                        toReturn.push(task.start - (notification.amount * 60 * 60));
                        break;
                    case 'days':
                        toReturn.push(task.start - (notification.amount * 60 * 60 * 24));
                        break;
                }
            });
        }
        return toReturn;
    };

    // This always try to remove the scheduler task, which might not be present - in which case the attempt to remove does not fail, but does nothing.
    exports.reinit = function (task) {
        // Find the notification setup
        var notificationTimestamps = getTimestampsFromNotificationsAttribute(task);
        if (notificationTimestamps.length === 0)
            notificationTimestamps = settings.defaultNotificationSetup(task);

        // If we will notify (indicated here that the array of notifications is non-empty
        if (notificationTimestamps.length) {
            // First delete an old notification (if there is any)
            for (var counter = 1; counter <= 100; counter++)
                scheduler.removeTask(task._id.toString() + counter.toString());

            // Find the e-mail in the storage.
            var resourceData = resourceToData[task.resource];

            // If the e-mail is not in the storage, put it there
            if (!resourceData)
                resourceData = addToResourceToData(task);

            // Now we should have email, but if the above call failed, we do not have it (but the error is logged).
            if (resourceData) {
                var cronTimestamps;
                if (task.type === 'reminder' && task.allDay) {
                    var currentDt = moment();
                    var utcOffset = moment.tz.zone(resourceData.timeZone).offset(currentDt);
                    cronTimestamps = settings.reminderCronTimestamps(task, utcOffset);
                } else
                    cronTimestamps = util.unixToCron(notificationTimestamps);
                
                var counter = 1;
                cronTimestamps.forEach(function (cronTimestamp) {
                    scheduler.addTask(task._id.toString() + (counter.toString()), {
                        schedule: cronTimestamp,
                        run: function () {
                             // Do not send reminders for tasks that are for the future
                            if (task.type === 'reminder' && task.start > moment().unix())
                                return;
                            mailer.mail(resourceData.email, createTitle(task, resourceData.timeZone), createBody(task));
                            scheduler.removeTask(task._id.toString() + (counter.toString()));
                        }
                    });
                    counter++;
                });
            }
        }
    };

    exports.remove = function (taskId) {
        // Delete old notification (if there is any)
        for (var counter = 1; counter <= 2; counter++)
            scheduler.removeTask(taskId + counter.toString());
    };

    var initializer = module.singleton('initializer', function () {
        init();
    });
};
