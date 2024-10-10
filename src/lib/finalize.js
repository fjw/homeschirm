
const { cmd } = require('./tools');
const {pngTmpFile, bmpTmpFile} = require("../config");

exports.convertToBmp = async () => {
    try {
        await cmd("convert", [pngTmpFile, bmpTmpFile]);
    } catch (e) {
        console.error(e);
    }
}

exports.pushToDisplay = async () => {
    try {
        await cmd("python3", ["python_src/display_bitmap.py"]);
    } catch (e) {
        console.error(e);
    }
}
