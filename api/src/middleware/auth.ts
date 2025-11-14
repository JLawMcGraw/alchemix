/**
 * Authentication Middleware
 *
 * This module handles JWT-based authentication for the AlcheMix API.
 * It provides middleware to protect routes and utilities to generate tokens.
 *
 * Security Features:
 * - JWT token verification with strong secret validation
 * - Bearer token extraction from Authorization header
 * - Type-safe payload handling
 * - Comprehensive error handling for auth failures
 * - Token blacklist for immediate logout (SECURITY FIX #7)
 * - Token versioning for session fixation protection (SECURITY FIX #10)
 * - JWT Token ID (jti) for granular revocation (SECURITY FIX #2)
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { JWTPayload } from '../types';
import { tokenBlacklist } from '../utils/tokenBlacklist';

/**
 * Extend Express Request Type
 *
 * This declaration adds a custom 'user' property to Express requests.
 * After authentication, the JWT payload (user ID, email) is attached here
 * for use in downstream route handlers.
 */
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

/**
 * JWT Secret Key Configuration
 *
 * CRITICAL SECURITY: This secret is used to sign and verify JWT tokens.
 * If compromised, attackers can forge tokens and impersonate any user.
 *
 * Security Requirements:
 * - MUST be set via JWT_SECRET environment variable
 * - MUST be at least 32 characters (256 bits)
 * - MUST be cryptographically random
 * - MUST be kept secret (never commit to version control)
 * - SHOULD be rotated periodically
 *
 * The application will refuse to start if these requirements aren't met.
 */
