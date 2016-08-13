exports.initialize = function (app, settings, util) {
    var mongo = require('ringo-mongodb');
    var moment = require('./bower_components/moment/moment.js');
    var client = new mongo.MongoClient('localhost', 27017);
    var db = client.getDB('schedulogy');
    var users = db.getCollection('user');
    var resources = db.getCollection('resource');

    exports.getSingleResource = function (object) {
        return resources.findOne(object).toJSON();
    };

    exports.getResources = function (object) {
        var toReturn = "{\"resources\": [";
        var first_resource = true;
        resources.find(object).forEach(function (resourceInMongo) {
            if (!first_resource)
                toReturn += ",";
            else
                first_resource = false;

            if (resourceInMongo.data.type === 'user') {
                var user = users.findOne({_id: resourceInMongo.data.user}).data;
                resourceInMongo.data.username = user.username ? user.username : user.email;
            }
            ;

            toReturn += resourceInMongo.toJSON();
        });
        toReturn += "]}";
        return toReturn;
    };

    var markResourceTasksAsDirty = function (resourceIdInMongo) {
        var dirtiedTasks = 0;

        return dirtiedTasks;
    };

    exports.storeResource = function (resource, tenantId, userId, tasksToBeDirtied) {
        if (resource._id) {
            resource._id = new Packages.org.bson.types.ObjectId(resource._id);
            var oldResource = resources.findOne(resource._id).data;
            if (JSON.stringify(oldResource.constraints) !== JSON.stringify(resource.constraints)) {
                var dirtiedTasks = markTasksAsDirty(resourceIdInMongo);
                if (dirtiedTasks > 0)
                    return 'too_many_affected_tasks';
            }
        }

        resource.tenant = new Packages.org.bson.types.ObjectId(tenantId);

        if (resource.user)
            resource.user = new Packages.org.bson.types.ObjectId(resource.user);

        resources.save(resource);
        return 'ok';
    };

    exports.removeResource = function (resourceId, tenantId) {
        var resourceIdInMongo = new Packages.org.bson.types.ObjectId(resourceId);
        var dirtiedTasks = markTasksAsDirty(resourceIdInMongo);
        if (dirtiedTasks > 0)
            return 'too_many_affected_tasks';
        else {
            resources.remove({_id: resourceIdInMongo});
            return 'ok';
        }
    };

    exports.resetResources = function (resourcesToResetTo) {
        resourcesToResetTo.forEach(function (rollbackResource) {
            resources.update({_id: rollbackResource._id}, rollbackResource.data);
        });
    };
};
