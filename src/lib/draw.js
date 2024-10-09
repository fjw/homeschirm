const util = require('util');

//todo: remove
function l(obj) {
    console.log(util.inspect(obj, { showHidden: true, depth: null, colors: true, maxArrayLength: null }));
}



const { createCanvas } = require('canvas');
const {writeFileSync} = require("fs");
const {displayColors} = require("../config");

exports.draw = async (data) => {

    const cnv = createCanvas(800, 480);
    const ctx = cnv.getContext('2d');

    ctx.fillStyle = displayColors.white;
    ctx.fillRect(0, 0, 800, 480);

    ctx.fillStyle = displayColors.red;

    ctx.fillRect(16,16, 240, 10);


    const buf = cnv.toBuffer();
    writeFileSync('test.png', buf);


}
