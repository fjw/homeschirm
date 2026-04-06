const { createReadStream, createWriteStream } = require('fs');
const { mosmixEndpoint, kmlTmpFile, stationId, kmzTmpFile, observationEndpoint} = require('../config');
const XmlParser = require('node-xml-stream');
const { msToHumanReadable, cmd } = require('./tools');
const { fetchWarnings } = require('./dwdWarnings');
const { Readable } = require('stream');
const { finished } = require('stream/promises');
const readline = require('readline');


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
        console.log('filtering.');
        const kmlString = await filterKml();
        console.log('     -> ' + msToHumanReadable(Date.now() - startime));

        startime = Date.now();
        console.log('parsing.');
        const data = await parseKml(kmlString);
        console.log('     -> ' + msToHumanReadable(Date.now() - startime));

        startime = Date.now();
        console.log('warnings.');
        data.warnings = await fetchWarnings(data.coordinates[1], data.coordinates[0]);
        console.log('     -> ' + msToHumanReadable(Date.now() - startime));

        startime = Date.now();
        console.log('observation.');
        data.observation = await fetchObservation();
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

function filterKml() {
    return new Promise((resolve, reject) => {
        const lines = [];
        let inHeader = true;
        let inTargetPlacemark = false;
        let inOtherPlacemark = false;
        let placemarkBuf = [];

        const rl = readline.createInterface({
            input: createReadStream(kmlTmpFile),
            crlfDelay: Infinity,
        });

        rl.on('line', (line) => {
            if (inHeader) {
                lines.push(line);
                if (line.includes('</dwd:ProductDefinition>')) {
                    inHeader = false;
                }
                return;
            }

            if (line.includes('<kml:Placemark>')) {
                placemarkBuf = [line];
                inOtherPlacemark = true;
                return;
            }

            if (inOtherPlacemark) {
                placemarkBuf.push(line);
                if (line.includes('<kml:name>' + stationId + '</kml:name>')) {
                    inTargetPlacemark = true;
                }
                if (line.includes('</kml:Placemark>')) {
                    if (inTargetPlacemark) {
                        lines.push(...placemarkBuf);
                        lines.push('    </kml:Document>');
                        lines.push('</kml:kml>');
                        rl.close();
                    }
                    placemarkBuf = [];
                    inOtherPlacemark = false;
                    inTargetPlacemark = false;
                }
                return;
            }
        });

        rl.on('close', () => resolve(lines.join('\n')));
        rl.on('error', reject);
    });
}

function parseKml(kmlString) {
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

        const stream = new Readable();
        stream.push(kmlString);
        stream.push(null);
        stream.pipe(parser);
    });

}



async function fetchObservation() {
    try {
        const res = await fetch(observationEndpoint);
        const text = await res.text();
        const lines = text.trim().split('\n');
        // Die erste Datenzeile (Index 3) ist die aktuellste Beobachtung
        const row = lines[3].split(';');
        const parse = v => v === '---' ? null : parseFloat(v.replace(',', '.'));
        return {
            temperature: parse(row[9]),
            humidity: parse(row[37]),
            windSpeed: parse(row[23]),
            precipitation: parse(row[33]),
        };
    } catch (e) {
        console.error('Observation fetch error:', e.message);
        return null;
    }
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
