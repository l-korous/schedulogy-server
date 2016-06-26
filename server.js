var {Application} = require('stick');
var app = exports.app = new Application();
app.configure('route');
app.configure('params');

var mongo = require('./mongoSetup.js');
mongo.initialize(app);

var solver = require('./solver.js');

var routes = require('./routes.js');
routes.initialize(app, mongo, solver);

if (require.main == module) {
    require('ringo/httpserver').main(module.id);
}