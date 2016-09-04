exports.initialize = function (util, mongoResources, db) {
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
            role: userData.role,
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

    exports.updateUser = function (user) {
        try {
            if (!user._id)
                util.log.error('Missing user._id in updateUser');
            else {
                user._id = new Packages.org.bson.types.ObjectId(user._id);
                var oldUser = users.findOne(user._id).data;
                for (var key in oldUser) {
                    if (!user[key])
                        user[key] = oldUser[key];
                }
            }

            users.save(user);
            return 'ok';
        }
        catch (e) {
            return 'fail';
        }
    };

    exports.createUser = function (userData, utcOffset) {
        var existingUser = users.findOne({email: userData.email});
        if (existingUser) {
            util.log.error('createUser: existing');
            return 'existing';
        }
        else {
            userData.active = 0;
            userData.new_user = true;
            userData.passwordResetHash = util.generatePasswordResetHash();

            if (!userData.tenant) {
                var tenantData = {name: userData.email};
                var saved = tenants.save(tenantData);
                if (saved.error) {
                    util.log.error('createTenant: error: ' + saved);
                    return 'create_tenant_error';
                }
                else {
                    userData.tenant = tenantData._id.toString();
                    userData.role = 'admin';
                }
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
                    user: userData._id.toString(),
                    name: userData.username ? userData.username : userData.email,
                    utcOffset: utcOffset
                });
                return users.findOne({_id: userData._id});
            }
        }
    };

    exports.removeUser = function (btime, userId) {
        var resource = resources.findOne({user: userId});
        var removeResourceRes = mongoResources.removeResource(btime, resource.id);
        if (removeResourceRes === 'ok') {
            users.remove({_id: new Packages.org.bson.types.ObjectId(userId)});
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

    exports.verifyPasswordResetLink = function (userId, passwordResetHash) {
        try {
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
        }
        catch (e) {
            return 'error';
        }
    };

    exports.activateUser = function (password, userId, passwordResetHash) {
        var linkCheck = exports.verifyPasswordResetLink(userId, passwordResetHash);
        if (linkCheck === 'ok') {
            var passwordHash = BCrypt.hashpw(password, BCrypt.gensalt(10));
            users.update({_id: new Packages.org.bson.types.ObjectId(userId)}, {$set: {active: 1, password: passwordHash, passwordResetHash: ''}});
            return exports.getUserById(userId);
        }
        else
            return linkCheck;
    };
};