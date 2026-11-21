# syntax=docker/dockerfile:1.7

# --- Build stage: compile the TanStack Start app into a standalone Node server ---
FROM oven/bun:1 AS build
WORKDIR /app

# Install dependencies from the committed bun lockfile for a reproducible build.
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
ENV BUILD_TARGET=node
RUN bun run build

# --- Runtime stage: only what the Node server needs ---
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Nitro's node-server output is self-contained (bundled deps + traced node_modules).
COPY --from=build /app/.output ./.output

EXPOSE 3000

# Basic container health probe against the SSR route.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", ".output/server/index.mjs"]
