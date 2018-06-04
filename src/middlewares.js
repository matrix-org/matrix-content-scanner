const express = require('express');
const consoleMiddleware = require('./console-middleware.js');

function jsonErrorMiddleware(err, req, res, next) {
    respondWithError(res, new ClientError(400, `Malformed JSON: ${err.message}`));
}

function attachMiddlewares(app, errorMiddleware) {
    app.use(consoleMiddleware);
    app.use(express.json(), jsonErrorMiddleware);
    app.use(errorMiddleware);
}

module.exports = {
    attachMiddlewares
};
