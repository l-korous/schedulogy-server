exports.settings = {
    weeks: 6,
    solverTimeout: 10,
    daysPerWeek: 5,
    hoursPerDay: 9,
    startHour: 8,
    endHour: 17,
    msGranularity: 36e5,
    fixedBTime: new Date(2016, 6, 1, 8, 0),
    debug: true,
    defaultHeader: {
            'Access-Control-Allow-Origin': "*",
            'Access-Control-Allow-Methods': 'OPTIONS,GET,PUT,POST,DELETE',
            'Access-Control-Allow-Headers': 'Origin, Content-Type, Authorization'
    },
    defaultHeaderJson: {
            'Access-Control-Allow-Origin': "*",
            'Access-Control-Allow-Methods': 'OPTIONS,GET,PUT,POST,DELETE',
            'Access-Control-Allow-Headers': 'Origin, Content-Type, Authorization',
            'Content-Type': 'application/json'
    }
};