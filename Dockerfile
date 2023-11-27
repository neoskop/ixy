FROM node:21.2.0-bookworm AS base
USER node
RUN mkdir /home/node/cache
WORKDIR /home/node/app
COPY package*.json ./
ENV MAX_WIDTH=2000 \
    MAX_HEIGHT=2000 \
    MAX_SIZE=5 \
    REVALIDATE_AFTER=30 \
    DEBUG=false \
    TIMEOUT=15 \
    MAX_REDIRECTS=5 \
    CACHE_DIR=/home/node/cache \
    CACHE_CONTROL_MAX_AGE=365
EXPOSE 8080
VOLUME [ "/home/node/cache" ]

FROM base AS development
ENV DEBUG=true
RUN npm ci
COPY . .
CMD [ "npm", "run", "start:dev" ]

FROM base AS production
RUN npm ci --only=production
COPY . .
CMD [ "npm", "start" ]