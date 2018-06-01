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

module.exports = function consoleMiddleware(req, res, next) {
    req.console = getConsole();
    next();
}
