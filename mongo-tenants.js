exports.initialize = function (settings, util, db) {
    var tenants = db.getCollection('tenant');

    exports.getTenantById = function (tenantId) {
        var tenant = tenants.findOne(new Packages.org.bson.types.ObjectId(tenantId));
        if (tenant)
            return tenant.data;
        else {
            var msg = 'Tenant with id "' + tenantId + '" does not exist';
            util.log.warn(msg);
            return msg;
        }
    };

    exports.getTenantByCode = function (tenantCode) {
        var tenant = tenants.findOne({code: tenantCode});
        if (tenant)
            return tenant.data;
        else {
            var msg = 'Tenant with code "' + tenantCode + '" does not exist';
            util.log.warn(msg);
            return msg;
        }
    };
};