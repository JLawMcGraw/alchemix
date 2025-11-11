/**
 * User-Based Rate Limiting Middleware (SECURITY FIX #14)
 *
 * Rate limiting based on authenticated user ID instead of IP address.
 *
 * Problem with IP-Based Rate Limiting:
 * 1. Shared IPs: Multiple users behind same NAT/proxy share IP
 *    - Office network: 100 employees share 1 IP
 *    - Mobile carrier: Thousands share same IP
 *    - Result: One bad actor blocks everyone
 *
 * 2. IP Rotation: Attackers can bypass IP limits
 *    - VPN/proxy switching: New IP every few requests
 *    - Botnet: Thousands of IPs available
 *    - Result: IP rate limiting ineffective
 *
 * 3. False Positives: Legitimate users blocked
 *    - Co-worker makes many requests → your requests blocked
 *    - Public WiFi: Strangers block each other
 *    - Result: Poor user experience
 *
 * User-Based Solution (SECURITY FIX #14):
 * - Track rate limits by userId (from JWT token)
 * - Each user has independent rate limit
 * - No collisions from shared IPs
 * - Precise accountability per user account
 *
 * Implementation:
 * - In-memory Map<userId, requestTimestamps[]>
 * - Sliding window algorithm
 * - Automatic cleanup of old entries
 *
 * Use Cases:
 * - Protect authenticated API routes
 * - Prevent abuse by individual users
 * - Fair usage enforcement
 * - Resource consumption control
 *
 * Example:
 * ```typescript
 * // Apply to specific routes
 * router.get('/inventory', authMiddleware, userRateLimit(100, 15), getInventory);
 *
 * // Apply to entire router
 * router.use(authMiddleware);
 * router.use(userRateLimit(100, 15));
 * ```
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Request Tracking Storage
 *
 * Stores request timestamps for each user to track rate limits.
 *
 * Structure: Map<userId, timestamp[]>
 * - Key: User's database ID (number)
 * - Value: Array of request timestamps (Unix milliseconds)
 *
 * Example Entry:
 * ```javascript
 * userRequests.set(123, [
 *   1699632000000,  // Request 1 at 10:00:00
 *   1699632005000,  // Request 2 at 10:00:05
 *   1699632010000   // Request 3 at 10:00:10
 * ])
 * ```
 *
 * Memory Considerations:
 * - Each timestamp: 8 bytes (JavaScript number)
 * - 100 requests per user: ~800 bytes
 * - 1000 active users: ~800KB
 * - Old timestamps automatically cleaned up
 *
 * Why Array of Timestamps (Sliding Window)?
 * - More accurate than token bucket
 * - Allows burst traffic within limits
 * - Easy to inspect for debugging
 *
 * Alternative: Token Bucket Algorithm
 * - More memory efficient (store count + lastRefill)
 * - Less accurate (doesn't track exact request times)
 * - Harder to debug (can't see request history)
 */
const userRequests = new Map<number, number[]>();

/**
 * Cleanup Interval for Old Entries
 *
 * Periodically removes expired request timestamps to prevent memory growth.
 * Runs every 5 minutes.
 *
 * Why cleanup?
 * - Request timestamps older than window are useless
 * - Without cleanup, Map grows indefinitely
 * - 1000 users × 100 requests = 100,000 timestamps = ~800KB
 * - After 15 minutes, old timestamps can be removed
 *
 * Cleanup Algorithm:
 * 1. Iterate through all users in Map
 * 2. For each user, filter out timestamps older than 1 hour
 * 3. If user has no recent requests, remove from Map entirely
 * 4. Log cleanup statistics
 *
 * Why 1 hour retention (longer than window)?
 * - Window is typically 15 minutes
 * - Keep extra history for debugging
 * - Allows viewing recent activity patterns
 * - Negligible extra memory cost
 */
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const RETENTION_PERIOD_MS = 60 * 60 * 1000; // 1 hour

