Matrix Content Scanner
======================

A Web service for scanning media hosted on a [Matrix](https://matrix.org) content repository.

# Introduction

MCS allows for arbitrary scanning of content hosted on Matrix. When a Matrix client requests media
from a Matrix content repository, it may be necessary to run anti virus software on the file. MCS
provides a mechanism as follows:
 1. The Matrix client requests media from the media repository.
 2. The media repository queries the MCS instance for an indication as to whether the file has been scanned.
 3. If the content has been scanned and marked clean, the media is sent to the Matrix client. 
 4. Otherwise, the Matrix client will need to invoke MCS directly in order to scan the file. Go to step 1.

# API

Will be documented shortly!

