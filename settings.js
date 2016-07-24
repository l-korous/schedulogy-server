exports.settings = {
    weeks: 52,
    solverTimeout: 5,
    daysPerWeek: 5,
    hoursPerDay: 9,
    minGranularity: 30,
    // This has to be exactly calculated using minGranularity
    slotsPerHour: 2, // === (60 / minGranularity)
    startSlot: 16, // This has to correspond to the above as well.
    endSlot: 34, // This has to correspond to the above as well.
    maxICalSize: 10,
    debug: true,
    // TODO - Are these correct?
    defaultHeaderJson: {
        'Access-Control-Allow-Origin': "*",
        'Access-Control-Allow-Methods': 'OPTIONS,GET,PUT,POST,DELETE',
        'Access-Control-Allow-Headers': 'Origin, Content-Type, Authorization',
        'Content-Type': 'application/json'
    },
    smtpHost: 'smtp.gmail.com',
    smtpPort: 587,
    smtpEncrypt: true,
    smtpUsername: 'util.314@gmail.com',
    smtpPassword: '[4t94ek123',
    optionAllowedResponse: {
        body: [],
        headers: {
            'Access-Control-Allow-Origin': "*",
            'Access-Control-Allow-Methods': 'OPTIONS,GET,PUT,POST,DELETE',
            'Access-Control-Allow-Headers': 'Origin, Content-Type, Authorization, Xuser, btime'
        },
        status: 200
    },
    mailSetupSubject: 'Welcome to SCHEDULOGY',
    mailSetupUrl: 'http://localhost:8100/#/password-reset',
    mailSetupText: function (userId, passwordResetHash) {
        var text = 'Welcome to SCHEDULOGY \r\n\r\n Please visit ';
        text += this.mailSetupUrl + '?id=' + passwordResetHash + '&user=' + userId;
        text += '. \r\n\r\n Please enjoy SCHEDULOGY and contact us at info@schedulogy.com with any questions you have.';
        return text;
    }
};