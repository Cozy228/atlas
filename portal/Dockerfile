# syntax=docker/dockerfile:1.7

ARG NODE_VERSION=22.21.1
ARG PNPM_VERSION=11.8.0

FROM node:${NODE_VERSION}-bookworm-slim AS base
ARG PNPM_VERSION

ENV PNPM_HOME="/pnpm"
ENV PATH="${PNPM_HOME}:${PATH}"

WORKDIR /app

RUN corepack enable \
  && corepack prepare "pnpm@${PNPM_VERSION}" --activate \
  && pnpm config set store-dir /pnpm/store

FROM base AS deps

COPY .npmrc package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/atlas-schema/package.json packages/atlas-schema/package.json
COPY packages/atlas-acceptance/package.json packages/atlas-acceptance/package.json
COPY context-layer/package.json context-layer/package.json
COPY portal/package.json portal/package.json
COPY infra/package.json infra/package.json

RUN --mount=type=cache,id=atlas-pnpm-store,target=/pnpm/store \
  pnpm install --frozen-lockfile

FROM deps AS builder

COPY . .

RUN pnpm --filter @atlas/portal build

FROM node:${NODE_VERSION}-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV PORT=8080

WORKDIR /app

COPY --from=builder --chown=node:node /app/portal/.output ./.output

USER node

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + process.env.PORT + '/health').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"]

CMD ["node", ".output/server/index.mjs"]
