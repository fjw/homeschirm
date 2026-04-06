const {showDaysCount} = require("../config");

exports.prepareData = async (newdata, data) => {

    if(data === null) {
        data = {
            issueTime: new Date("-000043-03-15T00:00:00.000Z"),
            updateTime: new Date("-000043-03-15T00:00:00.000Z"),
            days: []
        };
    }

    // Alte Daten nach Stunde gruppieren
    const objectByHour = {};
    data.days.forEach(day => {
        objectByHour[getIdFromDate(new Date(day.timeStep))] = day;
    });

    // Stundendaten mit neuen Daten überschreiben, Stunden außerhalb des aktuellen Forecasts behalten
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

    // Nächste Tage ab heute (nicht ab issueTime, die kann von gestern sein)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextdays = Array.from({length: showDaysCount},
        (v, i) => new Date(new Date(today).setDate(today.getDate() + i))
    ).map(d => getDayIdFromDate(d));

    // Leeren Forecast als Vorlage vorbereiten
    const emptyForecast = {};
    Object.keys(newdata.forecast).forEach(forecastKey => {
        emptyForecast[forecastKey] = null;
    });

    // Fehlende Stunden auffüllen
    nextdays.forEach(day => {
        for (let h = 0; h < 24; h++) {

            const timeStep = new Date(new Date(day).setHours(h, 0, 0, 0));

            if(!objectByHour[getIdFromDate(timeStep)]) {
                objectByHour[getIdFromDate(timeStep)] = {
                    day: getDayIdFromDate(timeStep),
                    hour: h,
                    timeStep: timeStep.toISOString(),
                    issueTime: null,
                    forecast: {...emptyForecast},
                };
            }
        }
    });

    // Tage außerhalb des Bereichs entfernen
    const d = Object.values(objectByHour).filter(i => nextdays.includes(i.day));

    // Nach Zeitpunkt sortieren
    d.sort((a, b) => new Date(a.timeStep) - new Date(b.timeStep));

    return {
        issueTime: newdata.issueTime,
        updateTime: newdata.updateTime,
        coords: {
            lat: newdata.coordinates[1],
            lon: newdata.coordinates[0],
            h: newdata.coordinates[2],
        },
        warnings: newdata.warnings || [],
        observation: newdata.observation || null,
        days: d
    };
}

function getIdFromDate(date) {
    return `${getDayIdFromDate(date)}:${date.getHours()}`;
}

function getDayIdFromDate(date) {
    return `${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}`;
}

