# ============================================================
# whatsapp-receptionist — Multi-stage Dockerfile
# Build: docker build -t whatsapp-receptionist .
# Run:   docker compose up  (see docker-compose.yml)
# ============================================================

# ---- Stage 1: deps ----------------------------------------
FROM node:22-alpine AS deps

WORKDIR /app

# Install dependencies needed by native addons
RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json ./

# Clean install for reproducible builds
RUN npm ci --omit=dev --ignore-scripts && \
    # Keep a copy of dev deps for the build stage
    cp -r node_modules /tmp/node_modules_prod && \
    npm ci --ignore-scripts


# ---- Stage 2: build ---------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

# Copy installed modules from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next.js telemetry off during build
ENV NEXT_TELEMETRY_DISABLED=1

# Build args for public env vars that must be baked at build time.
# Pass these via --build-arg or docker compose build args.
ARG NEXT_PUBLIC_APP_URL=https://your-domain.com
ARG NEXT_PUBLIC_APP_NAME=Ambrogio.ai
ARG NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=placeholder

ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY

# Placeholders so the build does not throw on missing server-side env vars.
# Real values are injected at runtime via docker compose / Kubernetes secrets.
ENV SUPABASE_SERVICE_ROLE_KEY=placeholder
ENV ANTHROPIC_API_KEY=placeholder
ENV STRIPE_SECRET_KEY=placeholder
ENV STRIPE_WEBHOOK_SECRET=placeholder
ENV WHATSAPP_API_KEY=placeholder
ENV WHATSAPP_WEBHOOK_HEADER_SECRET=placeholder
ENV ELEVENLABS_API_KEY=placeholder
ENV UPSTASH_REDIS_REST_URL=https://placeholder.upstash.io
ENV UPSTASH_REDIS_REST_TOKEN=placeholder
ENV INTERNAL_JOB_SECRET=placeholder

RUN npm run build


# ---- Stage 3: runtime -------------------------------------
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid  1001 nextjs

# Copy production-only node_modules
COPY --from=deps /tmp/node_modules_prod ./node_modules

# Copy the standalone Next.js output (requires output: 'standalone' in next.config.ts)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static    ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public          ./public

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Health check — relies on /api/health returning 200
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
