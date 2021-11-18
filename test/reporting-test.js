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

const {
    getReport,
    generateReport,
    generateHttpUrl,
    clearReportCache,
} = require('../src/reporting.js');
const {setConfig} = require("../src/config.js");

const assert = require('assert');

const generateConfig = {
    baseUrl: "https://matrix.org",
    tempDirectory: "/tmp",
    script: "true"
};

const example = require('../example.file.json');

function generateReportFromFile(config = generateConfig) {
    return generateReport(
        console,
        generateHttpUrl(config.baseUrl, example._domain, example._mediaId),
        undefined,
        'example.file.data',
        config.tempDirectory,
        config.script
    );
}

function generateDecryptedReportFromFile(config = generateConfig) {
    return generateReport(
        console,
        generateHttpUrl(config.baseUrl, example._domain, example._mediaId),
        example.file,
        'example.file.data',
        config.tempDirectory,
        config.script
    );
}

describe('reporting.js', () => {
    beforeEach(() => {
        clearReportCache();

        setConfig({
            scan: {
                baseUrl: "https://matrix.org",
                tempDirectory: "/tmp",
                script: "true"
            },
            altRemovalCmd: 'rm',
        });
    });

    describe('getReport', () => {
        it('should indicate that a file has not yet been scanned', async () => {
            const report = await getReport(console, example._domain, example._mediaId, undefined, generateConfig);

            assert.strictEqual(report.scanned, false);
            assert.strictEqual(report.clean, undefined);
        });

        it('should indicate that an unencrypted file has been scanned once it has been fetched and scanned', async () => {
            const result = await generateReportFromFile();

            const report = await getReport(console, example._domain, example._mediaId, undefined, generateConfig);

            assert.strictEqual(report.scanned, true);
            assert.strictEqual(typeof report.clean, 'boolean');
        });

        it('should indicate that an encrypted file has been scanned once it has been fetched and scanned', async () => {
            const result = await generateDecryptedReportFromFile();

            const report = await getReport(console, example._domain, example._mediaId, example.file, generateConfig);

            assert.strictEqual(report.scanned, true);
            assert.strictEqual(typeof report.clean, 'boolean');
        });

        it('should derive domain and mediaId from contentEventFile.url', async () => {
            const result = await generateDecryptedReportFromFile();

            const report = await getReport(console, undefined, undefined, example.file, generateConfig);

            assert.strictEqual(typeof report.clean, 'boolean');
        });
    });

    describe('generateReport', () => {
        it('should indicate that a file is clean if the script terminates with exit code 0', async () => {
            const report = await generateDecryptedReportFromFile();

            assert.strictEqual(report.clean, true, 'the file should be marked safe');
        });

        it('should provide human-readable info in a report', async () => {
            const report = await generateDecryptedReportFromFile();

            assert.notStrictEqual(report.info, undefined);
        });

        it('should indicate that file is unsafe/unclean if the script exits with non-zero exit code', async () => {
            const modifiedConfig = {
                baseUrl: "https://matrix.org",
                tempDirectory: "/tmp",

                // Script that will always mark a file as unsafe
                script: "false",
            };
            const report = await generateDecryptedReportFromFile(modifiedConfig);

            assert.strictEqual(report.clean, false);
        });

        it('should indicate that file is unsafe/unclean if the script does not exist', async () => {
            const modifiedConfig = {
                baseUrl: "https://matrix.org",
                tempDirectory: "/tmp",

                // Script that does not exist on disk
                script: "some_script_that_should_not_exist_on_disk.sh",
            };

            const report = await generateDecryptedReportFromFile(modifiedConfig);

            assert.strictEqual(report.clean, false);
        });

        it('should not cache if a scan failed with an exit code that should be ignored', async () => {
            setConfig({
                scan: {
                    baseUrl: "https://matrix.org",
                    tempDirectory: "/tmp",
                    script: "true",
                    doNotCacheExitCodes: [5]
                },
                altRemovalCmd: 'rm',
            })

            const failureReport = await generateDecryptedReportFromFile({
                baseUrl: "https://matrix.org",
                tempDirectory: "/tmp",
                // Script that exits with the error code we want to ignore, and ignores
                // any other argument.
                script: "exit 5;",
            });

            assert.strictEqual(failureReport.clean, false)

            const successReport = await generateDecryptedReportFromFile({
                baseUrl: "https://matrix.org",
                tempDirectory: "/tmp",
                // Now we want to accept everything.
                script: "true",
            });

            assert.strictEqual(successReport.clean, true)
        });

        it('should cache a scan result', async () => {
            const firstReport = await generateDecryptedReportFromFile({
                baseUrl: "https://matrix.org",
                tempDirectory: "/tmp",
                // Mark every file as unsafe to see if the file is still cached as unsafe
                // after we change the script to accept it.
                script: "false",
            });

            assert.strictEqual(firstReport.clean, false)

            const secondReport = await generateDecryptedReportFromFile({
                baseUrl: "https://matrix.org",
                tempDirectory: "/tmp",
                // Now we want to accept everything.
                script: "true",
            });

            assert.strictEqual(secondReport.clean, false)
        });
    });
});
