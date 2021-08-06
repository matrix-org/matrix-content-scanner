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
const get = require('simple-get');
const querystring = require('querystring');

const ClientError = require('./client-error.js');
const executeCommand = require('./execute-cmd.js');
const decryptFile = require('./decrypt-file.js');

const crypto = require('crypto');
const { getConfig } = require('./config.js');
const {createProxyTunnel } = require('./proxy.js');
const fileType = require('file-type');

// Generate a bas64 SHA 256 hash of the input string
function base64sha256(s) {
    const hash = crypto.createHash('sha256');
    hash.update(s);
    return hash.digest('base64');
}

// Generate a hash that changes if the report is for a different MXC URL or
// different matrixFile, which importantly changes if the decryption keys change.
function generateReportHash(httpUrl, matrixFile=undefined, thumbnailQueryParams=undefined) {
    // Result is cached against the hash of the input. Just using an MXC would
    // potentially allow an attacker to mark a file as clean without having the
    // keys to correctly decrypt it.
    return base64sha256(JSON.stringify({ httpUrl, matrixFile, thumbnailQueryParams }));
}

// Transform MXC components into HTTP URL
function generateHttpUrl(baseUrl, domain, mediaId, isThumbnail=false, directDownload=false) {
    const mediaType = isThumbnail ? 'thumbnail' : 'download';
    if (directDownload) {
        baseUrl = `https://${domain}`;
    }
    return `${baseUrl}/_matrix/media/v1/${mediaType}/${domain}/${mediaId}`;
}

// Generate HTTP request header for media download from homeserver
function generateRequestHeaders(config, req) {
    const requestHeaders = {};
    const { userAgent, xForward } = config;
    if (userAgent != null) {
        if (userAgent === 'origin') {
            requestHeaders['user-agent'] = req.header('user-agent');
        } else {
            requestHeaders['user-agent'] = userAgent;
        }
    }

    if (xForward != null) {
        if (xForward === 'origin') {
            requestHeaders['x-forwarded-for'] = req.ip;
        } else if (req.header(xForward)) {
            requestHeaders['x-forwarded-for'] = req.header(xForward);
        }
    }

    return requestHeaders;
}

// In-memory mapping between mxc:// URLs and the reports generated by generateReport
let reportCache = {};
function clearReportCache() {
    reportCache = {};
}

/**
 * Get cached report for the given input. If the domain, mediaId, matrixFile tuple has
 * been given to generateReport previously, then the cached result will be returned.
 * @param {object} console The console object to use for logging.
 * @param {string} domain The domain part of the MXC.
 * @param {string} mediaId The media ID part of the MXC.
 * @param {string} matrixFile Content under the "[thumbnail]_file" key in an encrypted matrix file event.
 * Optional. If not specified, no decryption step is taken.
 * @param {object} opts Options for getting the report.
 * @param {string} opts.baseUrl The URL of the homeserver to request media from.
 * @param {string} opts.thumbnailQueryParams If set, use as query parameters to request
 * a thumbnail. All thumbnail query parameters are optional, so passing `{ }` will download
 * a thumbnail without query parameters.
 * @param {string} opts.directDownload If true, download media directly from the media's content
 * repository. This should only be used if the `domain` is trusted for downloading media from
 * directly.
 *
 * @returns {Promise} A promise that resolves with a report:
 * ```
 *  { clean: false, scanned: true, info: "Some information gathered in the scan" }
 * ```
 **/
const getReport = async function(console, domain, mediaId, matrixFile, opts) {
    const { baseUrl, thumbnailQueryParams, directDownload } = opts;

    if (matrixFile) {
        [domain, mediaId] = matrixFile.url.split('/').slice(-2);
    }

    const httpUrl = generateHttpUrl(baseUrl, domain, mediaId, Boolean(thumbnailQueryParams), directDownload);
    const reportHash = generateReportHash(httpUrl, matrixFile, thumbnailQueryParams);

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
    const httpUrl = generateHttpUrl(opts.baseUrl, domain, mediaId, Boolean(opts.thumbnailQueryParams));
    return generateReportHash(httpUrl, matrixFile, opts.thumbnailQueryParams);
}

