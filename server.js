var {Application} = require('stick');
var app = exports.app = new Application();
app.configure('route');
app.configure('params');
var settings = require('./settings.js').settings;
var secrets = require('./secrets.js').secrets;
var crypt = require('./crypt.js');
crypt.initialize();

var auth = require('./auth.js');
auth.initialize(settings, secrets);
app.configure(auth);
app.configure('session');

var moment = require('./bower_components/moment/moment.js');

var util = require('./util.js');
util.initialize(settings, moment);

var mongoTasks = require('./mongo-tasks.js');
mongoTasks.initialize(app, settings, util);

var mongoUtil = require('./mongo-util.js');
mongoUtil.initialize(app, settings, secrets, crypt, util);

var solver = require('./solver.js');
solver.initialize(settings, util);

var mailer = require('./mailer.js');
mailer.initialize(settings);

var routesTasks = require('./routes-tasks.js');
routesTasks.initialize(app, mongoTasks, solver, util, settings, mailer, moment);

var routesUtil = require('./routes-util.js');
routesUtil.initialize(app, mongoUtil, util, settings, mailer, moment);

if (require.main == module) {
    require('ringo/httpserver').main(module.id);
}