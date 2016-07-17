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
        var endOfWeek = btime.clone().add(1, 'w').startOf('isoWeek').subtract(3, 'd').add(settings.endHour, 'h');
        var weekMiliseconds = Math.floor(slot / (settings.daysPerWeek * settings.hoursPerDay)) * 604800000;
        var slotModWeeks = slot % (settings.daysPerWeek * settings.hoursPerDay);
        var dayMiliseconds = Math.floor(slotModWeeks / settings.hoursPerDay) * 86400000;
        var slotModDays = slot % (settings.hoursPerDay);
        if (slotModDays > endOfDay - 1) {
            dayMiliseconds += (24 - (settings.endHour - settings.startHour)) * settings.msGranularity;
            slotModDays -= (endOfDay - slotModDays);
        }
        var hourMiliseconds = slotModDays * settings.msGranularity;

        var total = weekMiliseconds + dayMiliseconds + hourMiliseconds;
        // Over the weekend.
        if (btime.clone().add(total, 'ms') > endOfWeek)
            total += 2 * 86400000;

        var result = btime.clone().add(total, 'ms');
        clog('* slotToTime finishes with: ' + result + '.');
        return result.unix();
    };
    
    // This function, if given msg === 'ok', generates an OK response (200 HTTP Status Code),
    // otherwise 400, unless not given a code as the second parameter
    exports.simpleResponse = function(msg, code) {
        return {
            body: ['{"message": "' + msg + '"}'],
            status: msg === 'ok' ? 200 : (code ? code : 400),
            headers: settings.defaultHeaderJson
        };
    };
};