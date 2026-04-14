FROM node:24.14.0-alpine AS base
RUN apk add --no-cache tini && corepack enable && corepack prepare pnpm@latest --activate
USER node
RUN mkdir /home/node/cache
WORKDIR /home/node/app
COPY package.json pnpm-lock.yaml ./
EXPOSE 8080
VOLUME [ "/home/node/cache" ]
ENTRYPOINT [ "/sbin/tini", "--" ]

FROM base AS development
ENV DEBUG=true
RUN pnpm install --frozen-lockfile
COPY . .
CMD [ "pnpm", "start:dev" ]

FROM base AS production
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build && pnpm prune --prod
CMD [ "pnpm", "start:prod" ]