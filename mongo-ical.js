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
        return {calendar: builder.build(fin), registry: builder.getRegistry()};
    };

    var saveImportedTask = function (component, userId, btime, registry) {
        // Sanity check.
        if ((!component.getProperty('DTSTART')) || (!component.getProperty('DTEND')) || (!component.getProperty('SUMMARY')))
            return;

        var taskTitle = component.getProperty('SUMMARY').getValue();

        var taskStart = moment.utc(component.getProperty('DTSTART').getValue(), 'YYYYMMDDThhmm');
        var taskEnd = moment.utc(component.getProperty('DTEND').getValue(), 'YYYYMMDDThhmm');
        try {
            var tz = registry.getTimeZone(component.getProperty('DTSTART').getParameter("TZID").getValue());
            if (tz) {
                var taskStartInUnix = moment.utc(component.getProperty('DTSTART').getValue(), 'YYYYMMDDThhmm').unix();
                var taskEndInUnix = moment.utc(component.getProperty('DTEND').getValue(), 'YYYYMMDDThhmm').unix();
                taskStart = moment.unix(taskStartInUnix).add(-tz.getOffset(taskStartInUnix * 1000), 'ms');
                taskEnd = moment.unix(taskEndInUnix).add(-tz.getOffset(taskEndInUnix * 1000), 'ms');
            }
        }
        catch (e) {
            util.log.error( 'Exception: ' + e);
        }

        var bTimeMoment = moment.unix(btime);
        var endMoment = moment.unix(btime).add(settings.weeks, 'w');

        util.log.debug('saveImportedTask starts with btime = ' + bTimeMoment.toString() + ', taskEnd = ' + taskEnd);

        // Only tasks in present or future.
        if ((taskEnd.diff(bTimeMoment, 's') > 0) && (endMoment.diff(taskEnd, 's') > 0)) {
            util.log.debug('saveImportedTask - task not in the past (' + taskEnd.toString() + '), creating if not exists: ' + taskTitle);

            var uid = component.getProperty('UID').getValue();
            var userIdInMongo = new Packages.org.bson.types.ObjectId(userId);
            var exists = mongoTasks.tasks.findOne({user: userIdInMongo, iCalUid: uid});
            if (!exists) {
                util.log.debug('saveImportedTask - task not exists, creating new...');

                // Handle duration and type
                var type = ((taskEnd.hour() === 0 && taskStart.hour() === 0) ? 'fixedAllDay' : 'fixed');
                var duration = ((type === 'fixedAllDay') ? taskEnd.diff(taskStart, 'd') : Math.ceil(taskEnd.diff(taskStart, 'm') / settings.minGranularity));

                // Create a JSON with the task to be inserted.
                var taskToStore = {
                    iCalUid: uid,
                    type: type,
                    start: taskStart.unix(),
                    due: taskEnd.unix(),
                    needs: [],
                    blocks:[],
                    dur: duration,
                    dirty:true,
                    title: taskTitle,
                    desc: component.getProperty('DESCRIPTION') ? component.getProperty('DESCRIPTION').getValue() : ''
                };

                // Save the task. Only if it is not stored already.
                mongoTasks.storeTask(taskToStore, userId);
            }
        }
    };

    exports.processIcalFile = function (inputData, userId, btime) {
        var calendar = getCalendar(inputData, userId).calendar;
        var registry = getCalendar(inputData, userId).registry;

        for (var i = calendar.getComponents().iterator(); i.hasNext(); ) {
            var component = i.next();
            saveImportedTask(component, userId, btime, registry);
        }
    };
};