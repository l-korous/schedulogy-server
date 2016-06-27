var {Application} = require('stick');
var app = exports.app = new Application();
app.configure('route');
app.configure('params');

var settings = require('./settings.js');
var utilities = require('./utilities.js');

var mongo = require('./mongoSetup.js');
mongo.initialize(app, settings, utilities);

var solver = require('./solver.js');

var routes = require('./routes.js');
routes.initialize(app, mongo, solver);

if (require.main == module) {
    require('ringo/httpserver').main(module.id);
}