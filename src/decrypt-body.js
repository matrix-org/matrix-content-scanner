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

const ClientError = require('../src/client-error.js');

class BodyDecryptor {
    constructor(pickleKey, pickle) {
        this._decryption = new global.Olm.PkDecryption();
        this._pickleKey = pickleKey;

        if (pickleKey && pickle) {
            this._publicKey = this._decryption.unpickle(pickleKey, pickle);
        } else {
            this._publicKey = this._decryption.generate_key();
        }
    }

    pickle() {
        return this._decryption.pickle(this._pickleKey);
    }

    decryptBody(encryptedBody) {
        const { ephemeral, mac, ciphertext } = encryptedBody;

        let decrypted;
        try {
            decrypted = this._decryption.decrypt(ephemeral, mac, ciphertext);
        } catch (err) {
            throw new ClientError(403, `Bad decryption: ${err.message}`, 'MCS_BAD_DECRYPTION');
        }

        let result;
        try {
            result = JSON.parse(decrypted);
        } catch (err) {
            throw new ClientError(400, `Malformed JSON: ${err.message}`, 'MCS_MALFORMED_JSON');
        }

        return result;
    }

    getPublicKey() {
        return this._publicKey;
    }
}

module.exports = BodyDecryptor;
