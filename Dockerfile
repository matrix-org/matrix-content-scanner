FROM node:14 AS builder

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

FROM node:14-alpine

WORKDIR /usr/src/app

COPY config config
COPY example* ./
COPY package.json .
COPY src src
COPY test test
COPY --from=builder /usr/src/app/node_modules node_modules

EXPOSE 8080

CMD [ "npm", "start", "--", "config/docker.config.yaml" ]
