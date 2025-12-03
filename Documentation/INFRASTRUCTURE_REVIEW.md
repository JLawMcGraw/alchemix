# AlcheMix Infrastructure & DevOps Review

**Review Date:** December 2, 2025
**Project:** AlcheMix - Modern Cocktail Lab Management
**Version:** v1.20.0
**Reviewer:** Deployment Engineering Team

## Executive Summary

AlcheMix has a **solid foundation** for a production application with good Docker compose orchestration, comprehensive test coverage, and security-conscious implementations. However, there are several **critical gaps for production readiness** that need to be addressed before deploying to a live environment:

### Critical Issues (Address First)
1. **No CI/CD Pipeline** - No GitHub Actions, automated testing, or deployment automation
2. **Secrets Exposed in .env** - Production API keys visible in version control
3. **Missing Production Dockerfiles** - Frontend has no production Dockerfile
4. **No Health Check Endpoints** - Frontend lacks readiness/liveness probes
5. **Vulnerability in Express** - express < 4.22.0 has known CVE

### High Priority Issues (Before Launch)
1. Database backups/recovery procedures not documented
2. No logging aggregation or centralized monitoring
3. Missing environment parity between dev/staging/prod
4. No zero-downtime deployment strategy documented
5. API rate limiting not configured for production

### Medium Priority Issues (Improve Soon)
1. Container image optimization (security, size)
2. Test coverage gaps in integration tests
3. Missing end-to-end tests
4. No performance testing framework
5. Incomplete error handling in some services

---

## 1. Docker Configuration Review

### 1.1 docker-compose.yml Analysis

#### Strengths
- ✅ **Network isolation** - Proper bridge network for service-to-service communication
- ✅ **Volume management** - Persistent volumes for databases (Neo4j, Postgres, SQLite)
- ✅ **Health checks** - All services have proper health checks with retries
- ✅ **Environment isolation** - Services don't expose unnecessary ports

#### Issues & Recommendations

**CRITICAL: Missing API and Frontend services**
```yaml
# Current Status: Commented out in docker-compose.yml
api:    # COMMENTED OUT - Line 119
web:    # COMMENTED OUT - Line 137
```

**Issue:** API and Frontend are disabled in production compose file, but no separate production configuration provided.

**Recommendation:**
```bash
# Create separate composition strategy:
# 1. docker-compose.yml - All services (for local development)
# 2. docker-compose.prod.yml - Override only production settings
# 3. .env.production - Production environment variables
```

**Problem: Hardcoded Default Credentials**
```yaml
neo4j:
  environment:
    - NEO4J_AUTH=neo4j/alchemixpassword  # ❌ Hardcoded!

postgres:
  environment:
    - POSTGRES_PASSWORD=memmachinepassword  # ❌ Hardcoded!
```

**Recommendation:**
```yaml
# Use environment variables instead:
neo4j:
  environment:
    - NEO4J_AUTH=neo4j/${NEO4J_PASSWORD}
postgres:
  environment:
    - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
```

**Issue: Database Ports Exposed Unnecessarily**
```yaml
postgres:
  ports:
    - "5432:5432"  # ❌ Exposed to host, unnecessary in prod
neo4j:
  ports:
    - "7474:7474"  # ❌ Exposed to host
    - "7687:7687"  # ❌ Exposed to host
```

**Recommendation:**
```yaml
# Production override: Remove exposed ports
# Services communicate via network, not ports
# Only expose API and Frontend ports
postgres:
  # Remove ports: section entirely
  # Accessible only via alchemix-network
```

**Missing: Resource Limits**
```yaml
# No cpu/memory limits defined!
services:
  neo4j:
    # Missing: resources limits
```

**Recommendation:**
```yaml
services:
  neo4j:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
  postgres:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 1G
        reservations:
          cpus: '512m'
          memory: 512M
```

### 1.2 Dockerfile Analysis

#### API Dockerfile (api/Dockerfile) - GOOD

**Strengths:**
- ✅ Multi-stage build (builder → production → test)
- ✅ Alpine base image (lightweight)
- ✅ Production dependencies only (`npm ci --omit=dev`)
- ✅ Test stage for CI/CD

**Improvements Needed:**

1. **Missing: Non-root User**
```dockerfile
# ❌ Currently running as root
# ✅ Add this:
RUN addgroup --gid 1001 --system nodejs
RUN adduser --system nodejs --uid 1001
USER nodejs
```

2. **Missing: Explicit Labels**
```dockerfile
# Add for production tracking
LABEL maintainer="Jacob Lawrence"
LABEL version="1.20.0"
LABEL description="AlcheMix Express API"
```