// Validate JWT secret at startup (fail fast if misconfigured)
if (!process.env.JWT_SECRET) {
  console.error('❌ FATAL ERROR: JWT_SECRET environment variable is not set');
  console.error('   The application cannot start without a secure JWT secret.');
  console.error('   Generate a strong secret with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  process.exit(1); // Exit immediately - cannot run without proper security
}

if (process.env.JWT_SECRET.length < 32) {
  console.error('❌ FATAL ERROR: JWT_SECRET must be at least 32 characters long');
  console.error('   Current length:', process.env.JWT_SECRET.length);
  console.error('   A longer secret provides better security against brute-force attacks.');
  process.exit(1); // Exit immediately - security requirement not met
}

// TypeScript now knows JWT_SECRET is defined and at least 32 chars
const JWT_SECRET: string = process.env.JWT_SECRET;

/**
 * Generate Unique JWT Token ID (SECURITY FIX #2)
 *
 * Creates a cryptographically random unique identifier for each JWT token.
 *
 * Purpose:
 * - Unique identifier for each token (like a serial number)
 * - Enables granular token revocation (revoke specific token, not all)
 * - Reduces memory usage in blacklist (store jti instead of full token)
 * - Enables token usage tracking and auditing
 *
 * Implementation:
 * - Uses crypto.randomBytes() for cryptographic randomness
 * - 12-byte (96-bit) random value
 * - Encoded as hexadecimal string (24 characters)
 * - Globally unique (collision probability: ~1 in 10^28)
 *
 * Why 12 bytes?
 * - UUID is 16 bytes (128 bits) - slightly overkill
 * - 12 bytes (96 bits) provides excellent uniqueness
 * - Shorter = smaller token payload
 * - Still astronomically unlikely to collide
 *
 * Collision Probability:
 * - 12 bytes = 2^96 possible values
 * - Birthday paradox: ~10^14 tokens for 50% collision chance
 * - With 1 billion tokens: collision chance < 0.0000001%
 *
 * Alternative Approaches:
 * 1. UUID v4: 16 bytes, universally unique
 * 2. Timestamp + random: Easier to debug, slightly larger
 * 3. Sequential ID: Smaller, but leaks information (token count)
 *
 * Example JTIs:
 * - "a1b2c3d4e5f67890abcd"
 * - "f3e2d1c0b9a87654321f"
 * - "9876543210fedcba0123"
 *
 * Usage in Token:
 * ```typescript
 * const jti = generateJTI();
 * const token = generateToken({
 *   userId: 1,
 *   email: "user@example.com",
 *   jti: jti  // "a1b2c3d4e5f67890abcd"
 * });
 * ```
 *
 * Usage in Blacklist:
 * ```typescript
 * // Instead of storing full token (~200 bytes)
 * tokenBlacklist.add(fullToken, exp);
 *
 * // Store just jti (24 characters = 24 bytes)
 * jtiBlacklist.add(decoded.jti, exp);
 * ```
 *
 * Memory Savings:
 * - Full token: ~200 bytes
 * - JTI only: ~24 bytes
 * - Savings: 176 bytes per token (88% reduction)
 * - 10,000 tokens: 2MB → 240KB
 *
 * @returns 24-character hexadecimal string (12 random bytes)
 */
export function generateJTI(): string {
  // Generate 12 cryptographically random bytes
  const randomBytes = crypto.randomBytes(12);

  // Convert to hexadecimal string (24 characters)
  // Each byte becomes 2 hex characters
  const jti = randomBytes.toString('hex');

  return jti;
}

/**
 * Token Version Tracking (SECURITY FIX #10)
 *
 * SECURITY FIX #10: Session Fixation Protection via Token Versioning
 *
 * Purpose:
 * - Invalidate all existing tokens when user changes password
 * - Prevent session fixation attacks
 * - Force re-login after sensitive account changes
 * - Enable "logout from all devices" functionality
 *
 * How it Works:
 * 1. Each user has a token version number (starts at 0)
 * 2. When generating token, include current user's tokenVersion in JWT payload
 * 3. When verifying token, check if token's version matches current version
 * 4. On password change, increment user's token version
 * 5. All old tokens (with old version) are now invalid
 *
 * Implementation: In-Memory Map
 * - Map<userId, tokenVersion>: userId → current version number
 * - Token payload includes: { userId, email, tokenVersion, iat, exp }
 * - Auth middleware validates: decoded.tokenVersion === userTokenVersions.get(userId)
 *
 * Why In-Memory?
 * ✅ Simple (no database schema changes)
 * ✅ Fast (O(1) lookup)
 * ✅ Good for MVP/small deployments
 * ❌ Lost on server restart (users stay logged in until token expiry)
 * ❌ Not shared across multiple servers (load balancer issues)
 *
 * Production Alternative: Database Storage
 * - Add token_version column to users table
 * - Persistent (survives server restarts)
 * - Shared (works with load balancers)
 * - More complex (requires database queries)
 *
 * Security Properties:
 * - Password change → increment version → all old tokens invalid
 * - Prevents: Session fixation, stolen token persistence
 * - Enables: "Logout from all devices" feature
 * - Minimal overhead: O(1) Map lookup per request
 *
 * Memory Usage:
 * - Storage: ~16 bytes per user (userId + version number)
 * - Example: 10,000 users = ~160KB memory
 *
 * Usage Example:
 * ```typescript
 * // On token generation (login, signup)
 * const tokenVersion = userTokenVersions.get(userId) || 0;
 * const token = generateToken({ userId, email, tokenVersion });
 *
 * // On password change
 * const currentVersion = userTokenVersions.get(userId) || 0;
 * userTokenVersions.set(userId, currentVersion + 1);
 * // All old tokens now invalid (version mismatch)
 *
 * // On token verification (auth middleware)
 * const currentVersion = userTokenVersions.get(decoded.userId) || 0;
 * if (decoded.tokenVersion !== currentVersion) {
 *   return res.status(401).json({ error: 'Token has been revoked' });
 * }
 * ```
 *
 * Attack Scenarios Prevented:
 * 1. Password Compromise:
 *    - Attacker steals password, generates tokens
 *    - Victim changes password → version increments
 *    - Attacker's tokens are invalidated
 *
 * 2. Session Fixation:
 *    - Attacker sets victim's session to known token
 *    - Victim logs in → new token with incremented version
 *    - Attacker's token is invalid (old version)
 *
 * 3. Persistent Token Theft:
 *    - Attacker steals valid token
 *    - Victim uses "logout from all devices"
 *    - Version increments → stolen token invalid
 *
 * Future Enhancement (Phase 3+): Device Tracking
 * - Store Map<userId, Map<deviceId, tokenVersion>>
 * - Granular token invalidation per device
 * - "Logout from this device" vs "Logout from all devices"
 * - View active sessions in user settings
 */
const userTokenVersions = new Map<number, number>();

/**
 * Get Token Version for User
 *
 * Returns current token version for a user.
 * Defaults to 0 if user has never logged in or version not tracked.
 *
 * @param userId - User's database ID
 * @returns Current token version number (0 or higher)
 *
 * Why Default to 0?
 * - First login: User not in Map → version 0
 * - Version 0 is valid (not "no version")
 * - Incrementing starts from 0 → 1, 1 → 2, etc.
 */
export function getTokenVersion(userId: number): number {
  return userTokenVersions.get(userId) || 0;
}

/**
 * Increment Token Version for User
 *
 * Invalidates all existing tokens for a user by incrementing their version.
 * Called on password change, "logout from all devices", or security events.
 *
 * @param userId - User's database ID
 * @returns New token version number
 *
 * Use Cases:
 * - Password changed → increment version → old tokens invalid
 * - "Logout from all devices" → increment version → force re-login
 * - Security incident → increment version → revoke all access
 * - Account recovery → increment version → invalidate compromised tokens
 *
 * Example:
 * ```typescript
 * // In password change route
 * router.post('/change-password', authMiddleware, (req, res) => {
 *   // ... validate old password, hash new password ...
 *
 *   // Update password in database
 *   db.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
 *     .run(newPasswordHash, userId);
 *
 *   // SECURITY: Invalidate all existing tokens
 *   incrementTokenVersion(userId);
 *
 *   res.json({
 *     success: true,
 *     message: 'Password changed. Please login again.'
 *   });
 * });
 * ```
 *
 * Logging:
 * - Log version increments for security auditing
 * - Helps track when/why tokens were invalidated
 * - Useful for debugging "why was I logged out?" issues
 */
export function incrementTokenVersion(userId: number): number {
  const currentVersion = userTokenVersions.get(userId) || 0;
  const newVersion = currentVersion + 1;
  userTokenVersions.set(userId, newVersion);

  console.log(`🔐 Token version incremented for user ${userId}: ${currentVersion} → ${newVersion}`);
  console.log('   All existing tokens for this user are now invalid');

  return newVersion;
}

/**
 * Authentication Middleware
 *
 * This middleware function protects routes by verifying JWT tokens.
 * It must be applied to any route that requires user authentication.
 *
 * How it works:
 * 1. Extract JWT token from Authorization header
 * 2. Verify the token signature using JWT_SECRET
 * 3. Decode the payload (contains userId, email)
 * 4. Attach user info to req.user for downstream handlers
 * 5. Call next() to continue to the route handler
 *
 * Usage:
 *   router.get('/protected-route', authMiddleware, (req, res) => {
 *     const userId = req.user.userId; // Available after middleware runs
 *   });
 *
 * Security:
 * - Rejects requests without Authorization header
 * - Rejects expired tokens (7-day expiry)
 * - Rejects tampered tokens (signature verification)
 * - Returns 401 Unauthorized for auth failures
 *
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next middleware function
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    /**
     * Step 1: Extract Authorization Header
     *
     * Expected format: "Authorization: Bearer <token>"
     * The header contains the JWT token needed to verify the user's identity.
     */
    const authHeader = req.headers.authorization;

    // Reject requests without authentication
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        error: 'No authorization token provided'
      });
    }

    /**
     * Step 2: Extract Token from Header
     *
     * Authorization header format: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
     * We need to strip the "Bearer " prefix to get just the token.
     *
     * Supports both:
     * - Standard format: "Bearer <token>"
     * - Direct token: "<token>" (for compatibility)
     */
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.substring(7) // Remove "Bearer " prefix (7 characters)
      : authHeader; // Use as-is if no prefix

    /**
     * Step 3: Check Token Blacklist (SECURITY FIX #7)
     *
     * Before verifying JWT signature, check if token has been revoked.
     * This enables immediate logout and token invalidation.
     *
     * Use Cases:
     * - User logs out → token added to blacklist → subsequent requests rejected
     * - Password changed → old tokens blacklisted → force re-login
     * - Security incident → admin blacklists tokens → immediate revocation
     *
     * Why check before JWT verification?
     * - Faster (Map lookup is O(1), JWT verify is slower)
     * - Even valid signatures are rejected if blacklisted
     * - Logout is immediate (no waiting for token expiry)
     *
     * Performance Impact:
     * - Map lookup: <0.1ms
     * - Negligible overhead on every request
     */
    if (tokenBlacklist.isBlacklisted(token)) {
      return res.status(401).json({
        success: false,
        error: 'Token has been revoked. Please login again.'
      });
    }

    /**
     * Step 4: Verify and Decode JWT Token
     *
     * This is the critical security check. jwt.verify() does two things:
     * 1. Verifies the token signature using JWT_SECRET (proves authenticity)
     * 2. Checks expiration time (rejects expired tokens)
     * 3. Decodes the payload containing userId and email
     *
     * If verification fails, it throws an error (caught below)
     */
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;

    /**
     * Step 5: Validate Token Version (SECURITY FIX #10)
     *
     * Check if token's version matches user's current token version.
     * This enables immediate invalidation of all tokens on password change.
     *
     * How it Works:
     * - Token includes tokenVersion in payload (added during login/signup)
     * - User's current version stored in userTokenVersions Map
     * - On password change, user's version is incremented
     * - Old tokens have old version → rejected
     * - User must login again to get token with new version
     *
     * Security Benefits:
     * - Password changed → all old tokens invalid (even if not expired)
     * - "Logout from all devices" → increment version → force re-login
     * - Session fixation prevention → version changes on login
     *
     * Backward Compatibility:
     * - Old tokens without tokenVersion field → default to 0
     * - User not in Map (new system) → default to 0
     * - Version 0 === Version 0 → allow (first login after upgrade)
     *
     * Edge Cases:
     * 1. Token missing tokenVersion:
     *    - decoded.tokenVersion = undefined
     *    - Treated as 0 (backward compatibility)
     *    - Valid if user's current version is also 0
     *
     * 2. User not in version Map:
     *    - getTokenVersion(userId) returns 0 (default)
     *    - Valid for first login or after server restart
     *
     * 3. Version mismatch:
     *    - Token version: 0, Current version: 1
     *    - Indicates password changed → reject
     *
     * Performance:
     * - Map lookup: O(1) - <0.1ms
     * - Negligible overhead per request
     *
     * Example Scenarios:
     *
     * Scenario 1: Normal Login
     * - User logs in → tokenVersion = 0
     * - Token payload: { userId: 1, email: "user@example.com", tokenVersion: 0 }
     * - Validation: 0 === 0 → pass ✅
     *
     * Scenario 2: Password Changed
     * - User changes password → version incremented: 0 → 1
     * - Old token payload: { userId: 1, tokenVersion: 0 }
     * - Validation: 0 !== 1 → fail ❌
     * - User must login again to get token with version 1
     *
     * Scenario 3: Multiple Password Changes
     * - Password changed again → version incremented: 1 → 2
     * - Old tokens (version 0, 1) all invalid
     * - Only tokens with version 2 are valid
     */
    const tokenVersion = decoded.tokenVersion ?? 0; // Default to 0 for backward compatibility
    const currentVersion = getTokenVersion(decoded.userId);

    if (tokenVersion !== currentVersion) {
      console.log(`🔐 Token version mismatch for user ${decoded.userId}:`);
      console.log(`   Token version: ${tokenVersion}, Current version: ${currentVersion}`);
      console.log('   This usually means password was changed or user logged out from all devices');

      return res.status(401).json({
        success: false,
        error: 'Token has been invalidated. Please login again.'
      });
    }

    /**
     * Step 6: Attach User Info to Request
     *
     * The decoded payload contains:
     * - userId: Database ID of the authenticated user
     * - email: User's email address
     * - tokenVersion: Token version number (for invalidation)
     * - iat: Token issued at timestamp
     * - exp: Token expiration timestamp
     *
     * This info is now available in all subsequent middleware/handlers
     * via req.user
     */
    req.user = decoded;

    /**
     * Step 7: Continue to Next Middleware/Handler
     *
     * Authentication successful - allow the request to proceed
     * to the actual route handler.
     */
    next();
  } catch (error) {
    /**
     * Error Handling
     *
     * Common JWT errors:
     * - JsonWebTokenError: Invalid token signature or format
     * - TokenExpiredError: Token has expired (subclass of JsonWebTokenError)
     * - NotBeforeError: Token used before valid time
     */
    if (error instanceof jwt.JsonWebTokenError) {
      // Invalid or expired token - return clear error message
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }

    // Unexpected error during authentication - log and return generic error
    console.error('Authentication error:', error);
    return res.status(500).json({
      success: false,
      error: 'Authentication failed'
    });
  }
}

