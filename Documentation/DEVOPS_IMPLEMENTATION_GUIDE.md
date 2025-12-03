# DevOps Implementation Guide

**Quick Reference for Creating Production-Ready Infrastructure**

---

## File Structure to Create

```
alchemix/
├── .github/
│   └── workflows/
│       ├── ci.yml                    # NEW: GitHub Actions CI/CD
│       └── security.yml              # NEW: Security scanning
├── api/
│   ├── src/
│   │   └── config/
│   │       ├── validateEnv.ts        # NEW: Environment validation
│   │       ├── rateLimiter.ts        # NEW: Rate limiting config
│   │       └── env.ts                # EXISTING: Keep as is
│   └── Dockerfile                    # EXISTING: Update for production
├── docker/
│   └── Dockerfile.prod               # NEW: Production frontend build
├── docker-compose.prod.yml           # NEW: Production overrides
├── Dockerfile.prod                   # NEW: Frontend production image
└── INFRASTRUCTURE_REVIEW.md           # NEW: This document
```

---

## Step-by-Step Implementation

### Step 1: Create GitHub Actions Workflows

**File: `.github/workflows/ci.yml`**

```bash
mkdir -p .github/workflows
```

**Content:** [See PRODUCTION_READINESS_ACTION_PLAN.md - ci.yml section]

### Step 2: Create Environment Validation

**File: `api/src/config/validateEnv.ts`**

```bash
# Create the file
touch api/src/config/validateEnv.ts
```

**Content:**
```typescript
/**
 * Environment variable validation
 * Ensures all required variables are present and valid on startup
 */

interface Config {
  JWT_SECRET: string;
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  DATABASE_PATH: string;
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  MEMMACHINE_API_URL?: string;
  FRONTEND_URL?: string;
  SMTP_HOST?: string;
  SMTP_PORT?: number;
  SMTP_USER?: string;
  SMTP_PASS?: string;
  SMTP_FROM?: string;
}

export function validateEnv(): Config {
  const missingVars: string[] = [];

  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET) {
    missingVars.push('JWT_SECRET');
  } else if (JWT_SECRET.length < 32) {
    throw new Error(
      'FATAL: JWT_SECRET must be at least 32 characters long. ' +
      `Current length: ${JWT_SECRET.length}`
    );
  }

  const NODE_ENV = (process.env.NODE_ENV || 'development') as any;
  if (!['development', 'production', 'test'].includes(NODE_ENV)) {
    throw new Error(
      `FATAL: NODE_ENV must be one of: development, production, test. ` +
      `Got: ${NODE_ENV}`
    );
  }

  const PORT = parseInt(process.env.PORT || '3000');
  if (isNaN(PORT) || PORT < 1024 || PORT > 65535) {
    throw new Error(
      `FATAL: PORT must be between 1024 and 65535. Got: ${PORT}`
    );
  }

  const DATABASE_PATH = process.env.DATABASE_PATH || './data/alchemix.db';

  if (missingVars.length > 0) {
    throw new Error(
      `FATAL: Missing required environment variables:\n` +
      missingVars.map(v => `  - ${v}`).join('\n')
    );
  }

  const SMTP_PORT = process.env.SMTP_PORT
    ? parseInt(process.env.SMTP_PORT)
    : undefined;

  const config: Config = {
    JWT_SECRET,
    NODE_ENV,
    PORT,
    DATABASE_PATH,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    MEMMACHINE_API_URL: process.env.MEMMACHINE_API_URL,
    FRONTEND_URL: process.env.FRONTEND_URL,
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASS: process.env.SMTP_PASS,
    SMTP_FROM: process.env.SMTP_FROM,
  };

  if (config.SMTP_HOST) {
    const smtpVars = ['SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'];
    const missingSMTP = smtpVars.filter(v => !process.env[v]);

    if (missingSMTP.length > 0) {
      console.warn(
        '⚠️  SMTP_HOST configured but missing required SMTP variables:\n' +
        missingSMTP.map(v => `   ${v}`).join('\n') +
        '\nEmail functionality will be disabled.'
      );
    }
  }

  return config;
}

export const config = validateEnv();
```

### Step 3: Create Rate Limiter Configuration

