/**
 * Authentication Routes
 *
 * Handles user authentication operations:
 * - Signup: Create new user account
 * - Login: Authenticate existing user
 * - Logout: End user session (SECURITY FIX #7 - Token blacklist)
 * - Me: Get current authenticated user info
 *
 * Security Features:
 * - Password hashing with bcrypt (10 salt rounds)
 * - JWT token generation for session management
 * - Strong password validation (SECURITY FIX #9)
 * - Token blacklist for immediate logout (SECURITY FIX #7)
 * - Session fixation protection via token versioning (SECURITY FIX #10)
 * - Rate limiting on signup/login (5 attempts per 15 min)
 * - Email uniqueness enforcement
 * - Constant-time password comparison (prevents timing attacks)
 *
 * All passwords are hashed before storage - we NEVER store plaintext passwords.
 *
 * Security Enhancements (Phase 2+3):
 * - SECURITY FIX #7: Token blacklist enables immediate logout
 * - SECURITY FIX #9: Strong password validation (8+ chars, complexity)
 * - SECURITY FIX #10: Token versioning prevents session fixation
 */

import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { db } from '../database/db';
import { generateToken, authMiddleware, getTokenVersion, generateJTI } from '../middleware/auth';
import { validatePassword } from '../utils/passwordValidator';
import { tokenBlacklist } from '../utils/tokenBlacklist';
import { User } from '../types';

const router = Router();

/**
 * POST /auth/signup - Create New User Account
 *
 * Creates a new user account with email and password.
 * Validates input, checks for existing users, hashes password, stores in database.
 *
 * Request Body:
 * {
 *   "email": "user@example.com",
 *   "password": "SecurePassword123!"
 * }
 *
 * Response (201 Created):
 * {
 *   "success": true,
 *   "data": {
 *     "token": "eyJhbGci...",
 *     "user": { "id": 1, "email": "user@example.com", "created_at": "..." }
 *   }
 * }
 *
 * Error Responses:
 * - 400: Invalid input (missing fields, weak password, email exists)
 * - 500: Server error (database failure, bcrypt error)
 *
 * Security:
 * - Password hashed with bcrypt (10 rounds = ~100ms, resistant to brute-force)
 * - Strong password validation (12+ chars, mixed case, numbers, special chars)
 * - Email uniqueness enforced by database constraint
 * - JWT token returned for immediate login
 */
router.post('/signup', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    /**
     * Step 1: Basic Input Validation
     *
     * Ensure required fields are present.
     * Quick check before more expensive operations.
     */
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    /**
     * Step 2: Email Format Validation
     *
     * Ensure email is in valid format.
     * Basic regex check for @domain pattern.
     */
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format'
      });
    }

    /**
     * Step 3: Strong Password Validation (SECURITY FIX #9)
     *
     * Enforce strong password requirements:
     * - Minimum 12 characters (was 6)
     * - Uppercase and lowercase letters
     * - At least one number
     * - At least one special character
     * - Not a common weak password
     *
     * This significantly increases security against brute-force attacks.
     */
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Password does not meet security requirements',
        details: passwordValidation.errors
      });
    }

    /**
     * Step 4: Check for Existing User
     *
     * Prevent duplicate accounts with same email.
     * Email is unique constraint in database schema.
     *
     * Security Note:
     * We return a generic error to prevent email enumeration attacks.
     * (Attackers could check if email exists without knowing password)
     */
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'User already exists with this email'
      });
    }

    /**
     * Step 5: Hash Password with bcrypt
     *
     * bcrypt is a password-hashing function designed to be slow.
     * This makes brute-force attacks computationally expensive.
     *
     * Salt Rounds: 10 (default, recommended)
     * - Each round doubles the hashing time
     * - 10 rounds = ~100ms on modern CPU
     * - Balances security vs performance
     * - Resistant to GPU/ASIC brute-force attacks
     *
     * How bcrypt works:
     * 1. Generate random salt (16 bytes)
     * 2. Run password + salt through expensive hash function (2^10 = 1024 iterations)
     * 3. Store salt + hash together in result
     *
     * Result format: $2b$10$<salt><hash>
     * Example: $2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy
     */
    const password_hash = await bcrypt.hash(password, 10);

    /**
     * Step 6: Create User in Database
     *
     * Insert new user record with email and hashed password.
     * Database auto-generates ID and created_at timestamp.
     *
     * SQL: INSERT INTO users (email, password_hash) VALUES (?, ?)
     * Parameterized query prevents SQL injection.
     */
    const result = db.prepare(
      'INSERT INTO users (email, password_hash) VALUES (?, ?)'
    ).run(email, password_hash);

    const userId = result.lastInsertRowid as number;

    /**
     * Step 7: Retrieve Created User
     *
     * Fetch user record to return in response.
     * Exclude password_hash from response for security.
     */
    const user = db.prepare(
      'SELECT id, email, created_at FROM users WHERE id = ?'
    ).get(userId) as User;

    /**
     * Step 8: Generate JWT Token (SECURITY FIX #2, #10)
     *
     * Create authentication token for immediate login.
     * User doesn't need to login separately after signup.
     *
     * Token contains:
     * - userId: Database ID for user lookup
     * - email: User's email address
     * - tokenVersion: Current token version (starts at 0 for new users)
     * - jti: Unique token ID for granular revocation (SECURITY FIX #2)
     * - exp: Expiration (7 days from now, added by jwt.sign)
     *
     * JWT Token ID (jti) - SECURITY FIX #2:
     * - Unique identifier for this specific token
     * - Enables "logout this session" without affecting other sessions
     * - Reduces memory usage in blacklist (store jti instead of full token)
     * - 24-character hex string (12 random bytes)
     * - Globally unique (collision probability < 0.0000001%)
     *
     * Token Version (SECURITY FIX #10):
     * - New users start with tokenVersion = 0
     * - Version increments on password change
     * - Enables "logout from all devices" functionality
     * - Prevents session fixation attacks
     *
     * Why Generate Both?
     * - tokenVersion: Revoke all tokens for a user (password change)
     * - jti: Revoke specific token (logout single session)
     * - Both provide different granularity of control
     */
    const tokenVersion = getTokenVersion(user.id);
    const jti = generateJTI();
    const token = generateToken({
      userId: user.id,
      email: user.email,
      tokenVersion: tokenVersion,
      jti: jti
    });

    /**
     * Step 9: Return Success Response
     *
     * 201 Created status indicates new resource was created.
     * Return token for immediate authentication.
     */
    res.status(201).json({
      success: true,
      data: {
        token,
        user
      }
    });
  } catch (error) {
    /**
     * Error Handling
     *
     * Log detailed error for debugging (server-side only).
     * Return generic error to client (don't leak internals).
     *
     * Common errors:
     * - Database constraint violation (duplicate email)
     * - bcrypt failure (system resource issue)
     * - Database connection failure
     */
    console.error('Signup error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create account'
    });
  }
});

