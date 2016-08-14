exports.initialize = function (app, mongoUsers, mongoUtil, util, settings, mailer, auth) {
    app.post('/api/simplemail', function (req) {
        util.log_request(req);
        try {
            mailer.mail(settings.msgReceiver, 'Message from ' + req.params.email, req.params.msg);
            return util.simpleResponse('ok');
        }
        catch (err) {
            return util.simpleResponse(err.toString());
        }
    });
    
    app.post('/api/msg', function (req) {
        util.log_request(req);
        try {
            util.cdir(req);
            var user = mongoUsers.getUserByIdInternal(req.session.data.userId);
            mailer.mail(settings.msgReceiver, 'Message from ' + user.data.email, req.params.msg);
            return util.simpleResponse('ok');
        }
        catch (err) {
            return util.simpleResponse(err.toString());
        }
    });

    app.post('/api/login', function (req) {
        util.log_request(req);
        var res = mongoUtil.verifyUserCredentialsReturnUser(req.params);
        if (typeof res === 'object') {
            return {
                body: ['{"token":"' + auth.generateToken(res) + '", "runIntro":' + res.runIntro + '}'],
                headers: settings.defaultHeaderJson,
                status: 200
            };
        }
        else
            return util.simpleResponse(res, 403);
    });

    app.post("/api/reset-password", function (req) {
        var res = mongoUtil.getUserByEmailInternal(req.params.email);
        if (res.id) {
            var newHash = util.generatePasswordResetHash();
            mongoUtil.storePasswordResetHash(res.data._id, newHash);
            mailer.mail(res.data.email, settings.mailSetupSubject, settings.mailSetupText(res.data._id, newHash));
            res = 'ok';
        }
        return util.simpleResponse(res);
    });

    app.post('/api/authenticate', function (req) {
        // The middle ware takes care of forbidden states, once we get here, all is OK.
        return util.simpleResponse('ok');
    });

    app.post('/api/password-reset-check', function (req) {
        var res = mongoUtil.verifyPasswordResetLink(req.params.userId, req.params.passwordResetHash);
        return util.simpleResponse(res);
    });

    app.post('/api/activate', function (req) {
        util.log_request(req);
        var res = mongoUtil.activateUser(req.params.password, req.params.userId, req.params.passwordResetHash);
        return util.simpleResponse(res);
    });
};