**File: `api/src/config/rateLimiter.ts`**

```typescript
import rateLimit from 'express-rate-limit';

// General API rate limiter: 100 requests per 15 minutes
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'test',
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'Rate limit exceeded',
      retryAfter: req.rateLimit?.resetTime,
    });
  },
});

// Stricter limiter for auth endpoints: 5 attempts per 15 minutes
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  message: 'Too many login attempts, please try again later.',
  skip: (req) => process.env.NODE_ENV === 'test',
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'Too many authentication attempts',
      retryAfter: req.rateLimit?.resetTime,
    });
  },
});

// AI service rate limiter: 50 messages per hour (expensive operation)
export const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 50,
  message: 'AI service rate limit exceeded.',
  skip: (req) => process.env.NODE_ENV === 'test',
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'AI service rate limit exceeded',
      retryAfter: req.rateLimit?.resetTime,
    });
  },
});

// Create custom limiter for redis (optional, for distributed systems)
// import RedisStore from 'rate-limit-redis';
// import redis from 'redis';
//
// const redisClient = redis.createClient();
//
// export const distributedLimiter = rateLimit({
//   store: new RedisStore({
//     client: redisClient,
//     prefix: 'rl:',
//   }),
//   windowMs: 15 * 60 * 1000,
//   max: 100,
// });
```

### Step 4: Create Health Check Routes

**File: `api/src/routes/health.ts`**

```typescript
import { Router, Request, Response } from 'express';
import { db } from '../database/db';

const router = Router();

/**
 * Liveness probe - Is the process alive?
 * Used by: Kubernetes/Docker to detect dead containers
 * Should be lightweight with no external dependencies
 */
router.get('/health/live', (req: Request, res: Response) => {
  res.json({
    status: 'alive',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    pid: process.pid,
  });
});

/**
 * Readiness probe - Is the service ready to accept traffic?
 * Used by: Load balancers to route traffic
 * Checks all critical dependencies
 */
router.get('/health/ready', (req: Request, res: Response) => {
  try {
    // Check database connectivity
    const dbCheck = db.prepare('SELECT 1 as ready').all();
    if (!dbCheck || dbCheck.length === 0) {
      throw new Error('Database connectivity check failed');
    }

    // Check environment
    if (!process.env.JWT_SECRET) {
      throw new Error('Required environment variable JWT_SECRET not set');
    }

    // All checks passed
    res.json({
      status: 'ready',
      checks: {
        database: { status: 'ok' },
        environment: { status: 'ok' },
        memory: {
          status: 'ok',
          heapUsedMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = (error as Error).message;
    console.error('Health check failed:', message);

    res.status(503).json({
      status: 'not_ready',
      error: message,
      checks: {
        database: { status: 'failed' },
      },
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * Startup probe - Has initialization completed?
 * Used by: Kubernetes to know when to start routing traffic after boot
 * Takes longer than liveness/readiness
 */
router.get('/health/startup', (req: Request, res: Response) => {
  res.json({
    status: 'started',
    version: '1.20.0',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  });
});

/**
 * Deprecated health endpoint (for backward compatibility)
 */
router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    message: 'Use /health/ready, /health/live, or /health/startup instead'
  });
});

export default router;
```

### Step 5: Create Production Frontend Dockerfile

**File: `Dockerfile.prod`**

```dockerfile
# =============================================================================
# STAGE 1: Build Stage
# =============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Add metadata for build stage
LABEL stage=builder

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Build Next.js application
RUN npm run build

# =============================================================================
# STAGE 2: Production Runtime
# =============================================================================
FROM node:20-alpine

WORKDIR /app

# Install dumb-init for proper signal handling (PID 1 zombie prevention)
RUN apk add --no-cache dumb-init

# Create non-root user for security
# UID 1001 is standard for Node.js applications in containers
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Copy optimized dependencies from builder
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules

# Copy built Next.js application
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next

# Copy public assets
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Copy package files
COPY --from=builder --chown=nextjs:nodejs /app/package*.json ./

# Copy next.config.js and other config files
COPY --chown=nextjs:nodejs next.config.js ./

# Add OCI image metadata
LABEL org.opencontainers.image.title="AlcheMix Frontend"
LABEL org.opencontainers.image.version="1.20.0"
LABEL org.opencontainers.image.description="Modern Cocktail Lab Management UI"
LABEL org.opencontainers.image.vendor="AlcheMix"
LABEL org.opencontainers.image.url="https://github.com/yourusername/alchemix"

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3001

# Health check - verify Next.js is serving requests
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/ || exit 1

# Use dumb-init as PID 1 to handle signals properly
# This ensures graceful shutdown on SIGTERM
ENTRYPOINT ["dumb-init", "--"]

# Start Next.js in production mode
CMD ["npm", "start"]
```

