FROM node:14

WORKDIR /usr/src/app

RUN apt-get update && apt-get install -y vim secure-delete && apt-get clean

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 8080

CMD [ "npm", "start", "--", "config/docker.config.yaml" ]

