# Quick Fix Reference

**For:** AlcheMix Infrastructure Review
**Use When:** Implementing the fixes from PRODUCTION_READINESS_ACTION_PLAN.md

---

## Fix #1: Update Express (10 minutes)

```bash
cd "/c/Users/Admin/OneDrive/Desktop/DEV Work/alchemix/api"
npm install express@^4.22.0
npm audit fix
npm test
git add package*.json
git commit -m "fix: update express to >= 4.22.0 (CVE-GHSA-pj86-cfqh-vqx6)"
```

---

## Fix #2: Create Environment Validation (45 minutes)

**File:** `api/src/config/validateEnv.ts`

```bash
touch api/src/config/validateEnv.ts
```

Then copy content from DEVOPS_IMPLEMENTATION_GUIDE.md section "Step 2: Create Environment Validation"

**Update:** `api/src/server.ts`
Add after existing imports:
```typescript
import { config } from './config/validateEnv';
```

**Test:**
```bash
cd api
npm run dev  # Should validate and start
```

---

## Fix #3: Create Rate Limiting Config (20 minutes)

**File:** `api/src/config/rateLimiter.ts`

```bash
touch api/src/config/rateLimiter.ts
```

Copy content from DEVOPS_IMPLEMENTATION_GUIDE.md section "Step 3"

**Update:** `api/src/server.ts`
Add after security middleware:
```typescript
import { apiLimiter, authLimiter, aiLimiter } from './config/rateLimiter';

app.use('/api/', apiLimiter);
app.use('/auth/', authLimiter);
app.use('/api/messages', aiLimiter);
```

**Test:**
```bash
# Trigger rate limit (should fail on 6th request)
for i in {1..6}; do
  curl -X POST http://localhost:3000/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"wrong"}'
  sleep 0.1
done
```

---

## Fix #4: Add Health Endpoints (30 minutes)

**File:** `api/src/routes/health.ts`

```bash
touch api/src/routes/health.ts
```

Copy content from DEVOPS_IMPLEMENTATION_GUIDE.md section "Step 4"

**Update:** `api/src/server.ts`
Add before error handler:
```typescript
import healthRoutes from './routes/health';
app.use(healthRoutes);
```

**Test:**
```bash
npm run dev
curl http://localhost:3000/health/ready
curl http://localhost:3000/health/live
curl http://localhost:3000/health/startup
```

---

## Fix #5: Create Production Frontend Dockerfile (30 minutes)

**File:** `Dockerfile.prod`

```bash
touch Dockerfile.prod
```

Copy content from DEVOPS_IMPLEMENTATION_GUIDE.md section "Step 5"

**Test:**
```bash
# Build
docker build -t alchemix-frontend:test -f Dockerfile.prod .

# Run
docker run -p 3001:3001 alchemix-frontend:test

# Test
curl http://localhost:3001
```

---

## Fix #6: Update API Dockerfile (15 minutes)

**File:** `api/Dockerfile`

Replace production stage (lines after "# Stage 2: Production") with content from DEVOPS_IMPLEMENTATION_GUIDE.md section "Step 6"

**Key Changes:**
- Add `dumb-init` for signal handling
- Create non-root user
- Update health check
- Add OCI metadata labels

**Test:**
```bash
cd api
docker build -t alchemix-api:test -f Dockerfile .
docker run -p 3000:3000 alchemix-api:test
curl http://localhost:3000/health/ready
```

---

## Fix #7: Create .github/workflows/ci.yml (2 hours)

```bash
mkdir -p .github/workflows
touch .github/workflows/ci.yml
```

Copy content from PRODUCTION_READINESS_ACTION_PLAN.md section ci.yml

**Test:**
```bash
git add .github/workflows/ci.yml
git commit -m "ci: add GitHub Actions pipeline"
git push  # Will trigger workflow on GitHub
```

---

## Fix #8: Create docker-compose.prod.yml (30 minutes)

**File:** `docker-compose.prod.yml`

```bash
touch docker-compose.prod.yml
```

Copy content from PRODUCTION_READINESS_ACTION_PLAN.md section docker-compose.prod.yml

**Test:**
```bash
# Verify syntax
docker-compose -f docker-compose.yml -f docker-compose.prod.yml config > /dev/null && echo "Valid"
```

---

## Fix #9: Create Production Environment File (15 minutes)

**File:** `api/.env.production`

```bash
touch api/.env.production
```

Copy template from DEVOPS_IMPLEMENTATION_GUIDE.md section "Step 9"

**Important:** Do NOT commit actual secrets!

```bash
# Add to .gitignore
echo "api/.env.production.local" >> .gitignore
git add .gitignore api/.env.production
git commit -m "chore: add environment template for production"
```

---

## Fix #10: Rotate Secrets (CRITICAL - First Priority!)

