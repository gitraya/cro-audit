# Dockerfile for the CRO audit background worker.
#
# The worker runs `scripts/audit-worker.ts` directly via Node's built-in
# TypeScript type-stripping (`--experimental-strip-types`), so there is no
# separate build step — we only install production dependencies and copy the
# source it needs.

FROM node:22-alpine@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2 AS deps
WORKDIR /app

# Install only runtime dependencies against the lockfile for reproducibility.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:22-alpine@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2 AS runner
WORKDIR /app

# tini is a tiny init that reaps zombies and forwards signals cleanly — useful
# since Coolify does not start containers with `--init`.
RUN apk add --no-cache tini

ENV NODE_ENV=production
# 22.6+ ships type-stripping; keep it explicit so the image is self-documenting.
ENV NODE_OPTIONS=--experimental-strip-types

# Bring in the installed deps and the source the worker executes at runtime.
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY scripts ./scripts
COPY lib ./lib

# Run as the unprivileged user that the node image already provides.
USER node

# tini runs as PID 1 and forwards SIGTERM/SIGINT to node (not `npm run`) so the
# worker's graceful-shutdown handler can drain the current job on redeploy/stop.
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "scripts/audit-worker.ts"]
