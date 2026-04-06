/**
 * Wandelt Millisekunden in lesbares Format um.
 *
 * Beispiel: "5d 10h 36m 15s"
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


/**
 * Führt einen Shell-Befehl als Subprozess aus und gibt {stdout, stderr} zurück.
 *
 * @param {string} command Shell-Befehl
 * @param {*} options Optionen als String-Array
 * @returns {Promise<{cmd: array, error: *}|{cmd: array, stdout: string, stderr: string}>}
 */
exports.cmd = (command, options) => {
    const {spawn} = require("child_process");

    return new Promise((resolve, reject) => {

        const cmdcall = [command, ...options];
        const ls = spawn(command, options);

        let stdout = "";
        let stderr = "";

        ls.stdout.on('data', data => stdout += data);
        ls.stderr.on('data', data => stderr += data);

        ls.on('error', error => {
            reject({cmd: cmdcall, error});
        });

        ls.on('close', code => {
            if(!code) {
                resolve({stdout, stderr, cmd: cmdcall});
            } else {
                reject({cmd: cmdcall, error: stdout+stderr});
            }
        });
    });
}
