Matrix Content Scanner
======================

A Web service for scanning media hosted on a [Matrix](https://matrix.org) content repository.

# Introduction

MCS allows for arbitrary scanning of content hosted on Matrix. When a Matrix client requests media
from a Matrix content repository, it may be necessary to run antivirus software or other checks on
the file. MCS provides mechanisms for:
 - Downloading clean media
 - Retrieving scan results without downloading media

Downloading media follows these steps:
 1. The Matrix client requests media from MCS.
 1. If the media has not previously been scanned, the MCS requests media from the Matrix media repository, downloads it and scans it with the configured script.
 1. If safe, the scanned media is returned to the client, otherwise the error code 403 is returned.

Retrieving scan results follows the same steps but exposes a different API, as explained in the [API section](#API).

# Dependencies
### Olm
MCS requires the Olm library to handle `encrypted_body` requests. The version of Olm required is >2.2.2 and exposes the `PkEncryption` class. See [https://git.matrix.org/olm](https://git.matrix.org/olm).

# Configuration
See the [default configuration](config/default.config.yaml) for details.

# Running
MCS runs on node.js as an [express.js](https://expressjs.com) HTTP server exposed on the configured port.

```sh
git clone git@github.com:matrix-org/matrix-content-scanner.git

cd matrix-content-scanner

# Copy default configuration
cp config/default.config.yaml config/matrix-content-scanner-config.yaml

# Edit new configuration
vi config/matrix-content-scanner-config.yaml

npm install

npm run start -- config/matrix-content-scanner-config.yaml

# OR

node src/index.js config/matrix-content-scanner-config.yaml
```

# API

NB: All requests have the prefix `/_matrix/media_proxy/unstable/`.

Error response body fields:
 - `info`: The error message.

### `GET .../download/:domain/:mediaId`
### `GET .../thumbnail/:domain/:mediaId?width=100&height=100&method=scale`
Retrieve an unencrypted file from the media repo and if it hasn't been scanned since MCS started running, scan it. If the file is clean, respond with the file.

For thumbnails, all query parameters are optional.

#### Example Responses
```http
HTTP/1.1 200 OK
... file body
```
or
```http
HTTP/1.1 403 Forbidden
...
{
  "info": "Client error: File not clean. Output: ..."
}
```

-----

### `GET .../scan/:domain/:mediaId`
Retrieve an unencrypted file from the media repo and if it hasn't been scanned since MCS started running, scan it. Response is the result of the last scan.

#### Example Responses
```http
HTTP/1.1 200 OK
...
{
  "clean": false,
  "info": "File not clean. Output: '...'"
}
```
or
```http
HTTP/1.1 200 OK
...
{
  "clean": true,
  "info": "File clean at 6/7/2018, 6:02:40 PM"
}
```

Response body fields:
 - `clean`: If `true`, the script ran with an exit code of `0`. Otherwise it ran with a non-zero exit code.
 - `info`: Human-readable information about the result.

-----

### `POST .../download_encrypted`
### `POST .../scan_encrypted`
These are the same as `.../download` and `.../scan` but take input from the POST body.

#### Example Request
```http
POST .../download_encrypted HTTP/1.1
...
{
    "file": {
        "v": "v2",
        "iv": "...",
        "hashes": {
            "sha256": "...",
        },
        "key": {
            "alg": "A256CTR",
            "kty": "oct",
            "k": "...",
        },
        "url": "mxc://..."
    }
}
```

Request body fields:
 - `file`: The data under the `file`, `thumbnail_file` fields or root of the content of a Matrix file event.
 - `file.url`: The MXC URL of the file to fetch from the HS.
 - `file.key`, `file.iv`, `file.hashes` and `file.key`: encryption data required to decrypt the media once downloaded.

#### Example Encrypted Request
The request body of any POST request can be encrypted using the public key exposed by `.../public_key`. This can be done by using the `PkEncryption` class from of the [Olm](https://git.matrix.org/git/olm) library.

```http
POST .../download_encrypted HTTP/1.1
...
{
  "encrypted_body": {
    "ciphertext":
      "[base64-encoded string representing encrypted JSON of original request body]",
    "mac":
      "[base64-encoded string representing the MAC]",
    "ephemeral":
      "[base64-encoded string representing ephemeral public key]"
}
```

### `GET .../public_key`
Returns the current public curve25519 key of server. This can be used to encrypt `encrypted_body` requests.

(TODO: indicate outdated public key with 403 JSON response when using `encrypted_body`.)

#### Example Response
```http
HTTP/1.1 200 OK
...
{
  "public_key": "[base64-encoded curve25519 public key of the server]"
}
```
