# Redis Migration Plan for Production Scalability

**Date:** November 11, 2025
**Version:** Phase 3 (Future Implementation)
**Priority:** CRITICAL (for multi-instance deployments)
**Status:** DOCUMENTED - Implementation Required Before Scaling

---

## 🎯 Executive Summary

**Current Issue:** AlcheMix uses in-memory storage for rate limiting and token blacklist, which prevents horizontal scaling and creates inconsistent state across multiple server instances.

**Required Action:** Migrate to Redis before deploying with multiple instances (Kubernetes replicas, load balancers, cloud auto-scaling).

**Impact:**
- ✅ Enables horizontal scaling (multiple server instances)
- ✅ Consistent rate limiting across all instances
- ✅ Shared token blacklist for proper logout
- ✅ Session management for distributed systems
- ✅ Production-grade performance and reliability

---

## ⚠️ Critical Problems with Current Implementation

### 1. Rate Limiting (api/src/middleware/rateLimiter.ts)

**Current Implementation:**
```typescript
// In-memory Map - DOES NOT WORK with multiple instances
const requestCounts = new Map<string, { count: number; resetAt: number }>();
```

**Problem:**
- Each server instance has its own requestCounts Map
- User can bypass rate limits by hitting different servers
- No synchronization across instances
- Rate limits reset when server restarts

**Security Risk:** **HIGH**
- Attackers can bypass rate limits by distributing requests across instances
- Brute force attacks become feasible again
- DoS protection ineffective

**Example Failure Scenario:**
```
User makes 100 requests to Server A → Rate limited (5/15min)
User makes 100 requests to Server B → NOT rate limited (different memory)
User makes 100 requests to Server C → NOT rate limited (different memory)
TOTAL: 300 requests from same user, bypassing 5/15min limit
```

### 2. Token Blacklist (api/src/middleware/auth.ts)

**Current Implementation:**
```typescript
// In-memory Set - DOES NOT WORK with multiple instances
const tokenBlacklist = new Set<string>();
```

**Problem:**
- User logs out on Server A (token added to blacklist)
- Token still valid on Server B and Server C (different memory)
- User can continue using invalidated tokens
- Security breach: Logout doesn't actually log out

**Security Risk:** **CRITICAL**
- Session fixation attacks possible
- Compromised tokens remain valid
- Logout mechanism completely broken in multi-instance setup

**Example Failure Scenario:**
```
1. User logs in → Token: abc123
2. User logs out on Server A → Token blacklisted on Server A only
3. User sends request to Server B with Token: abc123 → Still authenticated!
4. User continues making authenticated requests → Logout meaningless
```

### 3. Startup Issues

**Current Implementation:**
```typescript
// Cleanup runs on each instance independently
setInterval(() => {
  const now = Date.now();
  for (const [token, expiry] of tokenBlacklist.entries()) {
    if (expiry < now) tokenBlacklist.delete(token);
  }
}, 900000); // 15 minutes
```

**Problem:**
- Cleanup doesn't clear tokens from other instances
- Memory leaks accumulate across restarts
- No persistence - all blacklisted tokens lost on restart

---

## 🏗️ Migration Architecture

### Target Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Load Balancer                      │
│            (nginx / AWS ALB / GCP LB)               │
└────────────┬──────────────┬────────────┬───────────┘
             │              │            │
       ┌─────▼─────┐  ┌────▼────┐  ┌───▼──────┐
       │ Server A  │  │ Server B│  │ Server C │
       │ (Pod 1)   │  │ (Pod 2) │  │ (Pod 3)  │
       └─────┬─────┘  └────┬────┘  └───┬──────┘
             │              │            │
             └──────────────┼────────────┘
                            │
                    ┌───────▼────────┐
                    │  Redis Cluster │
                    │  (Shared State)│
                    │                │
                    │  - Rate limits │
                    │  - Blacklist   │
                    │  - Sessions    │
                    └────────────────┘
