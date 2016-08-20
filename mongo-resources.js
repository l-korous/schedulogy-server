exports.initialize = function (util) {
    var mongo = require('ringo-mongodb');
    var client = new mongo.MongoClient('localhost', 27017);
    var db = client.getDB('schedulogy');
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

            toReturn += resourceInMongo.toJSON();
        });
        toReturn += "]}";
        return toReturn;
    };

    var markResourceTasksAsDirty = function (btime, resourceId, replacementResourceId) {
        util.log.debug('markResourceTasksAsDirty starts with resource = ' + resourceId + '.');
        var dirtiedTasks = 0;

        tasks.find({type: {$in: ['fixed', 'fixedAllDay']}, start: {$gte: btime}, resource: resourceId}).forEach(function (task) {
            util.log.debug('markResourceTasksAsDirty found a task: ' + task.data.title + '.');
            task.data.dirty = true;
            if (replacementResourceId)
                task.data.resource = replacementResourceId;
            tasks.update({_id: new Packages.org.bson.types.ObjectId(task.data._id)}, task.data);
            dirtiedTasks++;
        });

        tasks.find({type: 'floating', start: {$gte: btime}, admissibleResources: resourceId}).forEach(function (task) {
            util.log.debug('markResourceTasksAsDirty found a task: ' + task.data.title + '.');
            task.data.dirty = true;
            if (replacementResourceId) {
                var index = task.data.admissibleResources.findIndex(function (dep) {
                    return dep === resourceId;
                });
                task.data.admissibleResources.splice(index, 1);
                task.data.admissibleResources.push(replacementResourceId);
            }
            tasks.update({_id: new Packages.org.bson.types.ObjectId(task.data._id)}, task.data);
            dirtiedTasks++;
        });

        util.log.debug('markResourceTasksAsDirty ends with dirtiedTasks = ' + dirtiedTasks + '.');
        return dirtiedTasks;
    };

    exports.storeResource = function (resource, tenantId, btime) {
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

        if (!resource.tenant)
            resource.tenant = tenantId;

        resources.save(resource);
        return 'ok';
    };

    exports.removeResource = function (btime, resourceId) {
        var dirtiedTasks = markResourceTasksAsDirty(btime, resourceId);
        if (dirtiedTasks > 0) {
            // TODO Handle this better
            //return 'ok';
        }
        resources.remove({_id: new Packages.org.bson.types.ObjectId(resourceId)});
        return 'ok';
    };

    exports.resetResources = function (resourcesToResetTo) {
        resourcesToResetTo.forEach(function (rollbackResource) {
            resources.update({_id: rollbackResource._id}, rollbackResource.data);
        });
    };
};