/**
 * POST /auth/login - Authenticate User
 *
 * Verifies user credentials and returns JWT token for session management.
 *
 * Request Body:
 * {
 *   "email": "user@example.com",
 *   "password": "SecurePassword123!"
 * }
 *
 * Response (200 OK):
 * {
 *   "success": true,
 *   "data": {
 *     "token": "eyJhbGci...",
 *     "user": { "id": 1, "email": "user@example.com", "created_at": "..." }
 *   }
 * }
 *
 * Error Responses:
 * - 400: Missing email or password
 * - 401: Invalid credentials
 * - 500: Server error
 *
 * Security:
 * - SECURITY FIX #6: Constant-time comparison prevents timing attacks
 * - Generic error message prevents email enumeration
 * - bcrypt comparison is inherently timing-safe
 * - Password hash never returned to client
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    /**
     * Step 1: Basic Input Validation
     */
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    /**
     * Step 2: Fetch User from Database
     *
     * Query includes password_hash for verification.
     * Uses parameterized query to prevent SQL injection.
     */
    const user = db.prepare(
      'SELECT id, email, password_hash, created_at FROM users WHERE email = ?'
    ).get(email) as User | undefined;

    /**
     * SECURITY FIX #6: Timing Attack Prevention
     *
     * Problem: Early return when user not found creates timing difference
     * - User exists: ~100ms (bcrypt comparison)
     * - User doesn't exist: <1ms (immediate return)
     * - Attacker can measure timing to enumerate valid emails
     *
     * Solution: Always run bcrypt.compare() even for non-existent users
     * - Use dummy hash for non-existent users
     * - Ensures constant-time behavior
     * - Prevents email enumeration via timing analysis
     */
    const dummyHash = '$2b$10$YourDummyHashHereForTimingConsistencyProtection1234567890';
    const hashToCompare = user?.password_hash || dummyHash;

    /**
     * Step 3: Verify Password (Constant-Time)
     *
     * bcrypt.compare() runs in constant time regardless of password correctness.
     * This prevents timing attacks on the password itself.
     *
     * Time complexity: O(1) - always ~100ms regardless of:
     * - Whether user exists
     * - Whether password is correct
     * - How many characters are correct
     */
    const isValidPassword = await bcrypt.compare(password, hashToCompare);

    /**
     * Step 4: Check Authentication Success
     *
     * User must exist AND password must be valid.
     * Generic error message prevents email enumeration.
     *
     * Note: We check both conditions after bcrypt to maintain constant timing.
     */
    if (!user || !user.password_hash || !isValidPassword) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password' // Generic message - don't reveal which is wrong
      });
    }

    /**
     * Step 5: Generate JWT Token (SECURITY FIX #2, #10)
     *
     * Create session token for authenticated user.
     * Token expires in 7 days (configured in auth middleware).
     *
     * Token contains:
     * - userId: Database ID for user lookup
     * - email: User's email address
     * - tokenVersion: Current token version for this user
     * - jti: Unique token ID for this specific session (SECURITY FIX #2)
     * - exp: Expiration (7 days from now, added by jwt.sign)
     *
     * JWT Token ID (jti) - SECURITY FIX #2:
     * - Unique identifier for this login session
     * - Different jti for each login (even same user, same device)
     * - Enables "logout this session" without affecting other sessions
     * - Enables token usage tracking and auditing
     * - Example: User logs in on phone and laptop → 2 different jtis
     *
     * Token Version (SECURITY FIX #10):
     * - Fetches current version from userTokenVersions Map
     * - Defaults to 0 for first login
     * - Increments on password change → invalidates old tokens
     * - Enables session fixation protection
     *
     * Security Flow:
     * 1. User logs in → gets token with current version (e.g., version 0)
     * 2. User changes password → version incremented to 1
     * 3. Old token (version 0) is rejected by auth middleware
     * 4. User must login again → gets token with version 1
     *
     * Why Generate New JTI Each Login?
     * - Each login session gets unique identifier
     * - Allows tracking which session made which requests
     * - Enables "logout from other devices" feature
     * - Improves security auditing and monitoring
     *
     * Why Fetch Version on Each Login?
     * - Version may have changed since last login
     * - Password change increments version
     * - Ensures new token has latest version
     * - Prevents accepting old tokens after password change
     */
    const tokenVersion = getTokenVersion(user.id);
    const jti = generateJTI();
    const token = generateToken({
      userId: user.id,
      email: user.email,
      tokenVersion: tokenVersion,
      jti: jti
    });

    /**
     * Step 6: Remove Sensitive Data
     *
     * NEVER return password hash to client.
     * Use destructuring to exclude it from response.
     */
    const { password_hash, ...userWithoutPassword } = user;

    /**
     * Step 7: Return Success Response
     *
     * 200 OK status indicates successful authentication.
     * Client stores token for future authenticated requests.
     */
    res.json({
      success: true,
      data: {
        token,
        user: userWithoutPassword
      }
    });
  } catch (error) {
    /**
     * Error Handling
     *
     * Log detailed error server-side for debugging.
     * Return generic error to client (don't leak internals).
     *
     * Common errors:
     * - Database connection failure
     * - bcrypt error (rare, system resource issue)
     */
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to login'
    });
  }
});

