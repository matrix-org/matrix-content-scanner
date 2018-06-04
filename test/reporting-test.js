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
            const report = await getReport('mxc://unscanned_file');

            assert.strictEqual(report.clean, false);
            assert.strictEqual(report.scanned, false);
        });

        it('should indicate that a file has been scanned once it has been fetched and scanned', async () => {
            await generateReport(console, example.file, generateConfig);

            const report = await getReport(example.file.url);

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
