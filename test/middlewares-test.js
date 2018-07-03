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
const express = require('express');
const validate = require('express-validation');
const Joi = require('joi');
const { PkEncryption } = require('olm');

const { attachMiddlewares, attachErrorMiddlewares } = require('../src/middlewares.js');
const ClientError = require('../src/client-error.js');

async function createMiddlewareApp(attachHandlers) {
    // Mock an express app because express doesn't expose an API to create request or
    // response objects to give to the middlewares.
    const app = express();

    const middlewareOpts = {
        // TODO: Test encrypted_body key pickling
        encryptedBodyOpts: undefined,
    };
    await attachMiddlewares(app, middlewareOpts);

    attachHandlers(app);

    attachErrorMiddlewares(app);

    return app;
}

describe('middleware', () => {
    it('responds with 400 if Joi validation fails', async () => {
        const endpointSchema = {
            body: {
                param_1: Joi.number().required(),
            }
        };
        const app = await createMiddlewareApp(
            (app) => app.post(
                '/post_endpoint',
                validate(endpointSchema),
                (req, res) => res.status(200).json({}).end(),
            )
        );
        return request(app)
            .post('/post_endpoint')
            .send({param_1: 'not a number'})
            .expect('Content-Type', /json/)
            .expect(400)
            .then((res) => {
                assert.strictEqual(res.body.validationErrors.length, 1, 'expected 1 validation error');
            });
    });

    it('responds with 400 when JSON is malformed', async () => {
        const app = await createMiddlewareApp(
            (app) => app.post('/post_endpoint', (req, res) => res.status(200).json({}).end())
        );
        return request(app)
            .post('/post_endpoint')
            .type('application/json')
            .send('this is malformed {} json')
            .expect('Content-Type', /json/)
            .expect(400);
    });

    it('reports internal server error when a handler throws a generic error', async () => {
        const app = await createMiddlewareApp((app) => {
            app.get('/error_endpoint', () => {
                throw new Error('An error has occured');
            });
        });
        return request(app)
            .get('/error_endpoint')
            .expect('Content-Type', /json/)
            .expect((res) => {
                assert.strictEqual(res.status, 500, 'server error status expected');
            });
    });

    it('sends a client error when one is thrown in a handler', async () => {
        const app = await createMiddlewareApp((app) => {
            app.get('/error_endpoint', () => {
                throw new ClientError(418, 'An error has occured');
            });
        });
        return request(app)
            .get('/error_endpoint')
            .expect('Content-Type', /json/)
            .expect((res) => {
                assert.strictEqual(res.status, 418, 'thrown client error status expected');
            });
    });

    it('proxies an encrypted_body POST request through to a unencrypted request handler', async () => {
        const app = await createMiddlewareApp((app) => {
            app.post('/post_endpoint', (req, res) => {
                res.status(req.body.some === 'body' ? 200 : 406).end();
            });
        });

        const plainBody = { some: 'body' };

        const publicKey = await request(app)
            .get('/_matrix/media_proxy/unstable/public_key')
            .then(response => response.body.public_key);

        const encryption = new PkEncryption();
        encryption.set_recipient_key(publicKey);

        const encryptedBody = encryption.encrypt(JSON.stringify(plainBody));

        return request(app)
            .post('/post_endpoint')
            .send({encrypted_body: encryptedBody})
            .expect(200);
    });
});
