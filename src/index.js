const dwdForecast = require('./lib/dwdForecast');
const cron = require('node-cron');
const fs = require('fs/promises');
const {readFileSync} = require('fs');
const {jsonTmpFile, updateCronTime} = require("./config");


let actData;

try {
  actData = JSON.parse(readFileSync(jsonTmpFile).toString());
} catch (e) {
  actData = null;
} finally {


  cron.schedule(updateCronTime, async () => {
    const oldIssueTime = actData ? actData.issueTime : "never";
    actData = await dwdForecast.update();

    if(actData.issueTime !== oldIssueTime) {
      await fs.writeFile(jsonTmpFile, JSON.stringify(actData));
    }
  });


  setInterval(() => {
    if(actData) {
      console.log(new Date(), actData.issueTime);
    } else {
      console.log(".");
    }
  }, 10000);


}

