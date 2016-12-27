exports.initialize = function (app, mongoTasks, solver, util, settings, mailer, moment, mongoIcal) {
    var http = require('ringo/utils/http');

    var returnSchedule = function (btime, tenantId) {
        if (mongoTasks.mustSchedule(btime, tenantId)) {
            var btime_startOfDay_moment = moment.unix(btime).utc().startOf('day').add(settings.startSlot * settings.minuteGranularity, 'm');
            var btime_startOfDay = btime_startOfDay_moment.unix();
            var btime_startOfWeekOffset = -moment.unix(btime).utc().startOf('isoWeek').diff(btime_startOfDay_moment, 'm') / settings.minuteGranularity;
            try {
                var result = solver.solve(mongoTasks.getProblemJson(btime, btime_startOfDay, btime_startOfWeekOffset, tenantId));
            }
            catch (e) {
                util.log.error(e);
            }
            if (result) {
                mongoTasks.storeSlnData(result, btime_startOfDay);
                mongoTasks.markFixedAsNonDirty(tenantId);
                mongoTasks.recalculateConstraints(btime, tenantId);
            }
            else
                mongoTasks.markFixedAsNonDirty(tenantId);
        }
        else {
            result = 'ok';
            mongoTasks.markFixedAsNonDirty(tenantId);
            mongoTasks.recalculateConstraints(btime, tenantId);
        }

        return {
            body: [mongoTasks.getClientJson(tenantId, btime)],
            headers: settings.defaultHeaderJson,
            status: result ? 200 : 400
        };
    };

    app.del('/api/task/:taskId', function (req, task_id) {
        util.log_request(req);
        mongoTasks.removeTask(task_id);
        return returnSchedule(req.params.btime, req.session.data.tenantId);
    });

    app.del('/api/task', function (req) {
        util.log_request(req);
        mongoTasks.removeTasks({}, req.session.data.tenantId);
        return returnSchedule(req.params.btime, req.session.data.tenantId);
    });

    app.post('/api/task', function (req) {
        util.log_request(req);
        var task = req.postParams;
        mongoTasks.storeTask(task, req.session.data.tenantId, req.session.data.userId, req.params.btime);
        return returnSchedule(req.params.btime, req.session.data.tenantId);
    });

    app.post('/api/task/checkConstraints', function (req, what) {
        util.log_request(req);
        var task = req.postParams;

        var toReturn = mongoTasks.recalculateConstraint(task, req.params.btime, false);
        return {
            body: [toReturn ? JSON.stringify(toReturn) : ''],
            headers: settings.defaultHeaderJson,
            status: 200
        };
    });

    app.get('/api/task', function (req) {
        util.log_request(req);
        return returnSchedule(req.params.btime, req.session.data.tenantId);
    });

    app.post('/api/ical', function (req) {
        util.log_request(req);
        var result = 'ok';
        var file = http.parseFileUpload(req).file;
        if (!file) {
            result = 'Invalid file';
        }
        else {
            if (file.value.length > (settings.maxICalSize * 1024 * 1024))
                result = 'File too large, maximum size is ' + settings.maxICalSize + 'MB.';
            else {
                result = mongoIcal.processIcalFile(file.value, req.session.data.tenantId, req.session.data.userId, req.headers.btime);
                if (result === 'ok')
                    return returnSchedule(req.headers.btime, req.session.data.tenantId);
            }
        }

        return util.simpleResponse(result);
    });
};
