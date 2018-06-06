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

const express = require('express');
const app = express();

const ClientError = require('./client-error.js');
const { attachMiddlewares } = require('./middlewares.js');
const { attachHandlers } = require('./handlers.js');

const { loadConfig, getConfig } = require('./config.js');

const process = require('process');
const path = require('path');

if (process) {
    const processArguments = process.argv.slice(2);

    const configPath = processArguments[0] ||
        path.join(process.cwd(), 'config', 'default.config.yaml');

    console.info(`Loading configuration file ${configPath}`);
    try {
        loadConfig(configPath);
    } catch (err) {
        console.error(`Failed to load configuration file ${configPath}: ${err.message}`);
        process.exit(1);
    }
}

const serverConfig = getConfig().server;

function respondWithError(req, res, err) {
    req.console.info(`Responding to client with error: ${err.status} ${err.message}`);
    res.status(err.status).json({
        info: err.message,
        // Joi validation generates a list of readable messages, concat them here
        validationErrors: err.errors && err.errors.length > 0 ?
            err.errors.map(e => e.field.join('.') + ': ' + e.messages.join(', '))
            : undefined
    }).end();
}

function errorMiddleware(err, req, res, next) {
    // ClientError was thrown
    if (err instanceof ClientError) {
        respondWithError(req, res, err);
        return;
    }

    // Joi validation throws errors of type Error, with a status field set
    if (err.status !== undefined) {
        respondWithError(req, res, err);
        return;
    }

    req.console.error(`Unhandled error: '${err.message}'`);
    req.console.error(err);

    respondWithError(req, res, new ClientError(500, 'Unhandled server error'));
}

attachMiddlewares(app);
attachHandlers(app);

// Add a generic error handler to take care of anything unhandled, and also
// any ClientErrors that are thrown by the handlers.
app.use(errorMiddleware);

app.listen(serverConfig.port, serverConfig.host, () => console.log('Listening on ' +serverConfig.host + ":" + serverConfig.port));
