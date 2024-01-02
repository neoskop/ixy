FROM node:21.5.0-bookworm AS base
USER node
RUN mkdir /home/node/cache
WORKDIR /home/node/app
COPY package*.json ./
ENV HOST=0.0.0.0

FROM base AS development
ENV DEBUG=true
RUN npm ci
COPY --chown=node . .
EXPOSE 5173
CMD [ "npm", "run", "dev" ]

FROM base AS production
RUN npm ci --omit=dev
COPY --chown=node . .
RUN npm run build
EXPOSE 3000
CMD [ "npm", "run", "prod" ]