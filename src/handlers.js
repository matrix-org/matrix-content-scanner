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

const child_process = require('child_process');

const Joi = require('joi');
const validate = require('express-validation');

const { getReport, generateReportFromDownload } = require('./reporting.js');
const withTempDir = require('./with-temp-dir.js');

const ClientError = require('./client-error.js');

function wrapAsyncHandle(fn) {
    return (req, res, next) => fn(req, res, next).catch(next);
}

const { getConfig } = require('./config.js');

/**
 * Create a replacement function for `fs.unlink` that executes altRemovalCmd with
 * the file path as the first argument.
 */
function getUnlinkFn(console) {
    const alternateRemovalCommand = getConfig().altRemovalCmd;

    let fn;
    if (alternateRemovalCommand) {
        fn = (path, callback) => {
            child_process.execFile(alternateRemovalCommand, [path], callback);
        }
        console.info(`Will unlink file paths with alternate command "${alternateRemovalCommand}"`);
    }

    return fn;
}

const encryptedRequestSchema = {
    body: {
        file: Joi.object().keys({
            v: Joi.string().required(),
            key: Joi.object().keys({
                alg: Joi.string().required(),
                ext: Joi.boolean().required(),
                k: Joi.string().required(),
                key_ops: Joi.array().items(Joi.string()).required(),
                kty: Joi.string().required(),
            }).required(),
            iv: Joi.string().required(),
            hashes: Joi.object().keys({
                sha256: Joi.string().required(),
            }).required(),
            // mxc://:domain/:mediaId
            url: Joi.string().uri().required(),
            mimetype: Joi.string(),
        }).required(),
    }
};

const unencryptedRequestSchema = {
    params: {
        domain: Joi.string().hostname().required(),
        mediaId: Joi.string().required(),
    }
};

const thumbnailRequestSchema = {
    params: {
        domain: Joi.string().hostname().required(),
        mediaId: Joi.string().required(),
    },
    query: {
        width: Joi.number(),
        height: Joi.number(),
        method: Joi.string(),
    },
};

async function encryptedDownloadHandler(req, res, next) {
    const matrixFile = req.body.file;

    return downloadHandler(req, res, next, matrixFile);
}

async function thumbnailHandler(req, res, next) {
    const { width, height, method } = req.query;
    const thumbnailQueryParams = { width, height, method };

    return downloadHandler(req, res, next, undefined, thumbnailQueryParams);
}

async function downloadHandler(req, res, next, matrixFile, thumbnailQueryParams) {
    const config = getConfig();

    const { domain, mediaId } = req.params;

    const { script, tempDirectory, baseUrl, directDownload } = config.scan;
    const opts = {
        script,
        tempDirectory,
        baseUrl,

        thumbnailQueryParams,
        directDownload,
    };

    const cachedReport = await getReport(req.console, domain, mediaId, matrixFile, opts);

    if (cachedReport.scanned && !cachedReport.clean) {
        throw new ClientError(403, cachedReport.info, 'MCS_MEDIA_NOT_CLEAN');
    }

    const proxyDownloadWithTmpDir = withTempDir(tempDirectory, proxyDownload, getUnlinkFn(req.console));
    await proxyDownloadWithTmpDir(req, res, domain, mediaId, matrixFile, thumbnailQueryParams, config.scan);
}

async function proxyDownload(req, res, domain, mediaId, matrixFile, thumbnailQueryParams, config) {
    const { script, tempDirectory, baseUrl, directDownload } = config;
    const opts = {
        script,
        tempDirectory,
        baseUrl,

        thumbnailQueryParams,
        directDownload,
    };

    const {
        clean, info, filePath, headers
    } = await generateReportFromDownload(req, domain, mediaId, matrixFile, opts);

    if (!clean) {
        throw new ClientError(403, info, 'MCS_MEDIA_NOT_CLEAN');
    }

    req.console.info(`Sending ${filePath} to client`);

    const responseHeaders = {};
    const headerWhitelist = [
        'content-type',
        'content-disposition',
        'content-security-policy',
    ];
    // Copy headers from media download to response
    headerWhitelist
        .filter((headerKey) => headers[headerKey])
        .forEach((headerKey) => responseHeaders[headerKey] = headers[headerKey]);

    req.console.info(`Response headers are`, responseHeaders);

    res.set(responseHeaders);
    res.sendFile(filePath);
}

async function encryptedScanReportHandler(req, res, next) {
    const matrixFile = req.body.file;

    return scanReportHandler(req, res, next, matrixFile);
}

async function scanReportHandler(req, res, next, matrixFile) {
    const config = getConfig();
    const { domain, mediaId } = req.params;
    let result = await getReport(req.console, domain, mediaId, matrixFile, config.scan);

    if (!result.scanned) {
        const generateReportFromDownloadWithTmpDir = withTempDir(
            config.scan.tempDirectory,
            generateReportFromDownload,
            getUnlinkFn(req.console),
        );
        result = await generateReportFromDownloadWithTmpDir(
            req, domain, mediaId, matrixFile, config.scan
        );
    }

    const { clean, info } = result;

    const responseBody = { clean, info };

    res.status(200).json(responseBody);
}

function attachHandlers(app) {
    app.post(
        '/_matrix/media_proxy/unstable/download_encrypted',
        validate(encryptedRequestSchema),
        wrapAsyncHandle(encryptedDownloadHandler)
    );
    app.get(
        '/_matrix/media_proxy/unstable/download/:domain/:mediaId',
        validate(unencryptedRequestSchema),
        wrapAsyncHandle(downloadHandler)
    );
    app.get(
        '/_matrix/media_proxy/unstable/thumbnail/:domain/:mediaId',
        validate(thumbnailRequestSchema),
        wrapAsyncHandle(thumbnailHandler)
    );
    app.post(
        '/_matrix/media_proxy/unstable/scan_encrypted',
        validate(encryptedRequestSchema),
        wrapAsyncHandle(encryptedScanReportHandler)
    );
    app.get(
        '/_matrix/media_proxy/unstable/scan/:domain/:mediaId',
        validate(unencryptedRequestSchema),
        wrapAsyncHandle(scanReportHandler)
    );
}

module.exports = {
    attachHandlers
};
