# syntax=docker/dockerfile:1.7

ARG NODE_VERSION=22.21.1
ARG PNPM_VERSION=11.1.1
ARG LAMBDA_WEB_ADAPTER_VERSION=0.9.1

FROM public.ecr.aws/awsguru/aws-lambda-adapter:${LAMBDA_WEB_ADAPTER_VERSION} AS lambda-web-adapter

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
ENV AWS_LWA_PORT=8080

WORKDIR /var/task

COPY --from=lambda-web-adapter /lambda-adapter /opt/extensions/lambda-adapter
COPY --from=builder /app/portal/.output ./.output
# The registry data plane (ADR-0007) ships beside the bundle; point at a mounted
# volume via ATLAS_DATA_DIR to update data without rebuilding the image.
COPY --from=builder /app/data ./data
ENV ATLAS_DATA_DIR=/var/task/data

EXPOSE 8080

CMD ["node", ".output/server/index.mjs"]
