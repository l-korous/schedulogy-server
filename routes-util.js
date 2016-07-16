exports.initialize = function (app, mongoUtil, util, settings, mailer, moment, auth) {
    var defer = require("ringo/promise");

    app.options('/msg', function () {
        return settings.optionAllowedResponse;
    });
    app.options('/login', function () {
        return settings.optionAllowedResponse;
    });
    app.options('/register', function () {
        return settings.optionAllowedResponse;
    });

    app.post('/msg', function (req) {
        // TODO
    });
    app.post('/login', function (req) {
        var user = mongoUtil.verifyUserCredentialsReturnUser(req.params.credentials);
        if (user)
            return {
                body: [auth.generateToken(user)],
                headers: settings.defaultHeader,
                status: 200
            };
        else
            return settings.forbiddenResponse;
    });

    app.post("/register", function (req) {
        var res = mongoUtil.createUser(req.params);
        if (res._id) {

            mailer.mail(res.email, settings.mailSetupSubject, settings.mailSetupText(res.email, res.passwordSetupHash));

            return {
                body: [res],
                status: 200,
                headers: settings.defaultHeaderJson
            };
        }
        else
            return {
                body: [res],
                status: 400,
                headers: settings.defaultHeaderJson
            };
    });

    app.post('/authenticate', function (req) {
        // The middle ware takes care of forbidden states, once we get here, all is OK.
        return {
            body: ['OK'],
            status: 200,
            headers: {'Content-Type': 'application/json'}
        };
    });

    app.post('/activate', function (req) {
        var result = 
        mongoUtil.createUser(req.params).then(function (res) {
            if (res._id) {

                mailer.mail(res.email, settings.mailSetupSubject, settings.mailSetupText(res.email, res.passwordSetupHash));

                response.resolve({
                    body: [res],
                    status: 200,
                    headers: settings.defaultHeaderJson
                });
            }
            else
                response.resolve({
                    body: [res],
                    status: 400,
                    headers: settings.defaultHeaderJson
                });
        });
        return response.promise;
    });
};
