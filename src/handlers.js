const Joi = require('joi');
const validate = require('express-validation');

const generateReport = require('./generate-report.js');

function wrapAsyncHandle(fn) {
    return (req, res, next) => fn(req, res, next).catch(next);
}

const scanConfig = require('../config.js').scan;

const scanSchema = {
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
            hashes: {
                sha256: Joi.string().required(),
            },
            url: Joi.string().uri().required(),
            mimetype: Joi.string().required()
        }).required(),
    }
};

async function scanHandler(req, res, next) {
    const { clean, info } = await generateReport(req.body.file, scanConfig);

    const responseBody = { clean, info };

    res.status(200).json(responseBody);
}

function attachHandlers(app, errorHandler) {
    app.post('/scan', validate(scanSchema), wrapAsyncHandle(scanHandler), errorHandler);
}

module.exports = {
    attachHandlers
};
