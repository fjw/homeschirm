
const { cmd } = require('./tools');
const {pngTmpFile, bmpTmpFile} = require("../config");

exports.convertToBmp = async () => {
    await cmd("convert", [pngTmpFile, bmpTmpFile]);
}

exports.pushToDisplay = async () => {
    await cmd("python3", ["python_src/src/display_bitmap.py"]);
}