```

---

## 📋 Implementation Steps

### Phase 1: Redis Setup (2 hours)

**1.1 Install Redis Client Library**
```bash
cd api
npm install ioredis
npm install --save-dev @types/ioredis
```

**1.2 Create Redis Connection Utility**

**File:** `api/src/utils/redis.ts`
```typescript
/**
 * Redis Connection Manager
 *
 * Purpose: Centralized Redis client with connection pooling
 *
 * Features:
 * - Automatic reconnection on failure
 * - Connection pooling for performance
 * - Health checks and monitoring
 * - Environment-based configuration
 */

import Redis from 'ioredis';
import { logger } from './logger';

/**
 * Redis connection options
 */
const redisOptions: Redis.RedisOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),

  // Connection pool settings
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  enableOfflineQueue: true,

  // Reconnection strategy
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    logger.warn('Redis connection retry', { attempt: times, delay });
    return delay;
  },

  // Connection timeout
  connectTimeout: 10000,

  // TLS for production (AWS ElastiCache, Redis Cloud)
  ...(process.env.REDIS_TLS === 'true' && {
    tls: {
      rejectUnauthorized: false,
    },
  }),
};

/**
 * Redis client singleton
 */
export const redis = new Redis(redisOptions);

/**
 * Redis connection event handlers
 */
redis.on('connect', () => {
  logger.info('Redis connection established', {
    host: redisOptions.host,
    port: redisOptions.port,
    db: redisOptions.db,
  });
});

redis.on('ready', () => {
  logger.info('Redis client ready');
});

redis.on('error', (error) => {
  logger.error('Redis connection error', {
    error: error.message,
    stack: error.stack,
  });
});

redis.on('close', () => {
  logger.warn('Redis connection closed');
});

redis.on('reconnecting', () => {
  logger.info('Redis reconnecting');
});

/**
 * Health check function
 */
export async function checkRedisHealth(): Promise<boolean> {
  try {
    await redis.ping();
    return true;
  } catch (error) {
    logger.error('Redis health check failed', { error });
    return false;
  }
}

/**
 * Graceful shutdown
 */
export async function disconnectRedis(): Promise<void> {
  try {
    await redis.quit();
    logger.info('Redis connection closed gracefully');
  } catch (error) {
    logger.error('Error closing Redis connection', { error });
  }
}
```

**1.3 Update Environment Variables**

**File:** `api/.env.example`
```env
# Redis Configuration (required for production)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
REDIS_TLS=false

# For AWS ElastiCache / Redis Cloud
# REDIS_HOST=your-cluster.cache.amazonaws.com
# REDIS_TLS=true
```

---

### Phase 2: Migrate Rate Limiter (3 hours)

**2.1 Create Redis-Based Rate Limiter**

**File:** `api/src/middleware/rateLimiter.redis.ts`
```typescript
/**
 * Redis-Based Rate Limiter Middleware
 *
 * Purpose: Distributed rate limiting using Redis for multi-instance deployments
 *
 * Features:
 * - Shared state across all server instances
 * - Sliding window algorithm for accurate limiting
 * - Atomic operations (INCR + EXPIRE)
 * - Per-endpoint and per-user limits
 *
 * Compliance:
 * - OWASP API Security Top 10: API4:2023 Unrestricted Resource Consumption
 */

import { Request, Response, NextFunction } from 'express';
import { redis } from '../utils/redis';
import { logger, logSecurityEvent } from '../utils/logger';
import { RateLimitError } from '../errors';

export interface RateLimitOptions {
  windowMs: number;  // Time window in milliseconds
  max: number;       // Max requests per window
  keyPrefix: string; // Redis key prefix (e.g., 'ratelimit:auth')
}

/**
 * Create Redis-based rate limiter middleware
 *
 * @param options - Rate limit configuration
 * @returns Express middleware
 */