3. **Missing: .dockerignore Optimization**
Current `.dockerignore` is minimal. Should add:
```
.git
.gitignore
.env
.env.*
docs
*.md
.vscode
.idea
```

4. **Missing: Health Check Labels**
```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"
```

#### Frontend Dockerfile (Dockerfile.dev) - CRITICAL ISSUES

**Current (Development Only):**
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
EXPOSE 3001
CMD ["npm", "run", "dev"]
```

**Problems:**
- ❌ No production Dockerfile
- ❌ Includes dev dependencies
- ❌ No build stage
- ❌ No health checks
- ❌ Exposes all source code

**Required: Production Dockerfile for Frontend**
```dockerfile
# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app

# Add labels
LABEL stage=builder

# Cache dependencies
COPY package*.json ./
RUN npm ci

# Copy source
COPY . .

# Build Next.js
RUN npm run build

# Stage 2: Runtime
FROM node:20-alpine

WORKDIR /app

# Security: Non-root user
RUN addgroup --gid 1001 --system nodejs
RUN adduser --system nextjs --uid 1001

# Copy built application
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package*.json ./

# Switch to non-root user
USER nextjs

EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/ || exit 1

# Start Next.js in production mode
CMD ["npm", "start"]
```

#### Bar Server Dockerfile (Python) - GOOD WITH NOTES

**Strengths:**
- ✅ Multi-layer approach
- ✅ Health checks included
- ✅ Proper Python package management

**Recommendations:**
1. **Pin Python version:** Use `3.12.X` instead of `3.12-slim` for reproducibility
2. **Non-root user:** Add security user for Python process
3. **Security scanning:** No vulnerability scanning in build

---

## 2. Environment & Secrets Management Review

### 2.1 Critical Security Issues

#### Issue #1: API Keys in Version Control
**Files:** `.env` (production keys exposed!)

```
OPENAI_API_KEY=sk-proj-XXXX...XXXX (REDACTED - real key was exposed!)
ANTHROPIC_API_KEY=sk-ant-api03-XXXX...XXXX (REDACTED - real key was exposed!)
JWT_SECRET=XXXX...XXXX (REDACTED - real secret was exposed!)
```

**Risk Level:** 🔴 **CRITICAL**

**Impact:**
- Attackers can impersonate your OpenAI/Anthropic accounts
- JWT secret can be used to forge authentication tokens
- Potential for unauthorized data access
- Account takeover risk

**Immediate Actions Required:**
1. **Revoke all exposed keys immediately**
   ```bash
   # Rotate all keys in respective platforms
   # - OpenAI: https://platform.openai.com/account/api-keys
   # - Anthropic: Account settings
   ```

2. **Add .env to .gitignore**
   ```bash
   # Verify .env is ignored
   cat .gitignore | grep -E "^\.env"
   ```

3. **Remove from git history** (if ever pushed)
   ```bash
   # Using git-filter-repo (recommended)
   git-filter-repo --invert-paths --path .env
   ```

#### Issue #2: No Secrets Management for Production

**Current Approach:** Environment variables in `.env` file

**Problem:** Not suitable for production because:
- Manual management is error-prone
- No rotation/versioning
- No audit trail
- Difficult to share across team
- Risk of local exposure

**Production Recommendation: Use Secrets Manager**

```bash
# Option 1: AWS Secrets Manager (recommended for AWS deployment)
aws secretsmanager create-secret --name alchemix/prod --secret-string '{
  "OPENAI_API_KEY": "...",
  "ANTHROPIC_API_KEY": "...",
  "JWT_SECRET": "..."
}'

# Option 2: HashiCorp Vault (for multi-cloud)
vault kv put secret/alchemix/prod \
  OPENAI_API_KEY=... \
  ANTHROPIC_API_KEY=... \
  JWT_SECRET=...

# Option 3: Docker Secrets (for Docker Swarm)
echo "your-secret" | docker secret create alchemix_jwt_secret -

# Option 4: Kubernetes Secrets (for K8s)
kubectl create secret generic alchemix-secrets \
  --from-literal=OPENAI_API_KEY=... \
  --from-literal=ANTHROPIC_API_KEY=... \
  --from-literal=JWT_SECRET=...
```

#### Issue #3: Environment Variable Validation Missing

**Current Code (api/src/config/env.ts):**
```typescript
// Only logs presence of JWT_SECRET, doesn't validate it
if (!process.env.JWT_SECRET) {
  console.error('   JWT_SECRET: MISSING (critical error)');
}
```

**Recommendation: Validate on startup**
```typescript
// api/src/config/validateEnv.ts
interface Config {
  JWT_SECRET: string;
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  DATABASE_PATH: string;
  PORT: number;
  NODE_ENV: 'development' | 'production' | 'test';
}

