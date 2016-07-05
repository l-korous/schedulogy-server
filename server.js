var {Application} = require('stick');
    var app = exports.app = new Application();
app.configure('route');
app.configure('params');

var settings = require('./settings.js').settings;

var utilities = require('./utilities.js');
utilities.initialize(settings);

var mongo = require('./mongo.js');
mongo.initialize(app, settings, utilities);

var solver = require('./solver.js');
solver.initialize(settings);

var routes = require('./routes.js');
routes.initialize(app, mongo, solver, utilities, settings);

if (require.main == module) {
    require('ringo/httpserver').main(module.id);
}