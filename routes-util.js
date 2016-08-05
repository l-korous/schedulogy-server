exports.initialize = function (app, mongoUtil, util, settings, mailer, moment, auth) {
    app.post('/api/msg', function (req) {
        try {
            util.cdir(req);
            var user = mongoUtil.getUserById(req.session.data.userId);
            mailer.mail(settings.msgReceiver, 'Message from ' + user.data.email, req.params.msg);
            return util.simpleResponse('ok');
        }
        catch (err) {
            return util.simpleResponse(err.toString());
        }
    });

    app.post('/api/login', function (req) {
        var res = mongoUtil.verifyUserCredentialsReturnUser(req.params);
        if (typeof res === 'object') {
            var runIntro = false;
            if(res.new_user) {
                runIntro = true;
                res.new_user = false;
                mongoUtil.users.save(res);
            }
            return {
                body: ['{"token":"' + auth.generateToken(res) + '", "runIntro":' + runIntro + '}'],
                headers: settings.defaultHeaderJson,
                status: 200
            };
        }
        else
            return util.simpleResponse(res, 403);
    });

    app.post("/api/register", function (req) {
        var res = mongoUtil.createUser(req.params);
        if (res.id) {
            mailer.mail(res.data.email, settings.mailSetupSubject, settings.mailSetupText(res.data._id, res.data.passwordResetHash));

            res = 'ok';
        }
        return util.simpleResponse(res);
    });

    app.post("/api/reset-password", function (req) {
        var res = mongoUtil.getUserByEmail(req.params.email);
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
        var res = mongoUtil.activateUser(req.params.password, req.params.userId, req.params.passwordResetHash);
        return util.simpleResponse(res);
    });

    app.post('/api/set-username', function (req) {
        var res = mongoUtil.setUsername(req.session.data.userId, req.params.username);
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

    app.post('/api/set-password', function (req) {
        var res = mongoUtil.setPassword(req.session.data.userId, req.params.password);
        return util.simpleResponse(res);
    });
};
