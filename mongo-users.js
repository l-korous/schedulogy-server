exports.initialize = function (settings, util, mongoResources, db) {
    var users = db.getCollection('user');
    var tenants = db.getCollection('tenant');

    var filterUser = function (userData) {
        return {
            _id: userData._id.toString(),
            email: userData.email,
            tenant: userData.tenant.toString(),
            originalTenant: userData.originalTenant.toString(),
            role: userData.role,
            newUser: userData.newUser
        };
    };

    var getUserByEmailInternal = function (email) {
        var user = users.findOne({email: email});
        if(user)
            return user.data;
        else {
            var msg = 'User with email "' + email + '" does not exist';
            util.log.warn(msg);
            return msg;
        }
    };

    exports.getUserByEmail = function (email) {
        var result = getUserByEmailInternal(email);
        if (typeof result === 'object')
            return filterUser(result);
        else
            return result;
    };

    var getUserByIdInternal = function (userId) {
        var user = users.findOne(new Packages.org.bson.types.ObjectId(userId));
        if(user)
            return user.data;
        else {
            var msg = 'User with id "' + userId + '" does not exist';
            util.log.warn(msg);
            return msg;
        }
    };

    exports.getUserById = function (userId) {
        var result = getUserByIdInternal(userId);
        if (typeof result === 'object')
            return filterUser(result);
        else
            return result;
    };

    // This takes such an array as is returned e.g. from getUsers()
    exports.wrapReturnArrayInJson = function (users, additionalParams) {
        var toReturn = "{\"users\": [";
        var first_resource = true;
        users.forEach(function (user) {
            if (!first_resource)
                toReturn += ",";
            else
                first_resource = false;

            toReturn += JSON.stringify(user);
        });
        toReturn += "]";
        if (additionalParams)
            toReturn += ",\"params\": " + JSON.stringify(additionalParams);
        toReturn += "}";

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

    exports.getUser = function (object) {
        var result = users.findOne(object);
        if (typeof result === 'object')
            return filterUser(result.data);
        else
            return result;
    };

    exports.updateUser = function (user) {
        try {
            if (!user._id)
                util.log.error('Missing user._id in updateUser');
            else {
                user._id = new Packages.org.bson.types.ObjectId(user._id);
                var oldUser = users.findOne(user._id).data;
                for (var key in oldUser) {
                    if ((!user[key]) && user[key] !== false) {
                        user[key] = oldUser[key];
                    }
                }
            }
            users.save(user);
            return 'ok';
        }
        catch (e) {
            util.log.error('updateUser:' + e);
            return 'fail';
        }
    };

    exports.createUser = function (userData) {
        var existingUser = users.findOne({email: userData.email});
        if (existingUser) {
            util.log.error('createUser: existing');
            return 'User with email "' + userData.email + '" already exists';
        }

        // Basic setup
        userData.newUser = true;
        userData.active = true;
        userData.role = 'user';

        // Tenant
        var tenantData = {
            name: userData.email,
            code: util.createRandomString(settings.tenantCodeLength)
        };
        var saved = tenants.save(tenantData);
        if (saved.error) {
            util.log.error('createTenant: error: ' + saved);
            users.remove({_id: userData._id});
            return 'create_tenant_error';
        }
        else {
            userData.tenant = tenantData._id.toString();
            userData.originalTenant = tenantData._id.toString();
            userData.role = 'admin';
        }
        
        // Save (with Tenant)
        var saved = users.save(userData);
        if (saved.error) {
            util.log.error('createUser: error: ' + saved);
            return 'error';
        }

        // Resource
        mongoResources.storeResource({
            tenant: userData.tenant,
            type: 'user',
            user: userData._id.toString(),
            name: userData.email,
            timeZone: userData.timeZone
        });

        return users.findOne({_id: userData._id}).data;
    };

    exports.resetUser = function (userId) {
        var user = exports.getUserById(userId);
        user.tenant = user.originalTenant;
        user.role = 'admin';
        exports.updateUser(user);
    };

    // This function assumes that the associated resource has already been deleted.
    exports.removeUser = function (userId) {
        try {
            users.remove({_id: new Packages.org.bson.types.ObjectId(userId)});
            return 'ok';
        }
        catch (e) {
            return 'error';
        }
    };
};