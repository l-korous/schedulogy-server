var clientUrl = 'http://localhost:8100';

exports.settings = {
    weeks: 26,
    solverTimeout: 5,
    tokenTTLinDays: 5,
    daysPerWeek: 7,
    hoursPerDay: 24,
    minuteGranularity: 30,
    // This has to be exactly calculated using minuteGranularity
    slotsPerHour: 2, // === (60 / minuteGranularity)
    startSlot: 0, // This has to correspond to the above as well.
    endSlot: 48, // This has to correspond to the above as well.
    maxICalSize: 10,
    // TODO - Are these correct?
    defaultHeaderJson: {
        'Access-Control-Allow-Origin': "http://localhost:8100",
        'Access-Control-Allow-Methods': 'OPTIONS,GET,PUT,POST,DELETE',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Headers': 'Origin, Content-Type, Authorization, Xuser, btime, utcOffset',
        'Content-Type': 'application/json'
    },
    smtpHost: 'smtp.gmail.com',
    smtpPort: 587,
    smtpEncrypt: true,
    smtpUsername: 'util.314@gmail.com',
    smtpPassword: 'utili+t8k',
    msgReceiver: 'info@schedulogy.com',
    optionAllowedResponse: {
        body: [],
        headers: {
            'Access-Control-Allow-Origin': "http://localhost:8100",
            'Access-Control-Allow-Methods': 'OPTIONS,GET,PUT,POST,DELETE',
            'Access-Control-Allow-Credentials': 'true',
            'Access-Control-Allow-Headers': 'Origin, Content-Type, Authorization, Xuser, btime, utcOffset'
        },
        status: 200
    },
    mailSetupSubject: 'Welcome to SCHEDULOGY',
    mailSetupUrl: clientUrl + '/#/password-reset',
    mailSetupText: function (userId, passwordResetHash) {
        var text = '<html><head><meta http-equiv="Content-Type" content="text/html; charset="UTF-8" /><title>Thank you for choosing SCHEDULOGY</title></head><body bgcolor="#ffffff"><table width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#ffffff" style="background-color: #ffffff;"> <tr> <td width="100%" style="padding-top: 44px; padding-right: 0; padding-bottom: 0; padding-left: 0;"> <table width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#ffffff" style="font-family: -apple-system, \'Helvetica Neue\', \'Roboto\', \'Segoe UI\'; font-weight: normal; font-size: 13px; line-height: 18px; color: #444444; background-color: #ffffff; padding-top: 0; padding-bottom: 0; padding-right: 0; padding-left: 0; margin-left: 0; margin-bottom: 0; margin-top: 0; margin-right: 0;"> <tr> <td valign="top" width="100%" style="font-family: -apple-system, \'Helvetica Neue\', \'Roboto\', \'Segoe UI\'; font-size: 28px; line-height: 32px; color: #1a1a1a; font-weight: normal;"> <img src="https://www.schedulogy.com/images/icon192.png" alt="Schedulogy" title="Schedulogy" width="80" border="0" style="display: inline;float:right" /> Thank you for choosing<br/><strong>SCHEDULOGY</strong> </td> </tr> <tr> <td width="100%"> <table width="100%" border="0" cellspacing="0" cellpadding="0"> <tr> <td valign="top" width="100%" style="padding-left: 0; padding-bottom: 5px; padding-right: 0; padding-top: 35px; font-family: -apple-system, \'Helvetica Neue\', \'Roboto\', \'Segoe UI\'; font-weight: normal; font-size: 13px; line-height: 18px; color: #333333; "> <p><strong>Your e-mail is verified, and all you need to do now is to set up a password.</strong></p> <p>In order to set up your password for SCHEDULOGY - visit the following link:</p> <br /> <p>';
        text += this.mailSetupUrl + '?id=' + passwordResetHash + '&user=' + userId;
        text += '.</p> <br /> <p><strong>Please enjoy SCHEDULOGY and contact us at info@schedulogy.com with any questions you have.</strong></p> </td> </tr> </table> </td> </tr> <tr> <td valign="top" width="100%" style="padding-left: 0; padding-bottom: 40px; padding-right: 0; padding-top: 20px; font-family: -apple-system, \'Helvetica Neue\', \'Roboto\', \'Segoe UI\'; font-weight: normal; font-size: 13px; line-height: 18px; color: #333333; border-collapse: collapse; "> <!-- /// content: SIGN-OFF --> Sincerely,<br /><strong>SCHEDULOGY team</strong> <!-- End --> </td> </tr> </table> </td> </tr> <tr> <td width="100%" style="font-family: -apple-system, \'Helvetica Neue\', \'Roboto\', \'Segoe UI\'; font-weight: normal; font-size: 10px; line-height: 14px; color: #666666; padding-bottom: 0; padding-top: 20px; padding-right: 0; padding-left: 0; text-align: left;border-top-style: solid; border-top-color: #dcdcdc; border-top-width: 1px;"> <!-- /// content: Footer --> &copy; 2016 Schedulogy <br /><br /> You have received this mandatory email in order to set up the SCHEDULOGY service for you. <!-- End --> </td> </tr> </table> </div> </td> </tr></table></body></html>';
        return text;
        return text;
    },
    resetPasswordSubject: 'Password Reset for SCHEDULOGY',
    resetPasswordUrl: clientUrl + '/#/password-reset',
    resetPasswordText: function (userId, passwordResetHash) {
        var text = '<html><head><meta http-equiv="Content-Type" content="text/html; charset="UTF-8" /><title>Password Reset for SCHEDULOGY</title></head><body bgcolor="#ffffff"><table width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#ffffff" style="background-color: #ffffff;"> <tr> <td width="100%" style="padding-top: 44px; padding-right: 0; padding-bottom: 0; padding-left: 0;"> <table width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#ffffff" style="font-family: -apple-system, \'Helvetica Neue\', \'Roboto\', \'Segoe UI\'; font-weight: normal; font-size: 13px; line-height: 18px; color: #444444; background-color: #ffffff; padding-top: 0; padding-bottom: 0; padding-right: 0; padding-left: 0; margin-left: 0; margin-bottom: 0; margin-top: 0; margin-right: 0;"> <tr> <td valign="top" width="100%" style="font-family: -apple-system, \'Helvetica Neue\', \'Roboto\', \'Segoe UI\'; font-size: 28px; line-height: 32px; color: #1a1a1a; font-weight: normal;"> <img src="https://www.schedulogy.com/images/icon192.png" alt="Schedulogy" title="Schedulogy" width="40" border="0" style="display: inline;float:right" /> You are resetting your password for <br/><strong>SCHEDULOGY</strong> </td> </tr> <tr> <td width="100%"> <table width="100%" border="0" cellspacing="0" cellpadding="0"> <tr> <td valign="top" width="100%" style="padding-left: 0; padding-bottom: 5px; padding-right: 0; padding-top: 15px; font-family: -apple-system, \'Helvetica Neue\', \'Roboto\', \'Segoe UI\'; font-weight: normal; font-size: 13px; line-height: 18px; color: #333333; "><p>In order to reset up your password for SCHEDULOGY - visit the following link:</p> <br /> <p>';
        text += this.mailSetupUrl + '?id=' + passwordResetHash + '&user=' + userId;
        text += '.</p> <br /> <p><strong>Please enjoy SCHEDULOGY and contact us at info@schedulogy.com with any questions you have.</strong></p> </td> </tr> </table> </td> </tr> <tr> <td valign="top" width="100%" style="padding-left: 0; padding-bottom: 40px; padding-right: 0; padding-top: 20px; font-family: -apple-system, \'Helvetica Neue\', \'Roboto\', \'Segoe UI\'; font-weight: normal; font-size: 13px; line-height: 18px; color: #333333; border-collapse: collapse; "> <!-- /// content: SIGN-OFF --> Sincerely,<br /><strong>SCHEDULOGY team</strong> <!-- End --> </td> </tr> </table> </td> </tr> <tr> <td width="100%" style="font-family: -apple-system, \'Helvetica Neue\', \'Roboto\', \'Segoe UI\'; font-weight: normal; font-size: 10px; line-height: 14px; color: #666666; padding-bottom: 0; padding-top: 20px; padding-right: 0; padding-left: 0; text-align: left;border-top-style: solid; border-top-color: #dcdcdc; border-top-width: 1px;"> <!-- /// content: Footer --> &copy; 2016 Schedulogy <br /><br /> You have received this mandatory email in order to maintain the SCHEDULOGY service for you. <!-- End --> </td> </tr> </table> </div> </td> </tr></table></body></html>';
        return text;
    },
    defaultNotificationSetup: function (task) {
        if (task.allDay)
            return [task.start - (24 * 60 * 60), task.start];
        // 15-min ahead notification + right there at the start (in the case that a task gets scheduled to (almost) right now.
        else
            return [task.start - (15 * 60), task.start];
    },
    reminderCronTimestamps: function (task, utcOffset) {
        return task.done ? [] : ['* * * ' + String((24 - (utcOffset / 60)) % 24) + ' 0 0'];
    },
    notificationFormat: 'MMMM, Do HH:mm',
    reminderNotificationFormat: 'MMMM, Do',
    notificationUrl: clientUrl
};