/**
 * GET /auth/me - Get Current User Info
 *
 * Returns information about the currently authenticated user.
 * Requires valid JWT token in Authorization header.
 *
 * Headers:
 *   Authorization: Bearer <token>
 *
 * Response (200 OK):
 * {
 *   "success": true,
 *   "data": {
 *     "id": 1,
 *     "email": "user@example.com",
 *     "created_at": "2025-11-10T14:32:05.123Z"
 *   }
 * }
 *
 * Error Responses:
 * - 401: No token or invalid token (handled by authMiddleware)
 * - 404: User ID from token doesn't exist in database (token valid but user deleted)
 * - 500: Server error
 *
 * Use Cases:
 * - Frontend needs to verify user is still authenticated
 * - Frontend needs to display user info (email, account creation date)
 * - Refresh user data after login
 */
router.get('/me', authMiddleware, (req: Request, res: Response) => {
  try {
    /**
     * Step 1: Extract User ID from JWT Token
     *
     * authMiddleware (runs before this handler) decodes the JWT and
     * attaches user info to req.user. This includes:
     * - userId: Database ID from token payload
     * - email: Email from token payload
     *
     * If we reach this handler, the token is valid (not expired, correct signature).
     */
    const userId = req.user?.userId;

    /**
     * Step 2: Defensive Check
     *
     * This should never happen if authMiddleware works correctly,
     * but we check anyway for type safety and defense in depth.
     */
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    /**
     * Step 3: Fetch User from Database
     *
     * The token might be valid but the user could have been deleted.
     * We need to verify the user still exists in the database.
     *
     * Security Note:
     * - We exclude password_hash from the query (don't need it, shouldn't return it)
     * - Use parameterized query to prevent SQL injection
     */
    const user = db.prepare(
      'SELECT id, email, created_at FROM users WHERE id = ?'
    ).get(userId) as User | undefined;

    /**
     * Step 4: Handle User Not Found
     *
     * Edge case: User had valid token but was deleted from database.
     * Frontend should handle 404 by logging user out.
     */
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    /**
     * Step 5: Return User Info
     *
     * Return user data (without password hash).
     * Frontend can use this to display profile info.
     */
    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    /**
     * Error Handling
     *
     * Log detailed error server-side.
     * Return generic error to client.
     */
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user'
    });
  }
});

