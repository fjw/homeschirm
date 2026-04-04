const { warningsEndpoint, warningsZipTmpFile } = require('../config');
const { createWriteStream, createReadStream, readdirSync, readFileSync, mkdirSync, rmSync } = require('fs');
const { Readable } = require('stream');
const { finished } = require('stream/promises');
const { cmd } = require('./tools');
const XmlParser = require('node-xml-stream');
const { resolve } = require('path');

const WARNINGS_DIR = resolve(__dirname, '../../data/warnings');

exports.fetchWarnings = async (lat, lon) => {
    try {
        // Aktuelle ZIP-Datei ermitteln
        const indexHtml = await fetch(warningsEndpoint).then(r => r.text());
        const deZips = [...indexHtml.matchAll(/href="(Z_CAP_C_EDZW_\d+_PVW_STATUS_PREMIUMCELLS_DISTRICT_DE\.zip)"/g)];
        if (!deZips.length) return [];
        const zipName = deZips[deZips.length - 1][1];

        // Download
        const stream = createWriteStream(warningsZipTmpFile);
        const { body } = await fetch(warningsEndpoint + zipName);
        await finished(Readable.fromWeb(body).pipe(stream));

        // Entpacken
        rmSync(WARNINGS_DIR, { recursive: true, force: true });
        mkdirSync(WARNINGS_DIR, { recursive: true });
        await cmd('unzip', ['-o', warningsZipTmpFile, '-d', WARNINGS_DIR]);

        // Alle XMLs parsen und filtern
        const files = readdirSync(WARNINGS_DIR).filter(f => f.endsWith('.xml'));
        const warnings = [];

        for (const file of files) {
            const warning = await parseWarningXml(resolve(WARNINGS_DIR, file));
            if (warning && isAffected(warning, lat, lon)) {
                warnings.push({
                    event: warning.event,
                    severity: warning.severity,
                    headline: warning.headline,
                    description: warning.description,
                    onset: warning.onset,
                    expires: warning.expires,
                    areaDesc: warning.areaDesc,
                });
            }
        }

        return warnings;
    } catch (e) {
        console.error('Warnungen laden fehlgeschlagen:', e.message);
        return [];
    }
};

function parseWarningXml(filePath) {
    return new Promise((resolve) => {
        const parser = new XmlParser();
        const w = { polygons: [], excludePolygons: [] };
        let currentTag = '';
        let inGeocode = false;
        let geocodeValueName = '';

        parser.on('opentag', (name) => {
            currentTag = name;
            if (name === 'geocode') inGeocode = true;
        });

        parser.on('text', (text) => {
            if (currentTag === 'event') w.event = text;
            else if (currentTag === 'severity') w.severity = text;
            else if (currentTag === 'headline') w.headline = text;
            else if (currentTag === 'description') w.description = text;
            else if (currentTag === 'onset') w.onset = text;
            else if (currentTag === 'expires') w.expires = text;
            else if (currentTag === 'areaDesc') w.areaDesc = text;
            else if (currentTag === 'polygon') {
                w.polygons.push(parsePolygon(text));
            } else if (inGeocode && currentTag === 'valueName') {
                geocodeValueName = text;
            } else if (inGeocode && currentTag === 'value' && geocodeValueName === 'EXCLUDE_POLYGON') {
                w.excludePolygons.push(parsePolygon(text));
            }
        });

        parser.on('closetag', (name) => {
            if (name === 'geocode') {
                inGeocode = false;
                geocodeValueName = '';
            }
        });

        parser.on('finish', () => resolve(w.event ? w : null));
        parser.on('error', () => resolve(null));

        createReadStream(filePath).pipe(parser);
    });
}

function parsePolygon(text) {
    return text.trim().split(/\s+/).map(pair => {
        const [lat, lon] = pair.split(',').map(Number);
        return { lat, lon };
    }).filter(p => !isNaN(p.lat) && !isNaN(p.lon));
}

function isAffected(warning, lat, lon) {
    // Punkt muss in mindestens einem Polygon liegen
    const inside = warning.polygons.some(poly => pointInPolygon(lat, lon, poly));
    if (!inside) return false;
    // Punkt darf nicht in einem Exclude-Polygon liegen
    const excluded = warning.excludePolygons.some(poly => pointInPolygon(lat, lon, poly));
    return !excluded;
}

// Ray-Casting Algorithmus
function pointInPolygon(lat, lon, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].lat, yi = polygon[i].lon;
        const xj = polygon[j].lat, yj = polygon[j].lon;
        if ((yi > lon) !== (yj > lon) && lat < (xj - xi) * (lon - yi) / (yj - yi) + xi) {
            inside = !inside;
        }
    }
    return inside;
}