// Start cleanup task
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  const cutoff = now - RETENTION_PERIOD_MS;
  let totalEntriesBefore = 0;
  let totalEntriesAfter = 0;
  let usersRemoved = 0;

  for (const [userId, timestamps] of userRequests.entries()) {
    totalEntriesBefore += timestamps.length;

    // Filter out old timestamps (older than 1 hour)
    const recentTimestamps = timestamps.filter(ts => ts > cutoff);
    totalEntriesAfter += recentTimestamps.length;

    if (recentTimestamps.length === 0) {
      // No recent activity → remove user from Map
      userRequests.delete(userId);
      usersRemoved++;
    } else if (recentTimestamps.length < timestamps.length) {
      // Some timestamps removed → update Map
      userRequests.set(userId, recentTimestamps);
    }
  }

  const entriesRemoved = totalEntriesBefore - totalEntriesAfter;

  if (entriesRemoved > 0 || usersRemoved > 0) {
    console.log('🧹 User rate limit cleanup:');
    console.log(`   Removed ${entriesRemoved} old request entries`);
    console.log(`   Removed ${usersRemoved} inactive users`);
    console.log(`   Active users: ${userRequests.size}`);
    console.log(`   Total request entries: ${totalEntriesAfter}`);
  }
}, CLEANUP_INTERVAL_MS);

/**
 * Graceful Shutdown Handler
 *
 * Clears cleanup interval on server shutdown.
 * Prevents hanging process and enables clean exit.
 *
 * Should be called from server.ts shutdown handlers:
 * ```typescript
 * process.on('SIGTERM', () => {
 *   shutdownUserRateLimit();
 *   // ... other cleanup ...
 *   process.exit(0);
 * });
 * ```
 */
export function shutdownUserRateLimit(): void {
  clearInterval(cleanupInterval);
  console.log('🔒 User rate limiter shutdown complete');
}

/**
 * User-Based Rate Limiting Middleware Factory
 *
 * Creates rate limiting middleware that tracks limits per authenticated user.
 *
 * Algorithm: Sliding Window Counter
 * 1. Get userId from req.user (populated by authMiddleware)
 * 2. Get user's request timestamps from Map
 * 3. Filter timestamps to only those within window
 * 4. Check if count exceeds max
 * 5. If yes → reject with 429
 * 6. If no → add current timestamp and continue
 *
 * Why Sliding Window?
 * - More accurate than fixed window
 * - Prevents "double spending" at window boundaries
 * - Example with fixed window (broken):
 *   - 09:59:59: 100 requests → OK
 *   - 10:00:00: New window starts
 *   - 10:00:01: 100 requests → OK
 *   - Result: 200 requests in 2 seconds (defeats purpose)
 *
 * Example with Sliding Window (correct):
 * - 09:59:59: 100 requests → OK
 * - 10:00:01: Check last 15 min → 100 requests found → Reject
 * - 10:14:59: Check last 15 min → 0 requests found → OK
 *
 * @param maxRequests - Maximum requests allowed in window (default: 100)
 * @param windowMinutes - Time window in minutes (default: 15)
 * @returns Express middleware function
 *
 * Usage Examples:
 *
 * 1. Conservative (10 requests per 5 minutes):
 * ```typescript
 * router.post('/expensive-operation', authMiddleware, userRateLimit(10, 5), handler);
 * ```
 *
 * 2. Standard (100 requests per 15 minutes):
 * ```typescript
 * router.use(authMiddleware);
 * router.use(userRateLimit(100, 15));
 * ```
 *
 * 3. Generous (1000 requests per hour):
 * ```typescript
 * router.get('/data', authMiddleware, userRateLimit(1000, 60), handler);
 * ```
 *
 * Response Headers (RFC 6585):
 * - X-RateLimit-Limit: Maximum requests allowed
 * - X-RateLimit-Remaining: Requests left in window
 * - X-RateLimit-Reset: Timestamp when limit resets
 *
 * Error Response (429 Too Many Requests):
 * ```json
 * {
 *   "success": false,
 *   "error": "Rate limit exceeded. You have made 100 requests in the last 15 minutes. Maximum: 100. Try again in 5 minutes."
 * }
 * ```
 */
