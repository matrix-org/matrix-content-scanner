const yaml = require('js-yaml');
const fs = require('fs');
const Joi = require('joi');

const configSchema = Joi.object().keys({
    server: Joi.object().keys({
        port: Joi.number().required(),
    }).required(),
    scan: Joi.object().keys({
        script: Joi.string().required(),
        tempDirectory: Joi.string().required(),
        baseUrl: Joi.string().required(),
    }).required(),
});

// Exported alongside mechanism to load particular configuarion
let config;

function loadConfig(filePath) {
    config = yaml.safeLoad(fs.readFileSync(filePath, 'utf8'));

    const result = Joi.validate(config, configSchema);
    if (result.error) {
        throw result.error;
    }
}

module.exports = {
    loadConfig,
    getConfig: () => config,
}
