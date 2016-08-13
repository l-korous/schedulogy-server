exports.initialize = function (app, settings, secrets, util) {
    var mongo = require('ringo-mongodb');
    var client = new mongo.MongoClient('localhost', 27017);
    var db = client.getDB('schedulogy');
    var users = db.getCollection('user');
    var tenants = db.getCollection('tenant');
    var resources = db.getCollection('resource');
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

    exports.getUserByEmail = function (email) {
        var user = users.findOne({email: email});
        return user ? user : '!existing';
    };

    exports.getUserById = function (userId) {
        var user = users.findOne(new Packages.org.bson.types.ObjectId(userId));
        return user ? user : '!existing';
    };

    exports.storePasswordResetHash = function (userId, newHash) {
        users.update({_id: new Packages.org.bson.types.ObjectId(userId)}, {$set: {passwordResetHash: newHash}});
    };

    exports.createTenant = function (tenantData) {
        var saved = tenants.save(tenantData);
        if (saved.error) {
            util.log.error('createTenant: error: ' + saved);
            return false;
        }
        else
            return tenantData._id;
    };

    exports.createResource = function (resourceData) {
        var saved = resources.save(resourceData);
        if (saved.error) {
            util.log.error('createResource: error: ' + saved);
            return false;
        }
        else
            return resourceData._id;
    };

    exports.createUser = function (userData) {
        var existingUser = users.findOne({email: userData.email});
        if (existingUser) {
            util.log.error('createUser: existing');
            return 'existing';
        }
        else {
            userData.active = 0;
            userData.new_user = true;
            userData.passwordResetHash = util.generatePasswordResetHash();

            if (userData.tenant_id)
                userData.tenant = new Packages.org.bson.types.ObjectId(userData.tenant_id);
            else
                userData.tenant = new Packages.org.bson.types.ObjectId(exports.createTenant({
                    name: userData.email
                }));

            var saved = users.save(userData);
            if (saved.error) {
                util.log.error('createUser: error: ' + saved);
                return 'error';
            }
            else {
                exports.createResource({
                    tenant: userData.tenant,
                    type: 'user',
                    user: userData._id
                });
                return users.findOne({_id: userData._id});
            }
        }
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