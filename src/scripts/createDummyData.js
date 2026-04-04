/**
 * Generates dummy weather data and writes it to data/mosmix.json
 * Run with: node src/createDummyData.js
 *
 * Scenario:
 *   Day 0 (today):   Clear, 7–12°C, no rain
 *   Day 1:           Rain, max 11°C, frost + snow at night
 *   Day 2:           Clearing, -3–8°C, sunny
 *   Day 3–7:         Normal spring weather
 */

const fs = require('fs');
const path = require('path');
const { showDaysCount } = require('../config');

const C = (celsius) => celsius + 273.15;
const sun = (h, rise, set, peak) => {
    // h = UTC hour, rise/set/peak = UTC hours
    if (h < rise || h >= set) return 0;
    const mid = (rise + set) / 2;
    return Math.round(peak * Math.sin(Math.PI * (h - rise) / (set - rise)));
};

// Daily profiles: [T_min_C, T_max_C, rainProfile (24 values), sunRise, sunSet, peakSun]
// UTC times. CEST = UTC+2 → sunrise ~4:30 UTC, sunset ~17:30 UTC in April
const ramp = (from, to) => Array.from({length: 24}, (_, h) => Math.round(from + (to - from) * h / 23));

const days = [
    // Day 0: Regen tagsüber, Schnee nachts (Temp fällt unter 0)
    { min: -4, max: 11, rain: [0,0,0,0,0,0, 0.3,0.8,1.5,2.5,3.0,3.5, 3.0,2.5,2.0,1.5,1.0,0.5, 0.2,0.1,1.0,1.5,1.5,0.8],
      N: Array(24).fill(95), sunRise: 4, sunSet: 18, peakSun: 0 },
    // Day 1: Eisregen nachmittags (ww=67), Hagel nachts (ww=89)
    { min: 5, max: 13,
      rain: [0,0,0,0,0,0, 0,0,0,0,0,0, 0,0.2,0.5,0.3,0.1,0, 0,0,0,2.0,3.0,2.0],
      ww:   [null,null,null,null,null,null, null,null,null,null,null,null, null,67,67,67,67,null, null,null,null,89,89,89],
      N: Array(24).fill(80), sunRise: 4, sunSet: 18, peakSun: 500 },
    // Day 2: Bedeckungs-Gradient 0→100
    { min: 6, max: 13, rain: null, N: ramp(0, 100), sunRise: 4, sunSet: 18, peakSun: 1800 },
    // Day 3: N=0 (klar)
    { min: 8, max: 14, rain: null, N: Array(24).fill(0),   sunRise: 4, sunSet: 18, peakSun: 3600 },
    // Day 4: N=100 (bedeckt)
    { min: 7, max: 12, rain: null, N: Array(24).fill(100), sunRise: 4, sunSet: 18, peakSun: 0 },
    // Day 5: klare Nacht, bedeckter Tag
    { min: 5, max: 11, rain: null, N: Array.from({length: 24}, (_, h) => (h >= 6 && h < 18) ? 100 : 0), sunRise: 4, sunSet: 18, peakSun: 0 },
    // Day 6: bedeckte Nacht, klarer Tag
    { min: 7, max: 14, rain: null, N: Array.from({length: 24}, (_, h) => (h >= 6 && h < 18) ? 0 : 100), sunRise: 4, sunSet: 18, peakSun: 3000 },
    // Day 7: Gradient Nacht 0→100, Tag 100→0
    { min: 6, max: 12, rain: null, N: Array.from({length: 24}, (_, h) => {
        if (h < 6)             return Math.round(h / 5 * 100);
        if (h >= 6 && h < 18)  return Math.round((18 - h) / 12 * 100);
        return Math.round((h - 18) / 5 * 100);
    }), sunRise: 4, sunSet: 18, peakSun: 1500 },
];

const issueTime = new Date();
issueTime.setMinutes(0, 0, 0);

const startOfDay0 = new Date(issueTime);
startOfDay0.setUTCHours(0, 0, 0, 0);

function getDayId(date) {
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

const result = [];

for (let dayIndex = 0; dayIndex < showDaysCount; dayIndex++) {
    const profile = days[dayIndex];
    const avg = (profile.min + profile.max) / 2;
    const amp = (profile.max - profile.min) / 2;

    for (let h = 0; h < 24; h++) {
        const ts = new Date(startOfDay0);
        ts.setDate(ts.getDate() + dayIndex);
        ts.setUTCHours(h, 0, 0, 0);

        // Temperature: min at 2 UTC, max at 12 UTC
        const tempC = avg + amp * Math.cos((h - 12) * Math.PI / 12);
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
                N: profile.N ? profile.N[h] : (profile.rain ? 90 : (SunD1 > 1000 ? 30 : 60)),
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
    coords: { lat: 47.27, lon: 11.35, h: 574 },
    days: result,
};

const outPath = path.join(__dirname, '../../data/mosmix.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(output));
console.log(`Dummy data written to ${outPath}`);
console.log(`${result.length} time steps, issueTime: ${issueTime.toISOString()}`);
