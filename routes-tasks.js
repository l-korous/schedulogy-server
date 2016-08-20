exports.initialize = function (app, mongoTasks, solver, util, settings, mailer, moment, mongoIcal) {
    var http = require('ringo/utils/http');

    var returnSchedule = function (btime, utcOffset, tenantId, rollbackTaskValues) {
        if (mongoTasks.mustSchedule(btime, tenantId)) {
            var btime_startOfDay_moment = moment.unix(btime).utc().startOf('day').add(settings.startSlot * settings.minGranularity, 'm').add(-utcOffset, 'm');
            var btime_startOfDay = btime_startOfDay_moment.unix();
            var btime_startOfWeekOffset = -moment.unix(btime).utc().startOf('week').add(-utcOffset, 'm').diff(btime_startOfDay_moment, 'm') / settings.minGranularity;
            var result = solver.solve(mongoTasks.getProblemJson(btime, btime_startOfDay, btime_startOfWeekOffset, tenantId));

            if (result) {
                mongoTasks.storeSlnData(result, btime_startOfDay);
                mongoTasks.markFixedAsNonDirty(tenantId);
                mongoTasks.recalculateConstraints(btime, tenantId);
            }
            else {
                rollbackTaskValues && mongoTasks.resetTasks(rollbackTaskValues, tenantId);
                mongoTasks.removeTasks({dirty: true}, tenantId);
            }
        }
        else {
            result = 'ok';
            mongoTasks.markFixedAsNonDirty(tenantId);
            mongoTasks.recalculateConstraints(btime, tenantId);
        }

        return {
            body: [mongoTasks.getClientJson(tenantId)],
            headers: settings.defaultHeaderJson,
            status: result ? 200 : 400
        };
    };

    app.del('/api/task/:taskId', function (req, task_id) {
        util.log_request(req);
        mongoTasks.removeTask(task_id);
        return returnSchedule(req.params.btime, req.headers.utcoffset, req.session.data.tenantId);
    });

    app.del('/api/task', function (req) {
        util.log_request(req);
        mongoTasks.removeTasks({}, req.session.data.tenantId);
        return returnSchedule(req.params.btime, req.headers.utcoffset, req.session.data.tenantId);
    });

    app.post('/api/task', function (req) {
        util.log_request(req);
        var task = req.postParams;
        var rollbackTaskValues = [];
        mongoTasks.storeTask(task, req.session.data.tenantId, req.session.data.userId, rollbackTaskValues);
        return returnSchedule(req.params.btime, req.headers.utcoffset, req.session.data.tenantId, rollbackTaskValues);
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
        return returnSchedule(req.params.btime, req.headers.utcoffset, req.session.data.tenantId);
    });

    app.post('/api/ical', function (req) {
        util.log_request(req);
        var res = 'ok';
        var file = http.parseFileUpload(req).file;
        if (!file) {
            res = 'Invalid file';
        }
        else {
            if (file.value.length > (settings.maxICalSize * 1024 * 1024))
                res = 'File too large, maximum size is ' + settings.maxICalSize + 'MB.';
            else {
                mongoIcal.processIcalFile(file.value, req.session.data.tenantId, req.session.data.userId, req.headers.btime);
                return returnSchedule(req.headers.btime, req.headers.utcoffset, req.session.data.tenantId);
            }
        }

        return util.simpleResponse(res);
    });
};
