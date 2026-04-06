/**
 * Generates dummy weather data and writes it to data/mosmix.json
 * Run with: node src/scripts/createDummyData.js
 *
 * Scenario (alle Zeichenstile abgedeckt):
 *   Day 0 (today):   Mischung: Sonne morgens, Regen mittags, abends klar. Nulllinie sichtbar (Temp um 0°C nachts).
 *   Day 1:           Starkregen mit Overflow (>5mm), Eisregen nachmittags (ww=67), Hagel abends (ww=89).
 *   Day 2:           Frost + Schnee (TTT < 0°C, ww=70-79), Bedeckungs-Gradient 0→100.
 *   Day 3:           Sonnig, warm, klar (N=0). Max-Temp-Label oben.
 *   Day 4:           Komplett bedeckt (N=100), leichter Nieselregen, kühl.
 */

const fs = require('fs');
const path = require('path');
const { showDaysCount } = require('../config');

const C = (celsius) => celsius + 273.15;
const sun = (h, rise, set, peak) => {
    if (h < rise || h >= set) return 0;
    return Math.round(peak * Math.sin(Math.PI * (h - rise) / (set - rise)));
};

const ramp = (from, to) => Array.from({length: 24}, (_, h) => Math.round(from + (to - from) * h / 23));

const days = [
    // Day 0: Sonne morgens, Regen mittags, klar abends. Temp: -2 bis 12°C (Nulllinie sichtbar)
    {
        min: -2, max: 12,
        rain: [0,0,0,0,0,0, 0,0,0,0.5,1.2,2.0, 3.0,2.5,1.5,0.8,0.3,0, 0,0,0,0,0,0],
        N:    [10,5,5,10,15,20, 30,40,60,80,95,100, 100,95,90,80,60,40, 20,10,5,5,10,15],
        sunRise: 4, sunSet: 18, peakSun: 2500,
    },
    // Day 1: Extremregen (Overflow >15mm), Eisregen nachmittags, Hagel nachts
    {
        min: 1, max: 9,
        rain: [0,0,0,0,0,0, 0.5,2.0,5.0,12.0,25.0,35.0, 18.0,8.0,3.0,0.8,0.3,0.1, 0,0,0,6.0,10.0,4.0],
        ww:   [null,null,null,null,null,null, null,null,null,null,null,null, null,67,67,67,67,null, null,null,null,89,89,89],
        N:    Array(24).fill(95),
        sunRise: 4, sunSet: 18, peakSun: 200,
    },
    // Day 2: Frost + Schnee, Bedeckungs-Gradient 0→100
    {
        min: -6, max: 2,
        rain: [0,0,0,0.2,0.5,0.8, 1.0,0.8,0.5,0.2,0,0, 0,0,0,0,0.1,0.3, 0.5,0.8,1.2,1.5,1.0,0.5],
        ww:   [null,null,null,71,71,73, 73,75,75,71,null,null, null,null,null,null,71,71, 73,73,75,75,73,71],
        N:    ramp(0, 100),
        sunRise: 4, sunSet: 18, peakSun: 800,
    },
    // Day 3: Sonnig, warm, klar
    {
        min: 8, max: 24,
        rain: null,
        N:    Array(24).fill(0),
        sunRise: 4, sunSet: 18, peakSun: 3600,
    },
    // Day 4: Komplett bedeckt, Nieselregen
    {
        min: 4, max: 10,
        rain: [0,0,0,0,0,0, 0.1,0.2,0.3,0.3,0.2,0.2, 0.3,0.3,0.2,0.1,0.1,0, 0,0,0,0,0,0],
        N:    Array(24).fill(100),
        sunRise: 4, sunSet: 18, peakSun: 0,
    },
    // Extra Tage falls showDaysCount > 5
    { min: 6, max: 16, rain: null, N: Array.from({length: 24}, (_, h) => (h >= 6 && h < 18) ? 0 : 80), sunRise: 4, sunSet: 18, peakSun: 2800 },
    { min: 3, max: 13, rain: null, N: Array.from({length: 24}, (_, h) => (h >= 6 && h < 18) ? 80 : 0), sunRise: 4, sunSet: 18, peakSun: 400 },
    { min: 5, max: 15, rain: null, N: ramp(100, 0), sunRise: 4, sunSet: 18, peakSun: 1500 },
];

const issueTime = new Date();
issueTime.setMinutes(0, 0, 0);

const startOfDay0 = new Date(issueTime);
startOfDay0.setHours(0, 0, 0, 0);

function getDayId(date) {
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

const result = [];

for (let dayIndex = 0; dayIndex < showDaysCount; dayIndex++) {
    const profile = days[dayIndex];
    if (!profile) break;
    const avg = (profile.min + profile.max) / 2;
    const amp = (profile.max - profile.min) / 2;

    for (let h = 0; h < 24; h++) {
        const ts = new Date(startOfDay0);
        ts.setDate(ts.getDate() + dayIndex);
        ts.setHours(h, 0, 0, 0);

        // Temperature: min at 4 UTC, max at 14 UTC
        const tempC = avg + amp * Math.cos((h - 14) * Math.PI / 12);
        const TTT = C(tempC);

        const RR1c = profile.rain ? (profile.rain[h] ?? 0) : 0;
        const ww = profile.ww ? (profile.ww[h] ?? null) : null;
        const SunD1 = sun(h, profile.sunRise, profile.sunSet, profile.peakSun);

        result.push({
            day: getDayId(ts),
            hour: ts.getHours(),
            timeStep: ts.toISOString(),
            issueTime: issueTime.toISOString(),
            forecast: {
                PPPP: 101325,
                TX: null, TN: null,
                TTT,
                Td: C(tempC - 4),
                T5cm: C(tempC - 1),
                DD: 210, FF: 2.5, FX1: 4.0, FX3: 5.0,
                FXh: null, FXh25: null, FXh40: null, FXh55: null,
                N: profile.N ? profile.N[h] : 50,
                Neff: null, Nh: null, Nm: null, Nl: null, N05: null,
                VV: 8000,
                wwM: null, wwM6: null, wwMh: null, ww, W1W2: null,
                RR1c,
                RRS1c: 0, RR3c: null, RRS3c: null,
                R602: null, R650: null, Rh00: null, Rh02: null,
                Rh10: null, Rh50: null, Rd02: null, Rd50: null,
                Rad1h: null,
                SunD1,
            }
        });
    }
}

const output = {
    issueTime: issueTime.toISOString(),
    updateTime: new Date().toISOString(),
    coords: { lat: 48.12, lon: 11.78, h: 716 },
    warnings: [
        { event: 'STARKWIND', severity: 'Minor', headline: 'Amtliche Warnung vor STARKWIND', description: 'Boeen bis 60 km/h', onset: issueTime.toISOString(), expires: null, areaDesc: 'Landkreis Muenchen' },
        { event: 'FROST', severity: 'Moderate', headline: 'Amtliche Warnung vor FROST', description: 'Tiefstwerte bis -6°C', onset: issueTime.toISOString(), expires: null, areaDesc: 'Landkreis Muenchen' },
    ],
    observation: {
        temperature: 10.1,
        humidity: 68,
        windSpeed: 14,
        precipitation: 1.2,
    },
    days: result,
};

const outPath = path.join(__dirname, '../../data/mosmix.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(output));
console.log(`Dummy data written to ${outPath}`);
console.log(`${result.length} time steps, issueTime: ${issueTime.toISOString()}`);