export function createRateLimiter(options: RateLimitOptions) {
  const { windowMs, max, keyPrefix } = options;
  const windowSeconds = Math.ceil(windowMs / 1000);

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Generate unique key per IP/user + endpoint
      const identifier = req.ip || 'unknown';
      const key = `${keyPrefix}:${identifier}`;

      // Use Redis pipeline for atomic operations
      const pipeline = redis.pipeline();

      // Increment counter
      pipeline.incr(key);

      // Set expiry (only if key is new)
      pipeline.expire(key, windowSeconds, 'NX');

      // Get TTL
      pipeline.ttl(key);

      // Execute pipeline
      const results = await pipeline.exec();

      if (!results) {
        throw new Error('Redis pipeline execution failed');
      }

      // Parse results
      const count = results[0][1] as number;
      const ttl = results[2][1] as number;

      // Calculate reset time
      const resetAt = Date.now() + (ttl * 1000);

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, max - count));
      res.setHeader('X-RateLimit-Reset', new Date(resetAt).toISOString());

      // Check if limit exceeded
      if (count > max) {
        logSecurityEvent('Rate limit exceeded', {
          requestId: req.id,
          ip: identifier,
          path: req.path,
          count,
          limit: max,
          resetAt: new Date(resetAt).toISOString(),
        });

        throw new RateLimitError('Too many requests. Please try again later.', {
          retryAfter: Math.ceil(ttl),
        });
      }

      // Log metrics for monitoring
      logger.debug('Rate limit check passed', {
        requestId: req.id,
        key,
        count,
        max,
        remaining: max - count,
      });

      next();
    } catch (error: any) {
      // If Redis is down, fail open (allow request) in development
      // In production, you may want to fail closed (reject request)
      if (error instanceof RateLimitError) {
        throw error; // Rate limit exceeded - reject
      }

      logger.error('Rate limiter error - failing open', {
        requestId: req.id,
        error: error.message,
        failOpen: process.env.NODE_ENV === 'development',
      });

      if (process.env.NODE_ENV === 'production') {
        // Fail closed in production (conservative approach)
        throw new RateLimitError('Rate limiting service unavailable');
      } else {
        // Fail open in development (let request through)
        next();
      }
    }
  };
}

/**
 * Pre-configured rate limiters
 */
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  keyPrefix: 'ratelimit:auth',
});

export const apiRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  keyPrefix: 'ratelimit:api',
});
```

**2.2 Update server.ts**

Replace in-memory rate limiter imports with Redis-based ones:

```typescript
// OLD (remove):
// import { authRateLimiter, apiRateLimiter } from './middleware/rateLimiter';

// NEW (add):
import { authRateLimiter, apiRateLimiter } from './middleware/rateLimiter.redis';
import { redis, disconnectRedis, checkRedisHealth } from './utils/redis';

// Update graceful shutdown to close Redis
async function gracefulShutdown(signal: string) {
  logger.info(`Received ${signal} - Starting graceful shutdown`);

  server.close(async () => {
    logger.info('HTTP server closed');

    // Close database
    db.close();
    logger.info('Database connection closed');

    // Close Redis
    await disconnectRedis();

    logger.info('Graceful shutdown complete');
    process.exit(0);
  });
}

// Update health check to include Redis
app.get('/health', async (req, res) => {
  const redisHealthy = await checkRedisHealth();

  res.json({
    status: redisHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      database: 'ok',
      redis: redisHealthy ? 'ok' : 'down',
    },
  });
});
```

---

### Phase 3: Migrate Token Blacklist (3 hours)

**3.1 Create Redis-Based Token Blacklist**

**File:** `api/src/utils/tokenBlacklist.redis.ts`
```typescript
/**
 * Redis-Based Token Blacklist
 *
 * Purpose: Distributed token blacklist using Redis for multi-instance deployments
 *
 * Features:
 * - Shared state across all server instances
 * - Automatic expiry (no cleanup needed)
 * - Atomic operations
 * - Logout works consistently
 *
 * Security:
 * - Prevents session fixation
 * - Ensures logout actually logs out
 * - Required for OWASP A07:2021 compliance
 */

