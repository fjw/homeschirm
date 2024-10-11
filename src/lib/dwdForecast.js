const { createReadStream, createWriteStream } = require('fs');
const { mosmixEndpoint, kmlTmpFile, stationId, kmzTmpFile} = require('../config');
const XmlParser = require('node-xml-stream');
const { msToHumanReadable, cmd } = require('./tools');
const { Readable } = require('stream');
const { finished } = require('stream/promises');


exports.update = async () => {
    try {
        let startime;
        console.log('-- update -- ' + new Date().toLocaleString() + ' --');

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

        console.log('-- done --');

        return data;
    } catch (e) {
        console.error(e);
    }
}

async function downloadKmz() {
    const stream = createWriteStream(kmzTmpFile);
    const { body } = await fetch(mosmixEndpoint);
    await finished(Readable.fromWeb(body).pipe(stream));
}

async function extractKMZ() {
    await cmd("src/lib/unzipKml.sh", []);
}


function parseKml() {
    return new Promise((resolve, reject) => {

        let d = {
            updateTime: new Date().toISOString(),
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