**Build and test:**
```bash
# Build
docker build -t alchemix-frontend:prod -f Dockerfile.prod .

# Run
docker run -p 3001:3001 alchemix-frontend:prod

# Test
curl http://localhost:3001
```

### Step 6: Update API Dockerfile for Production

**File: `api/Dockerfile` (Replace production stage)**

```dockerfile
# Multi-stage Dockerfile for AlcheMix API
# Stage 1: Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Production stage
FROM node:20-alpine

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Security: Non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S api -u 1001

# Copy package files
COPY --chown=api:nodejs package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy built files from builder
COPY --from=builder --chown=api:nodejs /app/dist ./dist

# Create data directory for SQLite
RUN mkdir -p /app/data && chown -R api:nodejs /app/data

# Add OCI image metadata
LABEL org.opencontainers.image.title="AlcheMix API"
LABEL org.opencontainers.image.version="1.20.0"
LABEL org.opencontainers.image.description="AlcheMix Express API Backend"
LABEL org.opencontainers.image.vendor="AlcheMix"

# Switch to non-root user
USER api

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health/ready || exit 1

# Use dumb-init as PID 1
ENTRYPOINT ["dumb-init", "--"]

# Start the server
CMD ["npm", "start"]

# Stage 3: Test stage (unchanged)
FROM node:20-alpine AS test

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

CMD ["npm", "test"]
```

### Step 7: Create Production Docker Compose Override

**File: `docker-compose.prod.yml`**

```yaml
version: '3.8'

services:
  neo4j:
    restart: always
    # Remove port exposure - services communicate via network
    ports: []
    environment:
      - NEO4J_AUTH=neo4j/${NEO4J_PASSWORD}
      - NEO4J_dbms_memory_heap_max_size=1500m
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  postgres:
    restart: always
    ports: []  # Remove port exposure
    environment:
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 1G
        reservations:
          cpus: '512m'
          memory: 512M
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  memmachine:
    restart: always
    # Keep internal port, use reverse proxy externally
    ports:
      - "127.0.0.1:8080:8080"
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  bar-server:
    restart: always
    ports: []  # Remove port exposure
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 1G
        reservations:
          cpus: '512m'
          memory: 512M
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  api:
    image: ghcr.io/${GITHUB_ORG}/alchemix/api:${VERSION:-latest}
    restart: always
    environment:
      - NODE_ENV=production
    ports:
      - "127.0.0.1:3000:3000"  # Localhost only, use reverse proxy
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/health/ready"]
      interval: 30s
      timeout: 10s
      retries: 5
      start_period: 10s
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 1G
        reservations:
          cpus: '512m'
          memory: 512M
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
    depends_on:
      postgres:
        condition: service_healthy

  web:
    image: ghcr.io/${GITHUB_ORG}/alchemix/frontend:${VERSION:-latest}
    restart: always
    ports:
      - "127.0.0.1:3001:3001"  # Localhost only, use reverse proxy
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3001/"]
      interval: 30s
      timeout: 10s
      retries: 5
      start_period: 10s
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M
        reservations:
          cpus: '512m'
          memory: 256M
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

### Step 8: Update api/src/server.ts

Add these imports after existing security middleware:

```typescript
import { config } from './config/validateEnv';  // Add this
import { apiLimiter, authLimiter, aiLimiter } from './config/rateLimiter';  // Add this
import healthRoutes from './routes/health';  // Add this

// Apply rate limiting
app.use('/api/', apiLimiter);
app.use('/auth/', authLimiter);
app.use('/api/messages', aiLimiter);

