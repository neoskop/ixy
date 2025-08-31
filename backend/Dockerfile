FROM node:22.19.0-bookworm AS base
RUN npm install -g @nestjs/cli
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
RUN npm run build
CMD [ "npm", "run", "start:prod" ]