

const fs = require('fs/promises');
const {prepareData} = require("../lib/prepareData");
const dwdForecast = require("../lib/dwdForecast");
const {jsonTmpFile} = require("../config");

dwdForecast.update().then(fc => prepareData(fc, null).then(data => {
    fs.writeFile(jsonTmpFile, JSON.stringify(data))
        .then(() => console.log('done → ' + jsonTmpFile));
}));
