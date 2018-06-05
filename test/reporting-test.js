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

const { getReport, generateReport, clearReportCache } = require('../src/reporting.js');
const assert = require('assert');

const generateConfig = {
    baseUrl: "https://matrix.org",
    tempDirectory: "/tmp",
    script: "exit 0"
};

const example = require('../example.file.json');

describe('reporting.js (end-to-end tests)', () => {
    beforeEach(() => {
        clearReportCache();
    });

    describe('getReport', () => {
        it('should indicate that a file has not been scanned', async () => {
            const report = await getReport('some_secret_that_was_not_generated');

            assert.strictEqual(report.clean, false);
            assert.strictEqual(report.scanned, false);
        });

        it('should indicate that an unencrypted file has been scanned once it has been fetched and scanned', async () => {
            const result = await generateReport(console, { url: example.file.url }, generateConfig);

            const report = await getReport(result.resultSecret);

            assert.strictEqual(report.scanned, true);
            assert.strictEqual(typeof report.clean, 'boolean');
        });

        it('should indicate that a file has been scanned once it has been fetched and scanned', async () => {
            const result = await generateReport(console, example.file, generateConfig);

            const report = await getReport(result.resultSecret);

            assert.strictEqual(report.scanned, true);
            assert.strictEqual(typeof report.clean, 'boolean');
        });
    });

    describe('generateReport', () => {
        it('should indicate that a file is clean if the script terminates with exit code 0', async () => {
            const report = await generateReport(console, example.file, generateConfig);

            assert.strictEqual(report.clean, true, 'the file should marked safe');
        });

        it('should provide human-readable info in a report', async () => {
            const report = await generateReport(console, example.file, generateConfig);

            assert.notStrictEqual(report.info, undefined);
        });

        it('should indicate that file is unsafe/unclean if the script exits with non-zero exit code', async () => {
            const modifiedConfig = {
                baseUrl: "https://matrix.org",
                tempDirectory: "/tmp",

                // Script that will always mark a file as unsafe
                script: "exit 1",
            };

            const report = await generateReport(console, example.file, modifiedConfig);

            assert.strictEqual(report.clean, false);
        });

        it('should indicate that file is unsafe/unclean if the script does not exist', async () => {
            const modifiedConfig = {
                baseUrl: "https://matrix.org",
                tempDirectory: "/tmp",

                // Script that does not exist on disk
                script: "some_script_that_should_not_exist_on_disk.sh",
            };

            const report = await generateReport(console, example.file, modifiedConfig);

            assert.strictEqual(report.clean, false);
        });
    });
});