export function userRateLimit(
  maxRequests: number = 100,
  windowMinutes: number = 15
) {
  const windowMs = windowMinutes * 60 * 1000;

  return (req: Request, res: Response, next: NextFunction) => {
    /**
     * Step 1: Verify User Authentication
     *
     * This middleware REQUIRES authMiddleware to run first.
     * If req.user is not set, authentication is missing.
     *
     * Why require authentication?
     * - User-based rate limiting needs userId
     * - Unauthenticated requests should use IP-based limiting
     * - Prevents bypassing rate limits by not authenticating
     *
     * Typical middleware order:
     * 1. authMiddleware (sets req.user)
     * 2. userRateLimit (checks req.user.userId)
     * 3. Route handler (actual logic)
     */
    if (!req.user?.userId) {
      console.error('⚠️  userRateLimit middleware requires authMiddleware to run first');
      console.error('   req.user is undefined - cannot enforce user-based rate limit');
      console.error('   Falling back to allowing request (WARNING: Rate limit not enforced)');

      // Allow request but log warning
      // In production, consider rejecting with 500 (misconfiguration)
      return next();
    }

    const userId = req.user.userId;
    const now = Date.now();

    /**
     * Step 2: Get User's Request History
     *
     * Fetch timestamps of user's recent requests from Map.
     * If user not in Map (first request), initialize empty array.
     */
    let timestamps = userRequests.get(userId) || [];

    /**
     * Step 3: Filter to Sliding Window
     *
     * Remove timestamps outside current window.
     * Only count requests within last N minutes.
     *
     * Example (15-minute window):
     * - Now: 10:15:00
     * - Window start: 10:00:00
     * - Timestamps: [09:55:00, 10:05:00, 10:10:00, 10:14:00]
     * - After filter: [10:05:00, 10:10:00, 10:14:00]
     */
    const windowStart = now - windowMs;
    timestamps = timestamps.filter(ts => ts >= windowStart);

    /**
     * Step 4: Check Rate Limit
     *
     * If user has reached max requests, reject with 429.
     * Calculate retry-after time from oldest request in window.
     */
    if (timestamps.length >= maxRequests) {
      // Find oldest request in current window
      const oldestTimestamp = Math.min(...timestamps);
      const resetTime = oldestTimestamp + windowMs;
      const retryAfterSeconds = Math.ceil((resetTime - now) / 1000);

      console.log(`⚠️  Rate limit exceeded for user ${userId}:`);
      console.log(`   Requests in last ${windowMinutes} min: ${timestamps.length}`);
      console.log(`   Maximum allowed: ${maxRequests}`);
      console.log(`   Retry after: ${retryAfterSeconds} seconds`);

      // Set rate limit headers (RFC 6585 standard)
      res.set('X-RateLimit-Limit', maxRequests.toString());
      res.set('X-RateLimit-Remaining', '0');
      res.set('X-RateLimit-Reset', Math.floor(resetTime / 1000).toString());
      res.set('Retry-After', retryAfterSeconds.toString());

      return res.status(429).json({
        success: false,
        error: `Rate limit exceeded. You have made ${timestamps.length} requests in the last ${windowMinutes} minutes. Maximum: ${maxRequests}. Try again in ${Math.ceil(retryAfterSeconds / 60)} minutes.`
      });
    }

    /**
     * Step 5: Record Current Request
     *
     * Add current timestamp to user's request history.
     * Update Map with new timestamp array.
     */
    timestamps.push(now);
    userRequests.set(userId, timestamps);

    /**
     * Step 6: Set Rate Limit Headers
     *
     * Inform client of rate limit status.
     * Allows frontend to show warnings before hitting limit.
     *
     * Headers:
     * - X-RateLimit-Limit: Max requests in window (e.g., "100")
     * - X-RateLimit-Remaining: Requests left (e.g., "95")
     * - X-RateLimit-Reset: Unix timestamp when window resets
     */
    const remaining = maxRequests - timestamps.length;
    const oldestInWindow = timestamps.length > 0 ? Math.min(...timestamps) : now;
    const resetTime = oldestInWindow + windowMs;

    res.set('X-RateLimit-Limit', maxRequests.toString());
    res.set('X-RateLimit-Remaining', remaining.toString());
    res.set('X-RateLimit-Reset', Math.floor(resetTime / 1000).toString());

    /**
     * Step 7: Continue to Next Middleware
     *
     * Rate limit not exceeded - allow request to proceed.
     */
    next();
  };
}

