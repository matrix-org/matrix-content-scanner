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

const { getReport, scannedDownload } = require('./reporting.js');

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
    const { file } = req.body;

    return downloadHandler(req, res, next, file);
}

async function downloadHandler(req, res, next, file) {
    const config = getConfig();

    const { domain, mediaId } = req.params;

    return scannedDownload(req, res, domain, mediaId, file, config.scan);
}

async function encryptedScanReportHandler(req, res, next) {
    const { file } = req.body;

    return scanReportHandler(req, res, next, file);
}

async function scanReportHandler(req, res, next, file) {
    const config = getConfig();
    const { domain, mediaId } = req.params;
    const { clean, info } = await getReport(req.console, domain, mediaId, file, config.scan);

    const responseBody = { clean, info };
    req.console.info(`Returning scan report: domain = ${domain}, mediaId = ${mediaId}, clean = ${clean}`);

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