```bash
# 1. Revoke old keys
# - OpenAI: https://platform.openai.com/account/api-keys
# - Anthropic: Account settings
# - JWT: Generate new one

# 2. Generate new JWT_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Copy output and save securely

# 3. Remove .env from git history
git-filter-repo --invert-paths --path .env
git reflog expire --expire=now --all
git gc --prune=now

# 4. Clean and verify
git log --oneline -n 5  # Should not show .env commits
git log -p --all -- .env | head -5  # Should be empty
```

---

## Testing Checklist

After each fix, verify:

```bash
# Type checking
npm run type-check

# Linting
npm run lint

# Tests
npm test
cd api && npm test

# Build
npm run build
cd api && npm run build

# Docker build
docker build -t alchemix-api:test -f api/Dockerfile ./api
docker build -t alchemix-web:test -f Dockerfile.prod .
```

---

## Verification Commands

### API Health
```bash
# All health endpoints
curl http://localhost:3000/health
curl http://localhost:3000/health/live
curl http://localhost:3000/health/ready
curl http://localhost:3000/health/startup
```

### Rate Limiting
```bash
# Test auth rate limiting
for i in {1..6}; do
  curl -X POST http://localhost:3000/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"wrong"}' \
    -w "\nStatus: %{http_code}\n"
  sleep 0.5
done
# Should see 429 on attempts 5-6
```

### Docker Compose
```bash
# Syntax check
docker-compose -f docker-compose.yml -f docker-compose.prod.yml config > /dev/null

# Start services
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Check health
docker-compose ps
curl http://localhost:3000/health/ready
curl http://localhost:3001

# View logs
docker-compose logs -f api
docker-compose logs -f web

# Cleanup
docker-compose down
```

---

## Git Commits in Order

1. `fix: revoke all exposed API keys`
2. `fix: update express to >= 4.22.0`
3. `feat: add environment validation on startup`
4. `feat: implement API rate limiting`
5. `feat: add health check endpoints`
6. `feat: create production frontend Dockerfile`
7. `chore: update API Dockerfile for production`
8. `ci: add GitHub Actions CI/CD pipeline`
9. `chore: add production docker-compose override`
10. `chore: add environment templates`

---

## Rollback Procedures

If something breaks:

```bash
# Revert last commit
git revert HEAD

# Revert to specific commit
git revert <commit-hash>

# Hard reset (ONLY if not pushed!)
git reset --hard <commit-hash>

# Check logs
git log --oneline -n 10
```

---

## Quick Troubleshooting

### Docker Build Fails
```bash
# Clear build cache
docker builder prune -a

# Try again
docker build -t alchemix-api:test -f api/Dockerfile ./api

# Debug with verbose
docker build --progress=plain -t alchemix-api:test -f api/Dockerfile ./api
```

### Tests Fail After Changes
```bash
# Clear node_modules
rm -rf node_modules api/node_modules
npm run install:all

# Run tests again
npm run test:all
```

### Port Already in Use
```bash
# Linux/Mac
lsof -i :3000
kill -9 <PID>

# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### Database Issues
```bash
# Reset SQLite database
rm -rf api/data/

# Reinitialize
cd api && npm run dev
```

---

## Implementation Time Estimate

| Fix | Time | Priority |
|-----|------|----------|
| #1: Express Update | 10 min | 🔴 |
| #2: Env Validation | 45 min | 🔴 |
| #3: Rate Limiting | 20 min | 🔴 |
| #4: Health Endpoints | 30 min | 🔴 |
| #5: Frontend Dockerfile | 30 min | 🔴 |
| #6: API Dockerfile | 15 min | 🔴 |
| #7: GitHub Actions | 120 min | 🟠 |
| #8: Compose Override | 30 min | 🟠 |
| #9: Env Templates | 15 min | 🟠 |
| #10: Rotate Secrets | 30 min | 🔴 |
| **TOTAL (Critical)** | **3.5 hours** | |
| **TOTAL (High Priority)** | **2.5 hours** | |
| **TOTAL (All Fixes)** | **6 hours** | |

---

## Resources Needed

### Tools to Install
```bash
npm install dumb-init  # For Docker signal handling

# Optional for advanced deployments
npm install -g git-filter-repo  # For secret removal from history
pip install git-filter-repo  # Python version
```

### API Keys to Generate
- New JWT_SECRET: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- Database password: `openssl rand -base64 32`
- Neo4j password: `openssl rand -base64 32`

### Secrets to Rotate
- OPENAI_API_KEY (get from https://platform.openai.com/account/api-keys)
- ANTHROPIC_API_KEY (from your Anthropic dashboard)
- JWT_SECRET (generate new one)

---

**Created:** December 2, 2025
**Version:** 1.0
**Last Updated:** December 2, 2025
