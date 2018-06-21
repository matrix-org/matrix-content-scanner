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

const rimraf = require('rimraf');
const fs = require('fs');
const path = require('path');
module.exports = function withTempDir(tempDirectory, asyncFn, unlinkFn) {
    return async (...args) => {
        const opts = args[args.length - 1];

        const tempDir = await fs.promises.mkdtemp(`${tempDirectory}${path.sep}av-`);

        // Copy all options, overide tempDir
        args[args.length - 1] = Object.assign({}, opts, {tempDirectory: tempDir});

        let rimrafOpts = {};
        if (unlinkFn) {
            rimrafOpts.unlink = unlinkFn;
        }

        let result;
        try {
            result = await asyncFn(...args);
        } finally {
            await new Promise(
                (resolve, reject) => rimraf(tempDir, rimrafOpts, (err) => err ? reject(err) : resolve())
            );
        }

        return result;
    }
}
