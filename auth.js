exports.initialize = function (settings, secrets, util, moment, mongoUsers) {
    addToClasspath("./cpsolver/dist/java-jwt-2.1.0.jar");
    importPackage(com.auth0.jwt);
    importPackage(java.util);

    exports.generateToken = function (user) {
        var issuer = "schedulogy.com";
        var iat = moment().unix();
        var exp = iat + settings.tokenTTLinDays * 60 * 60 * 24;
        var x = new java.util.HashMap();
        x.put("iss", issuer);
        x.put("iat", iat);
        x.put("exp", exp);
        x.put("exp", exp);
        x.put("uid", user._id.toString());
        x.put("tid", user.tenant.toString());
        x.put("uem", user.email);
        x.put("uro", user.role);
        x.put("uname", user.username || '');
        var signer = new JWTSigner(secrets.jwtSecret);
        var jwt = signer.sign(x);
        return jwt;
    };

    exports.checkToken = function (token, userId) {
        try {
            var verifier = new JWTVerifier(secrets.jwtSecret);
            var claims = verifier.verify(token);
            if (claims.get('uid') === userId) {
                // TODO: consult mongoUsers
                return {msg: 'ok', tenantId: claims.get('tid')};
            }
            else if (parseInt(claims.get('exp')) < moment().unix())
                return {msg: 'expired'};
            else
                return {msg: 'fraud'};
        } catch (e) {
            return {msg: 'error'};
        }
    };

    exports.middleware = function (next) {
        return function (req) {
            if (req.method === 'OPTIONS')
                return settings.optionAllowedResponse;
            
            // This is needed so that after logout, we are returning correct data.
            if ('/api/login' === req.pathInfo) {
                req.session.data.userId = null;
            }

            // For login etc., we do not parse the token:
            if (['/api/password-reset-check', '/api/login', '/api/register', '/api/activate', '/api/reset-password', '/api/simplemail'].indexOf(req.pathInfo) > -1) {
                var toReturn = next(req);
                // Log the response.
                util.log.info(req.pathInfo + ' : ' + toReturn.status + ' : ' + toReturn.body);
                return toReturn;
            }
            if (!req.headers.authorization || !req.headers.xuser)
                return util.simpleResponse('missingAuth', 403);
            if (!req.session.data.userId) {
                var auth_res = exports.checkToken(req.headers.authorization, req.headers.xuser);
                if (auth_res.msg === 'ok') {
                    req.session.data.userId = req.headers.xuser;
                    req.session.data.tenantId = auth_res.tenantId;
                    var toReturn = next(req);
                    util.log.info(req.pathInfo + ' : ' + toReturn.status + ' : ' + toReturn.body);
                    return toReturn;
                }
                else {
                    util.log.info('bad_token: ' + auth_res.msg);
                    return util.simpleResponse(auth_res.msg, 403);
                }
            }
            else {
                var toReturn = next(req);
                util.log.info(req.pathInfo + ' : ' + toReturn.status + ' : ' + toReturn.body);
                return toReturn;
            }
        };
    };
};
