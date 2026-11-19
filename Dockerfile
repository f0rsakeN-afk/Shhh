# syntax=docker/dockerfile:1

# ---- Dependencies ----------------------------------------------------------
# Bun installs exactly what bun.lock pins. Dev dependencies stay installed:
# the build needs TypeScript, Tailwind and the React Compiler.
FROM oven/bun:1-slim AS deps
WORKDIR /app

COPY package.json bun.lock ./
RUN --mount=type=cache,target=/root/.bun/install/cache,sharing=locked \
    bun install --frozen-lockfile

# ---- Build -----------------------------------------------------------------
# NEXT_PUBLIC_* values are inlined into client assets at build time, so they
# must be present here rather than only at runtime. Changing one requires a
# rebuild. No server secret is needed: Redis is contacted lazily on request.
FROM oven/bun:1-slim AS builder
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ARG NEXT_PUBLIC_API_URL=
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Turbopack's incremental cache lives outside the traced output, so mounting
# it as a build cache speeds rebuilds without ending up in the runtime image.
RUN --mount=type=cache,target=/app/.next/cache,sharing=locked bun run build

# ---- Runtime ---------------------------------------------------------------
# Only the traced standalone server, static assets and public files ship.
# Credentials arrive at runtime through the environment, never via the image.
FROM node:22-alpine AS runner
WORKDIR /app

LABEL org.opencontainers.image.title="shhh" \
      org.opencontainers.image.description="Ephemeral, self-destructing chat rooms" \
      org.opencontainers.image.source="https://github.com/mercurius-five/shhh"

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 --ingroup nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000

# The landing page is static, so this stays green without Redis credentials
# and flips to unhealthy only when the HTTP server itself stops answering.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/ || exit 1

CMD ["node", "server.js"]
