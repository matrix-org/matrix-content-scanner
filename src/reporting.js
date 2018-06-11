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

const path = require('path');
const fs = require('fs');
const request = require('request');

const ClientError = require('./client-error.js');
const executeCommand = require('./execute-cmd.js');
const decryptFile = require('./decrypt-file.js');

const crypto = require('crypto');
function base64sha256(s) {
    const hash = crypto.createHash('sha256');
    hash.update(s);
    return hash.digest('base64');
}

function generateReportHash(httpUrl, matrixFile=undefined) {
    // Result is cached against the hash of the input. Just using an MXC would
    // potentially allow an attacker to mark a file as clean without having the
    // keys to correctly decrypt it.
    return base64sha256(JSON.stringify({ httpUrl, matrixFile }));
}

function generateHttpUrl(baseUrl, domain, mediaId) {
    return `${baseUrl}/_matrix/media/v1/download/${domain}/${mediaId}`;
}

// In-memory mapping between mxc:// URLs and the reports generated by generateReport
let reportCache = {};
function clearReportCache() {
    reportCache = {};
}

// Get cached report for the given URL
const getReport = async function(console, domain, mediaId, matrixFile, opts) {
    const { baseUrl } = opts;

    if (matrixFile) {
        [domain, mediaId] = matrixFile.url.split('/').slice(-2);
    }

    const httpUrl = generateHttpUrl(baseUrl, domain, mediaId);
    const reportHash = generateReportHash(httpUrl, matrixFile);

    if (!reportCache[reportHash]) {
        console.info(`File not scanned yet: domain = ${domain}, mediaId = ${mediaId}`);
        return { scanned: false };
    }
    const { clean, info } = reportCache[reportHash];

    console.info(`Returning scan report: domain = ${domain}, mediaId = ${mediaId}, clean = ${clean}`);

    return { clean, scanned: true, info };
};

// XXX: The result of this function is calculated similarly in a lot of places.
function getInputHash(_, domain, mediaId, matrixFile, opts) {
    if (matrixFile) {
        [domain, mediaId] = matrixFile.url.split('/').slice(-2);
    }
    const httpUrl = generateHttpUrl(opts.baseUrl, domain, mediaId);
    return generateReportHash(httpUrl, matrixFile);
}

// Deduplicate concurrent requests if getKey returns an identical value for identical requests
function deduplicatePromises(getKey, asyncFn) {
    const ongoing = {};
    return async (...args) => {
        const k = getKey(...args);

        if(!ongoing[k]) {
            ongoing[k] = asyncFn(...args).finally((res) => {delete ongoing[k]; return res;});
        }

        return await ongoing[k];
    };
}

const generateReportFromDownload = deduplicatePromises(getInputHash, _generateReportFromDownload);

// Generate a report on a Matrix file event.
async function _generateReportFromDownload(console, domain, mediaId, matrixFile, opts) {
    const { baseUrl, tempDirectory, script } = opts;
    if (baseUrl === undefined || tempDirectory === undefined || script === undefined) {
        throw new Error('Expected baseUrl, tempDirectory and script in opts');
    }

    const tempDir = tempDirectory;

    if (matrixFile) {
        [domain, mediaId] = matrixFile.url.split('/').slice(-2);
    }

    const httpUrl = generateHttpUrl(baseUrl, domain, mediaId);

    const filePath = path.join(tempDir, 'downloadedFile');

    console.info(`Downloading ${httpUrl}, writing to ${filePath}`);

    let downloadHeaders;
    let response;

    try {
        downloadHeaders = await new Promise((resolve, reject) => {
            let responseHeaders;
            request
                .get({url: httpUrl, encoding: null})
                .on('error', reject)
                .on('response', (response) => {
                    responseHeaders = response.headers;
                })
                .on('end', () => {
                    resolve(responseHeaders);
                })
                .pipe(fs.createWriteStream(filePath));
        });
    } catch (err) {
        if (!err.statusCode) {
            throw err;
        }

        console.error(`Receieved status code ${err.statusCode} when requesting ${httpUrl}`);

        throw new ClientError(502, 'Failed to get requested URL');
    }

    const result = await generateReport(console, httpUrl, matrixFile, filePath, tempDir, script);

    console.info(`Result: url = "${httpUrl}", clean = ${result.clean}, exit code = ${result.exitCode}`);

    result.filePath = filePath;
    result.headers = downloadHeaders;

    return result;
}

async function generateReport(console, httpUrl, matrixFile, filePath, tempDir, script) {
    const reportHash = generateReportHash(httpUrl, matrixFile);
    if (reportCache[reportHash] !== undefined) {
        console.info(`Result previously cached`);
        return reportCache[reportHash];
    }

    // By default, the file is considered decrypted
    let decryptedFilePath = filePath;

    if (matrixFile && matrixFile.key) {
        decryptedFilePath = path.join(tempDir, 'unsafeDownloadedDecryptedFile');
        console.info(`Decrypting ${filePath}, writing to ${decryptedFilePath}`);

        try {
            decryptFile(filePath, decryptedFilePath, matrixFile);
        } catch (err) {
            console.error(err);
            throw new ClientError(400, 'Failed to decrypt file');
        }
    }

    const cmd = script + ' ' + decryptedFilePath;
    console.info(`Running command ${cmd}`);
    const result = await executeCommand(cmd);

    reportCache[reportHash] = result;

    return result;
}

module.exports = {
    getReport,
    generateReportFromDownload,
    generateReport,
    generateHttpUrl,
    clearReportCache,
};
