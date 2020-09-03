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

const crypto = require('crypto');

// Decrypt a buffer of data using `info`, taken from the `file` key of the content an
// `m.room.message` Matrix event.
//
// See https://github.com/matrix-org/browser-encrypt-attachment/blob/6c49b2cee356bebbec2b98d11ad813fdca879f38/index.js#L63
module.exports = function decryptData(dataBuffer, info) {
    if (info === undefined || info.key === undefined || info.iv === undefined
        || info.hashes === undefined || info.hashes.sha256 === undefined) {
       throw new Error("Invalid info. Missing info.key, info.iv or info.hashes.sha256 key");
    }

    const expectedSha256base64 = info.hashes.sha256;

    // Convert from JWK to openssl algorithm
    // See https://www.w3.org/2012/webcrypto/wiki/KeyWrap_Proposal#JSON_Web_Key
    const algorithms = {
        'oct': {
            'A256CTR': 'aes-256-ctr',
        },
    };

    const alg = algorithms[info.key.kty] ? algorithms[info.key.kty][info.key.alg] : undefined;

    if (!alg) {
        throw new Error(
            `Unsupported key type/algorithm: ` +
            `key.kty = ${info.key.kty}, kry.alg = ${info.key.alg}`);
    }

    const key = Buffer.from(info.key.k, 'base64');

    // Calculate SHA 256 hash, encode as base64 without padding
    const hash = crypto.createHash('sha256');
    hash.update(dataBuffer);

    const hashDigest = hash.digest();
    const l = hashDigest.length;

    const unpaddedLength = 4 * Math.floor((l + 2) / 3) + (l + 2) % 3 - 2;
    const hashDigestBase64 = hashDigest.toString('base64').slice(0, unpaddedLength);

    if (hashDigestBase64 !== expectedSha256base64) {
        throw new Error('Unexpected sha256 hash of encrypted data');
    }

    // NB: in the original browser-encrypt-attachment, the number of bits used of the
    // IV or "counter" varied on the version (info.v). In practice, no changes to the
    // IV were necessary, at least not for version 2.
    const iv = Buffer.from(info.iv, 'base64');

    const decipher = crypto.createDecipheriv(alg, key, iv);

    return Buffer.concat([
        decipher.update(dataBuffer),
        decipher.final(),
    ]);
}
