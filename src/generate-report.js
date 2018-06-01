const path = require('path');
const fs = require('fs');
const rp = require('request-promise');

const ClientError = require('./client-error.js');
const executeCommand = require('./execute-cmd.js');
const decryptFile = require('./decrypt-file.js');

const resultCache = {};
// Generate a report on a Matrix file event.
module.exports = async function generateReport(console, eventContentFile, opts) {
    const url = eventContentFile.url;

    const { baseUrl, tempDirectory, script } = opts;
    if (baseUrl === undefined || tempDirectory === undefined || script === undefined) {
        throw new Error('Expected baseUrl, tempDirectory and script in opts');
    }

    const httpUrl = baseUrl + '/_matrix/media/v1/download/' + url.slice(6);

    if (resultCache[url] !== undefined) {
        const result = resultCache[url];
        console.info(`Returning cached result: url = ${url}, clean = ${result.clean}`);
        return result;
    }

    const tempDir = fs.mkdtempSync(`${tempDirectory}${path.sep}av-`);
    const filePath = path.join(tempDir, 'unsafeEncryptedFile');
    const decryptedFilePath = path.join(tempDir, 'unsafeFile');

    console.info(`Downloading ${httpUrl}, writing to ${filePath}`);

    try {
        data = await rp({url: httpUrl, encoding: null});
    } catch (err) {
        console.error(err);
        throw new ClientError(502, 'Failed to get requested URL');
    }

    fs.writeFileSync(filePath, data);

    console.info(`Decrypting ${filePath}, writing to ${decryptedFilePath}`);

    try {
        decryptFile(filePath, decryptedFilePath, eventContentFile);
    } catch (err) {
        console.error(err);
        throw new ClientError(400, 'Failed to decrypt file');
    }

    const cmd = script + ' ' + decryptedFilePath;
    console.info(`Running command ${cmd}`);
    const result = await executeCommand(cmd);

    console.info(`Result: url = "${url}", clean = ${result.clean}, exit code = ${result.exitCode}`);

    resultCache[url] = result;

    fs.unlinkSync(filePath);
    fs.unlinkSync(decryptedFilePath);
    fs.rmdirSync(tempDir);

    return result;
}
