exports.initialize = function (app, mongo, solver, util) {
    app.post('/task', function (request) {
        var btime = util.getBTime();

        var task = request.params;

        mongo.storeTask(task);

        var result = solver.solve(mongo.getProblemJson(btime));

        if (result) {
            mongo.storeSlnData(result, btime);
            return {
                body: [JSON.stringify(mongo.getClientJson())],
                headers: {'Content-Type': 'application/json'},
                status: 200
            };
        }
        else {
            mongo.tasks.remove({dirty: true});
            return {
                body: 'Invalid input data',
                headers: {'Content-Type': 'application/json'},
                status: 400
            };
        }
    });

    app.get('/', function (request) {
        var btime = util.getBTime();
        
        var result = solver.solve(mongo.getProblemJson(btime));

        if (result) {
            mongo.storeSlnData(result, btime);
            return {
                body: [JSON.stringify(mongo.getClientJson())],
                headers: {'Content-Type': 'application/json'},
                status: 200
            };
        }
        else {
            mongo.tasks.remove({dirty: true});
            return {
                body: 'Invalid input data',
                headers: {'Content-Type': 'application/json'},
                status: 400
            };
        }
    });
};