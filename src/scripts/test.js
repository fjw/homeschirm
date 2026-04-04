const { draw } = require('../lib/draw');
const data = require('../../data/mosmix.json');

draw(data).then(() => console.log('done → data/screen.png'));

