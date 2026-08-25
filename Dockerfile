FROM node:24-alpine AS base

# ── deps ──────────────────────────────────────────────────────────────────────
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
# BuildKit cache mount, verified persisting 2026-08-24 (231 MB carried between
# builds). It pays off only on the deploys where this layer actually RUNS — i.e.
# when package-lock.json moved; otherwise the layer is CACHED and npm ci is
# skipped entirely. Measured ~26 s cold vs ~20 s warm. Nothing from the mount
# lands in a layer: it is unmounted when the RUN ends.
# ⚠ `--no-cache` / `--no-cache-filter` CLEAR cache mounts, so a build run with
# either will look like the mount does nothing. Coolify's build.sh uses neither.
RUN --mount=type=cache,target=/root/.npm npm ci

# ── builder ───────────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time env vars (public only — baked into the JS bundle)
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

ENV NEXT_TELEMETRY_DISABLED=1
# NOT cache-mounted. A `--mount=type=cache,target=/app/.next/cache` here was
# built and measured 2026-08-24 and bought NOTHING: warm 47.9 s vs cold 47.9 s
# (compile 12.3 s vs 11.3 s, tsc 31.4 s vs 33.0 s). Turbopack did not reuse the
# cache across builds, and tsc — ~2/3 of the build — writes tsconfig.tsbuildinfo
# to the project root, which `COPY . .` overwrites regardless. Re-adding it would
# also mean the mount is gone by runtime, so an ISR / "use cache" route would
# find an empty incremental cache. Measure before re-adding, don't assume.
RUN npm run build

# ── runner ────────────────────────────────────────────────────────────────────
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Liveness probe (Coolify also runs its own; this backs `docker run` / compose).
# Hits the dependency-free /api/health route — see src/app/api/health/route.ts.
# start-period was 20s; measured 2026-08-24 the first probe passed 5s after the
# container started, and Coolify blocks the deploy for the whole period.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.js"]
