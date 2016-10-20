exports.initialize = function (util, mongoTasks, db) {
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

    exports.markResourceTasksAsDirty = function (btime, resourceId) {
        util.log.debug('markResourceTasksAsDirty starts with resource = ' + resourceId + '.');

        var dirtiedTasks = 0;

        var floatingDirtyUtilArray = [];
        tasks.find({type: 'event', start: {$gte: btime - 1}, resource: resourceId}).forEach(function (task) {
            util.log.debug('markResourceTasksAsDirty found a task: ' + task.data.title + '.');
            task.data.dirty = true;
            mongoTasks.markFloatingDirtyViaDependence(task.data, floatingDirtyUtilArray, btime);
            mongoTasks.markFloatingDirtyViaOverlap(task.data.start, util.getUnixEnd(task.data), resourceId);
            tasks.update({_id: new Packages.org.bson.types.ObjectId(task.data._id)}, task.data);
            dirtiedTasks++;
        });

        tasks.find({type: 'task', start: {$gte: btime - 1}, admissibleResources: resourceId}).forEach(function (task) {
            util.log.debug('markResourceTasksAsDirty found a task: ' + task.data.title + '.');
            task.data.dirty = true;
            mongoTasks.markFloatingDirtyViaDependence(task.data, floatingDirtyUtilArray);
            tasks.update({_id: new Packages.org.bson.types.ObjectId(task.data._id)}, task.data);
            dirtiedTasks++;
        });

        util.log.debug('markResourceTasksAsDirty ends with dirtiedTasks = ' + dirtiedTasks + '.');
        return dirtiedTasks;
    };

    exports.markResourceTasksAsDirtyOrDelete = function (btime, resourceId, replacementResourceId) {
        util.log.debug('markResourceTasksAsDirtyOrDelete starts with resource = ' + resourceId + ', replacementResourceId = ' + replacementResourceId + '.');

        if (!replacementResourceId) {
            tasks.remove({type: {$in: ['event', 'reminder']}, resource: resourceId});
            util.log.debug('markResourceTasksAsDirtyOrDelete deleted all events & reminders.');
            tasks.remove({type: 'task', admissibleResources: [resourceId]});
            util.log.debug('markResourceTasksAsDirtyOrDelete deleted all tasks.');
            return;
        }

        var dirtiedTasks = 0;

        var floatingDirtyUtilArray = [];
        tasks.find({type: 'event', resource: resourceId}).forEach(function (task) {
            util.log.debug('markResourceTasksAsDirtyOrDelete found a task: ' + task.data.title + '.');
            if (task.start > btime) {
                task.data.dirty = true;
                mongoTasks.markFloatingDirtyViaDependence(task.data, floatingDirtyUtilArray, btime);
                mongoTasks.markFloatingDirtyViaOverlap(task.data.start, util.getUnixEnd(task.data), resourceId);
            }
            task.data.resource = replacementResourceId;
            tasks.update({_id: new Packages.org.bson.types.ObjectId(task.data._id)}, task.data);
            dirtiedTasks++;
        });

        tasks.find({type: 'task', admissibleResources: resourceId}).forEach(function (task) {
            util.log.debug('markResourceTasksAsDirtyOrDelete found a task: ' + task.data.title + '.');
            if (task.start > btime) {
                task.data.dirty = true;
                mongoTasks.markFloatingDirtyViaDependence(task.data, floatingDirtyUtilArray);
            }
            
            util.log.debug('markResourceTasksAsDirtyOrDelete - about to look for the old resource in admissibleResources: ' + resourceId);
            var index = task.data.admissibleResources.findIndex(function (dep) {
                return dep === resourceId;
            });
            util.log.debug('markResourceTasksAsDirtyOrDelete - found index: ' + index);
            task.data.admissibleResources.splice(index, 1);
            task.data.admissibleResources.push(replacementResourceId);

            tasks.update({_id: new Packages.org.bson.types.ObjectId(task.data._id)}, task.data);
            dirtiedTasks++;
        });

        util.log.debug('markResourceTasksAsDirtyOrDelete ends with dirtiedTasks = ' + dirtiedTasks + '.');
        return dirtiedTasks;
    };

    exports.storeResource = function (resource, userId, tenantId, btime) {
        if (resource._id) {
            var oldResource = resources.findOne(new Packages.org.bson.types.ObjectId(resource._id)).data;
            if (JSON.stringify(oldResource.constraints) !== JSON.stringify(resource.constraints)) {
                var dirtiedTasks = exports.markResourceTasksAsDirty(btime, resource._id);
                if (dirtiedTasks > 0) {
                    // TODO Handle this better
                    // return 'ok';
                }
            }

            resource._id = new Packages.org.bson.types.ObjectId(resource._id);
        }

        if (!resource.tenant)
            resource.tenant = tenantId;
        if (!resource.user)
            resource.user = userId;

        resources.save(resource);
        return 'ok';
    };

    exports.removeResource = function (btime, resourceId, replacementResourceId) {
        exports.markResourceTasksAsDirtyOrDelete(btime, resourceId, replacementResourceId);
        resources.remove({_id: new Packages.org.bson.types.ObjectId(resourceId)});
        return 'ok';
    };
};
