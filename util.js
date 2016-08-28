exports.initialize = function (settings, moment) {
    var logging = require("ringo/logging");
    var loggingConfig = module.resolve("ringojs-0.12/modules/config/log4j.properties");
    logging.setConfig(getResource(loggingConfig));
    var log = logging.getLogger('schedulogy');
    exports.log = log;
    var cdir = function (what, is_for_info) {
        // This is only for debug output
        try {
            if (is_for_info)
                log.info(JSON.stringify(what));
            else
                log.debug(JSON.stringify(what));
        }
        catch (e) {
            log.debug(what.toString());
        }
    };
    exports.cdir = cdir;

    exports.log_request = function (req) {
        var entry = '{method: "' + req.method + '", path: "' + req.pathInfo + '", headers: ' + JSON.stringify(req.headers);
        if (req.params)
            entry += ', params: ' + JSON.stringify(req.params);
        if (req.postParams)
            entry += ', postParams: ' + JSON.stringify(req.postParams);
        entry += '}';
        log.info(entry);
    };

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
        log.debug('* timeToSlot starts with time = ' + time + ', btime = ' + btime.toString() + '.');
        var weeks = time.diff(btime, 'w');
        log.debug('** timeToSlot: weeks = ' + weeks);
        var weekSlots = weeks * settings.daysPerWeek * settings.hoursPerDay * settings.slotsPerHour;
        log.debug('** timeToSlot: weekSlots = ' + weekSlots);
        var timeMinusWeeks = time.clone().subtract(weeks, 'w');
        log.debug('** timeToSlot: timeMinusWeeks = ' + timeMinusWeeks.toString());
        var days = timeMinusWeeks.diff(btime, 'd');
        log.debug('** timeToSlot: days = ' + days);
        var daySlots = days * settings.hoursPerDay * settings.slotsPerHour;
        log.debug('** timeToSlot: daySlots = ' + daySlots);
        var timeMinusDays = timeMinusWeeks.clone().subtract(days, 'd');
        log.debug('** timeToSlot: timeMinusDays = ' + timeMinusDays);
        var slots = 0;
        // This is for the case that time is earlier (but on a further day) than btime.
        if (timeMinusDays.isoWeekday() !== btime.isoWeekday()) {
            log.debug('** timeToSlot: same weekday = false');
            var timeMinusDaysToSlots = exports.ToSlots(timeMinusDays);
            log.debug('** timeToSlot: timeMinusDaysToSlots = ' + timeMinusDaysToSlots);
            var shiftToStartSlot = timeMinusDaysToSlots - settings.startSlot;
            log.debug('** timeToSlot: shiftToStartSlot = ' + shiftToStartSlot);
            var bTimeToSlots = exports.ToSlots(btime);
            log.debug('** timeToSlot: bTimeToSlots = ' + bTimeToSlots);
            var shiftToEndSlot = settings.endSlot - bTimeToSlots;
            log.debug('** timeToSlot: shiftToEndSlot = ' + shiftToEndSlot);
            slots = Math.max(0, shiftToStartSlot) + Math.max(0, shiftToEndSlot);
        }
        else {
            log.debug('** timeToSlot: same weekday = true');
            slots = Math.floor(timeMinusDays.diff(btime, 'm') / settings.minGranularity);
        }

        var result = weekSlots + daySlots + slots;
        log.debug('* timeToSlot finishes with: ' + result + '.');
        return result;
    };
    exports.slotToTime = function (slot, btimeUnix) {
        var btime = moment.unix(btimeUnix);
        log.debug('* slotToTime starts with slot = ' + slot + ', btime = ' + btime.toString() + '.');
        var endOfDay = settings.endSlot - exports.ToSlots(btime);
        log.debug('** slotToTime - endOfDay: ' + endOfDay);
        var endOfWeek = btime.clone().add(1, 'w').startOf('isoWeek').add(settings.endSlot * settings.minGranularity, 'm');
        log.debug('** slotToTime - endOfWeek: ' + endOfWeek);
        var weekMinutes = Math.floor(slot / (settings.daysPerWeek * settings.hoursPerDay * settings.slotsPerHour)) * 7 * 1440;
        log.debug('** slotToTime - weekMinutes: ' + weekMinutes);
        var slotModWeeks = slot % (settings.daysPerWeek * settings.hoursPerDay * settings.slotsPerHour);
        log.debug('** slotToTime - slotModWeeks: ' + slotModWeeks);
        var dayMinutes = Math.floor(slotModWeeks / (settings.hoursPerDay * settings.slotsPerHour)) * 1440;
        log.debug('** slotToTime - dayMinutes: ' + dayMinutes);
        var slotModDays = slot % (settings.hoursPerDay * settings.slotsPerHour);
        log.debug('** slotToTime - slotModDays: ' + slotModDays);
        if (slotModDays > endOfDay - 1) {
            dayMinutes += ((24 * settings.slotsPerHour) - (settings.endSlot - settings.startSlot)) * settings.minGranularity;
            slotModDays -= endOfDay;
        }
        log.debug('** slotToTime - slotModDays: ' + slotModDays);
        var hourMinutes = slotModDays * settings.minGranularity;
        log.debug('** slotToTime - hourMinutes: ' + hourMinutes);
        var total = weekMinutes + dayMinutes + hourMinutes;
        log.debug('** slotToTime - total: ' + total);
        var result = btime.clone().add(total, 'm');
        log.debug('* slotToTime finishes with: ' + result + '.');
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
