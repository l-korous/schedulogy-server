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
        var text = 'Welcome to SCHEDULOGY \r\n \r\n \r\n Please visit ';
        text += this.mailSetupUrl + '?id=' + passwordResetHash + '&user=' + userId;
        text += '. \r\n \r\n \r\n Please enjoy SCHEDULOGY and contact us at info@schedulogy.com with any questions you have.';
        text += '. \r\n \r\n \r\n SCHEDULOGY team';
        return text;
    },
    resetPasswordSubject: 'Password Reset for SCHEDULOGY',
    resetPasswordUrl: clientUrl + '/#/password-reset',
    resetPasswordText: function (userId, passwordResetHash) {
        var text = 'Reset your password for SCHEDULOGY \r\n \r\n \r\n Please visit ';
        text += this.mailSetupUrl + '?id=' + passwordResetHash + '&user=' + userId;
        text += '. \r\n \r\n \r\n Please enjoy SCHEDULOGY and contact us at info@schedulogy.com with any questions you have.';
        text += '. \r\n \r\n \r\n SCHEDULOGY team';
        return text;
    },
    defaultNotificationSetup: function (task) {
        if (task.allDay)
            return [task.start - (24 * 60 * 60), task.start];
        // 15-min ahead notification + right there at the start (in the case that a task gets scheduled to (almost) right now.
        else
            return [task.start - (15 * 60), task.start];
    },
    reminderCronTimestamps: ['* * * 0 0 0'],
    notificationFormat: 'MMM, Do H:mm UTCZ',
    notificationUrl: clientUrl
};
