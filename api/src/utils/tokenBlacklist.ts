import type Database from 'better-sqlite3';
import { db } from '../database/db';

/**
 * Token Blacklist System
 *
 * SECURITY FIX #7: In-memory token revocation for immediate logout.
 *
 * Purpose:
 * - Immediately invalidate JWT tokens on logout
 * - Revoke tokens on security events (password change, suspicious activity)
 * - Prevent token replay attacks after logout
 * - Enable forced logout (admin/security features)
 *
 * Current Implementation: In-Memory Store
 * - Simple Map<string, number> stores token → expiry timestamp
 * - Automatic cleanup of expired tokens
 * - No external dependencies (Redis not required)
 * - Suitable for single-server deployments
 *
 * Why In-Memory vs Redis?
 *
 * In-Memory (Current):
 * ✅ Simple (no external service needed)
 * ✅ Fast (sub-millisecond lookup)
 * ✅ No network latency
 * ✅ Good for MVP/small deployments
 * ❌ Lost on server restart (tokens valid until expiry)
 * ❌ Not shared across multiple servers (load balancer issues)
 *
 * Redis (Phase 3+):
 * ✅ Persistent (survives server restarts)
 * ✅ Shared across multiple servers
 * ✅ Scalable (millions of tokens)
 * ✅ Built-in TTL (automatic expiry)
 * ❌ External dependency
 * ❌ Network latency (~1ms)
 * ❌ Infrastructure complexity
 *
 * Security Properties:
 * - Blacklisted tokens are rejected even if signature is valid
 * - Tokens expire from blacklist automatically (memory efficient)
 * - Cleanup runs every 15 minutes to free memory
 * - Thread-safe (JavaScript is single-threaded)
 *
 * Performance:
 * - Add token: O(1) - Map set operation
 * - Check token: O(1) - Map get operation
 * - Cleanup: O(n) - Run every 15 minutes
 * - Memory: ~100 bytes per token
 * - Example: 10,000 active blacklisted tokens = ~1MB memory
 *
 * Example Usage:
 * ```typescript
 * // On logout
 * const token = req.headers.authorization?.substring(7);
 * const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
 * tokenBlacklist.add(token, decoded.exp);
 *
 * // In auth middleware
 * if (tokenBlacklist.isBlacklisted(token)) {
 *   return res.status(401).json({ error: 'Token has been revoked' });
 * }
 * ```
 */

/**
 * Token Blacklist Class
 *
 * Manages blacklisted tokens with automatic expiry cleanup.
 */
class TokenBlacklist {
  /**
   * Blacklist Storage
   *
   * Map structure:
   * - Key: JWT token string (full token, not just jti)
   * - Value: Expiry timestamp (Unix timestamp in seconds)
   *
   * Why store full token instead of jti (token ID)?
   * - Our current JWTs don't include jti (see Fix #2 - JWT improvements)
   * - Full token works but is less efficient (larger keys)
   * - Phase 3: Add jti to JWT payload, store jti instead
   *
   * Example Entry:
   * {
   *   "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...": 1699632000
   * }
   *
   * Memory Calculation:
   * - Token length: ~200 characters
   * - Expiry: 8 bytes (number)
   * - Map overhead: ~50 bytes
   * - Total per entry: ~258 bytes
   * - 10,000 tokens: ~2.5MB
   */
  private blacklist: Map<string, number>;
  private insertStmt: Database.Statement<[string, number]>;
  private selectStmt: Database.Statement<[string]>;
  private deleteStmt: Database.Statement<[string]>;
  private cleanupStmt: Database.Statement<[number]>;

  /**
   * Cleanup Interval Timer
   *
   * Reference to setInterval timer for cleanup task.
   * Stored so we can clear it on graceful shutdown.
   */
  private cleanupInterval: NodeJS.Timeout;

  /**
   * Constructor
   *
   * Initializes empty blacklist and starts cleanup timer.
   *
   * Cleanup Schedule:
   * - Runs every 15 minutes (900,000ms)
   * - Removes expired tokens from blacklist
   * - Prevents memory growth over time
   *
   * Why 15 minutes?
   * - Balances memory usage vs CPU overhead
   * - Typical token lifetime is 7 days (10,080 minutes)
   * - Cleanup 672 times over token lifetime
   * - Not too frequent (low CPU), not too rare (bounded memory)
   */
  constructor() {
    this.blacklist = new Map();
    this.insertStmt = db.prepare('INSERT OR REPLACE INTO token_blacklist (token, expires_at) VALUES (?, ?)');
    this.selectStmt = db.prepare('SELECT expires_at FROM token_blacklist WHERE token = ?');
    this.deleteStmt = db.prepare('DELETE FROM token_blacklist WHERE token = ?');
    this.cleanupStmt = db.prepare('DELETE FROM token_blacklist WHERE expires_at < ?');

    // Start cleanup task (runs every 15 minutes)
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 15 * 60 * 1000); // 15 minutes in milliseconds

