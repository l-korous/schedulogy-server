exports.initialize = function (app, mongoTasks, solver, util, settings, mailer, moment) {
    app.options('/task', function () {
        return settings.optionAllowedResponse;
    });

    app.options('/task/:taskId', function () {
        return settings.optionAllowedResponse;
    });

    var returnSchedule = function (btime, userId) {
        if (0) {
            return {
                body: [mongoTasks.getClientJson(userId)],
                headers: settings.defaultHeaderJson,
                status: 200
            };
        }
        else {
            var result = solver.solve(mongoTasks.getProblemJson(btime));

            if (result) {
                mongoTasks.storeSlnData(result, btime);
                mongoTasks.recalculateConstraints(btime);
                
                return {
                    body: [mongoTasks.getClientJson(userId)],
                    headers: settings.defaultHeaderJson,
                    status: 200
                };
            }
            else {
                mongoTasks.tasks.remove({dirty: true});
                return {
                    body: ['Invalid input data'],
                    headers: settings.defaultHeaderJson,
                    status: 400
                };
            }
        }
    };

    app.del('/task/:taskId', function (req, task_id) {
        mongoTasks.removeTask(task_id);
        
        return returnSchedule(req.params.btime, req.session.data.userId);
    });

    app.post('/task', function (req, what) {
        var task = req.postParams;
        mongoTasks.storeTask(task, req.session.data.userId);
        return returnSchedule(req.params.btime, req.session.data.userId);
    });

    app.get('/task', function (req) {
        return returnSchedule(req.params.btime, req.session.data.userId);
    });
};
