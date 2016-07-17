exports.initialize = function (app, mongoUtil, util, settings, mailer, moment, auth) {
    app.options('/msg', function () {
        return settings.optionAllowedResponse;
    });
    app.options('/login', function () {
        return settings.optionAllowedResponse;
    });
    app.options('/register', function () {
        return settings.optionAllowedResponse;
    });
    app.options('/password-reset-check', function () {
        return settings.optionAllowedResponse;
    });
    app.options('/authenticate', function () {
        return settings.optionAllowedResponse;
    });
    app.options('/activate', function () {
        return settings.optionAllowedResponse;
    });

    app.post('/msg', function (req) {
        // TODO
    });
    app.post('/login', function (req) {
        var res = mongoUtil.verifyUserCredentialsReturnUser(req.params.credentials);
        if (typeof res === 'object') {
            return {
                body: ['{"token":"' + auth.generateToken(res) + '"}'],
                headers: settings.defaultHeaderJson,
                status: 200
            };
        }
        else
            return util.simpleResponse(res, 403);
    });

    app.post("/register", function (req) {
        var res = mongoUtil.createUser(req.params);
        if (res.id) {
            mailer.mail(res.data.email, settings.mailSetupSubject, settings.mailSetupText(res.data._id, res.data.passwordResetHash));
            
            res = 'ok';
        }
        return util.simpleResponse(res);
    });

    app.post('/authenticate', function (req) {
        // The middle ware takes care of forbidden states, once we get here, all is OK.
        return util.simpleResponse('ok');
    });

    app.post('/password-reset-check', function (req) {
        var res = mongoUtil.verifyPasswordResetLink(req.params.userId, req.params.passwordResetHash);
        return util.simpleResponse(res);
    });

    app.post('/activate', function (req) {
        var res = mongoUtil.activateUser(req.params.password, req.params.userId, req.params.passwordResetHash);
        return util.simpleResponse(res);
    });
};
