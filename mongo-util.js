exports.initialize = function (util) {
    var mongo = require('ringo-mongodb');
    var client = new mongo.MongoClient('localhost', 27017);
    var db = client.getDB('schedulogy');
    var users = db.getCollection('user');
    addToClasspath("./cpsolver/dist/jbcrypt-0.3m.jar");
    importPackage(org.mindrot.jbcrypt);

    exports.verifyUserCredentialsReturnUser = function (credentials) {
        var user = users.findOne({email: credentials.email});
        if (user) {
            if (user.data.active) {
                var res = BCrypt.checkpw(credentials.password, user.data.password);
                if (res) {

                    if (user.data.new_user) {
                        user.data.new_user = false;
                        users.save(user.data);
                        user.data.runIntro = true;
                    }
                    else
                        user.data.runIntro = false;

                    return user.data;
                }
                else
                    return 'password';
            }
            else
                return 'inactive';
        }
        else {
            return 'password';
        }
    };

    exports.storePasswordResetHash = function (userId, newHash) {
        users.update({_id: new Packages.org.bson.types.ObjectId(userId)}, {$set: {passwordResetHash: newHash}});
    };

    exports.verifyPasswordResetLink = function (userId, passwordResetHash) {
        var existingUser = users.findOne(new Packages.org.bson.types.ObjectId(userId));

        if (!existingUser) {
            util.log.error('verifyPasswordResetLink: (!) existing');
            return '!existing';
        }
        else {
            if (existingUser.data.passwordResetHash === '') {
                util.log.error('verifyPasswordResetLink: (!) used');
                return 'used';
            }
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
};