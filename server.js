var {Application} = require('stick');
var app = exports.app = new Application();
app.configure('route');
app.configure('params');
app.configure("cors");
app.cors({
    allowOrigin: ['*'],
    allowMethods: ['POST', 'GET', 'DELETE'],
    allowHeaders: ['Accept', 'Accept-Encoding', 'Accept-Language', 'Connection', 'Host', 'Origin', 'Referer', 'User-Agent', 'Content-Type'],
    exposeHeaders: [],
    maxAge: 1728000,
    allowCredentials: true
});

var mail = require('ringo-mail');
//mail.send({host: 'smtp.gmail.com', port: 587, encrypt: true,username: 'util.314@gmail.com', password: '[4t94ek123', to: 'BB <lukas.korous@gmail.com>'});

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