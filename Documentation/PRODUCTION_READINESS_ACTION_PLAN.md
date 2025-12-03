# Production Readiness Action Plan

**Created:** December 2, 2025
**Target Deployment:** December 30, 2025
**Status:** 🔴 NOT READY FOR PRODUCTION

---

## Critical Security Issues (MUST FIX FIRST)

### 1. Exposed API Keys in Version Control 🔴 CRITICAL

**Status:** Active breach
**Impact:** Account takeover, unauthorized API usage
**Time to Fix:** 30 minutes

**Steps:**
```bash
# Step 1: Revoke all exposed keys immediately
# - OpenAI: https://platform.openai.com/account/api-keys (delete and regenerate)
# - Anthropic: Account settings (regenerate key)
# - JWT_SECRET: Change immediately in all environments

# Step 2: Remove from git history
# Install git-filter-repo if needed
pip install git-filter-repo

# Remove .env from history
git-filter-repo --invert-paths --path .env

# Step 3: Clean local git
cd /c/Users/Admin/OneDrive/Desktop/'DEV\ Work'/alchemix
git reflog expire --expire=now --all
git gc --prune=now

# Step 4: Force push (only if not yet shared publicly)
# If already pushed to GitHub - do NOT force push!
# Instead, rotate all keys and follow GitHub's security guidance
```

**Add to .gitignore:**
```bash
# Verify .env files are ignored
echo ".env" >> .gitignore
echo ".env.*.local" >> .gitignore
echo ".env.production" >> .gitignore
git add .gitignore
git commit -m "fix: ensure .env files are not tracked"
```

**After Fixing:**
- [ ] Rotate OpenAI API key
- [ ] Rotate Anthropic API key
- [ ] Generate new JWT_SECRET (32+ random characters)
- [ ] Update all deployed instances
- [ ] Monitor for unauthorized usage

---

### 2. Update Express Vulnerability 🟠 HIGH

**Vulnerability:** GHSA-pj86-cfqh-vqx6
**Current:** express < 4.22.0
**Required:** express >= 4.22.0
**Time to Fix:** 10 minutes

```bash
cd "/c/Users/Admin/OneDrive/Desktop/DEV Work/alchemix/api"

# Update express
npm install express@^4.22.0

# Verify fix
npm audit

# Test
npm test

# Commit
git add package*.json
git commit -m "fix: update express to >= 4.22.0 (security vulnerability)"
```

---

### 3. Missing Environment Validation 🟠 HIGH

**Status:** Not implemented
**Impact:** Missing critical config goes undetected until runtime
**Time to Fix:** 45 minutes

**Create: `api/src/config/validateEnv.ts`**

```typescript
/**
 * Environment variable validation
 * Ensures all required variables are present and valid on startup
 */

interface Config {
  // Required
  JWT_SECRET: string;
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  DATABASE_PATH: string;

  // Optional
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  MEMMACHINE_API_URL?: string;
  FRONTEND_URL?: string;

  // SMTP (optional)
  SMTP_HOST?: string;
  SMTP_PORT?: number;
  SMTP_USER?: string;
  SMTP_PASS?: string;
  SMTP_FROM?: string;
}

export function validateEnv(): Config {
  const missingVars: string[] = [];

  // Check required variables
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

  // Optional variables
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

  // Validate SMTP configuration consistency
  if (config.SMTP_HOST) {
    const smtpVars = ['SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'];
    const missingSMTP = smtpVars.filter(
      v => !process.env[v]
    );

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

// Export global config instance
export const config = validateEnv();
```

**Update: `api/src/server.ts`**

```typescript
import './config/env';  // Keep existing dotenv load
import { config } from './config/validateEnv';  // Add validation

// ... other imports ...

// Validate environment immediately on startup
try {
  console.log('Validating environment configuration...');
  // config is already validated by import
  console.log('✅ Environment validated');
} catch (error) {
  console.error('❌ Environment validation failed:');
  console.error((error as Error).message);
  process.exit(1);
}

// ... rest of server.ts ...
```

**Test:**
```bash
cd api

# Should work with valid .env
npm run dev

# Should fail with missing JWT_SECRET
unset JWT_SECRET && npm run dev

# Should fail with short JWT_SECRET
export JWT_SECRET="short" && npm run dev
```

---

## High Priority Issues (Before Launch)

### 4. Create Production Frontend Dockerfile 🟠 HIGH

**Status:** Missing entirely
**Impact:** Cannot deploy frontend to production
**Time to Fix:** 30 minutes

