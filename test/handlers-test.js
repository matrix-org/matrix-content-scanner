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

const request = require('supertest');
const assert = require('assert');

const { clearReportCache } = require('../src/reporting.js');
const app = require('../src/app.js').createApp();
const example = require('../example.file.json');

const { setConfig } = require('../src/config.js');

setConfig({
    scan: {
        baseUrl: "https://matrix.org",
        tempDirectory: "/tmp",
        script: "exit 0"
    }
});

// XXX: These tests still don't make use of example.file.data
describe('GET /_matrix/media_proxy/unstable/download/matrix.org/EawFuailhYTuSPSGDGsNFigt', () => {
    beforeEach(() => {
        clearReportCache();
    });

    it('responds with the expected Content-Type header', () => {
        return request(app)
            .get('/_matrix/media_proxy/unstable/download/matrix.org/EawFuailhYTuSPSGDGsNFigt')
            .expect('Content-Type', /png/)
            .expect(200);
    });
});

describe('GET /_matrix/media_proxy/unstable/scan/matrix.org/EawFuailhYTuSPSGDGsNFigt', () => {
    beforeEach(() => {
        clearReportCache();
    });

    it('responds with the requested scan (when the file has not been scanned before)', () => {
        return request(app)
            .get('/_matrix/media_proxy/unstable/scan/matrix.org/EawFuailhYTuSPSGDGsNFigt')
            .expect('Content-Type', /json/)
            .expect(200)
            .then(response => {
                assert(response.body.clean, true);
            });
    });
});

describe('GET /_matrix/media_proxy/unstable/thumbnail/matrix.org/EawFuailhYTuSPSGDGsNFigt?width=100&height=100&method=scale', () => {
    beforeEach(() => {
        clearReportCache();
    });

    it('responds with the requested thumbnail (when the file has not been scanned before)', () => {
        return request(app)
            .get('/_matrix/media_proxy/unstable/thumbnail/matrix.org/EawFuailhYTuSPSGDGsNFigt?width=100&height=100&method=scale')
            .expect('Content-Type', /png/)
            .expect(200);
    });
});
