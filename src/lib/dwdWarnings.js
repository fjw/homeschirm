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
            if (!warning) continue;
            const matchedArea = findAffectedArea(warning, lat, lon);
            if (matchedArea) {
                warnings.push({
                    event: warning.event,
                    severity: warning.severity,
                    headline: warning.headline,
                    description: warning.description,
                    onset: warning.onset,
                    expires: warning.expires,
                    areaDesc: matchedArea.areaDesc,
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
        const w = { areas: [] };
        let currentTag = '';
        let inArea = false;
        let currentArea = null;
        let inGeocode = false;
        let geocodeValueName = '';

        parser.on('opentag', (name) => {
            currentTag = name;
            if (name === 'area') {
                inArea = true;
                currentArea = { areaDesc: '', polygons: [], excludePolygons: [] };
            } else if (name === 'geocode') {
                inGeocode = true;
            }
        });

        parser.on('text', (text) => {
            if (currentTag === 'event') w.event = text;
            else if (currentTag === 'severity') w.severity = text;
            else if (currentTag === 'headline') w.headline = text;
            else if (currentTag === 'description') w.description = text;
            else if (currentTag === 'onset') w.onset = text;
            else if (currentTag === 'expires') w.expires = text;
            else if (inArea && currentTag === 'areaDesc') currentArea.areaDesc = text;
            else if (inArea && currentTag === 'polygon') {
                currentArea.polygons.push(parsePolygon(text));
            } else if (inArea && inGeocode && currentTag === 'valueName') {
                geocodeValueName = text;
            } else if (inArea && inGeocode && currentTag === 'value' && geocodeValueName === 'EXCLUDE_POLYGON') {
                currentArea.excludePolygons.push(parsePolygon(text));
            }
        });

        parser.on('closetag', (name) => {
            if (name === 'geocode') {
                inGeocode = false;
                geocodeValueName = '';
            } else if (name === 'area') {
                inArea = false;
                if (currentArea) w.areas.push(currentArea);
                currentArea = null;
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

function findAffectedArea(warning, lat, lon) {
    for (const area of warning.areas) {
        const inside = area.polygons.some(poly => pointInPolygon(lat, lon, poly));
        if (!inside) continue;
        const excluded = area.excludePolygons.some(poly => pointInPolygon(lat, lon, poly));
        if (!excluded) return area;
    }
    return null;
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
