FROM node:24.21.0-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1 AS base
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