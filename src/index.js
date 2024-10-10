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

const initialize = async () => {
  try {

    actData = JSON.parse(readFileSync(jsonTmpFile).toString());

    // if data is older than 1 hour on load, update now
    if((new Date() - new Date(actData.updateTime)) / 1000 / 60 / 60 > 1 ) { await updateNow(); }

  } catch (e) {

    // no cached data, update now
    await updateNow();

  } finally {

    const display = async () => {
      await draw(actData);
      console.log("converting to BMP.");
      await convertToBmp();
      if(process.env["NODE_ENV"] !== "development") {
        console.log("push to display...")
        await pushToDisplay();
      }
    };

    // setup cron update
    cron.schedule(updateCronTime, async () => {
      await updateNow();
      await display();
    });

    console.log("-- initialized -- " + new Date().toLocaleString() + " -- data from: " + new Date(actData.issueTime).toLocaleString() + " --");
    await display();

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
  //console.log("-- initialized -- " + new Date().toLocaleString() + " -- data from: " + new Date(actData.issueTime).toLocaleString() + " --");


});

/*
const example = {
  issueTime: "2024-10-09T17:00:00.000Z",
  updateTime: "2024-10-09T17:46:08.067Z",
  days: [
    {
      day: "2024-10-9",
      hour: 22,
      timeStep: "2024-10-09T20:00:00.000Z",
      issueTime: "2024-10-09T17:00:00.000Z",
      forecast: {
        PPPP: 99270,
        TX: null,
        TTT: 285.65,
        Td: 283.65,
        TN: null,
        T5cm: 283.95,
        DD: 106,
        FF: 2.06,
        FX1: 4.12,
        FX3: 5.66,
        FXh: null,
        FXh25: null,
        FXh40: null,
        FXh55: null,
        N: 55,
        Neff: 49,
        Nh: 18,
        Nm: 40,
        Nl: 8,
        N05: 8,
        VV: 8500,
        wwM: 13,
        wwM6: null,
        wwMh: null,
        ww: 1,
        W1W2: null,
        RR1c: 0,
        RRS1c: 0,
        RR3c: null,
        RRS3c: null,
        R602: null,
        R650: null,
        Rh00: null,
        Rh02: null,
        Rh10: null,
        Rh50: null,
        Rd02: null,
        Rd50: null,
        Rad1h: null,
        SunD1: 0
      }
    },
    {
      day: "2024-10-9",
      hour: 23,
      timeStep: "2024-10-09T21:00:00.000Z",
      issueTime: "2024-10-09T17:00:00.000Z",
      forecast: {
        PPPP: 99220,
        TX: null,
        TTT: 286.15,
        Td: 283.35,
        TN: null,
        T5cm: 284.45,
        DD: 98,
        FF: 2.06,
        FX1: 4.12,
        FX3: 5.14,
        FXh: null,
        FXh25: null,
        FXh40: null,
        FXh55: null,
        N: 56,
        Neff: 56,
        Nh: 9,
        Nm: 44,
        Nl: 14,
        N05: 10,
        VV: 7900,
        wwM: 16,
        wwM6: 19,
        wwMh: null,
        ww: 1,
        W1W2: null,
        RR1c: 0,
        RRS1c: 0,
        RR3c: 0,
        RRS3c: 0,
        R602: null,
        R650: null,
        Rh00: null,
        Rh02: null,
        Rh10: null,
        Rh50: null,
        Rd02: null,
        Rd50: null,
        Rad1h: null,
        SunD1: 0
      }
    }
  ]
};
*/
