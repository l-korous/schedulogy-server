exports.initialize = function (app, mongo, solver, util, settings, mailer, moment) {
    app.options('/task', function () {
        return {
            body: [],
            headers: settings.defaultHeader,
            status: 200
        };
    });

    app.options('/task/:taskId', function () {
        return {
            body: [],
            headers: settings.defaultHeader,
            status: 200
        };
    });

    app.options('/msg', function () {
        return {
            body: [],
            headers: settings.defaultHeader,
            status: 200
        };
    });

    var returnSchedule = function (btime) {
        if (0) {
            return {
                body: [mongo.getClientJson()],
                headers: settings.defaultHeaderJson,
                status: 200
            };
        }
        else {
            var result = solver.solve(mongo.getProblemJson(btime));

            if (result) {
                mongo.storeSlnData(result, btime);
                mongo.recalculateConstraints(btime);
                
                return {
                    body: [mongo.getClientJson()],
                    headers: settings.defaultHeaderJson,
                    status: 200
                };
            }
            else {
                mongo.tasks.remove({dirty: true});
                return {
                    body: ['Invalid input data'],
                    headers: settings.defaultHeaderJson,
                    status: 400
                };
            }
        }
    };

    app.del('/task/:taskId', function (request, task_id) {
        mongo.removeTask(task_id);
        
        return returnSchedule(request.params.btime);
    });

    app.post('/task', function (request, what) {
        var task = request.postParams;
        mongo.storeTask(task);
        
        return returnSchedule(request.params.btime);
    });

    app.get('/task', function (request) {
        return returnSchedule(request.params.btime);
    });

    app.post('/msg', function (request) {
        return {
            body: [],
            headers: settings.defaultHeader,
            status: 200
        };
    });
};
