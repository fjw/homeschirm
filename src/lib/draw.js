const { createCanvas, registerFont } = require('canvas');
const { writeFileSync } = require('fs');
const { displayColors, showDaysCount, pngTmpFile } = require('../config');
const { resolve } = require('path');
const suncalc = require('suncalc');

registerFont(resolve('fonts/spleen-12x24.otf'), { family: 'Spleen24' });
registerFont(resolve('fonts/spleen-8x16.otf'), { family: 'Spleen16' });
registerFont(resolve('fonts/spleen-6x12.otf'), { family: 'Spleen12' });

const fontFamily = 'Spleen24';
const fontFamilyMed = 'Spleen16';
const fontFamilySmall = 'Spleen12';

exports.draw = async (data) => {
    const warnings = data.warnings || [];
    const observation = data.observation || null;
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
    const maxRain = 15;

    // Layout-Berechnung
    const obsRowHeight = observation ? 24 : 0;
    const rowGap = 18 + obsRowHeight;
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
    drawLine(ctx, data, row1Days, 1, row1X, vMargin, row1Height, pxPerHour1, minTemp, maxTemp, maxRain, 24);

    // "Jetzt"-Linie (aufgerundet auf naechste volle Stunde)
    if (row1Days.length > 0) {
        const now = new Date();
        const firstTs = new Date(row1Days[0].timeStep);
        const nowHour = Math.ceil((now - firstTs) / 3600000);
        if (nowHour >= 0 && nowHour < 24) {
            const nowX = row1X + nowHour * pxPerHour1 + Math.floor(pxPerHour1 / 2) - 1;
            ctx.fillStyle = displayColors.green;
            ctx.fillRect(nowX, vMargin, 3, row1Height);
        }
    }

    // Wochentag + Datum oben links
    const weekdays = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
    const months = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
    const firstDate = new Date(dayKeys[0]);
    const dateLabel = `${weekdays[firstDate.getUTCDay()]}, ${firstDate.getUTCDate()}. ${months[firstDate.getUTCMonth()]}`;
    ctx.font = `24px ${fontFamily}`;
    const dateLabelWidth = ctx.measureText(dateLabel).width;
    const dateLabelX = row1X + 12;
    const dateLabelY = vMargin + 6;
    ctx.fillStyle = displayColors.white;
    ctx.fillRect(dateLabelX - 6, dateLabelY, dateLabelWidth + 12, 26);
    ctx.fillStyle = displayColors.black;
    ctx.fillText(dateLabel, dateLabelX, dateLabelY + 22);

    // Warnungen unter dem Datum
    if (warnings.length > 0) {
        ctx.font = `24px ${fontFamily}`;
        let warningY = dateLabelY + 32;
        for (const w of warnings) {
            const warnText = `${w.headline || w.event}`;
            const warnWidth = ctx.measureText(warnText).width;
            ctx.fillStyle = displayColors.white;
            ctx.fillRect(dateLabelX - 6, warningY, warnWidth + 12, 26);
            ctx.fillStyle = displayColors.black;
            ctx.fillText(warnText, dateLabelX, warningY + 22);
            warningY += 28;
        }
    }

    // Aktuelle Messwerte zwischen den Zeilen
    if (observation) {
        const obsY = vMargin + row1Height + 9 + 19;
        ctx.font = `24px ${fontFamily}`;
        const gap = '  ';
        const segments = [];
        if (observation.temperature !== null) segments.push({ text: `${Math.round(observation.temperature)}°C`, color: displayColors.red });
        if (observation.humidity !== null) segments.push({ text: `${Math.round(observation.humidity)}% rF`, color: displayColors.orange });
        if (observation.windSpeed !== null) segments.push({ text: `${Math.round(observation.windSpeed)}km/h`, color: displayColors.black });
        if (observation.precipitation !== null && observation.precipitation > 0) segments.push({ text: `${observation.precipitation.toFixed(1)}mm`, color: displayColors.blue });
        const totalWidth = segments.reduce((w, s, i) => w + ctx.measureText(s.text).width + (i > 0 ? ctx.measureText(gap).width : 0), 0);
        let obsX = hMargin + Math.floor((contentWidth - totalWidth) / 2);
        segments.forEach((s, i) => {
            if (i > 0) obsX += ctx.measureText(gap).width;
            ctx.fillStyle = s.color;
            ctx.fillText(s.text, obsX, obsY);
            obsX += ctx.measureText(s.text).width;
        });
    }

    // Zeile 2: restliche Tage (zentriert)
    const row2DayKeySet = new Set(dayKeys.slice(1, showDaysCount));
    const row2Days = data.days.filter(d => row2DayKeySet.has(d.day));
    const row2TotalWidth = row2DayWidth * restDaysCount;
    const row2X = hMargin;
    const row2Y = vMargin + row1Height + rowGap;
    drawLine(ctx, data, row2Days, restDaysCount, row2X, row2Y, row2Height, pxPerHour2, minTemp, maxTemp, maxRain, 16);

    // Wochentag-Kuerzel in Zeile 2
    const weekdayShort = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
    ctx.font = `16px ${fontFamilyMed}`;
    for (let i = 0; i < restDaysCount; i++) {
        const dk = dayKeys[i + 1];
        if (!dk) break;
        const d = new Date(dk);
        const label = weekdayShort[d.getUTCDay()];
        const lx = row2X + i * row2DayWidth + 7;
        const ly = row2Y + 3;
        const lw = ctx.measureText(label).width;
        ctx.fillStyle = displayColors.white;
        ctx.fillRect(lx - 4, ly, lw + 8, 18);
        ctx.fillStyle = displayColors.black;
        ctx.fillText(label, lx, ly + 14);
    }

    writeFileSync(pngTmpFile, cnv.toBuffer());
    console.log('done');
};

