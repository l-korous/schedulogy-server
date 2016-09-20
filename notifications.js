exports.initialize = function (settings, scheduler, mailer, db, util, moment) {
    var tasks = db.getCollection('task');
    var resources = db.getCollection('resource');
    var users = db.getCollection('user');

    var resourceToData = {};

    var addToResourceToData = function (resourceId) {
        var toReturn = {};
        var res = resources.findOne({_id: new Packages.org.bson.types.ObjectId(resourceId)});
        if (res) {
            toReturn.utcOffset = res.data.utcOffset ? res.data.utcOffset : 0;
            if (res.data.type === 'user') {
                var user = users.findOne({_id: new Packages.org.bson.types.ObjectId(res.data.user)});
                if (user) {
                    toReturn.email = user.data.email;
                    resourceToData[resourceId] = toReturn;
                    return toReturn;
                }
                else
                    util.log.error('User for a resource ' + res._id.toString() + ' not found.');
            }
            else {
                if (res.data.email) {
                    toReturn.email = res.data.email;
                    resourceToData[resourceId] = toReturn;
                    return toReturn;
                }
                else
                    util.log.error('Resource ' + res._id.toString() + ' does not have e-mail.');
            }
        }
        util.log.error('Resource ' + resourceId + ' not found.');
    };

    var init = function () {
        var currentTime = moment().unix();
        tasks.find({dirty: false, start: {$gte: currentTime - 1}}).forEach(function (task) {
            exports.reinit(task.data);
        });
    };

    var createTitle = function (task, utcOffset) {
        var startTime = moment.unix(task.start);
        startTime.utcOffset(utcOffset);
        return task.title + ' - ' + startTime.format(settings.notificationFormat);
    };

    var createBody = function (task) {
        var toReturn = task.title + '\r\n\r\n';
        if (task.desc)
            toReturn += task.desc + '\r\n\r\n';
        toReturn += 'See in SCHEDULOGY - ' + settings.notificationUrl + '.';
        return toReturn;
    };

    // This always try to remove the scheduler task, which might not be present - in which case the attempt to remove does not fail, but does nothing.
    exports.reinit = function (task) {
        // Find the notification setup
        var notificationTimestamps = task.notificationTimestamps ? task.notificationTimestamps : settings.defaultNotificationSetup(task);

        // If we will notify (indicated here that the array of notifications is non-empty
        if (notificationTimestamps.length) {
            // First delete an old notification (if there is any)
            for (var counter = 1; counter <= 2; counter++)
                scheduler.removeTask(task._id.toString() + counter.toString());

            // Find the e-mail in the storage.
            var data = resourceToData[task.resource];

            // If the e-mail is not in the storage, put it there
            if (!data)
                data = addToResourceToData(task.resource);

            // Now we should have email, but if the above call failed, we do not have it (but the error is logged).
            if (data) {
                var cronTimestamps = util.unixToCron(notificationTimestamps);
                var counter = 1;
                cronTimestamps.forEach(function (cronTimestamp) {
                    scheduler.addTask(task._id.toString() + (counter++).toString(), {
                        schedule: cronTimestamp,
                        run: function () {
                            mailer.mail(data.email, createTitle(task, data.utcOffset), createBody(task));
                            scheduler.removeTask(task._id.toString());
                        }
                    });
                });
            }
        }
    };

    exports.remove = function (taskId) {
        // Delete old notification (if there is any)
        for (var counter = 1; counter <= 2; counter++)
            scheduler.removeTask(taskId + counter.toString());
    };

    init();
};