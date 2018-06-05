/**

Copyright 2018 New Vector Ltd.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

**/

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
                resolve({
                    clean: false,
                    info: stdout.length > 0 ? `File not clean. Output: '${stdout}'` : 'File not clean (no output)',
                    exitCode: err.code,
                });
                return;
            }

            resolve({
                clean: true,
                info: 'File clean at ' + new Date().toLocaleString(),
                exitCode: 0,
            });
        });
    });
}
