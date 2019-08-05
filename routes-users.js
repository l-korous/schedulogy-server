exports.initialize = function (app, mongoUsers, mongoTenants, util, settings, mailer, auth) {
    var {request} = require('ringo/httpclient');
    app.post('/api/loginSocial', function (req) {
        util.log_request(req);
        var exchange = request({
            method: 'POST',
            url: 'https://schedulogy.eu.auth0.com/tokeninfo',
            contentType: 'application/x-www-form-urlencoded',
            data: 'id_token=' + req.params.authOToken,
        });
        if (exchange.status === 200) {
            var user = mongoUsers.getUserByEmail(JSON.parse(exchange.content).email);
            // If this is a new user, create.
            if (typeof user !== 'object')
                user = mongoUsers.createUser({email: JSON.parse(exchange.content).email, timeZone: req.params.timeZone});
            // If we do not have user even after possible creation, something is wrong
            if (typeof user !== 'object')
                return util.simpleResponse(user, 400);
            else {
                if (user.newUser) {
                    user.newUser = false;
                    mongoUsers.updateUser(user);
                    user.runIntro = true;
                }
                else
                    user.runIntro = false;
                var headerToReturn = settings.defaultHeaderJson;
                headerToReturn['Set-Cookie'] = 'schedulogyAppAccessed=1; Domain=.schedulogy.com; Path=/; Max-Age=' + 7 * 86400 + ';';
                return {
                    body: ['{"token":"' + auth.generateToken(user) + '", "runIntro":' + user.runIntro + '}'],
                    headers: headerToReturn,
                    status: 200
                };
            }
        }
        else
            return util.simpleResponse(exchange.message, exchange.status);
    });
    app.post("/api/user", function (req) {
        util.log_request(req);
        if (!req.params.tenant)
            req.params.tenant = req.session.data.tenantId;
        if (req.params._id) {
            var result = mongoUsers.updateUser(req.params);
            if (result === 'ok')
                return {
                    body: [mongoUsers.wrapReturnArrayInJson(mongoUsers.getUsers({tenant: req.session.data.tenantId}))],
                    headers: settings.defaultHeaderJson,
                    status: 200
                };
            else
                return util.simpleResponse(res);
        }
        else {
            return util.simpleResponse('Invalid operation - update User without id', 400);
        }
    });
    app.del('/api/user/:userId', function (req, userId) {
        util.log_request(req);
        var result = mongoUsers.resetUser(userId);
        if (result === 'ok')
            return {
                body: [mongoUsers.wrapReturnArrayInJson(mongoUsers.getUsers({tenant: req.session.data.tenantId}))],
                headers: settings.defaultHeaderJson,
                status: 200
            };
        else
            return util.simpleResponse(result);
    });
    app.get('/api/user', function (req) {
        util.log_request(req);
        var tenant = mongoTenants.getTenantById(req.session.data.tenantId);
        var originalTenant = mongoTenants.getTenantById(req.session.data.originalTenantId);
        return {
            body: [mongoUsers.wrapReturnArrayInJson(mongoUsers.getUsers({tenant: req.session.data.tenantId}), {tenantCode: tenant.code, originalTenantCode: originalTenant.code})],
            headers: settings.defaultHeaderJson,
            status: 200
        };
    });
    app.get('/api/user/:userId', function (req, userId) {
        util.log_request(req);
        var user = mongoUsers.getUserById(userId);
        return {
            body: [user],
            headers: settings.defaultHeaderJson,
            status: 200
        };
    });
};
