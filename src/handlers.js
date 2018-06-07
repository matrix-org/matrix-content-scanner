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

const { getReport, generateReport } = require('./reporting.js');

function wrapAsyncHandle(fn) {
    return (req, res, next) => fn(req, res, next).catch(next);
}

const { getConfig } = require('./config.js');

const scanSchema = {
    body: {
        file: Joi.object().keys({
            v: Joi.string(),
            key: Joi.object().keys({
                alg: Joi.string().required(),
                ext: Joi.boolean().required(),
                k: Joi.string().required(),
                key_ops: Joi.array().items(Joi.string()).required(),
                kty: Joi.string().required(),
            }),
            iv: Joi.string(),
            hashes: Joi.object().keys({
                sha256: Joi.string().required(),
            }),
            url: Joi.string().uri().required(),
            mimetype: Joi.string(),
        // If key is present, v, iv and hashes are required
        }).with('key', ['v', 'iv', 'hashes']).required(),
    }
};

async function scanHandler(req, res, next) {
    const config = getConfig();

    const { clean, info, resultSecret } = await generateReport(req.console, req.body.file, config.scan);

    const responseBody = { clean, info, secret: resultSecret };

    res.status(200).json(responseBody);
}

const unencryptedScanReportSchema = {
    params: {
        // The secret that was returned previously by /scan
        domain: Joi.string().hostname().required(),
        mediaId: Joi.string().required(),
    }
};

async function unencryptedScanReportHandler(req, res, next) {
    const config = getConfig();
    const { domain, mediaId } = req.params;
    const { clean, scanned, info } = await getReport(domain, mediaId, undefined, config.scan);

    const responseBody = { clean, scanned, info };
    req.console.info(`Returning scan report: domain = ${domain}, mediaId = ${mediaId}, scanned = ${scanned}, clean = ${clean}`);

    res.status(200).json(responseBody);
}

function attachHandlers(app) {
    app.post('/scan', validate(scanSchema), wrapAsyncHandle(scanHandler));
    app.get(
        '/_matrix/media_proxy/unstable/scan/:domain/:mediaId',
        validate(unencryptedScanReportSchema),
        wrapAsyncHandle(unencryptedScanReportHandler)
    );
}

module.exports = {
    attachHandlers
};