export function validateEnv(): Config {
  const required = {
    JWT_SECRET: process.env.JWT_SECRET,
    DATABASE_PATH: process.env.DATABASE_PATH || './data/alchemix.db',
    PORT: parseInt(process.env.PORT || '3000'),
    NODE_ENV: (process.env.NODE_ENV || 'development') as any,
  };

  // Validate JWT_SECRET strength
  if (!required.JWT_SECRET || required.JWT_SECRET.length < 32) {
    throw new Error(
      'CRITICAL: JWT_SECRET must be at least 32 characters long'
    );
  }

  // Validate PORT is reasonable
  if (required.PORT < 1024 || required.PORT > 65535) {
    throw new Error('CRITICAL: PORT must be between 1024 and 65535');
  }

  return {
    ...required,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  };
}

// server.ts
const config = validateEnv();
```

### 2.2 Environment Configuration Files

#### Strengths
- ✅ `.env.docker` template provided
- ✅ `.env.example` in API with full documentation
- ✅ Clear comments about SMTP configuration options

#### Issues

**Missing: Multi-environment setup**
```
Current:
- .env (for development, hardcoded secrets)
- .env.docker (template for Docker)

Missing:
- .env.staging
- .env.production
- .env.test
```

**Recommendation:**
```bash
# Create environment-specific templates:
api/.env.example          # Documented template
api/.env.development      # Local dev defaults
api/.env.staging          # Staging defaults (NO SECRETS)
api/.env.production       # Production defaults (NO SECRETS)

# In CI/CD, inject secrets at runtime:
# GitHub Actions example:
env:
  JWT_SECRET: ${{ secrets.JWT_SECRET }}
  OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
  ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

#### Issue: SMTP Configuration Underdocumented

**Current:** Multiple providers documented in `.env.example`, but no testing mechanism

**Recommendation:**
```typescript
// api/src/config/smtpConfig.ts
import nodemailer from 'nodemailer';

export function createSmtpTransporter() {
  const config = {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_PORT === '465', // true for 465, false otherwise
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  };

  // Validate configuration
  if (config.host) {
    if (!config.auth.user || !config.auth.pass) {
      console.warn('⚠️  SMTP configured but missing credentials');
    }
  }

  return nodemailer.createTransport(config);
}

// Add CLI command to test SMTP:
// npm run test:smtp
```

---

## 3. Dependencies & Package Management Review

### 3.1 Security Vulnerabilities

#### Root Package.json
```bash
npm audit
# Output: found 0 vulnerabilities ✅
```

#### API Package.json
```bash
npm audit
# Output:
# express <4.22.0
# express improperly controls modification of query properties
# https://github.com/advisories/GHSA-pj86-cfqh-vqx6
# 1 low severity vulnerability
```

**Action Required:** Update Express
```bash
cd api
npm install express@^4.22.0
npm audit fix
```

**Complete Current Dependencies:**

**Root (Frontend):**
- ✅ next: ^14.1.0 (Latest stable)
- ✅ react: ^18.2.0 (LTS)
- ✅ zustand: ^4.5.0 (Latest)
- ✅ typescript: ^5.3.3 (Latest)

**API:**
- ⚠️ express: ^4.18.2 → **Update to 4.22.0+**
- ✅ bcrypt: ^5.1.1 (Latest, secure)
- ✅ better-sqlite3: ^9.2.2 (Latest)
- ✅ jsonwebtoken: ^9.0.2 (Latest)
- ✅ helmet: ^7.1.0 (Latest)
- ✅ winston: ^3.18.3 (Latest, logging)

**Recommendations:**

1. **Set up dependabot**
   ```yaml
   # .github/dependabot.yml
   version: 2
   updates:
     - package-ecosystem: "npm"
       directory: "/"
       schedule:
         interval: "weekly"
       open-pull-requests-limit: 5
     - package-ecosystem: "npm"
       directory: "/api"
       schedule:
         interval: "weekly"
   ```

2. **Automate security scanning**
   ```bash
   # Add to CI/CD pipeline
   npm audit --audit-level=moderate
   npm install -g snyk
   snyk test
   ```

3. **Lock file management**
   ```bash
   # Ensure reproducible builds
   npm ci  # instead of npm install
   ```

### 3.2 Dependency Bloat

**Frontend (Next.js):**
- 397 packages total (common for Next.js)
- Reasonable for modern React app

**API (Express):**
- 233 packages total
- Can be optimized for production:
  ```bash
  npm ci --omit=dev  # In production Docker builds
  ```

