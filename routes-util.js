exports.initialize = function (app, mongoUsers, mongoTenants, mongoResources, mongoTasks, util, settings, mailer, auth) {
    app.post('/api/simplemail', function (req) {
        try {
            util.log_request(req);
            var result = mailer.mail(settings.msgReceiver, 'Message from ' + req.params.email, req.params.msg);
            return util.simpleResponse(result);
        }
        catch (err) {
            return util.simpleResponse(err.toString());
        }
    });

    app.post('/api/msg', function (req) {
        util.log_request(req);
        try {
            var user = mongoUsers.getUserById(req.session.data.userId);
            var result = mailer.mail(settings.msgReceiver, 'Message from ' + user.email, req.params.msg);
            return util.simpleResponse(result);
        }
        catch (err) {
            return util.simpleResponse(err.toString());
        }
    });

    app.post('/api/inviteToTenant', function (req) {
        util.log_request(req);
        try {
            var user = mongoUsers.getUserById(req.session.data.userId);
            var tenant = mongoTenants.getTenantById(user.tenant);
            var result = mailer.html(req.params.email, settings.mailInvitationSubject, settings.mailInvitationText(user.email, tenant.code));
            return util.simpleResponse(result);
        }
        catch (err) {
            return util.simpleResponse(err.toString());
        }
    });

    app.post('/api/switchTenant', function (req) {
        util.log_request(req);
        try {
            var user = mongoUsers.getUserById(req.session.data.userId);
            var result = mongoTenants.getTenantByCode(req.params.tenantCode);
            if (typeof result !== 'object')
                return util.simpleResponse(result);

            // User
            var previousTenant = user.tenant;
            user.tenant = result._id.toString();
            user.role = ((user.tenant === user.originalTenant) ? 'admin' : 'user');
            result = mongoUsers.updateUser(user);
            if (result !== 'ok')
                return util.simpleResponse(result);

            // Tenant - all remaining users become Admins
            mongoUsers.getUsers({tenant: previousTenant}).forEach(function (userInTenant) {
                if (result === 'ok') {
                    userInTenant.role = 'admin';
                    result = mongoUsers.updateUser(userInTenant);
                }
            });
            if (result !== 'ok')
                return util.simpleResponse(result);

            // Resource
            var resource = mongoResources.getResourceByUserId(req.session.data.userId);
            resource.tenant = user.tenant;
            result = mongoResources.storeResource(resource);
            if (result !== 'ok')
                return util.simpleResponse(result);

            // Tasks - Events of this Resource will not block anything.
            mongoTasks.getTasks({type: 'event', resource: resource._id}).forEach(function (task) {
                task.blocks = [];
            });

            // Tasks - Tasks where this Resource was admissible are gone.
            // TODO - improvement DEV-191
            mongoTasks.removeTasks({type: 'task', admissibleResources: resource._id}, req.session.data.tenantId);

            // Token
            req.session.data.tenantId = null;
            return {
                body: ['{"token":"' + auth.generateToken(user) + '"}'],
                headers: settings.defaultHeaderJson,
                status: 200
            };
        }
        catch (err) {
            return util.simpleResponse(err.toString());
        }
    });
};
