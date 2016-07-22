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

    exports.timeToSlot = function (timeUnix, btimeUnix) {
        var time = moment.unix(timeUnix);
        var btime = moment.unix(btimeUnix);

        clog('* timeToSlot starts with time = ' + time + ', btime = ' + btime.toString() + '.');

        var weeks = time.diff(btime, 'w');
        var weekSlots = weeks * settings.daysPerWeek * settings.hoursPerDay;

        var time_minusWeeks = time.clone().subtract(weeks, 'w');
        clog('** timeToSlot: time_minusWeeks = ' + time_minusWeeks.toString());

        var days = time_minusWeeks.diff(btime, 'd');
        // There is a weekend in between
        var weekendInBetween = false;
        if ((time_minusWeeks.isoWeekday() < btime.isoWeekday()) || ((time_minusWeeks.isoWeekday() === btime.isoWeekday()) && (time_minusWeeks.hours() < btime.hours()))) {
            days -= 2;
            weekendInBetween = true;
        }
        var daySlots = days * settings.hoursPerDay;
        var time_minusDays = time.clone().subtract(days + (weekendInBetween * 2), 'd');
        clog('** timeToSlot: time_minusDays = ' + time_minusDays);

        var hours = 0;
        // This is for the case that time is earlier (but on a further day) than btime.
        if (time_minusDays.isoWeekday() !== btime.isoWeekday())
            hours = Math.max(0, time_minusDays.hours() - settings.startHour) + Math.max(0, (settings.endHour - btime.hours()));
        else
            hours = time_minusDays.diff(btime, 'h');

        var result = weekSlots + daySlots + hours;
        clog('* timeToSlot finishes with: ' + result + '.');
        return result;
    };

    exports.slotToTime = function (slot, btimeUnix) {
        var btime = moment.unix(btimeUnix);

        clog('* slotToTime starts with slot = ' + slot + ', btime = ' + btime.toString() + '.');
        var endOfDay = settings.endHour - btime.hours();
        exports.clog('** slotToTime - endOfDay: ' + endOfDay);
        var endOfWeek = btime.clone().add(1, 'w').startOf('isoWeek').subtract(3, 'd').add(settings.endHour, 'h');
        exports.clog('** slotToTime - endOfWeek: ' + endOfWeek);
        var weekMiliseconds = Math.floor(slot / (settings.daysPerWeek * settings.hoursPerDay)) * 604800000;
        exports.clog('** slotToTime - weekMiliseconds: ' + weekMiliseconds);
        var slotModWeeks = slot % (settings.daysPerWeek * settings.hoursPerDay);
        exports.clog('** slotToTime - slotModWeeks: ' + slotModWeeks);
        var dayMiliseconds = Math.floor(slotModWeeks / settings.hoursPerDay) * 86400000;
        exports.clog('** slotToTime - dayMiliseconds: ' + dayMiliseconds);
        var slotModDays = slot % (settings.hoursPerDay);
        exports.clog('** slotToTime - slotModDays: ' + slotModDays);
        if (slotModDays > endOfDay - 1) {
            dayMiliseconds += (24 - (settings.endHour - settings.startHour)) * settings.msGranularity;
            slotModDays -= endOfDay;
        }
        exports.clog('** slotToTime - slotModDays: ' + slotModDays);
        var hourMiliseconds = slotModDays * settings.msGranularity;
        exports.clog('** slotToTime - hourMiliseconds: ' + hourMiliseconds);
        var total = weekMiliseconds + dayMiliseconds + hourMiliseconds;
        exports.clog('** slotToTime - total: ' + total);
        // Over the weekend.
        if (btime.clone().add(total, 'ms') > endOfWeek)
            total += 2 * 86400000;

        exports.clog('** slotToTime - total: ' + total);

        var result = btime.clone().add(total, 'ms');
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
};