// Deduplicate concurrent requests if getKey returns an identical value for identical requests
function deduplicatePromises(getKey, asyncFn) {
    const ongoing = {};
    return async (console, ...args) => {
        const k = getKey(console, ...args);

        if(!ongoing[k]) {
            ongoing[k] = asyncFn(console, ...args).finally((res) => {delete ongoing[k]; return res;});
            ongoing[k]._id = console.id;
        }

        if (console.id !== ongoing[k]._id) {
            console.info(`Request deduplicated, see req [${ongoing[k]._id}] for canonical request`);
        }

        return await ongoing[k];
    };
}

const generateReportFromDownload = deduplicatePromises(getInputHash, _generateReportFromDownload);

/**
 * Download a matrix media file and generate and cache a scan report for it.
 *
 * @param {object} req The request object. Both the console and existing request headers are used.
 * @param {string} domain The domain part of the MXC.
 * @param {string} mediaId The media ID part of the MXC.
 * @param {string} matrixFile The content of a matrix file event. (Or "[thumbnail]_file" under an
 * encrypted file event.
 * @param {object} opts Options for generating a report.
 * @param {string} opts.baseUrl The URL of the homeserver to request media from.
 * @param {string} opts.tempDirectory The path to a directory where files can be written.
 * @param {string} opts.script The script to run against the downloaded file.
 * @param {string} opts.thumbnailQueryParams If set, use as query parameters to request
 * a thumbnail. All thumbnail query parameters are optional, so passing `{ }` will download
 * a thumbnail without query parameters.
 * @param {string} opts.directDownload If true, download media directly from the media's content
 * repository. This should only be used if the `domain` is trusted for downloading media from
 * directly.
 *
 * @returns {Promise} A promise that resolves with a report:
 * ```
 *  {
 *      clean: false,
 *      scanned: true,
 *      info: "Some information gathered in the scan",
 *
 *      filePath: "/some/path/to/the/downloaded/file",
 *
 *      // HTTP headers acquire in the GET to the media repository
 *      headers: [...],
 *  }
 * ```
 **/
async function _generateReportFromDownload(req, domain, mediaId, matrixFile, opts) {
    const { baseUrl, tempDirectory, script, thumbnailQueryParams, directDownload } = opts;
    if (baseUrl === undefined || tempDirectory === undefined || script === undefined) {
        throw new Error('Expected baseUrl, tempDirectory and script in opts');
    }

    const tempDir = tempDirectory;

    if (matrixFile) {
        [domain, mediaId] = matrixFile.url.split('/').slice(-2);
    }

    const httpUrl = generateHttpUrl(
        baseUrl, domain, mediaId, Boolean(thumbnailQueryParams), directDownload,
    );

    const filePath = path.join(tempDir, 'downloadedFile');
    const fileWriteStream = fs.createWriteStream(filePath);
    const fileWrittenPromise = new Promise((resolve, reject) => {
        fileWriteStream.once('close', resolve);
        fileWriteStream.once('error', reject);
    });

    const console = req.console;
    console.info(`Downloading ${httpUrl}, writing to ${filePath}`);

    let downloadHeaders;

    try {
        downloadHeaders = await new Promise((resolve, reject) => {
            // Base options for the request
            const opts = {
                url: httpUrl,
            };

            const config = getConfig();

            // Add additional request headers if configured
            if (config.requestHeader != null) {
                opts.headers = generateRequestHeaders(config.requestHeader, req);
                console.debug(`Request headers are`, connect.headers);
            }

            // Use a proxy if configured
            if (config.proxy) {
                opts.agent = createProxyTunnel();
            }

            // Add query parameters to the URL if we're requesting a thumbnail
            if (thumbnailQueryParams) {
                opts.url += '?' + querystring.stringify(thumbnailQueryParams);
            }

            // Download the media
            get(opts, (err, res) => {
                if (err) reject(err);

                // Write the file
                res.pipe(fileWriteStream);

                // Save the response headers
                resolve(res.headers);
            });
        });
    } catch (err) {
        if (!err.statusCode) {
            throw err;
        }

        console.error(`Received status code ${err.statusCode} when requesting ${httpUrl}`);

        throw new ClientError(502, 'Failed to get requested URL', 'MCS_MEDIA_REQUEST_FAILED');
    }

    // Wait for the writable stream to close
    await fileWrittenPromise;

    const stat = await fs.promises.stat(filePath);
    console.info(`File written to ${filePath}. (${stat.size} bytes)`);

    const result = await generateReport(console, httpUrl, matrixFile, filePath, tempDir, script);

    console.info(`Result: url = "${httpUrl}", clean = ${result.clean}, exit code = ${result.exitCode}`);

    result.filePath = filePath;
    result.headers = downloadHeaders;

    return result;
}

