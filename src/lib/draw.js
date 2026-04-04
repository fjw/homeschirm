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
    const dayHeight = 50;
    const tempYMargin = 10;
    const rainYMargin = 5;
    const maxRain = 5; // kg/m^2
    const minTemp = kelvinToCelsius(Math.min(...data.days.map(d => d.forecast.TTT).filter(v => v !== null)));
    const maxTemp = kelvinToCelsius(Math.max(...data.days.map(d => d.forecast.TTT).filter(v => v !== null)));

    // since all data is about the "last" hour etc everything is shifted by one hour
    // +1h offset: MOSMIX hourly data refers to the preceding hour (e.g. RR1c at 12:00 = rain 11-12)
    const dateToX = ts => margin + ((ts - firstTimeStep) / 1000 / 60 / 60 + 1) * pxPerHour;
    // for point-in-time events (sunrise, sunset) the +1 offset does not apply
    const dateToXPoint = ts => margin + ((ts - firstTimeStep) / 1000 / 60 / 60) * pxPerHour;

    const groupedPerDay = Object.groupBy(data.days, d => d.day);
    const sunTimes = Object.keys(groupedPerDay).map(k => {
        const d = new Date(new Date(k).setHours(12, 0, 0, 0));
        const times = suncalc.getTimes(d, data.coords.lat, data.coords.lon, data.coords.h);
        const hoursFromStart = ts => (ts - firstTimeStep) / 1000 / 60 / 60;
        return {
            day: k,
            sunrise: times.sunrise,
            sunset: times.sunset,
            sunriseX: margin + Math.ceil(hoursFromStart(times.sunrise)) * pxPerHour,
            sunsetX:  margin + Math.ceil(hoursFromStart(times.sunset))  * pxPerHour,
        };
    });
    const sunTimesByDay = Object.fromEntries(sunTimes.map(s => [s.day, s]));

    const indexToDayX = i => margin + i * pxPerHour + pxPerHour / 2;

    // cloud cover dithering – temperature background + bar below
    const barY = tempHeight + margin + margin;
    data.days.forEach((d, i) => {
        const N = d.forecast.N ?? 50;
        const ts = new Date(d.timeStep);
        const sunT = sunTimesByDay[d.day];
        const isDay = sunT && ts >= sunT.sunrise && ts < sunT.sunset;
        const baseColor = isDay ? displayColors.yellow : displayColors.black;
        const colX = margin + i * pxPerHour;
        drawDitheredColumn(ctx, colX, margin, pxPerHour, tempHeight, N / 100, baseColor);
        //drawDitheredColumn(ctx, colX, barY,    pxPerHour, dayHeight,  N / 100, baseColor);
    });

    // sunrise and sunset lines
    ctx.fillStyle = displayColors.yellow;
    sunTimes.forEach(({ sunriseX, sunsetX }) => {
        ctx.fillRect(sunriseX, margin, 1, tempHeight);
        ctx.fillRect(sunsetX, margin, 1, tempHeight);
    });

    // rain / snow / sleet / hail
    data.days.forEach((d, i) => {
        const rain = d.forecast.RR1c;
        if (!rain || rain <= 0) return;

        const type = getPrecipType(d.forecast);

        let rainH = interpolatePixel(rain, 0, maxRain, 0, tempHeight - 2*rainYMargin);
        let overflow = false;
        if (rainH > tempHeight - 2*rainYMargin) {
            rainH = tempHeight - 2*rainYMargin;
            overflow = true;
        }

        const x = indexToDayX(i) + 1.5;
        const y = margin + tempHeight - rainYMargin - rainH;
        const w = 3;

        if (type === 'snow') {
            ctx.strokeStyle = displayColors.blue;
            ctx.lineWidth = 1;
            ctx.strokeRect(x, y, w, rainH);
        } else if (type === 'sleet') {
            fillRectHatching(ctx, x, y, w, rainH, displayColors.blue, displayColors.white);
            ctx.strokeStyle = displayColors.blue;
            ctx.lineWidth = 1;
            ctx.strokeRect(x, y, w, rainH);
        } else if (type === 'hail') {
            fillRectHatching(ctx, x, y, w, rainH, displayColors.black, displayColors.white);
            ctx.strokeStyle = displayColors.blue;
            ctx.lineWidth = 1;
            ctx.strokeRect(x, y, w, rainH);
        } else {
            ctx.fillStyle = displayColors.blue;
            ctx.fillRect(x, y, w, rainH);
        }

        if (overflow) {
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
    if(zeroY > margin && zeroY < tempHeight + margin + margin) {
        ctx.beginPath();
        ctx.moveTo(margin, zeroY);
        ctx.lineTo(800 - margin, zeroY);
        ctx.stroke();
    }

    // draw temperature
    ctx.strokeStyle = displayColors.red;
    ctx.lineWidth = 2;
    drawCurveThroughPoints(ctx, data.days.map(d => d.forecast.TTT).map((temp, i) =>
        (temp === null) ? null : { x:indexToDayX(i), y:interpolatePixel(kelvinToCelsius(temp), minTemp, maxTemp, margin + tempHeight - tempYMargin, margin + tempYMargin)}
    ).filter(v => v !== null));

    // write temp min/max
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
            fillTextOutlined(ctx, text,
                Math.floor(indexToDayX(data.days.indexOf(minHour)) - textOffset.width / 2),
                Math.floor(interpolatePixel(kelvinToCelsius(minHour.forecast.TTT), minTemp, maxTemp, margin + tempHeight - tempYMargin, margin + tempYMargin) + 20),
                displayColors.red, displayColors.white
            );
        }

        // get hour with max temp
        const maxHour = hours.reduce(
            (max, hour) => (hour.forecast.TTT > max.forecast.TTT) ? hour : max
        , hours[0]);

        if(maxHour) {
            const text = Math.round(kelvinToCelsius(maxHour.forecast.TTT)) + "°C";
            const textOffset = ctx.measureText(text);
            fillTextOutlined(ctx, text,
                Math.floor(indexToDayX(data.days.indexOf(maxHour)) - textOffset.width / 2),
                Math.floor(interpolatePixel(kelvinToCelsius(maxHour.forecast.TTT), minTemp, maxTemp, margin + tempHeight - tempYMargin, margin + tempYMargin) - 4),
                displayColors.red, displayColors.white
            );
        }

    });






    //l(data.days.map(d => d.forecast.TTT));

    //l(data.days.map(d => d.day + " " + d.hour + " --  " + d.forecast.TTT + " --- " + new Date(d.issueTime).toLocaleString()));


    const buf = cnv.toBuffer();
    writeFileSync(pngTmpFile, buf);

    console.log("done");
}



