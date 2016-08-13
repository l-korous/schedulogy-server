exports.initialize = function (app, mongoResources, util, settings) {
    var http = require('ringo/utils/http');

    app.del('/api/resource/:resourceId', function (req, resourceId) {
        util.log_request(req);
        var res = mongoResources.removeResource(resourceId, req.session.data.tenantId);
        if (res === 'ok') {
            var resources = mongoResources.getResources({});
            return {
                body: [resources],
                headers: settings.defaultHeaderJson,
                status: 200
            };
        }
        else
            return util.simpleResponse(res);
    });

    app.post('/api/resource', function (req) {
        util.log_request(req);
        var resource = req.postParams;
        var res = mongoResources.storeResource(resource, req.session.data.tenantId, req.session.data.userId);
        if (res === 'ok')
            return {
                body: [mongoResources.getResources({})],
                headers: settings.defaultHeaderJson,
                status: 200
            };
        else
            return simpleResponse(res);
    });

    app.get('/api/resource', function (req) {
        util.log_request(req);

        var resources = mongoResources.getResources({});
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
