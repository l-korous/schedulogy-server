var clientUrl = 'https://www.schedulogy.com/app';

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
    tenantCodeLength: 10,
    // TODO - Are these correct?
    defaultHeaderJson: {
        'Access-Control-Allow-Origin': "https://www.schedulogy.com",
        'Access-Control-Allow-Methods': 'OPTIONS,GET,PUT,POST,DELETE',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Headers': 'Origin, Content-Type, Authorization, Xuser, btime',
        'Content-Type': 'application/json'
    },
    smtpHost: 'localhost',
    smtpPort: 25,
    smtpEncrypt: false,
    msgReceiver: 'SCHEDULOGY <info@schedulogy.com>',
    optionAllowedResponse: {
        body: [],
        headers: {
            'Access-Control-Allow-Origin': "https://www.schedulogy.com",
            'Access-Control-Allow-Methods': 'OPTIONS,GET,PUT,POST,DELETE',
            'Access-Control-Allow-Credentials': 'true',
            'Access-Control-Allow-Headers': 'Origin, Content-Type, Authorization, Xuser, btime'
        },
        status: 200
    },
    mailInvitationSubject: 'Invitation to SCHEDULOGY',
    mailInvitationText: function (sourceEmail, tenantCode) {
        var text = '<html><head><meta http-equiv="Content-Type" content="text/html; charset="UTF-8" /><title>Invitation to SCHEDULOGY</title></head><body style="background-color=#ffffff; margin:10%;"><table width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#ffffff" style="background-color: #ffffff;"> <tr> <td width="100%" style="padding-top: 44px; padding-right: 0; padding-bottom: 0; padding-left: 0;"> <table width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#ffffff" style="font-family: -apple-system, \'Helvetica Neue\', \'Roboto\', \'Segoe UI\'; font-weight: normal; font-size: 13px; line-height: 18px; color: #444444; background-color: #ffffff; padding-top: 0; padding-bottom: 0; padding-right: 0; padding-left: 0; margin-left: 0; margin-bottom: 0; margin-top: 0; margin-right: 0;"> <tr> <td valign="top" width="100%" style="font-family: -apple-system, \'Helvetica Neue\', \'Roboto\', \'Segoe UI\'; font-size: 28px; line-height: 32px; color: #1a1a1a; font-weight: normal;"> <img src="https://www.schedulogy.com/home/images/icon96.png" alt="Schedulogy" title="Schedulogy" width="80" border="0" style="display: inline;float:right" /> You have been invited to <br/> <br/><strong style="font-size:130%">SCHEDULOGY</strong> </td> </tr> <tr> <td width="100%"> <table width="100%" border="0" cellspacing="0" cellpadding="0"> <tr> <td valign="top" width="100%" style="padding-left: 0; padding-bottom: 5px; padding-right: 0; padding-top: 35px; font-family: -apple-system, \'Helvetica Neue\', \'Roboto\', \'Segoe UI\'; font-weight: normal; font-size: 13px; line-height: 18px; color: #333333; "> <p><strong style="color:#387ef5">' + sourceEmail + '</strong> sent you an invitation for collaboration.</p> <br /><br />How to join:<ol><li>Go to <strong><a href="' + clientUrl + '" target="_blank">' + clientUrl + '</a></strong> and log in.</li><li>Go to <strong>Manage Tenant</strong>, select <strong>Switch Tenant</strong>, and insert the code: <strong style="font-size:140%; color:#387ef5">' + tenantCode + '</strong>.</li></ol><br /> <br /> <p style="font-size:110%">Please enjoy our services and contact us at info@schedulogy.com with any questions you have.</p> </td> </tr> </table> </td> </tr> <tr> <td valign="top" width="100%" style="padding-left: 0; padding-bottom: 40px; padsding-right: 0; padding-top: 20px; font-family: -apple-system, \'Helvetica Neue\', \'Roboto\', \'Segoe UI\'; font-weight: normal; font-size: 13px; line-height: 18px; color: #333333; border-collapse: collapse; ">Sincerely,<br /><strong>SCHEDULOGY team</strong></td> </tr> </table> </td> </tr> <tr> <td width="100%" style="font-family: -apple-system, \'Helvetica Neue\', \'Roboto\', \'Segoe UI\'; font-weight: normal; font-size: 10px; line-height: 14px; color: #666666; padding-bottom: 0; padding-top: 20px; padding-right: 0; padding-left: 0; text-align: left;border-top-style: solid; border-top-color: #dcdcdc; border-top-width: 1px;">&copy; 2017 Schedulogy <br /><br /> You have received this mandatory email in order to set up the SCHEDULOGY service for you.</td> </tr> </table> </div> </td> </tr></table></body></html>';
        return text;
    },
    defaultNotificationSetup: function (task) {
        if (task.type === 'reminder') {
            if (task.allDay)
                return [task.start];
            else
                return [task.start];
        }
        else {
            if (task.allDay)
                return [task.start - (24 * 60 * 60), task.start];
            // 15-min ahead notification + right there at the start (in the case that a task gets scheduled to (almost) right now.
            else
                return [task.start - (15 * 60), task.start];
        }
    },
    reminderCronTimestamps: function (task, utcOffset) {
        return task.done ? [] : ['* * * ' + String((24 + (utcOffset / 60)) % 24) + ' 0 0'];
    },
    notificationFormat: 'MMMM, Do HH:mm',
    notificationUrl: clientUrl
};
