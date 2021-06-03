FROM node:14 AS builder

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

FROM node:14-slim

# `secure-delete` adds the `srm` utility to securely delete files.
# This is a better alternative to Node's `unlink`. The default config in
# `docker/docker.config.yaml` is already configured to use `srm` as the
# utility to delete the scanned files, which is why we add it to the base image.
RUN apt-get update && apt-get install -y secure-delete && apt-get clean

WORKDIR /usr/src/app

COPY config config
COPY example* ./
COPY package.json .
COPY src src
COPY test test
COPY --from=builder /usr/src/app/node_modules node_modules

EXPOSE 8080

CMD [ "npm", "start", "--", "config/docker.config.yaml" ]
