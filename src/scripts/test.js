const { draw } = require('../lib/draw');
const data = require('../../data/mosmix.json');
const { readFileSync } = require('fs');
const { resolve } = require('path');

let warnings = [];
try { warnings = JSON.parse(readFileSync(resolve(__dirname, '../../data/warnings.json')).toString()); } catch {}

draw(data, warnings).then(() => console.log('done → data/screen.png'));

