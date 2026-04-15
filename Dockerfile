# ═══════════════════════════════════════════════════════════════════════════════
# Vorea Studio — Multi-stage Dockerfile
# Stage 1: Install deps + build frontend
# Stage 2: Lightweight production image (Node.js + API + static frontend)
#
# Build:
#   docker build -t vorea-studio .
#
# Required build args:
#   VITE_OWNER_EMAIL — owner email for superadmin auto-promote
#   VITE_API_URL     — defaults to /api (monolith)
# ═══════════════════════════════════════════════════════════════════════════════

# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

# Enable corepack for pnpm support
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

WORKDIR /app

# Vite embeds VITE_* vars at build time — pass them as build args
ARG VITE_OWNER_EMAIL
ARG VITE_API_URL=/api

# Copy manifests + lockfile for deterministic installs
COPY package.json pnpm-lock.yaml ./

# Install deps (pnpm resolves correct platform binaries from lockfile)
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate 2>/dev/null || true

# Build the frontend and static SEO assets
RUN pnpm run build

# ── Stage 2: Production ──────────────────────────────────────────────────────
FROM node:22-alpine AS production

# Enable corepack for pnpm support
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

WORKDIR /app

# Copy manifests + lockfile for production install
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile && pnpm store prune

# Copy built frontend from builder
COPY --from=builder /app/dist ./dist

# Copy server code
COPY server/ ./server/

# Copy utils (needed by server for config imports)
COPY utils/ ./utils/

# Copy shared parametric engine modules consumed by the backend at runtime
COPY src/app/engine/ ./src/app/engine/

# Copy prisma schema (needed for client at runtime)
COPY prisma/ ./prisma/
RUN npx prisma generate 2>/dev/null || true

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

# Environment
ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

# Start the server using the already-installed local binary
CMD ["sh", "-c", "npx prisma migrate deploy && ./node_modules/.bin/tsx server/server.ts"]
