/**
 * CSRF Protection Middleware
 *
 * Protects against Cross-Site Request Forgery attacks when using
 * httpOnly cookie-based authentication.
 *
 * How CSRF Attacks Work:
 * 1. User logs into our app (gets httpOnly cookie)
 * 2. User visits malicious site
 * 3. Malicious site makes request to our API
 * 4. Browser automatically includes cookie (user is authenticated!)
 * 5. Request succeeds - attacker performed action as user
 *
 * Our Protection (Double Submit Cookie Pattern):
 * 1. On login, server generates CSRF token and sets it in a non-httpOnly cookie
 * 2. Frontend reads cookie and includes token in X-CSRF-Token header
 * 3. On state-changing requests, middleware validates header matches cookie
 * 4. Attacker can't read our cookie (same-origin policy) → can't forge header
 *
 * Why This Works:
 * - Attacker can trigger cookie to be sent automatically
 * - But attacker CANNOT read cookie value (same-origin policy)
 * - So attacker cannot set the X-CSRF-Token header correctly
 * - Request is rejected
 *
 * Implementation:
 * - GET/HEAD/OPTIONS: Skip CSRF check (read-only, no side effects)
 * - POST/PUT/DELETE/PATCH: Require X-CSRF-Token header matching csrf_token cookie
 *
 * Alternative: SameSite Cookie (we also use this!)
 * - sameSite: 'strict' prevents cookie from being sent on cross-site requests
 * - But doesn't work on older browsers, so we add CSRF as defense-in-depth
 */

import { Request, Response, NextFunction } from 'express';
import { timingSafeEqual as cryptoTimingSafeEqual } from 'crypto';

/**
 * List of HTTP methods that are safe (read-only, no side effects)
 * These don't need CSRF protection
 */
const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

/**
 * CSRF Validation Middleware
 *
 * Validates that the X-CSRF-Token header matches the csrf_token cookie.
 * Only applies to state-changing methods (POST, PUT, DELETE, PATCH).
 *
 * Usage:
 *   // Apply globally to all API routes
 *   app.use('/api', csrfMiddleware);
 *
 *   // Or apply to specific routes
 *   app.post('/api/recipes', csrfMiddleware, recipesHandler);
 *
 * Error Response:
 *   403 Forbidden: { success: false, error: 'Invalid CSRF token' }
 */
export function csrfMiddleware(req: Request, res: Response, next: NextFunction) {
  // Skip CSRF check for safe methods (they don't modify state)
  if (SAFE_METHODS.includes(req.method)) {
    return next();
  }

  // Skip CSRF check if using Authorization header (not cookie auth)
  // This allows API clients (Postman, mobile apps) to work without CSRF
  const authHeader = req.headers.authorization;
  if (authHeader && !req.cookies?.auth_token) {
    // Using header auth, not cookie auth - CSRF not needed
    return next();
  }

  // Get CSRF token from header and cookie
  const headerToken = req.headers['x-csrf-token'] as string | undefined;
  const cookieToken = req.cookies?.csrf_token;

  // Validate CSRF token
  if (!headerToken || !cookieToken) {
    console.warn(`⚠️ CSRF validation failed: Missing token (header: ${!!headerToken}, cookie: ${!!cookieToken})`);
    return res.status(403).json({
      success: false,
      error: 'CSRF token missing'
    });
  }

  // Constant-time comparison to prevent timing attacks
  if (!timingSafeEqual(headerToken, cookieToken)) {
    console.warn('⚠️ CSRF validation failed: Token mismatch');
    return res.status(403).json({
      success: false,
      error: 'Invalid CSRF token'
    });
  }

  // CSRF validation passed
  next();
}

/**
 * Constant-time string comparison using Node.js crypto module
 *
 * Uses the built-in crypto.timingSafeEqual for proper constant-time comparison
 * that prevents timing attacks on token validation.
 *
 * Why timing attacks matter:
 * - Normal comparison: "abc" vs "abd" stops at 'c' vs 'd'
 * - Attacker can measure time to guess characters one by one
 * - Constant-time: Always takes the same time regardless of match position
 *
 * @param a First string
 * @param b Second string
 * @returns true if strings are equal
 */
function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);

  // If lengths differ, we still need constant-time behavior
  // Pad the shorter buffer to match the longer one's length
  if (bufA.length !== bufB.length) {
    const maxLen = Math.max(bufA.length, bufB.length);
    const paddedA = Buffer.concat([bufA, Buffer.alloc(maxLen - bufA.length)]);
    const paddedB = Buffer.concat([bufB, Buffer.alloc(maxLen - bufB.length)]);
    // Compare padded buffers but always return false for length mismatch
    cryptoTimingSafeEqual(paddedA, paddedB);
    return false;
  }

  return cryptoTimingSafeEqual(bufA, bufB);
}

export default csrfMiddleware;
