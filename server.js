var {Application} = require('stick');
var app = exports.app = new Application();
app.configure('route');
app.configure('params');
app.configure("cors");
app.cors({
    allowOrigin: ['*'],
    allowMethods: ['POST', 'GET', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Accept', 'Accept-Encoding', 'Accept-Language', 'Connection', 'Host', 'Origin', 'Referer', 'User-Agent', 'Content-Type'],
    exposeHeaders: [],
    maxAge: 1728000,
    allowCredentials: true
});

var moment = require('./bower_components/moment/moment.js');

var settings = require('./settings.js').settings;

var utilities = require('./utilities.js');
utilities.initialize(settings, moment);

var mongo = require('./mongo.js');
mongo.initialize(app, settings, utilities);

var solver = require('./solver.js');
solver.initialize(settings, utilities);

var mailer = require('./mailer.js');
mailer.initialize(settings);

var routes = require('./routes.js');
routes.initialize(app, mongo, solver, utilities, settings, mailer, moment);

if (require.main == module) {
    require('ringo/httpserver').main(module.id);
}