/**
 * Generate and cache a scan report for a given [encrypted] file.
 *
 * @param {object} console The console object to use for logging.
 * @param {string} httpUrl The HTTP URL used to retreive the file.
 * @param {string} matrixFile Content under the "[thumbnail]_file" key in an encrypted matrix file event.
 * Optional. If not specified, no decryption step is taken.
 * @param {string} filePath The path of the file to [decrypt and] scan.
 * @param {string} tempDir The path to a directory where files can be written.
 * @param {string} script The script to run against the file.
 *
 * @returns {Promise} A promise that resolves with a report:
 * ```
 *  {
 *      clean: false,
 *      scanned: true,
 *      info: "Some information gathered in the scan",
 *  }
 * ```
 **/
async function generateReport(console, httpUrl, matrixFile, filePath, tempDir, script, thumbnailQueryParams) {
    const reportHash = generateReportHash(httpUrl, matrixFile, thumbnailQueryParams);
    if (reportCache[reportHash] !== undefined) {
        console.info(`Result previously cached`);
        return reportCache[reportHash];
    }

    let mimetypeArray = getConfig().acceptedMimeType;
    // Always make a decryptedFile on disk
    let decryptedFilePath = path.join(tempDir, 'unsafeDownloadedDecryptedFile');

    if (matrixFile && matrixFile.key) {
        console.info(`Decrypting ${filePath}, writing to ${decryptedFilePath}`);

        // Decrypt the file
        let decryptedFileContents;
        try {
            decryptedFileContents = decryptFile(filePath, matrixFile);
        } catch (err) {
            console.error(err);
            throw new ClientError(400, 'Failed to decrypt file', 'MCS_MEDIA_FAILED_TO_DECRYPT');
        }

        // Further validate the mimetype of the file from the decrypted content
        if (mimetypeArray) {
            const mimetype = fileType(decryptedFileContents);
            if (mimetype === null) {
                console.info(`Skipping unsupported decrypted file - unknown mimetype [${filePath}]`);
                return {clean: false, info: 'File type not supported'};
            } else if (!mimetypeArray.includes(mimetype.mime)) {
                console.info(`Skipping unsupported decrypted file ${mimetype.mime} [${filePath}]`);
                return {clean: false, info: 'File type not supported'};
            }
        }

        // Write the decrypted file bytes to disk
        try {
            fs.writeFileSync(decryptedFilePath, decryptedFileContents);
        } catch (err) {
            console.error(err);
            throw new ClientError(400, 'Failed to write decrypted file to disk', 'MCS_MEDIA_FAILED_TO_DECRYPT');
        }
    } else {
        if (mimetypeArray) {
            const fileData = fs.readFileSync(filePath);
            const mimetype = fileType(fileData);
            if (mimetype === null) {
                console.info(`Skipping unsupported file - unknown mimetype [${filePath}]`);
                return {clean: false, info: 'File type not supported'};
            } else if (!mimetypeArray.includes(mimetype.mime)) {
                console.info(`Skipping unsupported file type ${mimetype.mime} [${filePath}]`);
                return {clean: false, info: 'File type not supported'};
            }
        }
        try {
            fs.copyFileSync(filePath, decryptedFilePath);
        } catch (err) {
            console.error(err);
            throw new ClientError(400, 'Failed to copy file for decryption', 'MCS_MEDIA_FAILED_TO_DECRYPT');
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