import { redis } from './redis';
import { logger } from './logger';

/**
 * Blacklist a token (on logout or revocation)
 *
 * @param token - JWT token to blacklist
 * @param expiresAt - Token expiry timestamp (milliseconds)
 */
export async function blacklistToken(token: string, expiresAt: number): Promise<void> {
  try {
    const key = `blacklist:${token}`;
    const ttl = Math.ceil((expiresAt - Date.now()) / 1000);

    // Only blacklist if token hasn't expired yet
    if (ttl > 0) {
      // Store in Redis with automatic expiry
      await redis.setex(key, ttl, '1');

      logger.info('Token blacklisted', {
        tokenPrefix: token.substring(0, 20) + '...',
        ttl,
        expiresAt: new Date(expiresAt).toISOString(),
      });
    }
  } catch (error: any) {
    logger.error('Failed to blacklist token', {
      error: error.message,
      tokenPrefix: token.substring(0, 20) + '...',
    });
    throw error;
  }
}

/**
 * Check if a token is blacklisted
 *
 * @param token - JWT token to check
 * @returns True if blacklisted, false otherwise
 */
export async function isTokenBlacklisted(token: string): Promise<boolean> {
  try {
    const key = `blacklist:${token}`;
    const result = await redis.get(key);

    return result !== null;
  } catch (error: any) {
    logger.error('Failed to check token blacklist', {
      error: error.message,
      tokenPrefix: token.substring(0, 20) + '...',
    });

    // Fail secure: If Redis is down, consider token blacklisted
    // This prevents logged-out users from accessing the system
    return true;
  }
}

/**
 * Get blacklist statistics
 *
 * @returns Count of blacklisted tokens
 */
export async function getBlacklistStats(): Promise<{ count: number }> {
  try {
    // Count keys matching blacklist pattern
    const keys = await redis.keys('blacklist:*');

    return {
      count: keys.length,
    };
  } catch (error: any) {
    logger.error('Failed to get blacklist stats', { error: error.message });
    return { count: 0 };
  }
}
```

**3.2 Update auth.ts**

Replace in-memory Set with Redis-based blacklist:

```typescript
// OLD (remove):
// const tokenBlacklist = new Set<string>();
// function blacklistToken(token: string, expiresAt: number) { ... }
// function isTokenBlacklisted(token: string) { ... }

// NEW (add):
import { blacklistToken, isTokenBlacklisted } from '../utils/tokenBlacklist.redis';

// Update logout route to use async blacklist
router.post('/logout', authMiddleware, asyncHandler(async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '') || '';

  if (token) {
    const decoded = jwt.decode(token) as any;
    const expiresAt = decoded.exp * 1000; // Convert to milliseconds

    // Blacklist token in Redis (async)
    await blacklistToken(token, expiresAt);

    logger.info('User logged out', {
      requestId: req.id,
      userId: (req as any).user.userId,
      tokenExpiry: new Date(expiresAt).toISOString(),
    });
  }

  res.json({ success: true, message: 'Logged out successfully' });
}));

// Update auth middleware to check Redis blacklist (async)
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedError('No token provided');
    }

    const token = authHeader.replace('Bearer ', '');

    // Check blacklist in Redis (async)
    const isBlacklisted = await isTokenBlacklisted(token);
    if (isBlacklisted) {
      throw new UnauthorizedError('Token has been revoked');
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;

    // Attach user to request
    (req as any).user = { userId: decoded.userId, email: decoded.email };

    next();
  } catch (error: any) {
    if (error instanceof UnauthorizedError) {
      throw error;
    }
    throw new UnauthorizedError('Invalid token');
  }
}
```

---

### Phase 4: Testing & Validation (2 hours)

**4.1 Local Testing with Docker Redis**

```bash
# Start Redis container
docker run --name alchemix-redis -p 6379:6379 -d redis:alpine

# Update .env
echo "REDIS_HOST=localhost" >> api/.env
echo "REDIS_PORT=6379" >> api/.env

