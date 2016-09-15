exports.initialize = function (app, mongoUsers, util, settings, mailer, auth) {
    var http = require('ringo/utils/http');

    app.post("/api/register", function (req) {
        util.log_request(req);
        var res = mongoUsers.createUser(req.params, req.headers.utcoffset);
        if (res.id) {
            res = mailer.mail(res.data.email, settings.mailSetupSubject, settings.mailSetupText(res.data._id, res.data.passwordResetHash));
        }
        return util.simpleResponse(res);
    });

    app.post("/api/user", function (req) {
        util.log_request(req);
        if (!req.params.tenant)
            req.params.tenant = req.session.data.tenantId;
        if (req.params._id) {
            var res = mongoUsers.updateUser(req.params);
            if (res === 'ok')
                return {
                    body: [mongoUsers.wrapReturnArrayInJson(mongoUsers.getUsers({tenant: req.session.data.tenantId}))],
                    headers: settings.defaultHeaderJson,
                    status: 200
                };
            else
                return util.simpleResponse(res);
        }
        else {
            var res = mongoUsers.createUser(req.params, req.headers.utcoffset);
            if (res.id) {
                var res_mail = mailer.mail(res.data.email, settings.mailSetupSubject, settings.mailSetupText(res.data._id, res.data.passwordResetHash));
                if (res_mail !== 'ok')
                    mongoUsers.removeUser(req.params.btime, res.id);

                var bodyToReturn = [mongoUsers.wrapReturnArrayInJson(mongoUsers.getUsers({tenant: req.session.data.tenantId}), res_mail !== 'ok' ? ('"error":"' + res_mail + '"') : null)];

                return {
                    body: bodyToReturn,
                    headers: settings.defaultHeaderJson,
                    status: (res_mail === 'ok') ? 200 : 400
                };
            }
            return util.simpleResponse(res);
        }
    });

    app.del('/api/user/:userId', function (req, userId) {
        util.log_request(req);
        var res = mongoUsers.removeUser(req.params.btime, userId);
        if (res === 'ok')
            return {
                body: [mongoUsers.wrapReturnArrayInJson(mongoUsers.getUsers({tenant: req.session.data.tenantId}))],
                headers: settings.defaultHeaderJson,
                status: 200
            };
        else
            return util.simpleResponse(res);
    });

    app.get('/api/user', function (req) {
        util.log_request(req);

        return {
            body: [mongoUsers.wrapReturnArrayInJson(mongoUsers.getUsers({tenant: req.session.data.tenantId}))],
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

    app.post('/api/password-reset-check', function (req) {
        var res = mongoUsers.verifyPasswordResetLink(req.params.userId, req.params.passwordResetHash);
        return util.simpleResponse(res);
    });

    app.post('/api/activate', function (req) {
        util.log_request(req);
        var res = mongoUsers.activateUser(req.params.password, req.params.userId, req.params.passwordResetHash);
        if (typeof res === 'object') {
            return {
                body: [JSON.stringify(res)],
                headers: settings.defaultHeaderJson,
                status: 200
            };
        }
        else
            return util.simpleResponse(res);
    });
};