**Test Dependencies:** Well separated in devDependencies ✅

---

## 4. Build & Deployment Configuration Review

### 4.1 Package.json Scripts Analysis

**Frontend (Root):**
```json
"dev": "next dev -p 3001",           // Local development ✅
"dev:api": "cd api && npm run dev",  // API development ✅
"dev:all": "concurrently ...",       // Both together ✅
"build": "next build && cd api && npm run build",  // Full build ✅
"test": "vitest run",                // Frontend tests ✅
"test:api": "cd api && npm test",    // API tests ✅
```

**Issues:**

1. **Windows-specific script**
   ```json
   "dev:clean": "kill-ports.bat && npm run dev:all"  // ❌ Not cross-platform!
   ```

   **Fix:**
   ```bash
   npm install -D kill-port  # Cross-platform alternative
   ```
   ```json
   "dev:clean": "npx kill-port 3000 3001 5000 5001 && npm run dev:all"
   ```

2. **Missing production build verification**
   ```json
   // Add to CI/CD:
   "build:prod": "npm run build && npm run test && npm run type-check"
   ```

### 4.2 TypeScript Configuration Review

**Root tsconfig.json:**
- ✅ Strict mode enabled
- ✅ Module resolution proper
- ✅ Path aliases configured (`@/*`)

**API tsconfig.json:**
- ✅ Strict mode enabled
- ✅ Proper output directory
- ✅ ES2022 target (good for Node.js 20)

**Missing: tsconfig in test environments**
- API tests use separate vitest config (good)
- Frontend tests use vitest config (good)

**Recommendation: Add comments**
```json
{
  "compilerOptions": {
    "strict": true,  // Catch type errors early
    "noImplicitAny": true,  // Require explicit types
    "strictNullChecks": true,  // Prevent null/undefined errors
    "esModuleInterop": true,  // Better CommonJS compatibility
    "skipLibCheck": true,  // Speed up type checking
    "forceConsistentCasingInFileNames": true  // Platform compatibility
  }
}
```

---

## 5. Testing Review

### 5.1 Test Infrastructure

**Current Setup:**
- ✅ Vitest for both frontend and API
- ✅ Supertest for API integration tests
- ✅ Testing Library for frontend
- ✅ 379 total tests (14 files in API)
- ✅ Test coverage tracking configured

**Test Files Located:**
```
api/src/database/db.test.ts
api/src/middleware/auth.tokenVersioning.test.ts
api/src/middleware/errorHandler.test.ts
api/src/routes/auth.test.ts
api/src/routes/collections.test.ts
api/src/routes/favorites.test.ts
api/src/routes/inventoryItems.test.ts
api/src/routes/messages.test.ts
api/src/routes/recipes.test.ts
api/src/routes/shoppingList.test.ts
api/src/services/EmailService.test.ts
api/src/utils/inputValidator.test.ts
api/src/utils/passwordValidator.test.ts
api/src/utils/tokenBlacklist.test.ts
```

**Test Utilities:**
- ✅ `api/src/tests/setup.ts` - Database setup
- ✅ `api/src/tests/helpers.ts` - Test data generation
- ✅ `api/src/tests/assertions.ts` - Custom assertions
- ✅ `api/src/tests/mocks.ts` - Mock implementations
- ✅ Comprehensive documentation in README.md

### 5.2 Test Quality Assessment

**Strengths:**
- ✅ Clear test structure with beforeEach/afterEach
- ✅ Isolated database for each test
- ✅ Proper mocking of external dependencies
- ✅ Authentication token testing
- ✅ User data isolation verification
- ✅ Error handling tests
- ✅ Rate limiting tests

**Gaps & Recommendations:**

1. **Missing: Frontend Component Tests**
   ```
   Current: API focused (379 tests)
   Missing: React component tests
   ```

   **Recommendation:**
   ```typescript
   // src/__tests__/components/LoginForm.test.tsx
   import { render, screen, fireEvent } from '@testing-library/react';
   import { LoginForm } from '@/components/LoginForm';

   describe('LoginForm', () => {
     it('should submit credentials on form submit', async () => {
       render(<LoginForm />);
       const emailInput = screen.getByLabelText(/email/i);
       const submitButton = screen.getByRole('button', { name: /login/i });

       fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
       fireEvent.click(submitButton);

       await screen.findByText(/logging in/i);
     });
   });
   ```

2. **Missing: End-to-End Tests**
   ```bash
   # Should test complete user flows:
   # - Signup → Verification → Login → Add Item → Create Recipe
   # - Recommend with: Playwright, Cypress, or Puppeteer
   ```

