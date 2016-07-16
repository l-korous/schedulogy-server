exports.initialize = function (app, settings, secrets, crypt, util) {
    var mongo = require('ringo-mongodb');
    var defer = require("ringo/promise");
    var client = new mongo.MongoClient('localhost', 27017);
    var db = client.getDB('scheduler');
    var users = db.getCollection('user');

    exports.verifyUserCredentialsReturnUser = function (credentials) {
        var user = users.findOne({email: credentials.email});
        if (user.active) {
            crypt.checkpw(credentials.password, user.password, function (result) {
                if (result)
                    return user;
                else
                    return 'password';
            });
        }
        else
            return 'inactive';
    };

    exports.createUser = function (userData) {
        var existingUser = users.findOne({email: userData.email});
        if (existingUser) {
            util.clog('exports.createUser: existing');
            return 'existing';
        }
        else {
            userData.active = 0;

            function createRandomString(length)
            {
                var text = "";
                var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
                for (var i = 0; i < length; i++)
                    text += possible.charAt(Math.floor(Math.random() * possible.length));
                return text;
            }
            ;
            userData.passwordSetupHash = createRandomString(128);

            var saved = users.save(userData);
            if (saved.error) {
                util.clog('exports.createUser: error: ' + saved);
                return 'error';
            }
            else {
                return users.findOne({email: userData.email});
            }
        }
    };

    exports.activateUser = function (userId, password) {
        var deferred = new defer.Deferred();
        crypt.hashpw(password, secrets.cryptSalt, function (passwordHash) {
            users.update({_id: new Packages.org.bson.types.ObjectId(userId)}, {active: 1, password: passwordHash});
            deferred.resolve('OK');
        });
        return deferred.promise;
    };

    exports.deleteUser = function (userId) {
    };
};