// Add health check routes (before error handler)
app.use(healthRoutes);
```

### Step 9: Create Production Environment Templates

**File: `api/.env.production`**

```bash
# Production environment - DO NOT commit secrets!
NODE_ENV=production
PORT=3000
JWT_SECRET=${RUNTIME_INJECTED_JWT_SECRET}
DATABASE_PATH=/app/data/alchemix.db
FRONTEND_URL=https://alchemix.yourdomain.com
OPENAI_API_KEY=${RUNTIME_INJECTED_OPENAI_API_KEY}
ANTHROPIC_API_KEY=${RUNTIME_INJECTED_ANTHROPIC_API_KEY}
MEMMACHINE_API_URL=http://memmachine:8080
MEMMACHINE_ENABLED=true
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=${RUNTIME_INJECTED_SENDGRID_API_KEY}
SMTP_FROM=AlcheMix <noreply@yourdomain.com>
LOG_LEVEL=info
CORS_ORIGIN=https://alchemix.yourdomain.com
```

**File: `.env.production.local` (NEVER commit)**

```bash
# Local template for setting production secrets
# Copy to .env.production.local and fill in your values
# Add to .gitignore

RUNTIME_INJECTED_JWT_SECRET=generate-with-node
RUNTIME_INJECTED_OPENAI_API_KEY=sk-...
RUNTIME_INJECTED_ANTHROPIC_API_KEY=sk-ant-...
RUNTIME_INJECTED_SENDGRID_API_KEY=SG....
POSTGRES_PASSWORD=generate-strong-password
NEO4J_PASSWORD=generate-strong-password
GITHUB_ORG=yourusername
VERSION=1.20.0
```

---

## Quick Start Deployment

### Local Development
```bash
# Install and run
npm run install:all
npm run dev:all
```

### Staging Deployment
```bash
# Build and test
npm run build
npm run test:all

# Start infrastructure only
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up

# Run API and Frontend locally for testing
npm run dev:all
```

### Production Deployment
```bash
# Set environment variables
export OPENAI_API_KEY="sk-..."
export ANTHROPIC_API_KEY="sk-ant-..."
export JWT_SECRET="$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')"
export POSTGRES_PASSWORD="$(openssl rand -base64 32)"
export NEO4J_PASSWORD="$(openssl rand -base64 32)"

# Build images
docker build -t alchemix-api:1.20.0 -f api/Dockerfile ./api
docker build -t alchemix-web:1.20.0 -f Dockerfile.prod .

# Push to registry (optional)
docker tag alchemix-api:1.20.0 ghcr.io/yourorg/alchemix/api:1.20.0
docker push ghcr.io/yourorg/alchemix/api:1.20.0

# Deploy
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Verify
docker-compose ps
sleep 10
curl http://localhost:3000/health/ready
curl http://localhost:3001
```

### Monitoring
```bash
# View logs
docker-compose logs -f api
docker-compose logs -f web

# Check resource usage
docker stats alchemix-api alchemix-web alchemix-postgres

# Database health
docker-compose exec postgres psql -U memmachine -d memmachine -c "SELECT version();"
```

---

## Deployment with Nginx Reverse Proxy (Recommended)

**Create: `nginx/nginx.conf`**

```nginx
upstream api {
    server api:3000;
}

upstream web {
    server web:3001;
}

server {
    listen 80;
    server_name alchemix.yourdomain.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name alchemix.yourdomain.com;

    # SSL certificate (use Let's Encrypt with Certbot)
    ssl_certificate /etc/letsencrypt/live/alchemix.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/alchemix.yourdomain.com/privkey.pem;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;

    # API routes
    location /api {
        proxy_pass http://api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Frontend routes
    location / {
        proxy_pass http://web;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## Checklist: Before Committing

- [ ] No secrets in any `.env` file
- [ ] All new files added to appropriate directories
- [ ] Tests still pass: `npm run test:all`
- [ ] Type checking passes: `npm run type-check`
- [ ] `docker build` succeeds for both API and Frontend
- [ ] Health endpoints respond correctly
- [ ] Rate limiting is active
- [ ] Dockerfiles use non-root users
- [ ] All comments explain security decisions

---

**Created:** December 2, 2025
**Updated:** December 2, 2025