3. **Missing: Performance Tests**
   ```bash
   # Test endpoints under load:
   # - Response time benchmarks
   # - Pagination performance
   # - Database query optimization
   ```

4. **Test Coverage Gaps**
   ```bash
   # Run current coverage:
   cd api
   npm run test:coverage

   # Should aim for:
   # - 80%+ lines coverage
   # - 75%+ branch coverage
   # - 100% critical paths (auth, data integrity)
   ```

5. **Missing: Docker Integration Tests**
   ```bash
   # docker-compose.test.yml exists but:
   # - Only API tests, no frontend
   # - Should test service communication
   ```

### 5.3 Test Execution

**Current Execution:**
```bash
npm run test              # Vitest watch mode
npm run test:coverage    # With coverage report
cd api && npm test       # API tests only
npm run test:api:docker  # In Docker container
```

**Missing: CI/CD Integration**
- No GitHub Actions workflow
- No automated test running on PR
- No test result reporting

### 5.4 Vitest Configuration

**Root vitest.config.mts:**
- ✅ jsdom environment for React
- ✅ Setup files configured
- ✅ Coverage provider set to v8
- ✅ Path aliases resolved

**API vitest.config.ts:**
- ✅ Node environment (correct for Express)
- ✅ Setup files configured
- ✅ Test environment variables set
- ✅ Coverage excluded properly

---

## 6. Monorepo Structure Review

### 6.1 Current Setup

**Structure:**
```
alchemix/
├── src/                    # Next.js frontend code
├── api/                    # Express backend code
├── docker/                 # Docker configurations
│   ├── bar-server/
│   └── memmachine/
├── Documentation/          # Project documentation
├── package.json           # Root workspace
├── api/package.json       # Backend workspace
└── docker-compose*.yml    # Orchestration
```

### 6.2 Monorepo Issues & Recommendations

**Issue #1: Not a true monorepo**
- No workspace management (npm workspaces, yarn workspaces, lerna, pnpm)
- Manual dependency management
- Each package.json separate

**Recommendation: Implement npm workspaces**

```json
// Root package.json
{
  "name": "alchemix",
  "workspaces": [
    ".",
    "api"
  ],
  "scripts": {
    "dev:all": "concurrently \"npm run dev\" \"npm -w api run dev\"",
    "build:all": "npm run build && npm -w api run build",
    "test:all": "npm test && npm -w api test",
    "lint:all": "npm run lint && npm -w api run lint"
  }
}
```

**Benefits:**
- Single node_modules (faster installs)
- Shared dev dependencies
- Unified versioning
- Cleaner scripts

**Issue #2: Shared code duplication**
- Test utilities in `api/src/tests/` (specific to API)
- Could be shared with frontend tests

**Recommendation: Create shared test utilities**
```
alchemix/
├── packages/
│   ├── shared/              # New: Shared utilities
│   │   ├── test-utils/
│   │   └── types/
│   ├── frontend/            # Renamed: src/
│   └── backend/             # Renamed: api/
```

**Issue #3: Build output not ignored**
```bash
# Both packages build but output not isolated
frontend/.next/
api/dist/
```

**Recommendation: Centralize build output**
```json
// Root .gitignore
dist/
build/
.next/
coverage/
```

---

## 7. Production Readiness Checklist

### 7.1 Infrastructure & Deployment

- [ ] **CI/CD Pipeline**
  - [ ] GitHub Actions workflow for tests
  - [ ] Automated builds on commits
  - [ ] Deployment automation
  - [ ] Rollback procedures

- [ ] **Container Security**
  - [ ] Non-root users in Dockerfiles
  - [ ] Vulnerability scanning (Trivy, Snyk)
  - [ ] Image signing (Cosign)
  - [ ] Private registry usage

- [ ] **Secrets Management**
  - [ ] Remove all secrets from .env
  - [ ] Use AWS Secrets Manager / Vault
  - [ ] Automated secret rotation
  - [ ] Audit trail for access

- [ ] **Resource Management**
  - [ ] CPU/memory limits defined
  - [ ] Auto-scaling policies
  - [ ] Resource requests/limits
  - [ ] Performance baselines

### 7.2 Monitoring & Observability

- [ ] **Logging**
  - [ ] Centralized log aggregation (ELK, CloudWatch)
  - [ ] Structured logging (JSON format)
  - [ ] Log retention policy
  - [ ] Error tracking (Sentry, DataDog)

- [ ] **Metrics**
  - [ ] Application metrics (Prometheus)
  - [ ] Request latency tracking
  - [ ] Error rate monitoring
  - [ ] Database performance metrics