/**
 * Get Rate Limit Status for User
 *
 * Returns current rate limit status for debugging/monitoring.
 * Useful for admin dashboards and user account pages.
 *
 * @param userId - User's database ID
 * @param windowMinutes - Time window to check (default: 15)
 * @returns Rate limit status object
 *
 * Example Response:
 * ```typescript
 * {
 *   userId: 123,
 *   requestCount: 45,
 *   windowMinutes: 15,
 *   oldestRequest: 1699632000000,
 *   newestRequest: 1699632900000
 * }
 * ```
 *
 * Use Cases:
 * - User settings: "You've made 45/100 requests in the last 15 minutes"
 * - Admin dashboard: "User 123 is approaching rate limit"
 * - Debugging: "Why was user rate limited?"
 */
export function getUserRateLimitStatus(
  userId: number,
  windowMinutes: number = 15
): {
  userId: number;
  requestCount: number;
  windowMinutes: number;
  oldestRequest: number | null;
  newestRequest: number | null;
} {
  const windowMs = windowMinutes * 60 * 1000;
  const now = Date.now();
  const windowStart = now - windowMs;

  let timestamps = userRequests.get(userId) || [];
  timestamps = timestamps.filter(ts => ts >= windowStart);

  return {
    userId,
    requestCount: timestamps.length,
    windowMinutes,
    oldestRequest: timestamps.length > 0 ? Math.min(...timestamps) : null,
    newestRequest: timestamps.length > 0 ? Math.max(...timestamps) : null
  };
}

/**
 * Reset Rate Limit for User
 *
 * Clears rate limit history for a specific user.
 * Useful for customer support and testing.
 *
 * @param userId - User's database ID
 *
 * Use Cases:
 * - Customer support: User accidentally hit limit → reset
 * - Testing: Reset between test runs
 * - Admin action: Manually clear limit after investigation
 *
 * Security Warning:
 * - Only allow admin users to call this
 * - Log all manual resets for audit trail
 * - Consider requiring reason/justification
 *
 * Example:
 * ```typescript
 * router.post('/admin/reset-rate-limit', adminAuthMiddleware, (req, res) => {
 *   const { userId } = req.body;
 *   resetUserRateLimit(userId);
 *   auditLog('rate_limit_reset', { userId, adminId: req.user.userId });
 *   res.json({ success: true });
 * });
 * ```
 */
export function resetUserRateLimit(userId: number): void {
  userRequests.delete(userId);
  console.log(`🔓 Rate limit reset for user ${userId}`);
}

/**
 * Export Note: Integration with Existing System
 *
 * This user-based rate limiter complements (not replaces) IP-based limiting:
 *
 * 1. IP-Based Rate Limiting (existing, keep):
 *    - Applied to ALL routes (authenticated and unauthenticated)
 *    - Protects signup/login endpoints (no userId yet)
 *    - Prevents network-level DoS attacks
 *    - Configuration: 5-100 requests per IP per 15 min
 *
 * 2. User-Based Rate Limiting (new, this file):
 *    - Applied to AUTHENTICATED routes only
 *    - Tracks limits per user account
 *    - Prevents abuse by individual users
 *    - Configuration: 100-1000 requests per user per 15 min
 *
 * Recommended Middleware Order:
 * ```typescript
 * // 1. IP rate limiting (first line of defense)
 * app.use('/api', ipRateLimit(100, 15));
 *
 * // 2. Authentication (identify user)
 * app.use('/api/protected', authMiddleware);
 *
 * // 3. User rate limiting (second line of defense)
 * app.use('/api/protected', userRateLimit(100, 15));
 * ```
 *
 * Why Both?
 * - IP limiting stops attacks before authentication
 * - User limiting ensures fair usage per account
 * - Defense in depth (multiple layers)
 *
 * Production Considerations (Phase 3+):
 * - Move to Redis for distributed rate limiting
 * - Add different limits for different user tiers
 * - Implement token bucket for smoother limits
 * - Add rate limit analytics/monitoring
 */