function fillTextOutlined(ctx, text, x, y, fillColor, outlineColor) {
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = fillColor;
    ctx.fillText(text, x, y);
}

function drawDitheredColumn(ctx, x, y, w, h, cloudFraction, baseColor) {
    const bayer4 = [
        [ 0, 8, 2,10],
        [12, 4,14, 6],
        [ 3,11, 1, 9],
        [15, 7,13, 5]
    ];
    ctx.fillStyle = baseColor;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = displayColors.white;
    for (let py = 0; py < h; py++) {
        for (let px = 0; px < w; px++) {
            if (cloudFraction > bayer4[py % 4][px % 4] / 16) {
                ctx.fillRect(x + px, y + py, 1, 1);
            }
        }
    }
}

function getPrecipType(forecast) {
    const ww = forecast.ww;
    if (ww !== null && ww !== undefined) {
        if (ww >= 89) return 'hail';
        if (ww >= 87 || ww === 68 || ww === 69) return 'sleet';
        if (ww === 66 || ww === 67) return 'sleet';
        if ((ww >= 70 && ww <= 79) || ww === 85 || ww === 86) return 'snow';
        return 'rain';
    }
    if (forecast.TTT !== null && forecast.TTT < 273.15 && forecast.RR1c > 0) return 'snow';
    return 'rain';
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


function fillRectHatching(ctx, x, y, w, h, stripeColor, bgColor) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();

    ctx.fillStyle = bgColor;
    ctx.fillRect(x, y, w, h);

    ctx.fillStyle = stripeColor;
    for (let row = 0; row < h; row += 4) {
        ctx.fillRect(x, y + h - 2 - row, w, 2);
    }

    ctx.restore();
}