    this.loadFromDatabase();

    console.log('🔒 Token blacklist initialized');
    console.log('   Cleanup interval: Every 15 minutes');
  }

  /**
   * Load persisted blacklist entries from database on startup.
   * Removes any expired entries encountered during hydration.
   */
  private loadFromDatabase(): void {
    const now = Math.floor(Date.now() / 1000);
    const rows = db
      .prepare('SELECT token, expires_at FROM token_blacklist')
      .all() as { token: string; expires_at: number }[];

    for (const row of rows) {
      if (row.expires_at > now) {
        this.blacklist.set(row.token, row.expires_at);
      } else {
        this.deleteStmt.run(row.token);
      }
    }
  }

  /**
   * Add Token to Blacklist
   *
   * Revokes a token immediately by adding it to the blacklist.
   *
   * @param token - Full JWT token string
   * @param expiryTimestamp - Unix timestamp when token expires (from JWT 'exp' claim)
   *
   * Workflow:
   * 1. User logs out → POST /auth/logout
   * 2. Server extracts token from Authorization header
   * 3. Server decodes token to get expiry (exp claim)
   * 4. Server adds token to blacklist with expiry
   * 5. Future requests with this token are rejected
   *
   * Why store expiry?
   * - Allows automatic cleanup of expired tokens
   * - Prevents blacklist from growing indefinitely
   * - Memory efficient (expired tokens are useless anyway)
   *
   * Example:
   * ```typescript
   * const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";
   * const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
   * tokenBlacklist.add(token, decoded.exp);
   * // Token now blacklisted until expiry timestamp
   * ```
   *
   * Edge Cases:
   * - If token already blacklisted: Overwrites with new expiry (no-op)
   * - If expiry is in the past: Token is expired anyway (but still added for safety)
   * - If expiry is missing: Token won't be added (caller must provide expiry)
   */
  add(token: string, expiryTimestamp: number): void {
    this.blacklist.set(token, expiryTimestamp);
    this.insertStmt.run(token, expiryTimestamp);
    console.log(`🔒 Token blacklisted (expires: ${new Date(expiryTimestamp * 1000).toISOString()})`);
  }

  /**
   * Check if Token is Blacklisted
   *
   * Returns true if token is in blacklist and not yet expired.
   *
   * @param token - Full JWT token string
   * @returns true if token is blacklisted, false otherwise
   *
   * Workflow:
   * 1. User makes API request with token
   * 2. Auth middleware extracts token
   * 3. Before verifying JWT signature, check blacklist
   * 4. If blacklisted → reject immediately (401)
   * 5. If not blacklisted → proceed with JWT verification
   *
   * Why check before JWT verification?
   * - Faster (Map lookup is O(1), JWT verification is slower)
   * - Even valid signatures are rejected if blacklisted
   * - Logout is immediate (no waiting for token expiry)
   *
   * Performance:
   * - Map.has() is O(1) - constant time lookup
   * - Typical latency: <0.1ms
   * - Negligible impact on request handling
   *
   * Example:
   * ```typescript
   * if (tokenBlacklist.isBlacklisted(token)) {
   *   return res.status(401).json({
   *     success: false,
   *     error: 'Token has been revoked. Please login again.'
   *   });
   * }
   * ```
   *
   * Edge Cases:
   * - Token not in blacklist → returns false (allow request)
   * - Token in blacklist but expired → returns false (cleanup removed it)
   * - Token in blacklist and valid → returns true (reject request)
   */
  isBlacklisted(token: string): boolean {
    const now = Math.floor(Date.now() / 1000);
    const cachedExpiry = this.blacklist.get(token);

    if (cachedExpiry) {
      if (cachedExpiry < now) {
        this.blacklist.delete(token);
        this.deleteStmt.run(token);
        return false;
      }
      return true;
    }

    const row = this.selectStmt.get(token) as { expires_at: number } | undefined;
    if (!row) {
      return false;
    }

    if (row.expires_at < now) {
      this.deleteStmt.run(token);
      return false;
    }

    this.blacklist.set(token, row.expires_at);
    return true;
  }

  /**
   * Remove Expired Tokens (Cleanup)
   *
   * Removes tokens from blacklist that have already expired.
   * Called automatically every 15 minutes by cleanup interval.
   *
   * Algorithm:
   * 1. Get current timestamp
   * 2. Iterate through all blacklisted tokens
   * 3. For each token, check if expiry < now
   * 4. If expired, remove from blacklist
   * 5. Log cleanup statistics
   *
   * Why cleanup?
   * - Expired tokens are useless (JWT verification would reject them anyway)
   * - Prevents memory growth over time
   * - Keeps blacklist size bounded
   *
   * Performance:
   * - Time complexity: O(n) where n = number of blacklisted tokens
   * - Space complexity: O(1) (modifies Map in place)
   * - Typical runtime: <10ms for 10,000 tokens
   * - Runs in background (doesn't block requests)
   *
   * Example Cleanup:
   * - Before: 10,000 tokens in blacklist
   * - After 1 hour: 100 tokens expired → 9,900 remain
   * - Memory freed: 100 * 258 bytes = ~25KB
   *
   * Monitoring:
   * - Logs cleanup count every run
   * - High cleanup count indicates many logouts (good)
   * - Zero cleanup count indicates few logouts or short cleanup interval
   */
  private cleanup(): void {
    const now = Math.floor(Date.now() / 1000); // Current timestamp in seconds
    let removedCount = 0;

    // Iterate through blacklist and remove expired tokens
    for (const [token, expiryTimestamp] of this.blacklist.entries()) {
      if (expiryTimestamp < now) {
        this.blacklist.delete(token);
        this.deleteStmt.run(token);
        removedCount++;
      }
    }

    const dbCleanup = this.cleanupStmt.run(now).changes ?? 0;

    if (removedCount > 0 || dbCleanup > 0) {
      console.log(`🧹 Token blacklist cleanup: Removed ${removedCount + dbCleanup} expired tokens`);
      console.log(`   Blacklist size: ${this.blacklist.size} tokens`);
    }
  }

  /**
   * Get Blacklist Size
   *
   * Returns current number of blacklisted tokens.
   * Useful for monitoring and debugging.
   *
   * @returns Number of tokens currently in blacklist
   *
   * Use Cases:
   * - Health check endpoint (GET /health)
   * - Admin dashboard (token revocation stats)
   * - Monitoring/alerting (high blacklist size could indicate attack)
   *
   * Example:
   * ```typescript
   * app.get('/health', (req, res) => {
   *   res.json({
   *     status: 'ok',
   *     blacklistedTokens: tokenBlacklist.size()
   *   });
   * });
   * ```
   */
  size(): number {
    return this.blacklist.size;
  }

  /**
   * Graceful Shutdown
   *
   * Clears cleanup interval and releases resources.
   * Should be called on server shutdown (SIGINT/SIGTERM).
   *
   * Why important?
   * - Stops cleanup timer (prevents hanging process)
   * - Allows graceful process termination
   * - Good practice for production deployments
   *
   * Called from server.ts shutdown handlers:
   * ```typescript
   * process.on('SIGTERM', () => {
   *   tokenBlacklist.shutdown();
   *   db.close();
   *   process.exit(0);
   * });
   * ```
   */
  shutdown(): void {
    clearInterval(this.cleanupInterval);
    console.log('🔒 Token blacklist shutdown complete');
  }
}

