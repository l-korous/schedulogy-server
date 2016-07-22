exports.initialize = function (app, mongoTasks, solver, util, settings, mailer, moment) {
    app.options('/task', function () {
        return settings.optionAllowedResponse;
    });

    app.options('/task/:taskId', function () {
        return settings.optionAllowedResponse;
    });

    app.options('/task/checkConstraints', function () {
        return settings.optionAllowedResponse;
    });

    var returnSchedule = function (btime, userId, recalculate, rollbackTaskValues) {
        if (recalculate) {
            var result = solver.solve(mongoTasks.getProblemJson(btime, userId));

            if (result) {
                mongoTasks.storeSlnData(result, btime, userId);
                mongoTasks.recalculateConstraints(btime, userId);
            }
            else {
                if (rollbackTaskValues) {
                    rollbackTaskValues.forEach(function (rollbackTask) {
                        mongoTasks.tasks.update({_id: rollbackTask._id}, rollbackTask.data);
                    });
                }
                mongoTasks.tasks.remove({dirty: true});
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

    app.del('/task/:taskId', function (req, task_id) {
        mongoTasks.removeTask(task_id);

        return returnSchedule(req.params.btime, req.session.data.userId, true);
    });

    app.post('/task', function (req, what) {
        var task = req.postParams;
        var tasksToBeDirtied = [];
        mongoTasks.storeTask(task, req.session.data.userId, tasksToBeDirtied);
        return returnSchedule(req.params.btime, req.session.data.userId, true, tasksToBeDirtied);
    });

    app.post('/task/checkConstraints', function (req, what) {
        var task = req.postParams;
        // mongoTasks.storeTask(task, req.session.data.userId);
        // return returnSchedule(req.params.btime, req.session.data.userId);
        return {
            body: [JSON.stringify(mongoTasks.recalculateConstraint(task, task._id, req.params.btime, false))],
            headers: settings.defaultHeaderJson,
            status: 200
        };
    });

    app.get('/task', function (req) {
        return returnSchedule(req.params.btime, req.session.data.userId, true);
    });
};
