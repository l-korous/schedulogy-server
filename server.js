var {Application} = require('stick');

var app = exports.app = new Application();
app.configure('route');
app.configure('params');
var settings = require('./settings.js').settings;
var secrets = require('./secrets.js').secrets;

var moment = require('./bower_components/moment/moment.js');

var {scheduler} = require("./lib/scheduler/main.js");
scheduler.start();

var dbSetup = require('./db.js');
dbSetup.initialize();
var db = dbSetup.db;

var util = require('./util.js');
util.initialize(settings, moment);

var mailer = require('./mailer.js');
mailer.initialize(settings);

var notifications = require('./notifications.js');
notifications.initialize(settings, scheduler, mailer, db, util, moment);

var mongoTasks = require('./mongo-tasks.js');
mongoTasks.initialize(settings, util, db, notifications, moment);

var mongoResources = require('./mongo-resources.js');
mongoResources.initialize(util, mongoTasks, db);

var mongoUsers = require('./mongo-users.js');
mongoUsers.initialize(util, mongoResources, db);

var auth = require('./auth.js');
auth.initialize(settings, secrets, util, moment, mongoUsers);
app.configure(auth);
app.configure('session');

var mongoIcal = require('./mongo-ical.js');
mongoIcal.initialize(app, settings, util, moment, mongoTasks, mongoResources, db);

var mongoUtil = require('./mongo-util.js');
mongoUtil.initialize(util, db);

var solver = require('./solver.js');
solver.initialize(settings, util);

var routesTasks = require('./routes-tasks.js');
routesTasks.initialize(app, mongoTasks, solver, util, settings, mailer, moment, mongoIcal);

var routesUtil = require('./routes-util.js');
routesUtil.initialize(app, mongoUsers, mongoUtil, util, settings, mailer, auth);

var routesResources = require('./routes-resources.js');
routesResources.initialize(app, mongoResources, util, settings);

var routesUsers = require('./routes-users.js');
routesUsers.initialize(app, mongoUsers, util, settings, mailer, auth);

if (require.main == module) {
    require('ringo/httpserver').main(module.id);
}