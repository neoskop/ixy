FROM node:22.17.0-bookworm AS base
USER node
RUN mkdir /home/node/cache
WORKDIR /home/node/app
COPY package*.json ./
ENV HOST=0.0.0.0 \
    PORT=5173
EXPOSE 5173

FROM base AS development
ENV DEBUG=true
RUN npm ci
COPY --chown=node . .
CMD [ "npm", "run", "dev" ]

FROM development AS production
RUN npm run build
CMD [ "npm", "run", "prod" ]