**Create: `Dockerfile.prod`**

```dockerfile
# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Add metadata
LABEL stage=builder

# Cache node modules
COPY package*.json ./
RUN npm ci

# Copy source
COPY . .

# Build Next.js
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Copy from builder
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/package*.json ./

# Add metadata
LABEL org.opencontainers.image.title="AlcheMix Frontend"
LABEL org.opencontainers.image.version="1.20.0"
LABEL org.opencontainers.image.description="Modern Cocktail Lab Management"
LABEL org.opencontainers.image.vendor="AlcheMix"

# Switch user
USER nextjs

EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/ || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

CMD ["npm", "start"]
```

**Test:**
```bash
# Build
docker build -t alchemix-frontend:test -f Dockerfile.prod .

# Run
docker run -p 3001:3001 alchemix-frontend:test

# Test
curl http://localhost:3001
```

**Update API Dockerfile for production parity:**

```dockerfile
# In api/Dockerfile, update production stage:

# Stage 2: Production
FROM node:20-alpine

WORKDIR /app

# Install dumb-init
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

# Add metadata
LABEL org.opencontainers.image.title="AlcheMix API"
LABEL org.opencontainers.image.version="1.20.0"

USER api

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health/ready || exit 1

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

CMD ["npm", "start"]
```

---

### 5. Implement API Rate Limiting 🟠 HIGH

**Status:** Not configured
**Impact:** No protection against brute force, DoS attacks
**Time to Fix:** 20 minutes

**Update: `api/src/server.ts`**

```typescript
import rateLimit from 'express-rate-limit';

// General rate limiter - 100 requests per 15 minutes
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'test', // Skip in tests
});

// Authentication limiter - 5 attempts per 15 minutes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  message: 'Too many login attempts, please try again later.',
  skip: (req) => process.env.NODE_ENV === 'test',
});

// Apply limiters
app.use('/api/', apiLimiter);
app.use('/auth/', authLimiter);

// Special handling for AI endpoints (expensive)
const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // 50 messages per hour
  message: 'AI service rate limit exceeded.',
  skip: (req) => process.env.NODE_ENV === 'test',
});

app.use('/api/messages', aiLimiter);
```

**Test:**
```bash
# Generate 6 rapid auth requests - should get 429 on 6th
for i in {1..6}; do
  curl -X POST http://localhost:3000/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"wrong"}'
  echo "Request $i"
  sleep 0.1
done
```

---

### 6. Add Health Check Endpoints 🟠 HIGH

**Status:** Not implemented
**Impact:** Kubernetes/orchestration systems can't monitor readiness
**Time to Fix:** 30 minutes

**Create: `api/src/routes/health.ts`**

```typescript
import { Router, Request, Response } from 'express';
import { db } from '../database/db';

const router = Router();

/**
 * Liveness probe - Is the process alive?
 * Used by: Kubernetes to restart dead containers
 * Should be lightweight, no external dependencies
 */
router.get('/health/live', (req: Request, res: Response) => {
  res.json({
    status: 'alive',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

/**
 * Readiness probe - Is the service ready to accept traffic?
 * Used by: Load balancers to route traffic
 * Checks critical dependencies
 */
router.get('/health/ready', (req: Request, res: Response) => {
  try {
    // Check database
    const dbCheck = db.prepare('SELECT 1').all();
    if (!dbCheck || dbCheck.length === 0) {
      throw new Error('Database query returned no results');
    }

    res.json({
      status: 'ready',
      checks: {
        database: 'ok',
        process: 'ok',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'not_ready',
      error: (error as Error).message,
      checks: {
        database: 'failed',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * Startup probe - Has initialization completed?
 * Used by: Kubernetes to know when app is ready after start
 */
router.get('/health/startup', (req: Request, res: Response) => {
  res.json({
    status: 'started',
    version: '1.20.0',
    timestamp: new Date().toISOString(),
  });
});

/**
 * Deprecated health endpoint (for compatibility)
 */
router.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

export default router;
```

**Update: `api/src/server.ts`**

```typescript
import healthRoutes from './routes/health';

// Register before error handler
app.use(healthRoutes);
```

**Create: `src/app/health/page.tsx` (Frontend)**

```typescript
'use client';

export default function HealthPage() {
  return (
    <div>
      <h1>AlcheMix Frontend</h1>
      <p>Status: Healthy</p>
    </div>
  );
}
```

