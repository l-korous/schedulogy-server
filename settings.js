exports.settings = {
    weeks: 6,
    solverTimeout: 5,
    daysPerWeek: 5,
    hoursPerDay: 9,
    startHour: 8,
    endHour: 17,
    msGranularity: 36e5,
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
    forbiddenResponse: {
        body: ['Forbidden!'],
        status: 403,
        header: {'Content-Type': 'text/html'}
    },
    optionAllowedResponse: {
        body: [],
        headers: {
            'Access-Control-Allow-Origin': "*",
            'Access-Control-Allow-Methods': 'OPTIONS,GET,PUT,POST,DELETE',
            'Access-Control-Allow-Headers': 'Origin, Content-Type, Authorization'
        },
        status: 200
    },
    mailSetupSubject: 'Welcome to SCHEDULOGY',
    mailSetupUrl: 'http://localhost:8100/#/password-setup',
    mailSetupText: function(email, passwordSetupHash) {
        var text = 'Welcome to SCHEDULOGY \r\n\r\n Please visit ';
        text += this.mailSetupUrl + '?id=' + passwordSetupHash + '&user=' + email;
        text += '. \r\n\r\n Please enjoy SCHEDULOGY and contact us at info@schedulogy.com with any questions you have.';
        return text;
    }
};