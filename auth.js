exports.initialize = function (settings, secrets) {
    var kjur = require('./bower_components/kjur-jsrsasign/jsrsasign-latest-all-min.js');
    var defer = require("ringo/promise");

    exports.generateToken = function (user) {
        var oHeader = {alg: 'HS256', typ: 'JWT'};

        var oPayload = {};
        var tNow = kjur.jws.IntDate.get('now');
        var tEnd = kjur.jws.IntDate.get('now + 1day');
        oPayload.nbf = tNow;
        oPayload.iat = tNow;
        oPayload.exp = tEnd;
        oPayload.jti = user;
        var sHeader = JSON.stringify(oHeader);
        var sPayload = JSON.stringify(oPayload);
        return kjur.jws.JWS.sign("HS256", sHeader, sPayload, secrets.jwtSecret);
    };

    exports.checkTokenReturnUserId = function (token) {
        var isValid = kjur.jws.JWS.verifyJWT(token, secrets.jwtSecret, {alg: ['HS256']});

        if (isValid)
            return kjur.jws.JWS.readSafeJSONString(b64utoutf8(token.split(".")[1])).jti._id;
        else
            return false;
    };

    exports.middleware = function (next) {
        return function (req) {
            if (req.method === 'OPTIONS')
                return settings.optionAllowedResponse;
            // For login, we do not parse the token:
            if ((req.pathInfo === '/login') || (req.pathInfo === '/register')) {
                // TODO - this may be greatly slowing everything down.
                // If there is a way how to do this in such a way that we are not blocking a thread here, it would be great.
                return next(req).wait();
            }
            if (!req.session.data.user) {
                if (!req.headers.authorization)
                    return settings.forbiddenResponse;
                else {
                    var userId = exports.checkTokenReturnUserId(req.headers.authorization);
                    if (!userId)
                        return settings.forbiddenResponse;
                    else {
                        req.session.data.userId = userId;
                    }
                }
            }
            return next(req);
        };
    };
};