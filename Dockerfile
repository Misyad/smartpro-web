# syntax=docker/dockerfile:1.7

# --- Dependencies: install once from the committed lockfile ---
FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# --- Test stage: lint and unit tests (used by CI through `docker build --target test`) ---
FROM deps AS test
COPY . .
RUN bun run lint
RUN bun run test

# --- Build stage: compile the TanStack Start app into a standalone Node server ---
FROM deps AS build
COPY . .
ENV BUILD_TARGET=node
RUN bun run build

# --- Runtime stage: only what the Node server needs ---
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3050
ENV HOST=0.0.0.0

# Nitro's node-server output is self-contained (bundled deps + traced node_modules).
COPY --from=build /app/.output ./.output

EXPOSE 3050

# Basic container health probe against the SSR route.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3050)+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", ".output/server/index.mjs"]
