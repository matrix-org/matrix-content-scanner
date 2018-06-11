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

const Joi = require('joi');
const validate = require('express-validation');

const { getReport, generateReportFromDownload, scannedDownload } = require('./reporting.js');

function wrapAsyncHandle(fn) {
    return (req, res, next) => fn(req, res, next).catch(next);
}

const { getConfig } = require('./config.js');

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

async function encryptedDownloadHandler(req, res, next) {
    const matrixFile = req.body.file;

    return downloadHandler(req, res, next, matrixFile);
}

async function downloadHandler(req, res, next, matrixFile) {
    const config = getConfig();

    const { domain, mediaId } = req.params;

    const cachedReport = await getReport(req.console, domain, mediaId, eventContentFile, opts);

    if (cachedReport.scanned && !cachedReport.clean) {
        throw new ClientError(403, cachedReport.info);
    }

    const {
        clean, info, filePath, headers
    } = await generateReportFromDownload(req.console, domain, mediaId, matrixFile, config.scan);

    if (!clean) {
        throw new ClientError(403, info);
    }

    req.console.info(`Sending ${filePath} to client`);

    const responseHeaders = {};
    const headerWhitelist = [
        'content-type',
        'content-disposition',
        'content-security-policy',
    ];
    // Copy headers from media download to response
    headerWhitelist.forEach((headerKey) => responseHeaders[headerKey] = headers[headerKey]);

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
       result = await generateReportFromDownload(req.console, domain, mediaId, matrixFile, config.scan);
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
