exports.initialize = function (settings) {
    var mail = require('ringo-mail');

    exports.mail = function (to, subject, text) {
        try {
            if (settings.smtpHost === 'smtp.gmail.com')
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
            else
                mail.send({
                    host: settings.smtpHost,
                    port: settings.smtpPort,
                    encrypt: settings.smtpEncrypt,
                    from: settings.msgReceiver,
                    to: to,
                    subject: subject,
                    text: text
                });
            return 'ok';
        }
        catch (e) {
            return 'error';
        }
    };

    exports.html = function (to, subject, html) {
        try {
            if (settings.smtpHost === 'smtp.gmail.com')
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
            else
                mail.send({
                    host: settings.smtpHost,
                    port: settings.smtpPort,
                    encrypt: settings.smtpEncrypt,
                    from: settings.msgReceiver,
                    to: to,
                    subject: subject,
                    html: html
                });
            return 'ok';
        }
        catch (e) {
            return 'error';
        }
    };
};