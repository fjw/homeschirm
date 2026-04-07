exports.mosmixEndpoint = "https://opendata.dwd.de/weather/local_forecasts/mos/MOSMIX_S/all_stations/kml/MOSMIX_S_LATEST_240.kmz";
exports.stationId = 'P860'; //10865
exports.updateCronTime = '46 * * * *';

exports.kmlTmpFile = __dirname + '/../data/mosmix.kml';
exports.kmzTmpFile = __dirname + '/../data/mosmix.kmz';
exports.jsonTmpFile = __dirname + '/../data/data.json';
exports.pngTmpFile = __dirname + '/../data/screen.png';
exports.bmpTmpFile = __dirname + '/../data/screen.bmp';

exports.displayColors = {
    "white": "#fff",
    "black": "#000",
    "red": "#f00",
    "green": "#0f0",
    "blue": "#00f",
    "yellow": "#ff0",
    "orange": "#ff8000"
};

exports.showDaysCount = 5;
exports.showMinorWarnings = false;

exports.observationEndpoint = "https://opendata.dwd.de/weather/weather_reports/poi/10865-BEOB.csv";
exports.warningsEndpoint = "https://opendata.dwd.de/weather/alerts/cap/DISTRICT_CELLS_STAT/";
exports.warningsZipTmpFile = __dirname + '/../data/warnings.zip';
