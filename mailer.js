exports.initialize = function (settings) {
    var mail = require('ringo-mail');

    exports.mail = function (to, subject, text) {
        mail.send({
            host: settings.smtpHost,
            port: settings.smtpPort,
            encrypt: settings.smtpEncrypt,
            username: settings.smtpUsername,
            password: settings.smtpPassword,
            to: to,
            subject: subject,
            text: text
        });
    };

    exports.html = function (to, subject, html) {
        mail.send({
            host: settings.smtpHost,
            port: settings.smtpPort,
            encrypt: settings.smtpEncrypt,
            username: settings.smtpUsername,
            password: settings.smtpPassword,
            to: to,
            subject: subject,
            html: html
        });
    };
};