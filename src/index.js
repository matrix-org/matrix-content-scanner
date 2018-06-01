const express = require('express');
const app = express();

const ClientError = require('./client-error.js');

const serverConfig = require('../config.js').server;


// Example: '2017-01-24 11:32:44.054'
function getTimestamp() {
    return new Date().toISOString().split(/[TZ]/).join(' ').trim();
}

const logFunctions = {
    'info': console.info,
    'log': console.log,
    'warn': console.warn,
    'error': console.error,
};

function getConsole() {
    // Random request ID
    const id = Math.random().toString(12).slice(2, 10);
    return Object.keys(logFunctions).reduce((result, level) =>
        ({
            ...result,
            [level]: (...args) =>
                logFunctions[level](getTimestamp(), `[${id}] ${level} -`, ...args),
        }),
        {}
    );
}

function respondWithError(req, res, err) {
    req.console.info(`Responding to client with error: ${err.status} ${err.message}`);
    res.status(err.status).json({
        info: err.message,
        // Joi validation generates a list of readable messages, concat them here
        validationErrors: err.errors && err.errors.length > 0 ?
            err.errors.map(e => e.field.join('.') + ': ' + e.messages.join(', '))
            : undefined
    }).end();
}

function errorHandler(err, req, res, next) {
    // ClientError was thrown
    if (err instanceof ClientError) {
        respondWithError(req, res, err);
        return;
    }

    // Joi validation throws errors of type Error, with a status field set
    if (err.status !== undefined) {
        respondWithError(req, res, err);
        return;
    }

    req.console.error(`Unhandled error: '${err.message}'`);
    req.console.error(err);

    respondWithError(req, res, new ClientError(500, 'Unhandled server error'));
}

function handleJsonError(err, req, res, next) {
    respondWithError(res, new ClientError(400, `Malformed JSON: ${err.message}`));
}

app.use((req, res, next) => {
    req.console = getConsole();
    next();
});

app.use(express.json(), handleJsonError);
app.use(errorHandler);

const { attachHandlers } = require('./handlers.js');

attachHandlers(app, errorHandler);

app.listen(serverConfig.port, () => console.log('Listening on ' + serverConfig.port));