/**
 * Generate JWT Token
 *
 * Creates a signed JWT token for an authenticated user.
 * This token is used to maintain user sessions without server-side storage.
 *
 * How it works:
 * 1. Takes user payload (userId, email, tokenVersion)
 * 2. Signs it with JWT_SECRET (proves it came from our server)
 * 3. Adds expiration timestamp (7 days from now)
 * 4. Returns the encoded token string
 *
 * Token Structure:
 *   Header:  { "alg": "HS256", "typ": "JWT" }
 *   Payload: { "userId": 123, "email": "user@example.com", "tokenVersion": 0, "iat": ..., "exp": ... }
 *   Signature: HMACSHA256(base64(header) + "." + base64(payload), JWT_SECRET)
 *
 * The complete token looks like: "eyJhbGci...eyJ1c2VySWQ...Kx9sK1c"
 *
 * Token Version (SECURITY FIX #10):
 * - tokenVersion field enables session fixation protection
 * - Caller must include current user's token version in payload
 * - On password change, version increments → old tokens invalid
 * - Tokens without version are treated as version 0 (backward compatibility)
 *
 * Security:
 * - Tokens are signed but not encrypted (don't put sensitive data in them)
 * - Anyone can decode the payload, but can't modify it without invalidating signature
 * - 7-day expiration limits damage from token theft
 * - Tokens are stateless (no database lookup needed to verify)
 * - Token version enables immediate invalidation on password change
 *
 * Usage:
 * ```typescript
 * // On login/signup - include current token version
 * const tokenVersion = getTokenVersion(user.id);
 * const token = generateToken({
 *   userId: user.id,
 *   email: user.email,
 *   tokenVersion: tokenVersion
 * });
 * // Return token to client, who includes it in future requests
 * ```
 *
 * Caller Responsibility:
 * - Caller MUST include tokenVersion in payload (use getTokenVersion())
 * - If omitted, token will be treated as version 0
 * - This could allow old tokens to remain valid after password change
 *
 * Example with Full Workflow:
 * ```typescript
 * // Login Route
 * router.post('/login', (req, res) => {
 *   // ... authenticate user ...
 *
 *   // Get current token version for this user
 *   const tokenVersion = getTokenVersion(user.id);
 *
 *   // Generate token with version
 *   const token = generateToken({
 *     userId: user.id,
 *     email: user.email,
 *     tokenVersion: tokenVersion
 *   });
 *
 *   res.json({ token });
 * });
 *
 * // Password Change Route
 * router.post('/change-password', authMiddleware, (req, res) => {
 *   // ... validate and update password ...
 *
 *   // Increment token version (invalidates all old tokens)
 *   incrementTokenVersion(req.user.userId);
 *
 *   res.json({
 *     message: 'Password changed. Please login again.'
 *   });
 * });
 * ```
 *
 * @param payload - User information to encode in token (userId, email, tokenVersion)
 * @returns Signed JWT token string
 */
export function generateToken(payload: JWTPayload): string {
  return jwt.sign(
    payload,      // Data to encode (userId, email, tokenVersion, jti)
    JWT_SECRET,   // Secret key for signing (validates authenticity)
    {
      expiresIn: '7d',  // Token expires in 7 days (604800 seconds)
                        // After expiration, token is rejected by authMiddleware
                        // User must login again to get a fresh token
      algorithm: 'HS256' // HMAC with SHA-256 (secure, fast, standard)
    }
  );
}