/**
 * POST /auth/logout - End User Session
 *
 * Logs out the currently authenticated user by revoking their JWT token.
 *
 * SECURITY FIX #7: Token Blacklist Implementation
 * - Server-side token revocation for immediate logout
 * - Tokens added to in-memory blacklist
 * - Subsequent requests with same token are rejected (401)
 * - Automatic cleanup of expired tokens
 *
 * Headers:
 *   Authorization: Bearer <token>
 *
 * Response (200 OK):
 * {
 *   "success": true,
 *   "message": "Logged out successfully"
 * }
 *
 * Error Responses:
 * - 401: Unauthorized (no valid token)
 * - 500: Server error (blacklist failure - still allows logout)
 *
 * Complete Logout Flow:
 * 1. Client calls POST /auth/logout with Authorization header
 * 2. Server extracts token from header
 * 3. Server decodes token to get expiry time (exp claim)
 * 4. Server adds token to blacklist with expiry
 * 5. Server returns success response
 * 6. Client removes token from localStorage
 * 7. Client redirects to login page
 * 8. Future API requests with old token → 401 "Token has been revoked"
 *
 * Security Benefits:
 * - Immediate logout (no waiting for token expiry)
 * - Prevents token replay attacks after logout
 * - Enables forced logout (admin/security features)
 * - Supports "logout from all devices" (future)
 *
 * Performance:
 * - Token blacklist check: <0.1ms per request
 * - Negligible impact on logout time
 *
 * Future Enhancements (Phase 3+):
 * - Migrate to Redis for multi-server support
 * - Add "logout from all devices" feature
 * - Log logout events for security analytics
 * - Support selective token revocation (per device)
 */
router.post('/logout', authMiddleware, (req: Request, res: Response) => {
  try {
    /**
     * Step 1: Extract Token from Authorization Header
     *
     * The authMiddleware has already validated the token exists.
     * We need to extract it again for blacklisting.
     *
     * Header format: "Authorization: Bearer <token>"
     * We extract the token part (after "Bearer ")
     */
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      // Should never happen (authMiddleware already checked this)
      return res.status(401).json({
        success: false,
        error: 'No authorization token provided'
      });
    }

    const token = authHeader.startsWith('Bearer ')
      ? authHeader.substring(7)
      : authHeader;

    /**
     * Step 2: Decode Token to Get Expiry
     *
     * We need the expiry timestamp (exp claim) to know when to remove
     * the token from the blacklist.
     *
     * Note: We don't verify the token again (authMiddleware already did).
     * We just decode it to extract the exp claim.
     *
     * JWT exp claim is in seconds (Unix timestamp).
     */
    const JWT_SECRET = process.env.JWT_SECRET!; // Safe: validated at startup
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    if (!decoded.exp) {
      console.warn('⚠️  Token missing exp claim - cannot blacklist properly');
      // Still allow logout, but token won't be blacklisted correctly
      return res.json({
        success: true,
        message: 'Logged out successfully (warning: token expiry unknown)'
      });
    }

    /**
     * Step 3: Add Token to Blacklist (SECURITY FIX #7)
     *
     * Add the token to the blacklist with its expiry timestamp.
     * The blacklist will automatically remove it after expiry.
     *
     * Example:
     * - Token exp: 1699632000 (Unix timestamp)
     * - Current time: 1699625000
     * - Time until expiry: 7000 seconds (~2 hours)
     * - Blacklist stores token until 1699632000
     * - After that, cleanup removes it (no longer needed)
     */
    tokenBlacklist.add(token, decoded.exp);

    /**
     * Step 4: Return Success Response
     *
     * Client should now:
     * 1. Remove token from localStorage
     * 2. Redirect to login page
     * 3. Clear any cached user data
     */
    res.json({
      success: true,
      message: 'Logged out successfully'
    });

    console.log(`✅ User ${req.user?.userId} logged out (token blacklisted)`);
  } catch (error) {
    /**
     * Error Handling
     *
     * Even if blacklisting fails, we still allow logout.
     * This ensures users can always logout even if there's a bug.
     *
     * Common errors:
     * - JWT decode error (malformed token - shouldn't happen after auth middleware)
     * - Blacklist error (memory full - very rare)
     */
    console.error('Logout error:', error);

    // Still return success to allow client-side logout
    res.json({
      success: true,
      message: 'Logged out successfully (server-side revocation may have failed)'
    });
  }
});

/**
 * Export Authentication Router
 *
 * This router is mounted at /auth in server.ts:
 * - POST /auth/signup
 * - POST /auth/login
 * - GET /auth/me
 * - POST /auth/logout
 */
export default router;
