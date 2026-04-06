const dwdForecast = require('./lib/dwdForecast');
const cron = require('node-cron');
const fs = require('fs/promises');
const {readFileSync} = require('fs');
const {jsonTmpFile, updateCronTime} = require("./config");
const {draw} = require("./lib/draw");
const {prepareData} = require("./lib/prepareData");
const {convertToBmp, pushToDisplay} = require("./lib/finalize");

let actData = null;

const updateNow = async () => {
    actData = await prepareData(await dwdForecast.update(), actData);
    await fs.writeFile(jsonTmpFile, JSON.stringify(actData));
};

const display = async () => {
    await draw(actData);
    console.log("converting to BMP.");
    await convertToBmp();
    if (process.env["NODE_ENV"] !== "development") {
        console.log("push to display...");
        await pushToDisplay();
    }
};

const initialize = async () => {
    try {
        actData = JSON.parse(readFileSync(jsonTmpFile).toString());
        if ((new Date() - new Date(actData.issueTime)) / 1000 / 60 / 60 > 2) {
            await updateNow();
        }
    } catch (e) {
        await updateNow();
    } finally {
        cron.schedule(updateCronTime, async () => {
            await updateNow();
            await display();
        });

        console.log("-- initialized -- " + new Date().toLocaleString() + " -- issueTime: " + new Date(actData.issueTime).toLocaleString() + " --");
        await display();
    }

    return actData;
};

initialize();