# Start dev server
cd api && npm run dev
```

**4.2 Test Rate Limiting**

```bash
# Test auth rate limit (should block after 5 requests)
for i in {1..10}; do
  curl -X POST http://localhost:3000/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"wrong"}' \
    -w "\nStatus: %{http_code}\n"
done

# Verify Redis keys
docker exec -it alchemix-redis redis-cli
> KEYS ratelimit:*
> TTL ratelimit:auth:127.0.0.1
> GET ratelimit:auth:127.0.0.1
```

**4.3 Test Token Blacklist**

```bash
# 1. Login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}' \
  | jq -r '.token' > token.txt

TOKEN=$(cat token.txt)

# 2. Access protected route (should work)
curl http://localhost:3000/api/inventory \
  -H "Authorization: Bearer $TOKEN"

# 3. Logout
curl -X POST http://localhost:3000/auth/logout \
  -H "Authorization: Bearer $TOKEN"

# 4. Try to access again (should fail with 401)
curl http://localhost:3000/api/inventory \
  -H "Authorization: Bearer $TOKEN"

# Verify Redis blacklist
docker exec -it alchemix-redis redis-cli
> KEYS blacklist:*
> TTL blacklist:eyJhbGc...
> GET blacklist:eyJhbGc...
```

**4.4 Multi-Instance Test**

```bash
# Start 3 instances on different ports
PORT=3001 npm run dev &
PORT=3002 npm run dev &
PORT=3003 npm run dev &

# Test rate limiting across instances
# Should be limited to 5 total requests, not 5 per instance
for port in 3001 3002 3003 3001 3002 3003; do
  curl -X POST http://localhost:$port/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"wrong"}' \
    -w "\nPort $port - Status: %{http_code}\n"
done
```

---

### Phase 5: Production Deployment (4 hours)

**5.1 AWS ElastiCache Setup**

```bash
# Create Redis cluster via AWS Console or Terraform
aws elasticache create-replication-group \
  --replication-group-id alchemix-redis \
  --replication-group-description "AlcheMix production Redis" \
  --engine redis \
  --cache-node-type cache.t3.micro \
  --num-cache-clusters 2 \
  --automatic-failover-enabled \
  --multi-az-enabled \
  --at-rest-encryption-enabled \
  --transit-encryption-enabled

# Get endpoint
aws elasticache describe-replication-groups \
  --replication-group-id alchemix-redis \
  | jq -r '.ReplicationGroups[0].NodeGroups[0].PrimaryEndpoint.Address'
```

**5.2 Update Production Environment**

```env
# Production .env
REDIS_HOST=alchemix-redis.abc123.ng.0001.use1.cache.amazonaws.com
REDIS_PORT=6379
REDIS_TLS=true
```

**5.3 Kubernetes Deployment**

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: alchemix-api
spec:
  replicas: 3  # Multiple instances now supported!
  selector:
    matchLabels:
      app: alchemix-api
  template:
    metadata:
      labels:
        app: alchemix-api
    spec:
      containers:
      - name: api
        image: alchemix-api:latest
        env:
        - name: REDIS_HOST
          valueFrom:
            secretKeyRef:
              name: alchemix-secrets
              key: redis-host
        - name: REDIS_PASSWORD
          valueFrom:
            secretKeyRef:
              name: alchemix-secrets
              key: redis-password
        - name: REDIS_TLS
          value: "true"
```

---

## 📊 Performance Comparison

### Before Migration (In-Memory)

| Metric | Single Instance | Multiple Instances |
|--------|----------------|-------------------|
| **Rate Limiting** | ✅ Works | ❌ Broken (per-instance) |
| **Token Blacklist** | ✅ Works | ❌ Broken (per-instance) |
| **Logout Security** | ✅ Secure | ❌ Insecure |
| **Horizontal Scaling** | ❌ No | ❌ No |
| **Restart Durability** | ❌ Lost | ❌ Lost |
| **Memory Usage** | Low | Low (duplicated) |

