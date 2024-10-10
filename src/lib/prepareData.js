const {showDaysCount} = require("../config");

exports.prepareData = async (newdata, data) => {

    if(data === null) {
        data = {
            issueTime: new Date("-000043-03-15T00:00:00.000Z"),
            updateTime: new Date("-000043-03-15T00:00:00.000Z"),
            days: []
        };
    }

    // group old data by hour
    const objectByHour = {};
    data.days.forEach(day => {
        objectByHour[getIdFromDate(new Date(day.timeStep))] = day;
    });

    // overwrite hour data with newdata, keep data from days/hours not included in current forecast
    newdata.timeSteps.forEach((timestep, i) => {

        const ts = new Date(timestep);

        const forecastKeys = Object.keys(newdata.forecast);
        const forecast = {};
        forecastKeys.forEach(forecastKey => {
            forecast[forecastKey] = newdata.forecast[forecastKey][i];
        });

        objectByHour[getIdFromDate(ts)] = {
            day: getDayIdFromDate(ts),
            hour: ts.getHours(),
            timeStep: ts.toISOString(),
            issueTime: newdata.issueTime,
            forecast,
        };

    });

    // get next 8 days from issueTime (including issueTime)
    const nextdays = Array.from({length: showDaysCount},
        (v, i) => new Date(new Date(new Date(newdata.issueTime).setDate(new Date(newdata.issueTime).getDate() + i)).setHours(0,0,0,0))
    ).map(d => getDayIdFromDate(d));

    // prepare empty forecast for fill in
    const emptyForecast = {};
    Object.keys(newdata.forecast).forEach(forecastKey => {
        emptyForecast[forecastKey] = null;
    });

    // fillup missing hours
    nextdays.forEach(day => {
        for (let h = 0; h < 24; h++) {

            const timeStep = new Date(new Date(day).setHours(h, 0, 0, 0));

            if(!objectByHour[getIdFromDate(timeStep)]) {
                objectByHour[getIdFromDate(timeStep)] = {
                    day: getDayIdFromDate(timeStep),
                    hour: h,
                    timeStep: timeStep.toISOString(),
                    issueTime: null,
                    forecast: emptyForecast,
                };
            }
        }
    });

    // filter out days not in range
    const d = Object.values(objectByHour).filter(i => nextdays.includes(i.day));

    //order by timeStep
    d.sort((a, b) => new Date(a.timeStep) - new Date(b.timeStep));

    return {
        issueTime: newdata.issueTime,
        updateTime: newdata.updateTime,
        days: d
    };
}

function getIdFromDate(date) {
    return `${getDayIdFromDate(date)}:${date.getHours()}`;
}

function getDayIdFromDate(date) {
    return `${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}`;
}

