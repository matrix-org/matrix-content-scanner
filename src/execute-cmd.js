const { exec } = require('child_process');

// Execute a command asyncronously by wrapping in a promise that resolves to an
// object with two keys:
// {
//  clean: true, // true if the exit code was 0, false otherwise
//  info: "...", // Information about the execution of the command
// }
module.exports = function executeCommand(cmd) {
    return new Promise((resolve, reject) => {
        exec(cmd, (err, stdout, stderr) => {
            if (err) {
                console.info(`Script returned exit code ${err.code}`);
                resolve({
                    clean: false,
                    info: stdout.length > 0 ? `File not clean. Output: '${stdout}'` : 'File not clean (no output)',
                });
                return;
            }

            resolve({
                clean: true,
                info: 'File clean at ' + new Date().toLocaleString(),
            });
        });
    });
}
