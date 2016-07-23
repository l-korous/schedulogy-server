exports.initialize = function (app, settings, util, moment, mongoTasks) {
    var tempFiles = require('ringo/utils/files');
    var fs = require('fs');

    addToClasspath("./cpsolver/dist/backport-util-concurrent-3.1.jar");
    addToClasspath("./cpsolver/dist/commons-lang-2.6.jar");
    addToClasspath("./cpsolver/dist/commons-codec-1.8.jar");
    addToClasspath("./cpsolver/dist/commons-logging-1.1.3.jar");
    addToClasspath("./cpsolver/dist/groovy-all-2.1.7.jar");
    addToClasspath("./cpsolver/dist/ical4j-1.0.6.jar");
    addToClasspath("./cpsolver/dist");
    importPackage(net.fortuna.ical4j.data);
    importPackage(java.io);

    var getCalendar = function (inputData, userId) {
        var tempFile = tempFiles.createTempFile(userId, ".ical");
        fs.write(tempFile, inputData);

        var fin = new FileInputStream(tempFile);
        var builder = new CalendarBuilder();
        return builder.build(fin);
    };

    var saveImportedTask = function (component, userId, btime) {
        var taskStart = moment.utc(component.getProperty('DTSTART'), 'YYYYMMDDThhmm');
        var taskEnd = moment.utc(component.getProperty('DTEND'), 'YYYYMMDDThhmm');
        var bTimeMoment = moment.unix(btime);
        var endMoment = moment.unix(btime).add(settings.weeks, 'w');

        util.clog('saveImportedTask starts with btime = ' + bTimeMoment.toString() + ', taskEnd = ' + taskEnd.toString());

        // Only tasks in present or future.
        if ((taskEnd.diff(bTimeMoment, 's') > 0) && (endMoment.diff(taskEnd, 's') > 0)) {
            var taskTitle = component.getProperty('SUMMARY').toString();
            util.clog('saveImportedTask - task not in the past, creating if not exists: ' + taskTitle);

            var uid = component.getProperty('UID').toString();
            var exists = mongoTasks.tasks.findOne({iCalUid:uid});
            if (!exists) {
                util.clog('saveImportedTask - task not exists, creating new...');
                // Create a JSON with the task to be inserted.
                var taskToStore = {
                    iCalUid: uid,
                    type: 'fixed',
                    start: taskStart.unix(),
                    dur: Math.ceil(taskEnd.diff(taskStart, 'ms') / settings.msGranularity),
                    title: taskTitle,
                    desc: component.getProperty('DESCRIPTION').toString()
                };
                
                // Save the task. Only if it is not stored already.
                var created = mongoTasks.storeTask(taskToStore, userId);
                util.clog('saveImportedTask - task not exists, created: ' + created);
            }
        }
    };

    exports.processIcalFile = function (inputData, userId, btime) {
        var calendar = getCalendar(inputData, userId);

        for (var i = calendar.getComponents().iterator(); i.hasNext(); ) {
            var component = i.next();
            saveImportedTask(component, userId, btime);
        }
    };
};