**Test:**
```bash
# Test API health
curl http://localhost:3000/health/ready
curl http://localhost:3000/health/live
curl http://localhost:3000/health/startup

# Test Frontend (should not 404)
curl http://localhost:3001/health
```

---

### 7. Create Production Environment File 🟠 HIGH

**Status:** Not documented
**Impact:** Difficult to deploy consistently
**Time to Fix:** 15 minutes

**Create: `api/.env.production`**

```bash
# ALCHEMIX PRODUCTION ENVIRONMENT VARIABLES
# DO NOT commit secrets - these placeholders will be replaced at deployment

# Server Configuration
NODE_ENV=production
PORT=3000

# Security (REQUIRED - injected at deployment time)
# Use secrets manager, not this file!
JWT_SECRET=${RUNTIME_INJECTED_JWT_SECRET}

# Database
DATABASE_PATH=/app/data/alchemix.db

# Frontend (adjust to your domain)
FRONTEND_URL=https://alchemix.yourdomain.com

# Optional AI Services (injected at deployment)
OPENAI_API_KEY=${RUNTIME_INJECTED_OPENAI_API_KEY}
ANTHROPIC_API_KEY=${RUNTIME_INJECTED_ANTHROPIC_API_KEY}

# Optional MemMachine
MEMMACHINE_API_URL=http://memmachine:8080
MEMMACHINE_ENABLED=true

# Email Service (SendGrid example - update for your provider)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=${RUNTIME_INJECTED_SENDGRID_API_KEY}
SMTP_FROM=AlcheMix <noreply@yourdomain.com>

# Logging
LOG_LEVEL=info

# Security Headers
CORS_ORIGIN=https://alchemix.yourdomain.com
```

**Create: `docker/.env.production.template`**

```bash
# Template for production secrets
# Copy this file and fill in your actual values
# Then pass to docker-compose with: --env-file docker/.env.production

OPENAI_API_KEY=sk-...your-key...
ANTHROPIC_API_KEY=sk-ant-...your-key...
JWT_SECRET=...generate-with-node-crypto...
SENDGRID_API_KEY=SG....your-key...
POSTGRES_PASSWORD=...strong-random-password...
NEO4J_PASSWORD=...strong-random-password...
```

**Generate strong JWT_SECRET:**

```bash
# On your deployment machine
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Output: abc123def456...
```

---

## Medium Priority Issues (Next)

### 8. Create GitHub Actions CI/CD Pipeline 🟡 MEDIUM

**Status:** Not implemented
**Impact:** No automated testing, builds, deployments
**Time to Fix:** 2 hours