- [ ] **Alerting**
  - [ ] Critical error alerts
  - [ ] High latency alerts (>1s)
  - [ ] High error rate alerts (>5%)
  - [ ] Database connection alerts

- [ ] **Health Checks**
  - [ ] Readiness probe (ready to serve requests)
  - [ ] Liveness probe (process alive)
  - [ ] Startup probe (initialization complete)

### 7.3 Database & Data

- [ ] **Backup & Recovery**
  - [ ] Daily automated backups
  - [ ] Backup verification testing
  - [ ] Recovery time objective (RTO) defined
  - [ ] Recovery point objective (RPO) defined

- [ ] **Migrations**
  - [ ] Schema migration automation
  - [ ] Backward compatibility
  - [ ] Rollback procedures
  - [ ] Zero-downtime migration support

- [ ] **Scaling**
  - [ ] Database replication strategy
  - [ ] Connection pooling
  - [ ] Read replicas for analytics
  - [ ] Sharding strategy (if needed)

### 7.4 Security

- [ ] **API Security**
  - [ ] Rate limiting (currently missing!)
  - [ ] Input validation
  - [ ] SQL injection prevention
  - [ ] CSRF protection
  - [ ] API authentication (JWT)

- [ ] **Data Protection**
  - [ ] Encryption at rest
  - [ ] Encryption in transit (TLS)
  - [ ] Sensitive data masking in logs
  - [ ] Data retention policies

- [ ] **Access Control**
  - [ ] RBAC (Role-Based Access Control)
  - [ ] Multi-factor authentication
  - [ ] API key rotation
  - [ ] User permissions audit

### 7.5 Performance

- [ ] **Optimization**
  - [ ] Database query optimization
  - [ ] Caching strategy (Redis)
  - [ ] Frontend bundle optimization
  - [ ] Image optimization

- [ ] **Testing**
  - [ ] Load testing (k6, JMeter)
  - [ ] Performance benchmarks
  - [ ] Capacity planning
  - [ ] Regression testing

---

## 8. Specific Implementation Recommendations

### 8.1 Missing Critical: GitHub Actions CI/CD Pipeline

**Create: `.github/workflows/ci.yml`**

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

env:
  REGISTRY: ghcr.io

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [20.x]

    steps:
      - uses: actions/checkout@v4

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

      - name: Build
        run: npm run build

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./api/coverage/coverage-final.json

  build:
    needs: test
    runs-on: ubuntu-latest
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'

    permissions:
      contents: read
      packages: write

    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push API image
        uses: docker/build-push-action@v5
        with:
          context: ./api
          file: ./api/Dockerfile
          push: true
          tags: |
            ${{ env.REGISTRY }}/${{ github.repository }}/api:latest
            ${{ env.REGISTRY }}/${{ github.repository }}/api:${{ github.sha }}

      - name: Build and push Frontend image
        uses: docker/build-push-action@v5
        with:
          context: .
          file: ./Dockerfile
          push: true
          tags: |
            ${{ env.REGISTRY }}/${{ github.repository }}/frontend:latest
            ${{ env.REGISTRY }}/${{ github.repository }}/frontend:${{ github.sha }}

  security:
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

      - name: Upload Trivy results to GitHub Security
        uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: 'trivy-results.sarif'
```

### 8.2 Missing Critical: Production Dockerfiles

**Create: `Dockerfile` (Frontend Production)**

```dockerfile
# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 3: Runtime
FROM node:20-alpine

WORKDIR /app

# Security: Non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Copy from builder
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/package*.json ./

# Metadata
LABEL org.opencontainers.image.title="AlcheMix Frontend"
LABEL org.opencontainers.image.version="1.20.0"
LABEL org.opencontainers.image.description="Modern Cocktail Lab Management UI"

USER nextjs

EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/ || exit 1

CMD ["npm", "start"]
```

### 8.3 Missing Critical: API Rate Limiting Configuration

**Create: `api/src/config/rateLimiter.ts`**

```typescript
import rateLimit from 'express-rate-limit';

// General API rate limiter
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
});

// Stricter limiter for auth endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per windowMs
  skipSuccessfulRequests: true, // Don't count successful requests
  message: 'Too many login attempts, please try again later.',
});

// Strict limiter for AI endpoints (expensive)
export const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // 50 requests per hour
  message: 'AI service rate limit exceeded.',
});

// Store in Redis for distributed systems
// import RedisStore from 'rate-limit-redis';
// export const limiterWithRedis = rateLimit({
//   store: new RedisStore({
//     client: redisClient,
//     prefix: 'rl:',
//   }),
//   windowMs: 15 * 60 * 1000,
//   max: 100,
// });
```

**Apply in server.ts:**
```typescript
import { apiLimiter, authLimiter, aiLimiter } from './config/rateLimiter';

