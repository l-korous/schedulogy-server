exports.initialize = function (util, mongoResources) {
    var mongo = require('ringo-mongodb');
    var client = new mongo.MongoClient('localhost', 27017);
    var db = client.getDB('schedulogy');
    var users = db.getCollection('user');
    var resources = db.getCollection('resource');
    var tenants = db.getCollection('tenant');
    addToClasspath("./cpsolver/dist/jbcrypt-0.3m.jar");
    importPackage(org.mindrot.jbcrypt);

    var filterUser = function (userData) {
        return {
            _id: userData._id.toString(),
            email: userData.email,
            tenant: userData.tenant.toString(),
            username: userData.username || '',
            active: userData.active
        };
    };

    exports.getUserByEmailInternal = function (email) {
        var user = users.findOne({email: email});
        return user ? user : '!existing';
    };

    exports.getUserByIdInternal = function (userId) {
        var user = users.findOne(new Packages.org.bson.types.ObjectId(userId));
        return user ? user : '!existing';
    };

    exports.getUserById = function (userId) {
        var res = exports.getUserByIdInternal(userId);
        if (typeof res === 'object')
            return filterUser(res.data);
        else
            return res;
    };

    // This takes such an array as is returned e.g. from getUsers()
    exports.wrapReturnArrayInJson = function (users) {
        var toReturn = "{\"users\": [";
        var first_resource = true;
        users.forEach(function (user) {
            if (!first_resource)
                toReturn += ",";
            else
                first_resource = false;

            toReturn += JSON.stringify(user);
        });
        toReturn += "]}";
        return toReturn;
    };

    exports.getUsers = function (object) {
        var _users = users.find(object);
        var toReturn = [];
        _users.forEach(function (user) {
            toReturn.push(filterUser(user.data));
        });
        return toReturn;
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

            if (userData.tenant)
                userData.tenant = new Packages.org.bson.types.ObjectId(userData.tenant);
            else {
                var tenantData = {name: userData.email};
                var saved = tenants.save(tenantData);
                if (saved.error) {
                    util.log.error('createTenant: error: ' + saved);
                    return 'create_tenant_error';
                }
                else
                    userData.tenant = new Packages.org.bson.types.ObjectId(tenantData._id);
            }

            var saved = users.save(userData);
            if (saved.error) {
                util.log.error('createUser: error: ' + saved);
                return 'error';
            }
            else {
                mongoResources.storeResource({
                    tenant: userData.tenant,
                    type: 'user',
                    user: userData._id
                });
                return users.findOne({_id: userData._id});
            }
        }
    };

    exports.removeUser = function (userId) {
        var userIdInMongo = new Packages.org.bson.types.ObjectId(userId);
        var resource = resources.findOne({user: userIdInMongo});
        var removeResourceRes = mongoResources.removeResource(resource.id);
        if (removeResourceRes === 'ok') {
            users.remove({_id: userIdInMongo});
            return 'ok';
        }
        else
            return removeResourceRes;
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