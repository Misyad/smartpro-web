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

# Vite inlines import.meta.env.VITE_* at COMPILE time, so these must be present
# during the build, not at container start. Passing them only via `docker run
# --env-file` is not enough: the client bundle would be compiled with the values
# undefined and isBackendEnabled() would be false in the browser forever.
#
# They are declared as build args (not secrets) on purpose: anything VITE_*
# prefixed ends up readable in the shipped JavaScript, so only the PUBLIC anon
# key may go here. The service-role key must never be a build arg.
ARG VITE_SUPABASE_URL=""
ARG VITE_SUPABASE_ANON_KEY=""
ENV VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
ENV VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY}

RUN bun run build

# Fail the build if the client bundle was compiled without a backend URL.
# A silent miss here produces a site that serves live data but whose login and
# cart silently fall back to demo mode — exactly the kind of failure that looks
# healthy until someone tries to use it.
RUN if [ -n "$VITE_SUPABASE_URL" ]; then \
      REF=$(printf '%s' "$VITE_SUPABASE_URL" | sed -E 's#^https?://([^.]+)\..*#\1#'); \
      if ! grep -rq "$REF" .output/public/assets/ 2>/dev/null; then \
        echo "FATAL: VITE_SUPABASE_URL was set but the Supabase project ref '$REF'"; \
        echo "       is not present in the client bundle. Vite did not inline it."; \
        exit 1; \
      fi; \
      echo "Verified: client bundle contains Supabase ref '$REF'"; \
    else \
      echo "NOTE: VITE_SUPABASE_URL is empty - building in demo mode (no live backend)."; \
    fi

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
