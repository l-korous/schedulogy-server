exports.initialize = function (util) {
    var mongo = require('ringo-mongodb');
    var client = new mongo.MongoClient('localhost', 27017);
    var db = client.getDB('schedulogy');
    var users = db.getCollection('user');
    var tasks = db.getCollection('task');
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

            toReturn += resourceInMongo.toJSON();
        });
        toReturn += "]}";
        return toReturn;
    };

    var markResourceTasksAsDirty = function (btime, resourceId) {
        util.log.debug('markResourceTasksAsDirty starts with resource = ' + resourceId + '.');
        var dirtiedTasks = 0;

        tasks.find({type: {$in: ['fixed', 'fixedAllDay']}, start: {$gte: btime}, resource: new Packages.org.bson.types.ObjectId(resourceId)}).forEach(function (task) {
            util.log.debug('markResourceTasksAsDirty found a task: ' + task.data.title + '.');
            task.data.dirty = true;
            tasks.save(task.data);
            dirtiedTasks++;
        });

        tasks.find({type: 'floating', start: {$gte: btime}, admissibleResources: new Packages.org.bson.types.ObjectId(resourceId)}).forEach(function (task) {
            util.log.debug('markResourceTasksAsDirty found a task: ' + task.data.title + '.');
            task.data.dirty = true;
            tasks.save(task.data);
            dirtiedTasks++;
        });

        util.log.debug('markResourceTasksAsDirty ends with dirtiedTasks = ' + dirtiedTasks + '.');
        return dirtiedTasks;
    };

    exports.storeResource = function (btime, resource, tenantId) {
        if (resource._id) {
            var oldResource = resources.findOne(new Packages.org.bson.types.ObjectId(resource._id)).data;
            if (JSON.stringify(oldResource.constraints) !== JSON.stringify(resource.constraints)) {
                var dirtiedTasks = markResourceTasksAsDirty(btime, resource._id);
                if (dirtiedTasks > 0) {
                    // TODO Handle this better
                    // return 'ok';
                }
            }
            resource._id = new Packages.org.bson.types.ObjectId(resource._id);
        }

        resource.tenant = new Packages.org.bson.types.ObjectId(resource.tenant || tenantId);

        if (resource.user)
            resource.user = new Packages.org.bson.types.ObjectId(resource.user);

        resources.save(resource);
        return 'ok';
    };

    exports.removeResource = function (btime, resourceId) {
        var dirtiedTasks = markResourceTasksAsDirty(btime, resourceId);
        if (dirtiedTasks > 0) {
            // TODO Handle this better
            //return 'ok';
        }
        resources.remove({_id: new Packages.org.bson.types.ObjectId(resourceIdInMongo)});
        return 'ok';
    };

    exports.resetResources = function (resourcesToResetTo) {
        resourcesToResetTo.forEach(function (rollbackResource) {
            resources.update({_id: rollbackResource._id}, rollbackResource.data);
        });
    };
};
