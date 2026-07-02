# syntax=docker/dockerfile:1.7

ARG NODE_VERSION=22.21.1
ARG PNPM_VERSION=11.1.1

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

# Valkey client (GLIDE) version — keep in sync with @valkey/valkey-glide in
# context-layer/package.json.
ARG GLIDE_VERSION=2.4.2

ENV NODE_ENV=production
ENV PORT=8080

WORKDIR /app

COPY --from=builder /app/portal/.output ./.output

# GLIDE's platform-native `.node` package is externalized from the server bundle
# (portal/vite.config.ts); the bundled client `require`s it at runtime. Copy the
# linux-x64-gnu build resolved during `pnpm install` — the image targets
# linux/amd64 (ECS Fargate default), matching the CI build platform. GLIDE only
# loads when CACHE_VALKEY_URL is set; without this the cache would degrade to the
# in-memory fallback.
COPY --from=deps \
  /app/node_modules/.pnpm/@valkey+valkey-glide-linux-x64-gnu@${GLIDE_VERSION}/node_modules/@valkey/valkey-glide-linux-x64-gnu \
  ./node_modules/@valkey/valkey-glide-linux-x64-gnu

EXPOSE 8080

CMD ["node", ".output/server/index.mjs"]
