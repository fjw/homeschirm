const { draw } = require('../lib/draw');
const data = require('../../data/mosmix.json');
const { convertToBmp, pushToDisplay } = require("../lib/finalize");

draw(data)
    .then(() => { console.log('done → data/screen.png'); return convertToBmp(); })
    .then(() => { console.log('done → data/screen.bmp'); return pushToDisplay(); })
    .then(() => console.log('done → pushed to display'));

