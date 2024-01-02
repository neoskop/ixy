FROM node:21.5.0-bookworm AS base
USER node
RUN mkdir /home/node/cache
WORKDIR /home/node/app
COPY package*.json ./
EXPOSE 8080
VOLUME [ "/home/node/cache" ]

FROM base AS development
ENV DEBUG=true
RUN npm ci
COPY . .
CMD [ "npm", "run", "start:dev" ]

FROM base AS production
RUN npm ci --omit=dev
COPY . .
CMD [ "npm", "start:prod" ]