FROM node:24.20.0-alpine@sha256:e67514e5d0f6c46656005e1b693b2ec9d52e80b641307de684d4a015ba7a4eaf AS base
RUN apk add --no-cache tini && corepack enable && corepack prepare pnpm@latest --activate
USER node
RUN mkdir /home/node/cache
WORKDIR /home/node/app
COPY --chown=node:node package.json pnpm-lock.yaml pnpm-workspace.yaml ./
EXPOSE 8080
VOLUME [ "/home/node/cache" ]
ENTRYPOINT [ "/sbin/tini", "--" ]

FROM base AS development
ENV DEBUG=true
RUN pnpm install --frozen-lockfile
COPY --chown=node:node . .
CMD [ "pnpm", "start:dev" ]

FROM base AS production
RUN pnpm install --frozen-lockfile
COPY --chown=node:node . .
RUN pnpm build && pnpm prune --prod
CMD [ "pnpm", "start:prod" ]