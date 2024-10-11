const util = require('util');

//todo: remove
function l(obj) {
    console.log(util.inspect(obj, { showHidden: true, depth: null, colors: true, maxArrayLength: null }));
}



const { createCanvas, registerFont } = require('canvas');
const {writeFileSync} = require("fs");
const {displayColors, showDaysCount, pngTmpFile} = require("../config");
const {resolve} = require("path");
const suncalc = require('suncalc');

registerFont(resolve("MINERVA1.otf"), { family: 'Minerva' });

exports.draw = async (data) => {

    const cnv = createCanvas(800, 480);
    const ctx = cnv.getContext('2d');

    ctx.antialias = 'none'
    ctx.quality = 'best'
    ctx.textRendering = 'optimizeLegibility';
    //ctx.translate(0.5, 0.5); todo

    ctx.fillStyle = displayColors.white;
    ctx.fillRect(0, 0, 800, 480);

    ctx.font = '16px Minerva';
    ctx.fillStyle = displayColors.orange;
    ctx.fillText("Hurra! Dies ist ein wünderbarer Text.", 100, 300);

    const firstTimeStep = new Date(data.days[0].timeStep);
    const pxPerHour = Math.floor(800/showDaysCount/24);
    const margin = (800 - showDaysCount * 24 * pxPerHour) / 2;
    const tempHeight = 160;
    const tempYMargin = 10;
    const rainYMargin = 5;
    const maxRain = 5; // kg/m^2
    const maxSun = 60*60; //SunD1 is in seconds per hour
    const minTemp = kelvinToCelsius(Math.min(...data.days.map(d => d.forecast.TTT).filter(v => v !== null)));
    const maxTemp = kelvinToCelsius(Math.max(...data.days.map(d => d.forecast.TTT).filter(v => v !== null)));

    // since all data is about the "last" hour etc everything is shifted by one hour
    const dateToX = ts => margin + ((ts - firstTimeStep) / 1000 / 60 / 60 + 1) * pxPerHour;

    const groupedPerDay = Object.groupBy(data.days, d => d.day);
    const dayXs = Object.keys(groupedPerDay).map(k => new Date(new Date(k).setHours(12,0,0,0))).map(
        d => {
            const stimes = suncalc.getTimes(d, data.coords.lat, data.coords.lon, data.coords.h);
            return [Math.round(dateToX(stimes.dawn)), Math.round(dateToX(stimes.nauticalDusk))];
        }
    );
    console.log(dayXs);

    console.log(data.coords);

    //draw night
    ctx.fillStyle = displayColors.black;
    ctx.fillRect(margin, margin,showDaysCount * 24 * pxPerHour, tempHeight);

    // draw days
    ctx.fillStyle = displayColors.white;
    dayXs.forEach(([x1, x2]) => {
        ctx.fillRect(x1, margin, x2-x1, tempHeight);
    });

    const drawCirlce = (x, y, r) => {
        ctx.fillStyle = displayColors.orange;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, 2 * Math.PI);
        ctx.fill();
    }

    const dddd = new Date("10-11-24 08:00");
    console.log(dddd);
    drawCirlce(dateToX(dddd), 10, 4);

    const indexToDayX = i => margin + i * pxPerHour + pxPerHour / 2;

    // sun
    data.days.map(d => d.forecast.SunD1).forEach((rain, i) => {

        let sunH = interpolatePixel(rain, 0, maxSun, 0, tempHeight - 2*rainYMargin);
        let overflow = false;

        ctx.fillStyle = displayColors.yellow;
        ctx.fillRect(
            indexToDayX(i),
            margin + tempHeight - rainYMargin - sunH,
            4,
            sunH
        );

    });

    // rain
    data.days.map(d => d.forecast.RR1c).forEach((rain, i) => {

        let rainH = interpolatePixel(rain, 0, maxRain, 0, tempHeight - 2*rainYMargin);
        let overflow = false;
        if(rainH > tempHeight - 2*rainYMargin) {
            rainH = tempHeight - 2*rainYMargin;
            overflow = true;
        }

        ctx.fillStyle = displayColors.blue;
        ctx.fillRect(
            indexToDayX(i) + 2,
            margin + tempHeight - rainYMargin - rainH,
            2,
            rainH
        );

        if(overflow) {
            ctx.fillStyle = displayColors.orange;
            ctx.fillRect(indexToDayX(i) + 1, margin + rainYMargin, 3, 2);
        }
    });

    // draw day separators
    ctx.strokeStyle = displayColors.black;
    ctx.lineWidth = 1;
    for(let i = 1; i < showDaysCount; i++) {
        //draw line
        ctx.beginPath();
        ctx.moveTo(margin + i * 24 * pxPerHour, margin);
        ctx.lineTo(margin + i * 24 * pxPerHour, margin+tempHeight);
        ctx.stroke();
    }

    // draw zero line
    const zeroY = interpolatePixel(0, minTemp, maxTemp, margin + tempHeight - tempYMargin, margin + tempYMargin);
    ctx.beginPath();
    ctx.moveTo(margin, zeroY);
    ctx.lineTo(800-margin, zeroY);
    ctx.stroke();

    // draw temperature
    ctx.strokeStyle = displayColors.red;
    ctx.lineWidth = 2;
    drawCurveThroughPoints(ctx, data.days.map(d => d.forecast.TTT).map((temp, i) =>
        (temp === null) ? null : { x:indexToDayX(i), y:interpolatePixel(kelvinToCelsius(temp), minTemp, maxTemp, margin + tempHeight - tempYMargin, margin + tempYMargin)}
    ).filter(v => v !== null));

    // write temp min/max
    ctx.fillStyle = displayColors.red;
    const perday = Object.groupBy(data.days, d => d.day);
    Object.keys(perday).forEach(key => {

        const hours = perday[key].filter(h => h.forecast.TTT !== null);

        // get hour with min temp
        const minHour = hours.reduce(
            (min, hour) => (hour.forecast.TTT < min.forecast.TTT) ? hour : min
        , hours[0]);

        if(minHour) {
            const text = Math.floor(kelvinToCelsius(minHour.forecast.TTT)) + "°C";
            const textOffset = ctx.measureText(text);
            ctx.fillText(
                text,
                Math.floor(indexToDayX(data.days.indexOf(minHour)) - textOffset.width / 2),
                Math.floor(interpolatePixel(kelvinToCelsius(minHour.forecast.TTT), minTemp, maxTemp, margin + tempHeight - tempYMargin, margin + tempYMargin) + 20)
            );
        }

        // get hour with max temp
        const maxHour = hours.reduce(
            (max, hour) => (hour.forecast.TTT > max.forecast.TTT) ? hour : max
        , hours[0]);

        if(maxHour) {
            const text = Math.round(kelvinToCelsius(maxHour.forecast.TTT)) + "°C";
            const textOffset = ctx.measureText(text);
            ctx.fillText(
                text,
                Math.floor(indexToDayX(data.days.indexOf(maxHour)) - textOffset.width / 2),
                Math.floor(interpolatePixel(kelvinToCelsius(maxHour.forecast.TTT), minTemp, maxTemp, margin + tempHeight - tempYMargin, margin + tempYMargin) - 4)
            );
        }

    });






    //l(data.days.map(d => d.forecast.TTT));

    //l(data.days.map(d => d.day + " " + d.hour + " --  " + d.forecast.TTT + " --- " + new Date(d.issueTime).toLocaleString()));


    const buf = cnv.toBuffer();
    writeFileSync(pngTmpFile, buf);

    console.log("done");
}



function kelvinToCelsius(k) {
    return k - 273.15;
}

function interpolatePixel(value, minValue, maxValue, minPixel, maxPixel) {
    // Berechnung des interpolierten Pixelwerts
    return minPixel + (value - minValue) * (maxPixel - minPixel) / (maxValue - minValue);
}

function drawCurveThroughPoints(ctx, points) {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    const length = points.length - 2
    for (let i = 1; i < length; i++) {
        const xc = (points[i].x + points[i + 1].x) / 2;
        const yc = (points[i].y + points[i + 1].y) / 2;
        ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
    }
    ctx.quadraticCurveTo(points[length].x, points[length].y, points[length + 1].x, points[length + 1].y);
    ctx.stroke();
}
