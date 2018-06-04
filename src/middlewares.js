const express = require('express');
const consoleMiddleware = require('./console-middleware.js');
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
}

module.exports = {
    attachMiddlewares
};
