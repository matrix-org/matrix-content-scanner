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
const consoleMiddleware = require('./console-middleware.js');
const encryptedBodyMiddleware = require('./encrypted-body-middleware.js');
const ClientError = require('./client-error.js');

function jsonErrorMiddleware(err, req, res, next) {
    next(new ClientError(400, `Malformed JSON: ${err.message}`));
}

function attachMiddlewares(app) {
    // Add req.console for nicer formatted logs
    app.use(consoleMiddleware);

    // Add express-provided JSON but give it it's own unique error handling instead
    // of falling back on the generic one - handing these back to the client is OK.
    app.use(express.json(), jsonErrorMiddleware);

    // Add middleware to replace requests with `encrypted_body` with the deciphered
    // body.
    app.use(encryptedBodyMiddleware);
}

module.exports = {
    attachMiddlewares
};
