FROM node:26.13.0-alpine@sha256:c6ad9e9c1d80f6eb607c26b4b0a132ff7a2344fad1c78ea3baa2a7d4c8de6d94 AS base
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