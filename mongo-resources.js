exports.initialize = function (util, mongoTasks, db, notifications) {
    var tasks = db.getCollection('task');
    var resources = db.getCollection('resource');

    exports.getResourceById = function (resourceId) {
        var resource = resources.findOne(new Packages.org.bson.types.ObjectId(resourceId));
        if (resource)
            return resource.data;
        else {
            var msg = 'Resource with id "' + resourceId + '" does not exist';
            util.log.warn(msg);
            return msg;
        }
    };

    exports.getResourceByUserId = function (userId) {
        var resource = resources.findOne({user: userId, type: 'user'});
        if (resource)
            return resource.data;
        else {
            var msg = 'Resource with userId "' + userId + '" does not exist';
            util.log.warn(msg);
            return msg;
        }
    };

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

    exports.handleResourceRemovalInTasks = function (btime, resourceId, replacementResourceId) {
        util.log.debug('handleResourceRemovalInTasks starts with resource = ' + resourceId + ', replacementResourceId = ' + replacementResourceId + '.');

        if (!replacementResourceId) {
            tasks.remove({type: {$in: ['event', 'reminder']}, resource: resourceId});
            util.log.debug('handleResourceRemovalInTasks deleted all events & reminders.');
            // This deletes only such tasks where the ONLY admissible resource was the deleted one.
            tasks.remove({type: 'task', admissibleResources: [resourceId]});
            util.log.debug('handleResourceRemovalInTasks deleted all tasks.');
            return;
        }

        var dirtiedTasks = 0;

        var floatingDirtyUtilArray = [];
        tasks.find({type: 'event', start: {$gte: btime - 1}, resource: resourceId}).forEach(function (task) {
            util.log.debug('handleResourceRemovalInTasks found a task: ' + task.data.title + '.');
            task.data.dirty = true;
            mongoTasks.markFloatingDirtyViaDependence(task.data, floatingDirtyUtilArray, btime);
            mongoTasks.markFloatingDirtyViaOverlap(task.data.start, util.getUnixEnd(task.data), resourceId);
            task.data.resource = replacementResourceId;
            tasks.update({_id: new Packages.org.bson.types.ObjectId(task.data._id)}, task.data);
            dirtiedTasks++;
        });

        tasks.find({type: 'task', start: {$gte: btime - 1}, admissibleResources: resourceId}).forEach(function (task) {
            util.log.debug('handleResourceRemovalInTasks found a task: ' + task.data.title + '.');
            task.data.dirty = true;
            mongoTasks.markFloatingDirtyViaDependence(task.data, floatingDirtyUtilArray);

            util.log.debug('handleResourceRemovalInTasks - about to look for the old resource in admissibleResources: ' + resourceId);
            // This index is always there - see the find() condition
            var index = task.data.admissibleResources.findIndex(function (dep) {
                return dep === resourceId;
            });
            util.log.debug('handleResourceRemovalInTasks - found index: ' + index);
            task.data.admissibleResources.splice(index, 1);
            task.data.admissibleResources.push(replacementResourceId);

            tasks.update({_id: new Packages.org.bson.types.ObjectId(task.data._id)}, task.data);
            dirtiedTasks++;
        });

        util.log.debug('handleResourceRemovalInTasks ends with dirtiedTasks = ' + dirtiedTasks + '.');
        return dirtiedTasks;
    };

    exports.storeResource = function (resource, userId, tenantId, btime) {
        if (resource._id) {
            var oldResource = resources.findOne(new Packages.org.bson.types.ObjectId(resource._id)).data;
            if ((JSON.stringify(oldResource.constraints) !== JSON.stringify(resource.constraints)) || (oldResource.timeZone !== resource.timeZone)) {
                // No need to handle dirtied tasks here (just mark them), frontend refreshes tasks each time a resource is saved.
                exports.markResourceTasksAsDirty(btime, resource._id);
            }

            // Additionally, we must reinit all notifications.
            if (oldResource.timeZone !== resource.timeZone) {
                tasks.find({resource: resource._id}).forEach(function (task) {
                    if (task.data.start > btime) {
                        notifications.reinit(task.data);
                    }
                });
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
        exports.handleResourceRemovalInTasks(btime, resourceId, replacementResourceId);
        resources.remove({_id: new Packages.org.bson.types.ObjectId(resourceId)});
        return 'ok';
    };
};