/**
 * Export Singleton Instance
 *
 * Single shared instance used across entire application.
 *
 * Why singleton?
 * - All routes need to check same blacklist
 * - Multiple instances would have inconsistent state
 * - Cleanup timer runs once for whole app
 *
 * Usage:
 * ```typescript
 * import { tokenBlacklist } from '../utils/tokenBlacklist';
 *
 * // In auth middleware
 * if (tokenBlacklist.isBlacklisted(token)) {
 *   return res.status(401).json({ error: 'Token revoked' });
 * }
 *
 * // In logout route
 * tokenBlacklist.add(token, decoded.exp);
 * ```
 */
export const tokenBlacklist = new TokenBlacklist();

/**
 * Migration to Redis (Phase 3+)
 *
 * For production deployments with multiple servers, migrate to Redis:
 *
 * ```typescript
 * import Redis from 'ioredis';
 *
 * class RedisTokenBlacklist {
 *   private redis: Redis;
 *
 *   constructor() {
 *     this.redis = new Redis(process.env.REDIS_URL);
 *   }
 *
 *   async add(token: string, expiryTimestamp: number): Promise<void> {
 *     const ttl = expiryTimestamp - Math.floor(Date.now() / 1000);
 *     if (ttl > 0) {
 *       // Redis automatically removes key after TTL
 *       await this.redis.setex(`blacklist:${token}`, ttl, '1');
 *     }
 *   }
 *
 *   async isBlacklisted(token: string): Promise<boolean> {
 *     const exists = await this.redis.exists(`blacklist:${token}`);
 *     return exists === 1;
 *   }
 *
 *   async size(): Promise<number> {
 *     const keys = await this.redis.keys('blacklist:*');
 *     return keys.length;
 *   }
 * }
 * ```
 *
 * Benefits of Redis:
 * - Persistent (survives server restarts)
 * - Shared (works with load balancers)
 * - Auto-expiry (no cleanup needed)
 * - Scalable (millions of tokens)
 *
 * Drawbacks:
 * - External dependency (infrastructure)
 * - Network latency (~1ms vs <0.1ms)
 * - Async (requires await)
 */
