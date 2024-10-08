const dwdForecast = require('./lib/dwdForecast');
const cron = require('node-cron');
const fs = require('fs/promises');
const {readFileSync} = require('fs');
const {jsonTmpFile, updateCronTime} = require("./config");
const {draw} = require("./lib/draw");


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

    // no cached data, update now
    await updateNow();

  } finally {

    // setup cron update
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

  return actData
};

initialize().then(async actData => {
  console.log("-- initialized -- " + new Date().toLocaleString() + " -- data from: " + new Date(actData.issueTime).toLocaleString() + " --");

  await draw(actData);
});
