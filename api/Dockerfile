# =============================================================================
# AlcheMix API - Multi-stage Dockerfile
# =============================================================================
# Production-ready Docker image with security best practices
#
# Build context must be the REPO ROOT (not api/), so that
# packages/types/ is available for the shared type declarations.
#
# Features:
# - Multi-stage build (smaller final image)
# - Non-root user (security)
# - dumb-init for proper signal handling
# - Health check for container orchestration
# - OCI image labels for metadata
#
# Stages:
# - builder: Compile TypeScript to JavaScript
# - production: Minimal runtime image
# - test: For running tests in CI
#
# Build: docker build -t alchemix-api:prod --target production -f api/Dockerfile .
# Run:   docker run -p 3000:3000 alchemix-api:prod
# Test:  docker build -t alchemix-api:test --target test -f api/Dockerfile . && docker run alchemix-api:test
# =============================================================================

# =============================================================================
# STAGE 1: Builder
# =============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Add build metadata
LABEL stage=builder

# Build shared types package first
COPY packages/types/ /packages/types/
RUN cd /packages/types && npm install && npx tsc

# Build shared spirits package (runtime code — the api build resolves its type
# declarations, and the production runtime require()s its compiled output)
COPY packages/spirits/ /packages/spirits/
RUN cd /packages/spirits && npm install && npx tsc

# Copy package files for dependency installation
COPY api/package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy API source code
COPY api/ .

# Build TypeScript to JavaScript
RUN npm run build

# =============================================================================
# STAGE 2: Production
# =============================================================================
FROM node:20-alpine AS production

WORKDIR /app

# Install dumb-init for proper signal handling (PID 1 zombie prevention)
RUN apk add --no-cache dumb-init

# Create non-root user for security
# UID 1001 is standard for Node.js applications in containers
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 api

# Copy package files
COPY --chown=api:nodejs api/package*.json ./

# Shared spirits package: runtime code the app require()s at startup (unlike the
# type-only @alchemix/types). Only package.json + built dist are needed — it has no
# runtime dependencies — and it must exist before npm ci so the file: dep resolves.
COPY --from=builder /packages/spirits/package.json /packages/spirits/package.json
COPY --from=builder /packages/spirits/dist /packages/spirits/dist

# Install production dependencies only
RUN npm ci --omit=dev && npm cache clean --force

# Copy built files from builder
COPY --from=builder --chown=api:nodejs /app/dist ./dist

# Create data directory for SQLite with proper permissions
RUN mkdir -p /app/data && chown -R api:nodejs /app/data

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Add OCI image metadata
LABEL org.opencontainers.image.title="AlcheMix API"
LABEL org.opencontainers.image.version="1.36.0"
LABEL org.opencontainers.image.description="AlcheMix Express API Backend"
LABEL org.opencontainers.image.vendor="AlcheMix"
LABEL org.opencontainers.image.source="https://github.com/JLawMcGraw/alchemix"
LABEL org.opencontainers.image.licenses="MIT"

# Switch to non-root user
USER api

# Expose port
EXPOSE 3000

# Health check - verify API is responding
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health/ready || exit 1

# Use dumb-init as PID 1 to handle signals properly
# This ensures graceful shutdown on SIGTERM
ENTRYPOINT ["dumb-init", "--"]

# Start the server
CMD ["node", "dist/server.js"]

# =============================================================================
# STAGE 3: Test
# =============================================================================
FROM node:20-alpine AS test

WORKDIR /app

# Shared spirits package source — the api vitest config aliases @alchemix/spirits to
# ../packages/spirits/src, so the source must be present for tests to resolve it.
COPY packages/spirits/ /packages/spirits/

# Copy package files
COPY api/package*.json ./

# Install all dependencies including devDependencies
RUN npm ci

# Copy all source code and test files
COPY api/ .

# Run tests by default
CMD ["npm", "test"]
