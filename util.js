exports.initialize = function (settings, moment) {
    var logging = require("ringo/logging");
    var loggingConfig = module.resolve("ringojs-0.12/modules/config/log4j.properties");
    logging.setConfig(getResource(loggingConfig));
    var log = logging.getLogger('schedulogy');
    
    exports.log = log;
    var cdir = function (what, stringify) {
        // This is only for debug output
        if (settings.logLevel === 3) {
            if (stringify)
                log.debug(moment(new Date()).format('YYYY-MM-DD hh:mm:ss') + ' ' + JSON.stringify(what, null, 4));
            else {
                log.debug(moment(new Date()).format('YYYY-MM-DD hh:mm:ss'));
                log.debug(what);
            }
        }
    };
    exports.cdir = cdir;

    // This is only for comparison !!! As this calculates slots since the beginning of the day.
    exports.ToSlots = function (momentTime) {
        return Math.floor(((momentTime.hour() * 60) + momentTime.minute()) / settings.minGranularity);
    };

    exports.ToMinutesPlusDuration = function (momentTime, addedDuration) {
        return ((momentTime.hour() * 60) + momentTime.minute() + (addedDuration * settings.minuteGranularity));
    };

    exports.equalDays = function (momentTime1, momentTime2) {
        return (momentTime1.format("YYYY-MM-DD") === momentTime2.format("YYYY-MM-DD"));
    };

    exports.timeToSlot = function (timeUnix, btimeUnix) {
        var time = moment.unix(timeUnix);
        var btime = moment.unix(btimeUnix);

        clog('* timeToSlot starts with time = ' + time + ', btime = ' + btime.toString() + '.');

        var weeks = time.diff(btime, 'w');
        clog('** timeToSlot: weeks = ' + weeks);

        var weekSlots = weeks * settings.daysPerWeek * settings.hoursPerDay * settings.slotsPerHour;
        clog('** timeToSlot: weekSlots = ' + weekSlots);

        var timeMinusWeeks = time.clone().subtract(weeks, 'w');
        clog('** timeToSlot: timeMinusWeeks = ' + timeMinusWeeks.toString());

        var days = timeMinusWeeks.diff(btime, 'd');
        clog('** timeToSlot: days = ' + days);

        // There is a weekend in between
        var weekendInBetween = false;
        if ((timeMinusWeeks.isoWeekday() < btime.isoWeekday()) || ((timeMinusWeeks.isoWeekday() === btime.isoWeekday()) && (timeMinusWeeks.hours() < btime.hours()))) {
            days -= 2;
            weekendInBetween = true;
        }
        clog('** timeToSlot: weekendInBetween = ' + weekendInBetween);

        var daySlots = days * settings.hoursPerDay * settings.slotsPerHour;
        clog('** timeToSlot: daySlots = ' + daySlots);

        var timeMinusDays = timeMinusWeeks.clone().subtract(days + (weekendInBetween * 2), 'd');
        clog('** timeToSlot: timeMinusDays = ' + timeMinusDays);

        var slots = 0;
        // This is for the case that time is earlier (but on a further day) than btime.
        if (timeMinusDays.isoWeekday() !== btime.isoWeekday()) {
            clog('** timeToSlot: same weekday = false');
            var timeMinusDaysToSlots = exports.ToSlots(timeMinusDays);
            clog('** timeToSlot: timeMinusDaysToSlots = ' + timeMinusDaysToSlots);
            var shiftToStartSlot = timeMinusDaysToSlots - settings.startSlot;
            clog('** timeToSlot: shiftToStartSlot = ' + shiftToStartSlot);

            var bTimeToSlots = exports.ToSlots(btime);
            clog('** timeToSlot: bTimeToSlots = ' + bTimeToSlots);
            var shiftToEndSlot = settings.endSlot - bTimeToSlots;
            clog('** timeToSlot: shiftToEndSlot = ' + shiftToEndSlot);

            slots = Math.max(0, shiftToStartSlot) + Math.max(0, shiftToEndSlot);
        }
        else {
            clog('** timeToSlot: same weekday = true');
            slots = Math.floor(timeMinusDays.diff(btime, 'm') / settings.minGranularity);
        }

        var result = weekSlots + daySlots + slots;
        clog('* timeToSlot finishes with: ' + result + '.');
        return result;
    };

    exports.slotToTime = function (slot, btimeUnix) {
        var btime = moment.unix(btimeUnix);

        clog('* slotToTime starts with slot = ' + slot + ', btime = ' + btime.toString() + '.');
        var endOfDay = settings.endSlot - exports.ToSlots(btime);
        exports.clog('** slotToTime - endOfDay: ' + endOfDay);
        var endOfWeek = btime.clone().add(1, 'w').startOf('isoWeek').subtract(3, 'd').add(settings.endSlot * settings.minGranularity, 'm');
        exports.clog('** slotToTime - endOfWeek: ' + endOfWeek);
        var weekMinutes = Math.floor(slot / (settings.daysPerWeek * settings.hoursPerDay * settings.slotsPerHour)) * 7 * 1440;
        exports.clog('** slotToTime - weekMinutes: ' + weekMinutes);
        var slotModWeeks = slot % (settings.daysPerWeek * settings.hoursPerDay * settings.slotsPerHour);
        exports.clog('** slotToTime - slotModWeeks: ' + slotModWeeks);
        var dayMinutes = Math.floor(slotModWeeks / (settings.hoursPerDay * settings.slotsPerHour)) * 1440;
        exports.clog('** slotToTime - dayMinutes: ' + dayMinutes);
        var slotModDays = slot % (settings.hoursPerDay * settings.slotsPerHour);
        exports.clog('** slotToTime - slotModDays: ' + slotModDays);
        if (slotModDays > endOfDay - 1) {
            dayMinutes += ((24 * settings.slotsPerHour) - (settings.endSlot - settings.startSlot)) * settings.minGranularity;
            slotModDays -= endOfDay;
        }
        exports.clog('** slotToTime - slotModDays: ' + slotModDays);
        var hourMinutes = slotModDays * settings.minGranularity;
        exports.clog('** slotToTime - hourMinutes: ' + hourMinutes);
        var total = weekMinutes + dayMinutes + hourMinutes;
        exports.clog('** slotToTime - total: ' + total);
        // Over the weekend.
        if (btime.clone().add(dayMinutes + hourMinutes, 'm') > endOfWeek)
            total += 2 * 1440;

        exports.clog('** slotToTime - total: ' + total);

        var result = btime.clone().add(total, 'm');
        clog('* slotToTime finishes with: ' + result + '.');
        return result.unix();
    };

    // This function, if given msg === 'ok', generates an OK response (200 HTTP Status Code),
    // otherwise 400, unless not given a code as the second parameter
    exports.simpleResponse = function (msg, code) {
        return {
            body: ['{"msg": "' + msg + '"}'],
            status: msg === 'ok' ? 200 : (code ? code : 400),
            headers: settings.defaultHeaderJson
        };
    };

    exports.generatePasswordResetHash = function () {
        function createRandomString(length)
        {
            var text = "";
            var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
            for (var i = 0; i < length; i++)
                text += possible.charAt(Math.floor(Math.random() * possible.length));
            return text;
        }

        return createRandomString(32);
    };

    exports.to_utf = function (s) {
        return unescape(encodeURIComponent(s));
    };

    exports.from_utf = function (s) {
        return decodeURIComponent(escape(s));
    };

    exports.getUnixEnd = function (task) {
        // Duration in seconds (unix time is in seconds)
        var duration = 60 * (task.dur * (task.type === 'fixedAllDay' ? 1440 : settings.minGranularity));
        return task.start + duration;
    };

    exports.getUnixStart = function (task) {
        if (task.type !== 'floating')
            return task.start;
        // Duration in seconds (unix time is in seconds)
        var duration = 60 * task.dur * settings.minGranularity;
        return task.due - duration;
    };

    exports.getUnixDuration = function (task) {
        return  60 * (task.dur * (task.type === 'fixedAllDay' ? 1440 : settings.minGranularity));
    };
};