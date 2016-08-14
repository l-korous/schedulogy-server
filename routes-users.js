exports.initialize = function (app, mongoUsers, util, settings, mailer, auth) {
    var http = require('ringo/utils/http');

    app.post("/api/register", function (req) {
        util.log_request(req);
        var res = mongoUsers.createUser(req.params);
        if (res.id) {
            mailer.mail(res.data.email, settings.mailSetupSubject, settings.mailSetupText(res.data._id, res.data.passwordResetHash));

            res = 'ok';
        }
        return util.simpleResponse(res);
    });

    app.post("/api/user", function (req) {
        util.log_request(req);
        if(!req.params.tenant)
            req.params.tenant = req.session.data.tenantId;
        var res = mongoUsers.createUser(req.params);
        if (res.id) {
            mailer.mail(res.data.email, settings.mailSetupSubject, settings.mailSetupText(res.data._id, res.data.passwordResetHash));
            return {
                body: [mongoUsers.wrapReturnArrayInJson(mongoUsers.getUsers({tenant: new Packages.org.bson.types.ObjectId(req.session.data.tenantId)}))],
                headers: settings.defaultHeaderJson,
                status: 200
            };
        }
        return util.simpleResponse(res);
    });

    app.del('/api/user/:userId', function (req, userId) {
        util.log_request(req);
        var res = mongoUsers.removeUser(userId);
        if (res === 'ok')
            return {
                body: [mongoUsers.wrapReturnArrayInJson(mongoUsers.getUsers({tenant: new Packages.org.bson.types.ObjectId(req.session.data.tenantId)}))],
                headers: settings.defaultHeaderJson,
                status: 200
            };
        else
            return util.simpleResponse(res);
    });

    app.get('/api/user', function (req) {
        util.log_request(req);

        return {
            body: [mongoUsers.wrapReturnArrayInJson(mongoUsers.getUsers({tenant: new Packages.org.bson.types.ObjectId(req.session.data.tenantId)}))],
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

    app.post('/api/user/set-username', function (req) {
        util.log_request(req);
        var res = mongoUsers.setUsername(req.session.data.userId, req.params.username);
        if (typeof res === 'object') {
            return {
                body: ['{"token":"' + auth.generateToken(res) + '"}'],
                headers: settings.defaultHeaderJson,
                status: 200
            };
        }
        else
            return util.simpleResponse(res);
    });

    app.post('/api/user/set-password', function (req) {
        util.log_request(req);
        var res = mongoUsers.setPassword(req.session.data.userId, req.params.password);
        return util.simpleResponse(res);
    });
};
