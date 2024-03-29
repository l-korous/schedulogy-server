exports.initialize = function (app, settings, util, moment, mongoTasks, mongoResources, db) {
    var tempFiles = require('ringo/utils/files');
    var fs = require('fs');
    var resources = db.getCollection('resource');

    addToClasspath("./cpsolver/dist/backport-util-concurrent-3.1.jar");
    addToClasspath("./cpsolver/dist/commons-lang-2.6.jar");
    addToClasspath("./cpsolver/dist/commons-codec-1.8.jar");
    addToClasspath("./cpsolver/dist/commons-logging-1.1.3.jar");
    addToClasspath("./cpsolver/dist/groovy-all-2.1.7.jar");
    addToClasspath("./cpsolver/dist/ical4j-1.0.6.jar");
    addToClasspath("./cpsolver/dist");
    importPackage(net.fortuna.ical4j.data);
    importPackage(net.fortuna.ical4j.model);
    importPackage(net.fortuna.ical4j.model.property);
    importPackage(net.fortuna.ical4j.model.parameter);
    importPackage(java.io);

    var getCalendar = function (inputData, userId) {
        try {
            var fileName = userId.toString() + (new moment()).unix();
            util.log.info('Saved iCal file: ' + fileName);
            var tempFile = tempFiles.createTempFile(fileName, ".ical");
            fs.write(tempFile, inputData);

            var fin = new FileInputStream(tempFile);
            var builder = new CalendarBuilder();
            return {calendar: builder.build(fin), registry: builder.getRegistry()};
        }
        catch (e) {
            util.log.error('Exception: ' + e);
            throw(e);
        }
    };

    var saveImportedTask = function (component, tenantId, userId, resourceId, btime, registry) {
        // Sanity check.
        if ((!component.getProperty('DTSTART')) || (!component.getProperty('DTEND')) || (!component.getProperty('SUMMARY')))
            return;

        var taskTitle = component.getProperty('SUMMARY').getValue();
        
        var comment = component.getProperty('COMMENT') ? component.getProperty('COMMENT').getValue() : '';
        var desc = comment.substring(13, comment.length)
        var internalData = (comment.substring(0, 13) === '${SCHEDULOGY}') ? JSON.parse(desc) : {};
        
        var taskStart = moment.utc(component.getProperty('DTSTART').getValue(), 'YYYYMMDDThhmmss');
        var taskEnd = moment.utc(component.getProperty('DTEND').getValue(), 'YYYYMMDDThhmmss');
        try {
            if (component.getProperty('DTSTART').getParameter("TZID"))
            {
                var tz = registry.getTimeZone(component.getProperty('DTSTART').getParameter("TZID").getValue());
                if (tz) {
                    var taskStartInUnix = moment.utc(component.getProperty('DTSTART').getValue(), 'YYYYMMDDThhmmss').unix();
                    var taskEndInUnix = moment.utc(component.getProperty('DTEND').getValue(), 'YYYYMMDDThhmmss').unix();
                    taskStart = moment.unix(taskStartInUnix).add(-tz.getOffset(taskStartInUnix * 1000), 'ms');
                    taskEnd = moment.unix(taskEndInUnix).add(-tz.getOffset(taskEndInUnix * 1000), 'ms');
                }
            }
        }
        catch (e) {
            util.log.error('Exception: ' + e);
        }

        var bTimeMoment = moment.unix(btime);
        var endMoment = moment.unix(btime).add(settings.weeks, 'w');

        util.log.debug('saveImportedTask starts with btime = ' + bTimeMoment.toString() + ', taskEnd = ' + taskEnd);

        // Only tasks in present or future.
        if ((taskEnd.diff(bTimeMoment, 's') > 0) && (endMoment.diff(taskEnd, 's') > 0)) {
            util.log.debug('saveImportedTask - task not in the past (' + taskEnd.toString() + '), creating if not exists: ' + taskTitle);

            var uid = component.getProperty('UID').getValue();
            var exists = mongoTasks.getSingleTask({user: userId, iCalUid: uid});

            // Save the task. Only if it is not stored already.
            if (!exists) {
                util.log.debug('saveImportedTask - task not exists, creating new...');

                // Handle duration and type
                var type = internalData.type ? internalData.type : 'event';
                var allDay = internalData.allDay ? internalData.allDay : (taskEnd.hour() === 0 && taskStart.hour() === 0);
                var duration = internalData.dur ? internalData.dur : (allDay ? taskEnd.diff(taskStart, 'd') : Math.ceil(taskEnd.diff(taskStart, 'm') / settings.minuteGranularity));

                function saveTask(taskStartUnix, taskEndUnix) {
                    // Create a JSON with the task to be inserted.
                    var taskToStore = {
                        iCalUid: uid,
                        type: type,
                        start: taskStartUnix,
                        allDay: allDay,
                        due: taskEndUnix,
                        needs: [],
                        blocks: [],
                        resource: resourceId,
                        dur: duration,
                        dirty: true,
                        title: taskTitle,
                        desc: component.getProperty('DESCRIPTION') ? component.getProperty('DESCRIPTION').getValue() : ''
                    };
                    mongoTasks.storeTask(taskToStore, tenantId, userId, btime);
                }

                var recurrence = component.getProperty('RRULE') ? component.getProperty('RRULE') : null;
                if (recurrence) {
                    var recurSeed = new Date(taskStart.unix() * 1000);
                    var recurStart = new Date(btime * 1000);
                    var recurEnd = new Date((parseInt(btime) + settings.weeks * 7 * 1440 * 60) * 1000);
                    var dateList = recurrence.getRecur().getDates(recurSeed, recurStart, recurEnd, Value.DATE_TIME);
                    util.log.debug('saveImportedTask - dateList: ' + dateList);
                    dateList.toArray().forEach(function (date) {
                        // UTC date
                        var occurenceStart = moment.utc(date, 'YYYYMMDDThhmmss');

                        // Add time from taskStart
                        // - zone needs to come first.
                        occurenceStart.zone(taskStart.zone());
                        occurenceStart.hour(taskStart.hour());
                        occurenceStart.minute(taskStart.minute());

                        // Add duration to get the end.
                        var occurenceEnd = occurenceStart.clone().add(duration * (type === 'event' ? settings.minuteGranularity : 1440), 'minutes');
                        util.log.debug('saveImportedTask - ' + date);
                        util.log.debug('saveImportedTask - ' + occurenceStart);
                        util.log.debug('saveImportedTask - ' + occurenceEnd);
                        saveTask(occurenceStart.unix(), occurenceEnd.unix());
                    });
                }
                else {
                    util.log.debug('saveImportedTask - Storing single start-end: ' + taskStart + ' - ' + taskEnd);
                    saveTask(taskStart.unix(), taskEnd.unix());
                }
            }
        }
    };

    exports.processIcalFile = function (inputData, tenantId, userId, btime) {
        try {
            var allData = getCalendar(inputData, userId);
            var calendar = allData.calendar;
            var registry = allData.registry;

            // The user's resource is the one where all tasks are put at the moment.
            var resource = resources.findOne({user: userId, type: 'user'});
            if (resource) {
                for (var i = calendar.getComponents().iterator(); i.hasNext(); ) {
                    var component = i.next();
                    saveImportedTask(component, tenantId, userId, resource.id, btime, registry);
                }
                // We also need to mark all floating tasks for this resource as dirty.
                mongoResources.markResourceTasksAsDirty(btime, resource.id);
                return 'ok';
            }
            else {
                util.log.error('No resource in processIcalFile');
                return 'error';
            }
        }
        catch (e) {
            util.log.error('processIcalFile: ' + e);
            return 'error';
        }
    };
};