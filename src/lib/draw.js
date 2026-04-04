const { createCanvas, registerFont } = require('canvas');
const { writeFileSync } = require('fs');
const { displayColors, showDaysCount, pngTmpFile } = require('../config');
const { resolve } = require('path');
const suncalc = require('suncalc');

registerFont(resolve('MINERVA1.otf'), { family: 'Minerva' });
registerFont(resolve('CozetteVector.ttf'), { family: 'Cozette' });

const fontFamily = 'Cozette';

exports.draw = async (data) => {
    const cnv = createCanvas(800, 480);
    const ctx = cnv.getContext('2d');

    ctx.antialias = 'none';
    ctx.quality = 'best';
    ctx.textRendering = 'optimizeLegibility';

    ctx.fillStyle = displayColors.white;
    ctx.fillRect(0, 0, 800, 480);

    // Globale Skalen (gleich fuer beide Zeilen)
    const allTemps = data.days
        .filter(d => d.forecast.TTT !== null)
        .map(d => kelvinToCelsius(d.forecast.TTT));
    const minTemp = Math.min(...allTemps);
    const maxTemp = Math.max(...allTemps);
    const maxRain = 5;

    // Layout-Berechnung
    const rowGap = 18;
    const restDaysCount = showDaysCount - 1;

    // Zeile 2 bestimmt die gemeinsame Breite (mehr Rundungsverlust)
    const pxPerHour2 = Math.floor(800 / (24 * restDaysCount));
    const row2DayWidth = pxPerHour2 * 24;
    const contentWidth = row2DayWidth * restDaysCount;
    const hMargin = Math.floor((800 - contentWidth) / 2);

    // Zeile 1 nutzt dieselbe Breite
    const pxPerHour1 = Math.floor(contentWidth / 24);
    const row1DayWidth = pxPerHour1 * 24;

    // Vertikaler Rand = horizontaler Rand
    const vMargin = hMargin;

    // Gleiche Seitenverhaeltnisse: row1Height/row1DayWidth = row2Height/row2DayWidth
    const availableHeight = 480 - vMargin * 2 - rowGap;
    const ratio = row2DayWidth / row1DayWidth;
    const row1Height = Math.floor(availableHeight / (1 + ratio));
    const row2Height = Math.floor(availableHeight * ratio / (1 + ratio));

    // Daten nach Tag aufteilen
    const groupedPerDay = Object.groupBy(data.days, d => d.day);
    const dayKeys = Object.keys(groupedPerDay);

    // Zeile 1: erster Tag (zentriert)
    const row1Days = data.days.filter(d => d.day === dayKeys[0]);
    const row1X = hMargin;
    drawLine(ctx, data, row1Days, 1, row1X, vMargin, row1Height, pxPerHour1, minTemp, maxTemp, maxRain);

    // Wochentag + Datum oben links
    const weekdays = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
    const months = ['Januar', 'Februar', 'Maerz', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
    const firstDate = new Date(dayKeys[0]);
    const dateLabel = `${weekdays[firstDate.getUTCDay()]}, ${firstDate.getUTCDate()}. ${months[firstDate.getUTCMonth()]}`;
    ctx.font = `24px ${fontFamily}`;
    const dateLabelWidth = ctx.measureText(dateLabel).width;
    const dateLabelX = row1X + 8;
    const dateLabelY = vMargin + 6;
    ctx.fillStyle = displayColors.white;
    ctx.fillRect(dateLabelX - 2, dateLabelY, dateLabelWidth + 4, 26);
    ctx.fillStyle = displayColors.black;
    ctx.fillText(dateLabel, dateLabelX, dateLabelY + 22);

    // Zeile 2: restliche Tage (zentriert)
    const row2DayKeySet = new Set(dayKeys.slice(1, showDaysCount));
    const row2Days = data.days.filter(d => row2DayKeySet.has(d.day));
    const row2TotalWidth = row2DayWidth * restDaysCount;
    const row2X = hMargin;
    const row2Y = vMargin + row1Height + rowGap;
    drawLine(ctx, data, row2Days, restDaysCount, row2X, row2Y, row2Height, pxPerHour2, minTemp, maxTemp, maxRain);

    writeFileSync(pngTmpFile, cnv.toBuffer());
    console.log('done');
};

function drawLine(ctx, allData, dayHours, numDays, x, y, height, pxPerHour, minTemp, maxTemp, maxRain) {
    const tempYMargin = Math.max(4, Math.round(height * 0.06));
    const rainYMargin = Math.max(2, Math.round(height * 0.03));
    const fontSize = 20;
    const rainBarWidth = Math.max(2, Math.round(pxPerHour * 0.45));
    const outlineWidth = 3;

    const firstTimeStep = new Date(dayHours[0].timeStep);
    const indexToDayX = i => x + i * pxPerHour + pxPerHour / 2;

    // Sonnenzeiten
    const groupedPerDay = Object.groupBy(dayHours, d => d.day);
    const sunTimes = Object.keys(groupedPerDay).map(k => {
        const d = new Date(new Date(k).setHours(12, 0, 0, 0));
        const times = suncalc.getTimes(d, allData.coords.lat, allData.coords.lon, allData.coords.h);
        const hoursFromStart = ts => (ts - firstTimeStep) / 1000 / 60 / 60;
        return {
            day: k,
            sunrise: times.sunrise,
            sunset: times.sunset,
            sunriseX: x + Math.ceil(hoursFromStart(times.sunrise)) * pxPerHour,
            sunsetX:  x + Math.ceil(hoursFromStart(times.sunset))  * pxPerHour,
        };
    });
    const sunTimesByDay = Object.fromEntries(sunTimes.map(s => [s.day, s]));

    // Bewoelkung Dithering
    dayHours.forEach((d, i) => {
        const N = d.forecast.N ?? 50;
        const ts = new Date(d.timeStep);
        const sunT = sunTimesByDay[d.day];
        const isDay = sunT && ts >= sunT.sunrise && ts < sunT.sunset;
        const baseColor = isDay ? displayColors.yellow : displayColors.black;
        const colX = x + i * pxPerHour;
        drawDitheredColumn(ctx, colX, y, pxPerHour, height, N / 100, baseColor);
    });

    // Sonnenauf-/untergangslinien
    ctx.fillStyle = displayColors.yellow;
    sunTimes.forEach(({ sunriseX, sunsetX }) => {
        ctx.fillRect(sunriseX, y, 1, height);
        ctx.fillRect(sunsetX, y, 1, height);
    });

    // Niederschlag
    dayHours.forEach((d, i) => {
        const rain = d.forecast.RR1c;
        if (!rain || rain <= 0) return;

        const type = getPrecipType(d.forecast);
        let rainH = interpolatePixel(rain, 0, maxRain, 0, height - 2 * rainYMargin);
        let overflow = false;
        if (rainH > height - 2 * rainYMargin) {
            rainH = height - 2 * rainYMargin;
            overflow = true;
        }

        const barX = indexToDayX(i) - rainBarWidth / 2;
        const barY = y + height - rainYMargin - rainH;

        if (type === 'snow') {
            ctx.strokeStyle = displayColors.blue;
            ctx.lineWidth = 1;
            ctx.strokeRect(barX, barY, rainBarWidth, rainH);
        } else if (type === 'sleet') {
            fillRectHatching(ctx, barX, barY, rainBarWidth, rainH, displayColors.blue, displayColors.white);
            ctx.strokeStyle = displayColors.blue;
            ctx.lineWidth = 1;
            ctx.strokeRect(barX, barY, rainBarWidth, rainH);
        } else if (type === 'hail') {
            fillRectHatching(ctx, barX, barY, rainBarWidth, rainH, displayColors.black, displayColors.white);
            ctx.strokeStyle = displayColors.blue;
            ctx.lineWidth = 1;
            ctx.strokeRect(barX, barY, rainBarWidth, rainH);
        } else {
            ctx.fillStyle = displayColors.blue;
            ctx.fillRect(barX, barY, rainBarWidth, rainH);
        }

        if (overflow) {
            ctx.fillStyle = displayColors.orange;
            ctx.fillRect(barX, y + rainYMargin, rainBarWidth, 2);
        }
    });

    // Tagestrennlinien
    ctx.strokeStyle = displayColors.black;
    ctx.lineWidth = 1;
    for (let i = 1; i < numDays; i++) {
        ctx.beginPath();
        ctx.moveTo(x + i * 24 * pxPerHour, y);
        ctx.lineTo(x + i * 24 * pxPerHour, y + height);
        ctx.stroke();
    }

    // Nulllinie
    const zeroY = interpolatePixel(0, minTemp, maxTemp, y + height - tempYMargin, y + tempYMargin);
    if (zeroY > y && zeroY < y + height) {
        ctx.strokeStyle = displayColors.black;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, zeroY);
        ctx.lineTo(x + numDays * 24 * pxPerHour, zeroY);
        ctx.stroke();
    }

    // Temperaturkurve
    ctx.strokeStyle = displayColors.red;
    ctx.lineWidth = 2;
    const points = dayHours.map((d, i) => {
        if (d.forecast.TTT === null) return null;
        return {
            x: indexToDayX(i),
            y: interpolatePixel(kelvinToCelsius(d.forecast.TTT), minTemp, maxTemp, y + height - tempYMargin, y + tempYMargin)
        };
    }).filter(v => v !== null);
    if (points.length > 2) drawCurveThroughPoints(ctx, points);

    // Min/Max Temperaturbeschriftungen pro Tag
    ctx.font = `${fontSize}px ${fontFamily}`;
    const labelBelow = Math.max(8, Math.round(height * 0.05));
    const labelAbove = Math.max(2, Math.round(height * 0.01));

    Object.keys(groupedPerDay).forEach(key => {
        const hours = groupedPerDay[key].filter(h => h.forecast.TTT !== null);
        if (!hours.length) return;

        const minHour = hours.reduce((min, h) => h.forecast.TTT < min.forecast.TTT ? h : min, hours[0]);
        const maxHour = hours.reduce((max, h) => h.forecast.TTT > max.forecast.TTT ? h : max, hours[0]);

        if (minHour) {
            const text = Math.floor(kelvinToCelsius(minHour.forecast.TTT)) + '°C';
            const tw = ctx.measureText(text).width;
            const idx = dayHours.indexOf(minHour);
            fillTextOutlined(ctx, text,
                Math.floor(indexToDayX(idx) - tw / 2),
                Math.floor(interpolatePixel(kelvinToCelsius(minHour.forecast.TTT), minTemp, maxTemp, y + height - tempYMargin, y + tempYMargin) + labelBelow),
                displayColors.red, displayColors.white, outlineWidth
            );
        }

        if (maxHour) {
            const text = Math.round(kelvinToCelsius(maxHour.forecast.TTT)) + '°C';
            const tw = ctx.measureText(text).width;
            const idx = dayHours.indexOf(maxHour);
            fillTextOutlined(ctx, text,
                Math.floor(indexToDayX(idx) - tw / 2),
                Math.floor(interpolatePixel(kelvinToCelsius(maxHour.forecast.TTT), minTemp, maxTemp, y + height - tempYMargin, y + tempYMargin) - labelAbove),
                displayColors.red, displayColors.white, outlineWidth
            );
        }
    });
}

function fillTextOutlined(ctx, text, x, y, fillColor, outlineColor, strokeWidth) {
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = strokeWidth || 3;
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
    return minPixel + (value - minValue) * (maxPixel - minPixel) / (maxValue - minValue);
}

function drawCurveThroughPoints(ctx, points) {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    const length = points.length - 2;
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
