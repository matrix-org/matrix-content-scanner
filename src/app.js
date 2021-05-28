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

const { attachMiddlewares, attachErrorMiddlewares } = require('./middlewares.js');
const { attachHandlers } = require('./handlers.js');

const { loadConfig, getConfig } = require('./config.js');

const process = require('process');
const path = require('path');

async function createApp(middlewareOpts) {
    const app = express();

    // Load and initialise olm
    console.debug("Initialising Olm lib...")
    try {
        // Store Olm under the global namespace as we'll need to use it elsewhere
        global.Olm = require('@matrix-org/olm');
        await global.Olm.init();
    } catch (err) {
        console.error("Failed to initialise olm library")
        process.exit(1)
    }

    await attachMiddlewares(app, middlewareOpts);
    attachHandlers(app);

    attachErrorMiddlewares(app);

    return app;
}

async function runApp() {
    if (process) {
        const processArguments = process.argv.slice(2);

        const configPath = processArguments[0] ||
            path.join(process.cwd(), 'config', 'default.config.yaml');

        console.info(`Loading configuration file ${configPath}`);
        try {
            loadConfig(configPath);
        } catch (err) {
            console.error(`Failed to load configuration file ${configPath}: ${err.message}`);
            process.exit(1);
        }
    }

    const config = getConfig();
    const serverConfig = config.server;
    let app;
    try {
        app = await createApp(config.middleware);
    } catch (err) {
        console.error('Failed to start:', err);
        return;
    }

    app.listen(serverConfig.port, serverConfig.host, () => console.log('Listening on ' +serverConfig.host + ":" + serverConfig.port));
}

module.exports = {
    createApp,
    runApp,
};
