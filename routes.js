exports.initialize = function (app, mongo, solver) {
    app.post('/task', function (request) {
        // Set BreakingHour
        var breakingHour = new Date();
        var year = breakingHour.getUTCFullYear();
        var month = breakingHour.getUTCMonth();
        var day = breakingHour.getUTCDate();
        var hour = breakingHour.getUTCHours();

        console.dir(request);
        var task = request.params;
        // TODO validation

        // Dependency handling.
        if (task.dependencies) {
            for (var i = 0; i < task.dependencies.length; i++) {
                var dependency = task.dependencies[i];
                task.dependencies[i] = mongo.tasks.findOne(new Packages.org.bson.types.ObjectId(dependency));
            }
        }

        // Dirty bit
        task.dirty = true;

        // Save with 'dirty' bit
        //mongo.tasks.insert(task);

        // call DB -> JSON for CPS input
        var result = solver.solve(mongo.getInputJson());
        if(result) {
            // - wipe all 'dirty' flags
            // - store all starts according to BreakingHour
            // - generate JSON, send back
        }

        // call CPS, get SLN JSON back
        // if successful:
        // if NOT successful:
        // - delete all 'dirty' data        
    });

    app.get('/', function (request) {
        // Add the Jena library to the classpath
        addToClasspath("../cpsolver/dist/cpsolver-1.3-SNAPSHOT.jar");

// Import a whole package from the loaded library
        importPackage(org.cpsolver.ifs.example.tt);

        var test = new Test;

        var asdf = test.calculate();

        return {
            body: [asdf],
            headers: {'Content-Type': 'text/html'},
            status: 200
        };
    });
};