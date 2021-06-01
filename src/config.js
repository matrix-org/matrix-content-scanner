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

const yaml = require('js-yaml');
const fs = require('fs');
const Joi = require('joi');

const configSchema = Joi.object().keys({
    server: Joi.object().keys({
        port: Joi.number().required(),
        host: Joi.string().required(),
    }).required(),
    scan: Joi.object().keys({
        script: Joi.string().required(),
        tempDirectory: Joi.string().required(),
        baseUrl: Joi.string().required(),
        directDownload: Joi.boolean(),
    }).required(),
    altRemovalCmd: Joi.string(),
    proxy: Joi.string(),
    requestHeader: Joi.object().keys({
        userAgent: Joi.string(),
        xForward: Joi.string(),
    }),
    middleware: Joi.object().keys({
        encryptedBody: Joi.object().keys({
            pickleKey: Joi.string().required(),
            picklePath: Joi.string().required(),
        }),
    }),
	acceptedMimeType: Joi.array(),
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
    setConfig: (c) => config = c,
    getConfig: () => config,
}
