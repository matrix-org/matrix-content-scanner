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

const BodyDecryptor = require('./decrypt-body.js');

function encryptedBodyMiddleware(req, res, next) {
    // If a POST body contains `encrypted_body`, decrypt it and pass it as a body
    // to the next middleware

    const decryptor = BodyDecryptor.getDecryptor();

    if (req.method === 'POST' && req.body && req.body.encrypted_body) {
        try {
            req.body = decryptor.decryptBody(req.body.encrypted_body);
        } catch (err) {
            next(err);
            return;
        }
    }

    next();
}

module.exports = encryptedBodyMiddleware;
