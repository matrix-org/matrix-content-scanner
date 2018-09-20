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
const cors = require('cors');
const consoleMiddleware = require('./console-middleware.js');
const ClientError = require('./client-error.js');
const JoiError = require('./joi-error.js');

const attachEncryptedBodySubApp = require('./encrypted-body-sub-app.js');

function jsonErrorMiddleware(err, req, res, next) {
    next(new ClientError(400, `Malformed JSON: ${err.message}`, 'MCS_MALFORMED_JSON'));
}

async function attachMiddlewares(app, opts) {
    // Add req.console for nicer formatted logs
    app.use(consoleMiddleware);

    const corsOptions = {
        origin: '*',
        methods: ['GET', 'PUT', 'POST', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept',
                         'Authorization']
    }
    app.use(cors(corsOptions));

    // Add express-provided JSON but give it it's own unique error handling instead
    // of falling back on the generic one - handing these back to the client is OK.
    app.use(express.json(), jsonErrorMiddleware);

    const encryptedBodyConfig = opts && opts.encryptedBody;

    let encryptedBodyOpts;
    if (encryptedBodyConfig) {
        const { pickleKey, picklePath } = encryptedBodyConfig;
        encryptedBodyOpts = { pickleKey, picklePath };
    }

    // Add subapp to replace requests with `encrypted_body` with the deciphered
    // body and expose public key.
    const encryptedBodyApp = await attachEncryptedBodySubApp(app, encryptedBodyOpts);
}

function attachErrorMiddlewares(app) {
    // Add a generic error handler to take care of anything unhandled, and also
    // any ClientErrors that are thrown by the handlers.
    app.use(errorMiddleware);
}

function errorMiddleware(err, req, res, next) {
    // ClientError was thrown
    if (err instanceof ClientError) {
        respondWithError(req, res, err);
        return;
    }

    // Joi validation throws errors of type Error, with a status field set
    if (err.status !== undefined) {
        respondWithError(req, res, new JoiError(err));
        return;
    }

    req.console.error(`Unhandled error: '${err.message}'`);
    req.console.error(err);

    respondWithError(req, res, new ClientError(500, 'Unhandled server error'));
}

function respondWithError(req, res, err) {
    res.status(err.status).json(err.toJSON());
}

module.exports = {
    attachMiddlewares,
    attachErrorMiddlewares,
};