**Create: `.github/workflows/ci.yml`**

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop, feature/*]
  pull_request:
    branches: [main, develop]
  schedule:
    - cron: '0 2 * * 0'  # Weekly security scan

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  test:
    name: Test & Lint
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [20.x]

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'

      - name: Install dependencies
        run: npm run install:all

      - name: Type check
        run: npm run type-check

      - name: Lint
        run: npm run lint

      - name: Test Frontend
        run: npm test -- --run

      - name: Test API
        run: npm -w api test -- --run

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./api/coverage/coverage-final.json
          flags: api
          fail_ci_if_error: false

  build:
    name: Build
    runs-on: ubuntu-latest
    needs: test
    if: github.event_name == 'push'

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20.x'
          cache: 'npm'

      - name: Install dependencies
        run: npm run install:all

      - name: Build Frontend
        run: npm run build

      - name: Build API
        run: npm -w api run build

      - name: Save build artifacts
        uses: actions/upload-artifact@v3
        with:
          name: builds
          path: |
            .next
            api/dist
          retention-days: 7

  security:
    name: Security Scan
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: '.'
          format: 'sarif'
          output: 'trivy-results.sarif'
          severity: 'CRITICAL,HIGH'

      - name: Upload Trivy results
        uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: 'trivy-results.sarif'

  docker-build:
    name: Build Docker Images
    runs-on: ubuntu-latest
    needs: test
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'

    permissions:
      contents: read
      packages: write

    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=ref,event=branch
            type=sha,prefix={{branch}}-
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}

      - name: Build and push API image
        uses: docker/build-push-action@v5
        with:
          context: ./api
          file: ./api/Dockerfile
          push: true
          tags: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/api:latest
          cache-from: type=registry,ref=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/api:buildcache
          cache-to: type=registry,ref=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/api:buildcache,mode=max

      - name: Build and push Frontend image
        uses: docker/build-push-action@v5
        with:
          context: .
          file: ./Dockerfile.prod
          push: true
          tags: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/frontend:latest
          cache-from: type=registry,ref=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/frontend:buildcache
          cache-to: type=registry,ref=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/frontend:buildcache,mode=max
```

---

### 9. Create docker-compose.prod.yml 🟡 MEDIUM

**Status:** Not implemented
**Impact:** Cannot deploy consistently to production
**Time to Fix:** 30 minutes

**Create: `docker-compose.prod.yml`**

```yaml
version: '3.8'

services:
  neo4j:
    restart: always
    ports: []  # Remove port exposure
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

  memmachine:
    restart: always
    ports:
      - "8080:8080"  # Keep internal, reverse proxy externally
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G

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

  api:
    image: ghcr.io/yourusername/alchemix/api:latest
    restart: always
    environment:
      - NODE_ENV=production
    ports:
      - "3000:3000"  # Should be behind reverse proxy only
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

  web:
    image: ghcr.io/yourusername/alchemix/frontend:latest
    restart: always
    ports:
      - "3001:3001"  # Should be behind reverse proxy only
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

**Deployment command:**

```bash
# Start production stack
export OPENAI_API_KEY="..."
export ANTHROPIC_API_KEY="..."
export JWT_SECRET="..."
export POSTGRES_PASSWORD="..."
export NEO4J_PASSWORD="..."

docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Verify
docker-compose ps
curl http://localhost:3000/health/ready
curl http://localhost:3001
```

---

## Quick Implementation Checklist

### Week 1: Critical Fixes (Before Any Deployment)
- [ ] Revoke all exposed API keys
- [ ] Update Express to 4.22.0+
- [ ] Add environment validation (`validateEnv.ts`)
- [ ] Create production frontend Dockerfile
- [ ] Implement rate limiting
- [ ] Add health check endpoints
- [ ] Remove secrets from .env in version control

**Estimated Time:** 3-4 hours
**Status After:** Ready for staging deployment

### Week 2: High Priority Items
- [ ] Set up GitHub Actions CI/CD pipeline
- [ ] Create docker-compose.prod.yml
- [ ] Create production environment documentation
- [ ] Document deployment procedures
- [ ] Set up monitoring/alerts (basic)

**Estimated Time:** 4-5 hours
**Status After:** Ready for production deployment

### Week 3-4: Medium Priority Items
- [ ] Add end-to-end tests
- [ ] Implement centralized secrets management
- [ ] Set up database backups
- [ ] Implement performance monitoring
- [ ] Create disaster recovery plan

**Estimated Time:** 8-10 hours
**Status After:** Production-grade infrastructure

---

## Testing Checklist Before Launch

### Security Testing
- [ ] Run `npm audit` - zero vulnerabilities
- [ ] Run Trivy scan - no critical vulnerabilities
- [ ] Test rate limiting under load
- [ ] Verify JWT secret rotation capability
- [ ] Test secrets are not logged

### Performance Testing
- [ ] Load test API (100+ concurrent users)
- [ ] Load test Frontend
- [ ] Verify response times < 500ms
- [ ] Test pagination with large datasets
- [ ] Memory leak testing (24h run)

### Integration Testing
- [ ] Full user signup → verification → login → use features
- [ ] Database failover
- [ ] Service restart recovery
- [ ] Network disconnection recovery

### Operational Testing
- [ ] Deployment procedure works end-to-end
- [ ] Health checks properly report status
- [ ] Rollback procedure works
- [ ] Logs are properly captured
- [ ] Monitoring alerts fire correctly

---

## Cost Estimate (First 3 Months)

| Service | Cost | Provider |
|---------|------|----------|
| API Server (1GB, 1 CPU) | $10-15/mo | AWS/DigitalOcean |
| Frontend Server (512MB, 0.5 CPU) | $5-10/mo | AWS/DigitalOcean |
| PostgreSQL (1GB) | $15-20/mo | AWS RDS/DigitalOcean |
| Neo4j (2GB - if needed) | $50-100/mo | Neo4j Cloud/Self-hosted |
| Storage (backups, logs) | $5-10/mo | S3/Block Storage |
| **Total Monthly** | **$85-155** | |
| **3-Month Cost** | **$255-465** | |

**Cost Reduction Tips:**
- Use managed services (easier ops)
- Auto-scale during off-peak hours
- Use spot instances for non-production
- Consider PostgreSQL only if not using graph features heavily

---

**Document Version:** 1.0
**Last Updated:** December 2, 2025
**Next Review:** December 16, 2025
