Matrix Content Scanner
======================

A Web service for scanning media hosted on a [Matrix](https://matrix.org) content repository.

# Introduction

MCS allows for arbitrary scanning of content hosted on Matrix. When a Matrix client requests media
from a Matrix content repository, it may be necessary to run antivirus software or other checks on
the file. MCS provides a mechanism as follows:
 1. The Matrix client requests media from the media repository.
 2. The media repository queries the MCS instance for an indication as to whether the file has been scanned.
 3. If the content has been scanned and marked clean, the media is sent to the Matrix client.
 4. Otherwise, the Matrix client will need to invoke MCS directly in order to scan the file. Go to step 1.

# API

### `POST /scan`
Invokes a scan on a specified file or returns a cached result. The result includes a secret
that can be given to the media repository to gain access to the file.

### Example request:
```http
POST /scan HTTP/1.1
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
or for unencrypted media
```http
{
    "file": {
        "url": "mxc://..."
    }
}
```
Request body fields:
 - `file`: The data under the `file`, `thumbnail_file` fields or root of the content of a Matrix file event.
 - `file.url`: The MXC URL of the file to fetch from the HS.
 - `file.key`, `file.iv`, `file.hashes` and `file.key`: encryption data required to decrypt the media once downloaded.

### Example response:
```http
HTTP/1.1 200 OK
...
{
    "secret": "...",
    "clean": true,
    "info": "..."
}
```
Response body fields:
 - `secret`: The base64-encoded secret that identifies this result. This can be given to the `/scan_report` API.
 - `clean`: If `true`, the script ran with an exit code of `0`. Otherwise it ran with a non-zero exit code.
 - `info`: Human-readable information about the result.

-----

### `POST /scan_report`
Retrieve a scan report for a given secret.

### Example request:
```http
POST /scan_report HTTP/1.1
...
{
    "secret": "..."
}
```
Request body fields:
 - `secret`: The base64-encoded secret that was previously retrieved by calling `/scan`.

### Example response:
```http
HTTP/1.1 200 OK
...
{
    "scanned": true,
    "clean": false,
    "info": "..."
}
```
or
```http
HTTP/1.1 200 OK
...
{
    "scanned": false,
    "clean": false,
    "info": ""
}
```
Response body fields:
 - `scanned`: Whether `/scan` has been run previously where `secret` has been returned.
 - `clean`: If `true`, the script ran with an exit code of `0`. Otherwise it ran with a non-zero exit code.
 - `info`: Human-readable information about the result.
