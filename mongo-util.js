exports.initialize = function (app, settings, secrets, util) {
    var mongo = require('ringo-mongodb');
    var client = new mongo.MongoClient('localhost', 27017);
    var db = client.getDB('schedulogy');
    var users = db.getCollection('user');
    addToClasspath("./cpsolver/dist/jbcrypt-0.3m.jar");
    importPackage(org.mindrot.jbcrypt);

    exports.verifyUserCredentialsReturnUser = function (credentials) {
        var user = users.findOne({email: credentials.email});
        if (user.data.active) {
            var res = BCrypt.checkpw(credentials.password, user.data.password);
            if (res)
                return user.data;
            else
                return 'password';
        }
        else
            return 'inactive';
    };

    exports.getUserByEmail = function (email) {
        var user = users.findOne({email: email});
        return user ? user : '!existing';
    };

    exports.storePasswordResetHash = function (userId, newHash) {
        users.update({_id: new Packages.org.bson.types.ObjectId(userId)}, {$set: {passwordResetHash: newHash}});
    };

    exports.createUser = function (userData) {
        var existingUser = users.findOne({email: userData.email});
        if (existingUser) {
            util.clog('createUser: existing');
            return 'existing';
        }
        else {
            userData.active = 0;
            userData.passwordResetHash = util.generatePasswordResetHash();

            var saved = users.save(userData);
            if (saved.error) {
                util.clog('createUser: error: ' + saved);
                return 'error';
            }
            else {
                return users.findOne({email: userData.email});
            }
        }
    };

    exports.verifyPasswordResetLink = function (userId, passwordResetHash) {
        var existingUser = users.findOne(new Packages.org.bson.types.ObjectId(userId));

        if (!existingUser) {
            util.clog('verifyPasswordResetLink: (!) existing');
            return '!existing';
        }
        else {
            if (existingUser.data.passwordResetHash === '')
                return 'used';
            else if (existingUser.data.passwordResetHash === passwordResetHash)
                return 'ok';
            else
                return 'password';
        }
    };

    exports.activateUser = function (password, userId, passwordResetHash) {
        var linkCheck = exports.verifyPasswordResetLink(userId, passwordResetHash);
        if (linkCheck === 'ok') {
            var passwordHash = BCrypt.hashpw(password, BCrypt.gensalt(10));
            users.update({_id: new Packages.org.bson.types.ObjectId(userId)}, {$set: {active: 1, password: passwordHash, passwordResetHash: ''}});
            return 'ok';
        }
        else
            return linkCheck;
    };

    exports.deleteUser = function (userId) {
    };

    exports.setUsername = function (userId, username) {
        try {
            users.update({_id: new Packages.org.bson.types.ObjectId(userId)}, {$set: {username: username}});
            return users.findOne({_id: new Packages.org.bson.types.ObjectId(userId)}).data;
        }
        catch (msg) {
            return msg ? msg : '';
        }
    };

    exports.setPassword = function (userId, password) {
        try {
            var passwordHash = BCrypt.hashpw(password, BCrypt.gensalt(10));
            users.update({_id: new Packages.org.bson.types.ObjectId(userId)}, {$set: {password: passwordHash}});
            return 'ok';
        }
        catch (msg) {
            return msg ? msg : '';
        }
    };
};