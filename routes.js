exports.initialize = function (app, mongo, solver, util, settings) {
    app.options('/task', function () {
        return {
            body: [],
            headers: settings.defaultHeader,
            status: 200
        };
    });

    app.post('/task', function (request, what) {
        var btime = util.getBTime();

        var task = request.params;
        
        mongo.storeTask(task);

        return {
            body: [mongo.getClientJson()],
            headers: settings.defaultHeaderJson,
            status: 200
        };

        /*
         * var result = solver.solve(mongo.getProblemJson(btime));
         
         if (result) {
         mongo.storeSlnData(result, btime);
         return {
         body: [mongo.getClientJson()],
         headers: settings.defaultHeaderJson,
         status: 200
         };
         }
         else {
         mongo.tasks.remove({dirty: true});
         return {
         body: 'Invalid input data',
         headers: settings.defaultHeaderJson,
         status: 400
         };
         }
         */
    });

    app.get('/task', function (request) {
        return {
            body: [mongo.getClientJson()],
            headers: settings.defaultHeaderJson,
            status: 200
        };
    });
};