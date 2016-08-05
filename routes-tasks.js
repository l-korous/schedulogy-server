exports.initialize = function (app, mongoTasks, solver, util, settings, mailer, moment, mongoIcal) {
    var http = require('ringo/utils/http');

    var returnSchedule = function (btime, userId, recalculate, rollbackTaskValues) {
        if (recalculate) {
            var btime_startOfDay = moment.unix(btime).startOf('day').add(settings.startSlot * settings.minGranularity, 'm').unix();
            var result = solver.solve(mongoTasks.getProblemJson(btime, userId));

            if (result) {
                mongoTasks.storeSlnData(result, btime_startOfDay, userId);
                mongoTasks.recalculateConstraints(btime, userId);
            }
            else {
                rollbackTaskValues && mongoTasks.resetTasks(rollbackTaskValues, userId);
                mongoTasks.removeTasks({dirty: true}, userId);
            }

            return {
                body: [mongoTasks.getClientJson(userId)],
                headers: settings.defaultHeaderJson,
                status: result ? 200 : 400
            };
        }
        else {
            return {
                body: [mongoTasks.getClientJson(userId)],
                headers: settings.defaultHeaderJson,
                status: 200
            };
        }
    };

    app.del('/api/task/:taskId', function (req, task_id) {
        mongoTasks.removeTask(task_id);

        return returnSchedule(req.params.btime, req.session.data.userId, true);
    });

    app.del('/api/task', function (req) {
        mongoTasks.removeTasks({}, req.session.data.userId);

        return returnSchedule(req.params.btime, req.session.data.userId, true);
    });

    app.post('/api/task', function (req, what) {
        var task = req.postParams;
        var tasksToBeDirtied = [];
        mongoTasks.storeTask(task, req.session.data.userId, tasksToBeDirtied);
        return returnSchedule(req.params.btime, req.session.data.userId, true, tasksToBeDirtied);
    });

    app.post('/api/task/checkConstraints', function (req, what) {
        var task = req.postParams;
        // mongoTasks.storeTask(task, req.session.data.userId);
        // return returnSchedule(req.params.btime, req.session.data.userId);
        return {
            body: [JSON.stringify(mongoTasks.recalculateConstraint(task, task._id, req.params.btime, false))],
            headers: settings.defaultHeaderJson,
            status: 200
        };
    });

    app.get('/api/task', function (req) {
        return returnSchedule(req.params.btime, req.session.data.userId, false);
    });

    app.post('/api/ical', function (req) {
        var res = 'ok';
        var file = http.parseFileUpload(req).file;
        if (!file) {
            res = 'Invalid file';
        }
        else {
            if (file.value.length > (settings.maxICalSize * 1024 * 1024))
                res = 'File too large, maximum size is ' + settings.maxICalSize + 'MB.';
            else {
                mongoIcal.processIcalFile(file.value, req.session.data.userId, req.headers.btime);
                return returnSchedule(req.headers.btime, req.session.data.userId, true);
            }
        }

        return util.simpleResponse(res);
    });
};