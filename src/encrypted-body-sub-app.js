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
const fs = require('fs');

const BodyDecryptor = require('./decrypt-body.js');

class EncryptedBodyApp {
    constructor(pickleKey, pickle) {
        this._decryptor = new BodyDecryptor(pickleKey, pickle);
    }

    middleware(req, res, next) {
        // If a POST body contains `encrypted_body`, decrypt it and pass it as a body
        // to the next middleware

        if (req.method === 'POST' && req.body && req.body.encrypted_body) {
            req.console.info('This request has an encrypted body; decrypting it...');
            try {
                req.body = this._decryptor.decryptBody(req.body.encrypted_body);
            } catch (err) {
                next(err);
                return;
            }
            req.console.info('Decryption successful');
        }

        next();
    }

    handler(req, res) {
        const responseBody = {
            public_key: this._decryptor.getPublicKey(),
        };

        res.status(200).json(responseBody);
    }

    attach(app) {
        app.use((...args) => this.middleware(...args));
        app.get('/_matrix/media_proxy/unstable/public_key', (...args) => this.handler(...args));
    }

    getPickle() {
        return this._decryptor.pickle();
    }

    static async attachEncryptedBodySubApp(app, opts) {
        let pickle;
        let pickleKey;
        if (opts && opts.pickleKey) {
            pickleKey = opts.pickleKey;
        }

        // Get pickle from file, if configured
        if (opts && opts.picklePath && opts.pickleKey) {
            try {
                pickle = (await fs.promises.readFile(opts.picklePath)).toString();
                console.info('Creating encrypted_body middleware with pickled decryption key');
            } catch (err) {
                console.warn('Could not read pickled decryption key: ' + err.message);
                console.info('Pickled decryption key will be generated and saved to ' + opts.picklePath);
            }
        }

        const encryptedBodyApp = new EncryptedBodyApp(pickleKey, pickle);

        // Unpickling failed, pickle the newly generated pickle
        if (!pickle && opts && opts.picklePath) {
            await fs.promises.writeFile(opts.picklePath, encryptedBodyApp.getPickle());
        }

        encryptedBodyApp.attach(app);
    }
}

module.exports = EncryptedBodyApp.attachEncryptedBodySubApp;