### After Migration (Redis)

| Metric | Single Instance | Multiple Instances |
|--------|----------------|-------------------|
| **Rate Limiting** | ✅ Works | ✅ Works (shared) |
| **Token Blacklist** | ✅ Works | ✅ Works (shared) |
| **Logout Security** | ✅ Secure | ✅ Secure |
| **Horizontal Scaling** | ✅ Yes | ✅ Yes |
| **Restart Durability** | ✅ Persisted | ✅ Persisted |
| **Memory Usage** | Low (offloaded) | Low (shared) |
| **Latency Overhead** | +2-5ms | +2-5ms |

---

## 💰 Cost Estimates

### Development
- **Redis Container (Docker):** Free
- **Time Investment:** 10 hours

### Production

**AWS ElastiCache (US-East-1):**
- **cache.t3.micro (1 node):** $0.017/hour = ~$12/month
- **cache.t3.small (2 nodes, Multi-AZ):** $0.034/hour × 2 = ~$50/month
- **cache.m6g.large (3 nodes, high traffic):** $0.182/hour × 3 = ~$400/month

**Redis Cloud (managed):**
- **Free tier:** 30MB RAM (sufficient for testing)
- **Starter:** $7/month (1GB RAM)
- **Production:** $40/month (10GB RAM, Multi-AZ)

**Upstash (serverless Redis):**
- **Free tier:** 10,000 requests/day
- **Pay-as-you-go:** $0.20 per 100K requests

---

## ✅ Migration Checklist

### Pre-Migration
- [ ] Document current in-memory implementation
- [ ] Set up local Redis for testing
- [ ] Create Redis utility module
- [ ] Write migration tests

### Migration
- [ ] Implement Redis-based rate limiter
- [ ] Test rate limiter with multiple instances
- [ ] Implement Redis-based token blacklist
- [ ] Test logout across instances
- [ ] Update graceful shutdown to close Redis
- [ ] Update health check to include Redis status

### Testing
- [ ] Test rate limiting (single instance)
- [ ] Test rate limiting (multi-instance)
- [ ] Test token blacklist (single instance)
- [ ] Test token blacklist (multi-instance)
- [ ] Test logout functionality
- [ ] Load test with ab or k6
- [ ] Failover test (kill Redis, verify fallback)

### Production Deployment
- [ ] Provision Redis cluster (ElastiCache / Redis Cloud)
- [ ] Configure TLS encryption
- [ ] Set up Redis monitoring (CloudWatch / DataDog)
- [ ] Configure backup strategy
- [ ] Update Kubernetes deployment (increase replicas)
- [ ] Deploy to staging environment
- [ ] Run smoke tests
- [ ] Deploy to production
- [ ] Monitor for 24 hours

---

## 🚨 Rollback Plan

If Redis migration causes issues in production:

1. **Immediate:** Revert to single-instance deployment (replicas: 1)
2. **Code Rollback:** Revert to in-memory implementation (Git tag)
3. **Redis Cleanup:** Delete Redis keys (FLUSHDB)
4. **Post-Mortem:** Analyze logs, identify root cause

---

## 📚 References

- **Redis Documentation:** https://redis.io/docs/
- **ioredis Client:** https://github.com/luin/ioredis
- **Rate Limiting Patterns:** https://redis.io/docs/manual/patterns/rate-limiter/
- **AWS ElastiCache:** https://docs.aws.amazon.com/elasticache/
- **Redis Cloud:** https://redis.com/redis-enterprise-cloud/overview/

---

**⚠️ CRITICAL REMINDER:** Do NOT deploy multiple server instances until this migration is complete. Current implementation will break security (logout) and rate limiting with multiple instances.

**Timeline:** Implement in Phase 3 (after Medium Priority optimizations) or immediately before scaling to multiple instances.

---

**Status:** DOCUMENTED - Ready for Implementation
**Last Updated:** November 11, 2025
