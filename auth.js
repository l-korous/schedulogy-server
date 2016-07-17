exports.initialize = function (settings, secrets, util, moment) {
    addToClasspath("./cpsolver/dist/java-jwt-2.1.0.jar");
    importPackage(com.auth0.jwt);
    importPackage(java.util);

    exports.generateToken = function (user) {
        var issuer = "http://schedulogy.com/";
        var iat = moment().unix();
        util.clog(iat);
        var exp = iat + 60 * 60 * 24;
        util.clog(exp);
        var x = new java.util.HashMap();
        x.put("iss", issuer);
        x.put("iat", iat);
        x.put("exp", exp);
        x.put("exp", exp);
        x.put("u", user._id.toString());
        var signer = new JWTSigner(secrets.jwtSecret);
        var jwt = signer.sign(x);
        return jwt;
    };

    exports.checkTokenReturnUserId = function (token, userId) {
        try {
            var verifier = new JWTVerifier(secrets.jwtSecret);
            var claims = verifier.verify(token);
            if (claims.get('u') === userId)
                return 'ok';
            else
                return 'fraud';
        } catch (e) {
            return 'error';
        }
    };

    exports.middleware = function (next) {
        return function (req) {
            if (req.method === 'OPTIONS')
                return settings.optionAllowedResponse;
            // For login etc., we do not parse the token:
            if (['/password-reset-check', '/login', '/register', '/activate'].indexOf(req.pathInfo) > -1) {
                return next(req);
            }
            if (!req.session.data.userId) {
                if (!req.headers.authorization || !req.headers.xuser)
                    return util.simpleResponse('missingAuth', 403);
                else {
                    var auth_res = exports.checkTokenReturnUserId(req.headers.authorization, req.headers.xuser);
                    if(auth_res === 'ok') {
                        req.session.data.userId = req.headers.xuser;
                        return next(req);
                    }
                    else
                        return util.simpleResponse(auth_res, 403);
                }
            }
            else
                return next(req);
        };
    };
};