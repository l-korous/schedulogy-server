exports.initialize = function (settings, moment) {
    var clog = function (what) {
        if (settings.debug)
            console.log(what);
    };
    exports.clog = clog;

    var cdir = function (what, stringify) {
        if (stringify)
            console.log(JSON.stringify(what, null, 4));
        else if (settings.debug)
            console.dir(what);
    };
    exports.cdir = cdir;

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
        var weekSlots = weeks * settings.daysPerWeek * settings.hoursPerDay * settings.slotsPerHour;

        var time_minusWeeks = time.clone().subtract(weeks, 'w');
        clog('** timeToSlot: time_minusWeeks = ' + time_minusWeeks.toString());

        var days = time_minusWeeks.diff(btime, 'd');
        // There is a weekend in between
        var weekendInBetween = false;
        if ((time_minusWeeks.isoWeekday() < btime.isoWeekday()) || ((time_minusWeeks.isoWeekday() === btime.isoWeekday()) && (time_minusWeeks.hours() < btime.hours()))) {
            days -= 2;
            weekendInBetween = true;
        }
        var daySlots = days * settings.hoursPerDay * settings.slotsPerHour;
        var time_minusDays = time.clone().subtract(days + (weekendInBetween * 2), 'd');
        clog('** timeToSlot: time_minusDays = ' + time_minusDays);

        var slots = 0;
        // This is for the case that time is earlier (but on a further day) than btime.
        if (time_minusDays.isoWeekday() !== btime.isoWeekday())
            slots = Math.max(0, (exports.ToSlots(time_minusDays) - settings.startSlot)) + Math.max(0, (settings.endSlot - exports.ToSlots(btime)));
        else
            slots = Math.floor(time_minusDays.diff(btime, 'm') / settings.minGranularity);

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
            dayMinutes += (24 - (settings.endSlot - settings.startSlot)) * settings.minGranularity;
            slotModDays -= endOfDay;
        }
        exports.clog('** slotToTime - slotModDays: ' + slotModDays);
        var hourMinutes = slotModDays * settings.minGranularity;
        exports.clog('** slotToTime - hourMinutes: ' + hourMinutes);
        var total = weekMinutes + dayMinutes + hourMinutes;
        exports.clog('** slotToTime - total: ' + total);
        // Over the weekend.
        if (btime.clone().add(total, 'ms') > endOfWeek)
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

        return createRandomString(128);
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