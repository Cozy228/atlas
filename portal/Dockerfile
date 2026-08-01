# syntax=docker/dockerfile:1.7

ARG NODE_VERSION=22.21.1

FROM node:${NODE_VERSION}-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV PORT=8080

WORKDIR /app

COPY --link .output ./.output

EXPOSE 8080

CMD ["node", ".output/server/index.mjs"]
