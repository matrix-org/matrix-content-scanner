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

const assert = require('assert');
const BodyDecryptor = require('../src/decrypt-body.js');
const ClientError = require('../src/client-error.js');
const PICKLE_KEY = 'secret_key';

describe('decryptBody', () => {
    let encryption;
    let decryption;
    let publicKey;

    before("Initialise Olm library", async () => {
        try {
            // Store Olm under the global namespace as we'll need to use it elsewhere
            global.Olm = require('@matrix-org/olm');
            await global.Olm.init();
        } catch (err) {
            console.error("Failed to initialise olm library")
            process.exit(1)
        }

        // Setup necessary test variables
        encryption = new global.Olm.PkEncryption();
        decryption = new BodyDecryptor(PICKLE_KEY);

        // In reality, getting the public key, and doing an encryption is done
        // client-side.
        publicKey = decryption.getPublicKey();
        encryption.set_recipient_key(publicKey);
    });

    it('should decrypt an encrypted body', async () => {
        const plainBody = {
            some: 'body',
            with: 'keys',
            nested: {
                arbitrary: 'structure',
            },
        };
        const encryptedBody = encryption.encrypt(JSON.stringify(plainBody));

        const decryptedBody = decryption.decryptBody(encryptedBody);
        assert.deepStrictEqual(decryptedBody, plainBody);
    });

    it('should throw 400 if the decrypted body is malformed', async () => {
        const encryptedBody = encryption.encrypt('this is not JSON');

        assert.throws(
            () => decryption.decryptBody(encryptedBody),
            (e) => e instanceof ClientError && e.status === 400,
        );
    });

    it('should throw 403 if the decryption is bad', async () => {
        const plainBody = {
            some: 'body',
            with: 'keys',
            nested: {
                arbitrary: 'structure',
            },
        };
        const encryptedBody = encryption.encrypt(JSON.stringify(plainBody));

        encryptedBody.mac = "this is not the mac";

        assert.throws(
            () => decryption.decryptBody(encryptedBody),
            (e) => e instanceof ClientError && e.status === 403,
        );
    });

    it('should unpickle a pickled PkDecryption when created with a pickleKey & pickle', () => {
        const pickle = decryption.pickle(PICKLE_KEY);
        const unpickledDecryptor = new BodyDecryptor(PICKLE_KEY, pickle);

        const plainBody = {
            some: 'body',
            with: 'keys',
            nested: {
                arbitrary: 'structure',
            },
        };
        const encryptedBody = encryption.encrypt(JSON.stringify(plainBody));

        const decryptedBody = unpickledDecryptor.decryptBody(encryptedBody);
        assert.deepStrictEqual(decryptedBody, plainBody);
    });
});
