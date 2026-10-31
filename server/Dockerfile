# syntax=docker/dockerfile:1
# NESTAMA API. Build from the repository root:
#   docker build -f server/Dockerfile -t nestama-api .
# Runtime configuration comes from environment variables (see server/.env.example).

FROM node:24-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
# Prisma's migration engine links against OpenSSL.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable
WORKDIR /repo

FROM base AS build
# Manifests first, so the dependency layer is reused until they change.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY client/package.json client/
COPY shared/package.json shared/
COPY server/package.json server/
RUN pnpm install --frozen-lockfile --filter "server..." --ignore-scripts
COPY shared shared
COPY server server
RUN pnpm --filter server exec prisma generate \
  && pnpm --filter server build \
  && pnpm --filter server deploy --prod --legacy /out

FROM node:24-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out ./
COPY --from=build --chown=node:node /repo/server/dist ./dist
# Local uploads land here when Cloudinary isn't configured (use CLOUDINARY_URL in production), and
# the semantic search model is downloaded into .cache on first start.
RUN mkdir -p uploads .cache && chown node:node uploads .cache
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Apply pending migrations, then start. Migrations are idempotent, so restarts are safe.
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && exec node dist/server.js"]
