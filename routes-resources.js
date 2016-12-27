exports.initialize = function (app, mongoResources, util, settings) {
    app.del('/api/resource/:resourceId', function (req, resourceId) {
        util.log_request(req);
        var result = mongoResources.removeResource(req.params.btime, resourceId, req.params.replacementResourceId);
        if (result === 'ok')
            return {
                body: [mongoResources.getResources({tenant: req.session.data.tenantId})],
                headers: settings.defaultHeaderJson,
                status: 200
            };
        else
            return util.simpleResponse(result);
    });

    app.post('/api/resource', function (req) {
        util.log_request(req);
        var resource = req.postParams;
        var result = mongoResources.storeResource(resource, req.session.data.userId, req.session.data.tenantId, req.params.btime);
        if (result === 'ok')
            return {
                body: [mongoResources.getResources({tenant: req.session.data.tenantId})],
                headers: settings.defaultHeaderJson,
                status: 200
            };
        else
            return simpleResponse(result);
    });

    app.get('/api/resource', function (req) {
        util.log_request(req);
        var resources = mongoResources.getResources({tenant: req.session.data.tenantId});
        return {
            body: [resources],
            headers: settings.defaultHeaderJson,
            status: 200
        };
    });

    app.get('/api/resource/:resourceId', function (req, resourceId) {
        util.log_request(req);

        var resource = mongoResources.getSingleResource({_id: new Packages.org.bson.types.ObjectId(resourceId)});
        return {
            body: [resource],
            headers: settings.defaultHeaderJson,
            status: 200
        };
    });
};