// Apply general rate limiter to API
app.use('/api/', apiLimiter);

// Apply stricter limiter to auth routes
app.use('/auth/', authLimiter);

// Apply AI rate limiter
app.use('/api/messages', aiLimiter);
```

### 8.4 Missing: Health Check Endpoints

**Create: `api/src/routes/health.ts`**

```typescript
import { Router } from 'express';
import { db } from '../database/db';

const router = Router();

// Liveness probe: Is the process alive?
router.get('/health/live', (req, res) => {
  res.json({
    status: 'alive',
    timestamp: new Date().toISOString(),
  });
});

// Readiness probe: Is the service ready to accept requests?
router.get('/health/ready', (req, res) => {
  try {
    // Check database connectivity
    db.prepare('SELECT 1').all();

    res.json({
      status: 'ready',
      checks: {
        database: 'ok',
        cache: 'ok',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'not-ready',
      checks: {
        database: 'failed',
      },
      error: (error as Error).message,
    });
  }
});

// Startup probe: Has initialization completed?
router.get('/health/startup', (req, res) => {
  // Could check schema version, migrations, etc.
  res.json({
    status: 'started',
    version: process.env.npm_package_version || '1.20.0',
  });
});

export default router;
```

**Apply in server.ts:**
```typescript
import healthRoutes from './routes/health';
app.use(healthRoutes);
```

**Update docker-compose.yml:**
```yaml
api:
  healthcheck:
    test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/health/ready"]
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 10s
```

### 8.5 Environment Parity: Create Production Overrides

**Create: `docker-compose.prod.yml`**

```yaml
version: '3.8'

services:
  neo4j:
    environment:
      - NEO4J_AUTH=neo4j/${NEO4J_PASSWORD}
    # Remove ports - use only via network
    ports: []
    restart: always
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G

  postgres:
    environment:
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    ports: []  # Remove port exposure
    restart: always
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 1G

  api:
    restart: always
    environment:
      - NODE_ENV=production
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 1G
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/health/ready"]
      interval: 30s
      timeout: 10s
      retries: 5
      start_period: 10s

  web:
    restart: always
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3001/"]
      interval: 30s
      timeout: 10s
      retries: 5
```

**Usage:**
```bash
# Production deployment
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

---

## 9. Security Enhancements

### 9.1 Current Security Implementation (Good)

✅ **Helmet.js** - HTTP security headers
✅ **CORS** - Cross-origin protection
✅ **JWT** - Authentication tokens
✅ **bcrypt** - Password hashing
✅ **Rate limiting** - Basic framework (needs configuration)
✅ **Input validation** - Implemented for routes
✅ **HTTPS redirect** - In production mode

### 9.2 Security Gaps & Recommendations

**Issue #1: Missing HSTS Header**
```typescript
// api/src/server.ts
app.use(helmet.hsts({
  maxAge: 31536000, // 1 year
  includeSubDomains: true,
  preload: true,
}));
```

**Issue #2: No CSRF Protection for Forms**
```bash
npm install csurf
npm install @types/csurf -D
```

**Issue #3: Missing Content Security Policy (CSP)**
```typescript
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "cdn.jsdelivr.net"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", "data:", "https:"],
    fontSrc: ["'self'", "fonts.googleapis.com"],
  },
}));
```

**Issue #4: No SQL Injection Prevention (currently safe with better-sqlite3)**
- Better-sqlite3 uses parameterized queries ✅
- Ensure all queries use parameters, no string concatenation

**Issue #5: Missing JWT Secret Rotation Strategy**
```typescript
// Implement key versioning:
// 1. Current key ID in JWT header
// 2. Keep multiple keys in rotation
// 3. Gradual key deprecation
```

---

## 10. Performance Optimization Opportunities

### 10.1 Database Optimization

**Current:** SQLite with better-sqlite3

**Recommendations:**
1. Add query logging to identify slow queries
2. Implement database indexes for common filters
3. Consider connection pooling once upgraded to PostgreSQL

**Query Analysis Needed:**
```typescript
// Add query performance logging
db.pragma('profile_output = query_profile.txt');
```

### 10.2 Frontend Bundle Optimization

**Current Next.js Setup:**
- ✅ Code splitting automatic
- ✅ Image optimization available
- ✅ CSS-in-JS (efficient)

**Recommendations:**
1. Analyze bundle with: `npm run analyze`
2. Lazy load components not needed on initial load
3. Implement Service Worker for offline support

### 10.3 API Response Optimization

**Recommendations:**
1. Add response compression (gzip)
2. Implement pagination (already done ✅)
3. Add caching headers for static assets
4. Consider GraphQL for complex queries (future)

---

## 11. Operational Runbooks

### 11.1 Deployment Procedure

**Pre-deployment Checklist:**
- [ ] All tests passing
- [ ] Code reviewed and approved
- [ ] Secrets configured in production environment
- [ ] Database backup created
- [ ] Rollback plan documented

**Deployment Steps:**
```bash
# 1. Build images
docker build -t alchemix:v1.20.1 -f Dockerfile .
docker build -t alchemix-api:v1.20.1 -f api/Dockerfile ./api

# 2. Test images
docker run --rm alchemix:v1.20.1 npm run build
docker run --rm alchemix-api:v1.20.1 npm run test

# 3. Push to registry
docker tag alchemix:v1.20.1 ghcr.io/user/alchemix:v1.20.1
docker push ghcr.io/user/alchemix:v1.20.1

# 4. Deploy with rolling update
docker-compose -f docker-compose.prod.yml up -d --no-deps api web
```

### 11.2 Rollback Procedure

```bash
# Immediate rollback to previous version
docker-compose -f docker-compose.prod.yml pull old-version
docker-compose -f docker-compose.prod.yml up -d

# Verify services
docker-compose ps
curl http://localhost:3000/health/ready
curl http://localhost:3001/health
```

### 11.3 Monitoring Queries

```bash
# Check service health
docker-compose ps

# View logs
docker logs alchemix-api --follow
docker logs alchemix-web --follow

# Monitor resource usage
docker stats alchemix-api alchemix-web alchemix-postgres

# Database integrity
# Connect to postgres and run:
# SELECT datname, pg_size_pretty(pg_database_size(datname)) FROM pg_database;
```

---

## 12. Cost Optimization

### 12.1 Current Infrastructure Costs (Estimated)

**Services Running:**
- Neo4j: 2GB RAM, 2 CPU = ~$100-150/month (premium)
- PostgreSQL: 1GB RAM, 1 CPU = ~$15-30/month
- Express API: 1GB RAM, 1 CPU = ~$10-20/month
- Next.js Frontend: 512MB RAM, 0.5 CPU = ~$5-10/month

**Monthly Estimate:** $130-210 (managed services)

### 12.2 Cost Reduction Strategies

1. **Use PostgreSQL instead of Neo4j for simple cases**
   - If graph features not heavily used, save $100+/month

2. **Implement caching (Redis)**
   - Reduce database queries by 50%
   - Reduce API response time
   - Cost: ~$15-20/month

3. **Use spot instances for non-critical workloads**
   - Testing, staging environments
   - Savings: 60-70% off regular pricing

4. **Auto-scale infrastructure**
   - Scale down at night/weekends
   - Scale up during peak hours
   - Can reduce costs by 40-50%

---

## Summary & Priority Actions

### Immediate (This Week)
1. **Revoke all exposed API keys** - CRITICAL SECURITY RISK
2. **Fix Express vulnerability** - Update to 4.22.0+
3. **Remove secrets from version control** - Use environment variables
4. **Create production Dockerfile for frontend** - Required for deployment
5. **Set up API rate limiting** - Security requirement

### Short-term (This Month)
1. Create GitHub Actions CI/CD pipeline
2. Implement production docker-compose.prod.yml
3. Add health check endpoints
4. Document deployment procedures
5. Set up monitoring/logging

### Medium-term (Next Quarter)
1. Implement centralized secrets management
2. Add comprehensive end-to-end tests
3. Set up database backup automation
4. Implement performance monitoring
5. Create disaster recovery procedures

---

## Appendix: Useful Commands

```bash
# Docker management
docker-compose up --build          # Build and start services
docker-compose logs -f api         # Follow API logs
docker-compose exec postgres psql -U memmachine -d memmachine  # DB shell
docker-compose down -v             # Stop and remove volumes (careful!)

# Testing
npm run test                        # Frontend tests
npm run test:coverage              # With coverage
cd api && npm test                 # API tests
npm run test:all                   # Everything

# Building
npm run build                       # Frontend only
cd api && npm run build            # API only
npm run build:all                  # Both

# Development
npm run dev:all                    # Both services
npm run dev                        # Frontend only
cd api && npm run dev              # API only

# Type checking
npm run type-check                 # Check all

# Security
npm audit                          # Check vulnerabilities
npm audit fix                      # Auto-fix where possible
```

---

**Document Version:** 1.0
**Last Updated:** December 2, 2025
**Next Review:** December 30, 2025
