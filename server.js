var {Application} = require('stick');
var app = exports.app = new Application();
app.configure('route');
app.configure('params');
var settings = require('./settings.js').settings;
var secrets = require('./secrets.js').secrets;

var moment = require('./bower_components/moment/moment.js');

var util = require('./util.js');
util.initialize(settings, moment);

var auth = require('./auth.js');
auth.initialize(settings, secrets, util, moment);
app.configure(auth);
app.configure('session');

var mongoTasks = require('./mongo-tasks.js');
mongoTasks.initialize(app, settings, util);

var mongoIcal = require('./mongo-ical.js');
mongoIcal.initialize(app, settings, util, moment, mongoTasks);

var mongoUtil = require('./mongo-util.js');
mongoUtil.initialize(app, settings, secrets, util);

var mongoResources = require('./mongo-resources.js');
mongoResources.initialize(app, settings, util);

var solver = require('./solver.js');
solver.initialize(settings, util);

var mailer = require('./mailer.js');
mailer.initialize(settings);

var routesTasks = require('./routes-tasks.js');
routesTasks.initialize(app, mongoTasks, solver, util, settings, mailer, moment, mongoIcal);

var routesUtil = require('./routes-util.js');
routesUtil.initialize(app, mongoUtil, util, settings, mailer, moment, auth);

var routesResources = require('./routes-resources.js');
routesResources.initialize(app, mongoResources, util, settings);

if (require.main == module) {
    require('ringo/httpserver').main(module.id);
}