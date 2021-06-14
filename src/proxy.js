/**

Copyright 2021 The Matrix.org Foundation C.I.C.

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

/**
 * Create a tunnel agent through a proxy to a URL. Detects whether to use SSL for the
 * connection to the proxy.
 *
 * @param {string} proxyUrl The URI of the proxy.
 *
 * @returns {tunnel.tunnel} A HTTP/HTTPS tunnel to the configured proxy.
 **/
function createProxyTunnel(proxy) {
    // Build a proxy connection.
    // Note that the final URL is always assumed here to be HTTPS
    if (proxy.startsWith("https://")) {
        // https tunnel
        return tunnel.httpsOverHttps({
            proxy: {
                host: proxy,
            }
        });
    }

    // http tunnel
    return tunnel.httpsOverHttp({
        proxy: {
            host: proxy,
        }
    });
}

module.exports = {
    createProxyTunnel,
}