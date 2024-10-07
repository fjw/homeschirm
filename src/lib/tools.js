/**
 * Converts a milliseconds time into human readable form.
 *
 * example: "5d 10h 36m 15s"
 *
 * @param ms
 * @returns {string}
 */
exports.msToHumanReadable = ms => {

    if(ms === null) {
        return "never";
    }

    const oned = 1000 * 60 * 60 * 24,
        oneh = 1000 * 60 * 60,
        onem = 1000 * 60,
        ones = 1000;

    const d = Math.floor(ms / oned);
    const h = Math.floor((ms-(d*oned)) / oneh);
    const m = Math.floor((ms-(d*oned)-(h*oneh)) / onem);
    const s = Math.floor((ms-(d*oned)-(h*oneh)-(m*onem)) / ones);

    let t = "";
    if (d) t = d + "d ";
    if (d || h) t = t + h + "h ";
    if (d || h || m) t = t + m + "m ";
    return t + s + "s";
}
