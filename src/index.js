const dwdForecast = require('./lib/dwdForecast');
const cron = require('node-cron');
const fs = require('fs/promises');
const {readFileSync} = require('fs');
const {jsonTmpFile, updateCronTime} = require("./config");


let actData;

const updateNow = async () => {
  const oldIssueTime = actData ? actData.issueTime : "never";
  actData = await dwdForecast.update();

  if(actData.issueTime !== oldIssueTime) {
    await fs.writeFile(jsonTmpFile, JSON.stringify(actData));
  }
};

const initialize = async () => {
  try {
    actData = JSON.parse(readFileSync(jsonTmpFile).toString());

    // if data is older than 1 hour on load, update now
    if((new Date() - new Date(actData.updateTime)) / 1000 / 60 / 60 > 1 ) { await updateNow(); }

  } catch (e) {
    actData = null;
  } finally {


    cron.schedule(updateCronTime, async () => { await updateNow(); });


    /*
    setInterval(() => {
      if(actData) {
        console.log(
            new Date().toLocaleString(),
            "  -  ",
            new Date(actData.issueTime).toLocaleString(),
            "  -  ",
            new Date(actData.updateTime).toLocaleString(),
        );
      } else {
        console.log(".");
      }
    }, 10000);
    */

  }
};

initialize().then(() => console.log("-- initialized -- " + new Date().toLocaleString() + " --"));
