FROM node:24.18.1-alpine@sha256:f70403e87646dc51b45295f4b8b70cdad0b63d2297c4c9899119b03f7af7a6b3 AS base
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