function drawLine(ctx, allData, dayHours, numDays, x, y, height, pxPerHour, minTemp, maxTemp, maxRain, fontSize) {
    const tempYMargin = Math.max(4, Math.round(height * 0.06));
    const rainYMargin = Math.max(2, Math.round(height * 0.03));
    const font = fontSize <= 12 ? `12px ${fontFamilySmall}` : fontSize <= 16 ? `16px ${fontFamilyMed}` : `24px ${fontFamily}`;
    const rainBarWidth = Math.max(2, Math.round(pxPerHour * 0.45));
    const outlineWidth = 6;

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
        const hoursAfterSunrise = sunT ? (ts - sunT.sunrise) / 3600000 : Infinity;
        const hoursBeforeSunset = sunT ? (sunT.sunset - ts) / 3600000 : Infinity;
        const isDawnDusk = isDay && (hoursAfterSunrise < 1 || hoursBeforeSunset < 1);
        const baseColor = isDay ? (isDawnDusk ? displayColors.orange : displayColors.yellow) : displayColors.black;
        const colX = x + i * pxPerHour;
        drawDitheredColumn(ctx, colX, y, pxPerHour, height, N / 100, baseColor);
    });

    // Sonnenauf-/untergangslinien
    ctx.fillStyle = displayColors.orange;
    sunTimes.forEach(({ sunriseX, sunsetX }) => {
        ctx.fillRect(sunriseX, y, 1, height);
        ctx.fillRect(sunsetX, y, 1, height);
    });

    // Niederschlag
    dayHours.forEach((d, i) => {
        const rain = d.forecast.RR1c;
        if (!rain || rain <= 0) return;

        const type = getPrecipType(d.forecast);
        let rainH = (height - 2 * rainYMargin) * Math.sqrt(rain) / Math.sqrt(maxRain);
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
    ctx.lineWidth = 2;
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
        ctx.lineWidth = 2;
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
    ctx.font = font;
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
