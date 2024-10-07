const fs = require('fs/promises');
const { createReadStream } = require('fs');
const { mosmixEndpoint, kmlTmpFile, stationId } = require('../config');
const AdmZip = require("adm-zip");
const XmlParser = require('node-xml-stream');
const { msToHumanReadable } = require('./tools');


exports.update = async () => {
    let startime;
    console.log('-- update -- ' + new Date() + ' --');

    startime = Date.now();
    console.log('downloading mosmix.');
    const kmz = await downloadKmz();
    console.log('     -> ' + msToHumanReadable(Date.now() - startime));

    startime = Date.now();
    console.log('extracting.');
    await extractKMZ(kmz);
    console.log('     -> ' + msToHumanReadable(Date.now() - startime));

    startime = Date.now();
    console.log('parsing.');
    const data = await parseKml();
    console.log('     -> ' + msToHumanReadable(Date.now() - startime));

    return data;
}

async function downloadKmz() {
    const response = await fetch(mosmixEndpoint,{ cache: 'no-store' });
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
}

async function extractKMZ(kmz) {
    const zip = new AdmZip(kmz);
    const zipEntries = zip.getEntries();
    const data = await getZipEntryData(zipEntries[0]);

    await fs.writeFile(kmlTmpFile, data);
}


function parseKml() {
    return new Promise((resolve, reject) => {

        let d = {
            loadTime: new Date()
        };

        const parser = new XmlParser();

        let currentTag;
        let timeSteps = [];
        let currentPlacemark;
        let currentForecastName;

        parser.on('opentag', (name, attrs) => {
            currentTag = name;

            if (name === 'kml:Placemark') {
                currentPlacemark = { forecast: {} };
            } else if (name === 'dwd:Forecast') {
                currentForecastName = attrs['dwd:elementName'];
            }

        });

        parser.on('text', (text) => {
            if (currentTag === 'dwd:IssueTime') {
                d.issueTime = text;
            } else if (currentTag === 'dwd:TimeStep') {
                timeSteps.push(text);
            } else if (currentTag === 'kml:name') {
                currentPlacemark.name = text;
            } else if (currentTag === 'kml:description') {
                currentPlacemark.description = text;
            } else if (currentTag === 'kml:coordinates') {
                currentPlacemark.coordinates = text.split(',').map(v => parseFloat(v));
            } else if (currentTag === 'dwd:value') {
                currentPlacemark.forecast[currentForecastName] = text.split(' ').filter(v => v !== '').map(v => v === '-' ? null : parseFloat(v));
            }
        });

        parser.on('closetag', (name) => {
            if(name === 'dwd:ForecastTimeSteps') {
                d.timeSteps = timeSteps;
            } else if (name === 'kml:Placemark') {
                if (currentPlacemark.name === stationId) {
                    d = {...d, ...currentPlacemark};
                    parser.end();
                }
            }
        });

        parser.on('finish', () => {
            resolve(d);
        });

        parser.on('error', (e) => {
            reject(e);
        });

        createReadStream(kmlTmpFile).pipe(parser);
    });

}



/**
 * Helper to make getDataAsync a promise (AdmZip)
 *
 * @param entry
 * @returns {Promise<unknown>}
 */
function getZipEntryData(entry) {
    return new Promise((resolve, reject) => {
        try {
            entry.getDataAsync(data => {
                resolve(data);
            });
        } catch (e) {
            reject(e);
        }
    });
}
