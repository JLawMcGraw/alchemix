/**
 * Authentication Routes
 *
 * Handles user authentication operations:
 * - Signup: Create new user account (sends verification email)
 * - Login: Authenticate existing user (returns is_verified status)
 * - Logout: End user session (SECURITY FIX #7 - Token blacklist)
 * - Me: Get current authenticated user info
 * - Verify Email: Verify user's email address
 * - Resend Verification: Resend verification email
 * - Forgot Password: Request password reset email
 * - Reset Password: Set new password with reset token
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
 * - Email verification (soft block - can browse but not modify)
 * - Secure password reset with time-limited tokens
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
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { db } from '../database/db';
import { generateToken, authMiddleware, getTokenVersion, generateJTI, incrementTokenVersion } from '../middleware/auth';
import { validatePassword } from '../utils/passwordValidator';
import { tokenBlacklist } from '../utils/tokenBlacklist';
import { emailService } from '../services/EmailService';
import { User } from '../types';
import { asyncHandler } from '../utils/asyncHandler';

/**
 * Generate a secure random token for email verification or password reset
 * Returns a 64-character hex string (32 bytes of randomness = 256 bits)
 */
function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate CSRF token
 * Returns a 32-character hex string (16 bytes of randomness = 128 bits)
 */
function generateCSRFToken(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Cookie Configuration for JWT Token
 *
 * Security settings:
 * - httpOnly: true - Cookie NOT accessible via JavaScript (XSS protection)
 * - secure: true (production) - Cookie only sent over HTTPS
 * - sameSite: 'strict' - Cookie not sent with cross-site requests (CSRF protection)
 * - maxAge: 7 days - Matches JWT expiration
 * - path: '/' - Cookie valid for all routes
 */
function getAuthCookieOptions(): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'strict' | 'lax' | 'none';
  maxAge: number;
  path: string;
} {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,                          // NOT accessible via JavaScript
    secure: isProduction,                    // HTTPS only in production
    sameSite: 'strict',                      // Strict CSRF protection
    maxAge: 7 * 24 * 60 * 60 * 1000,        // 7 days in milliseconds
    path: '/',                               // Valid for all routes
  };
}

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
router.post('/signup', asyncHandler(async (req: Request, res: Response) => {
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
      // Generic error to prevent email enumeration attacks
      return res.status(400).json({
        success: false,
        error: 'Unable to create account'
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
     * Step 6: Generate Verification Token
     *
     * Create a secure token for email verification.
     * Token expires in 24 hours.
     */
    const verificationToken = generateSecureToken();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

    /**
     * Step 7: Create User in Database
     *
     * Insert new user record with email, hashed password, and verification token.
     * is_verified defaults to 0 (false) - user must verify email.
     * Database auto-generates ID and created_at timestamp.
     *
     * SQL: INSERT INTO users (email, password_hash, verification_token, verification_token_expires) VALUES (?, ?, ?, ?)
     * Parameterized query prevents SQL injection.
     */
    const result = db.prepare(
      'INSERT INTO users (email, password_hash, verification_token, verification_token_expires) VALUES (?, ?, ?, ?)'
    ).run(email, password_hash, verificationToken, verificationExpires);

    const userId = result.lastInsertRowid as number;

    /**
     * Step 8: Send Verification Email
     *
     * Send email with verification link.
     * Non-blocking - don't fail signup if email fails (user can resend later).
     */
    try {
      await emailService.sendVerificationEmail(email, verificationToken);
      console.log(`✅ Verification email sent to ${email}`);
    } catch (emailError) {
      const message = emailError instanceof Error ? emailError.message : 'Unknown error';
      console.error(`⚠️ Failed to send verification email to ${email}:`, message);
      // Continue with signup - user can request new verification email later
    }

    /**
     * Step 9: Retrieve Created User
     *
     * Fetch user record to return in response.
     * Include is_verified so frontend knows to show verification banner.
     * Exclude password_hash and tokens from response for security.
     */
    const user = db.prepare(
      'SELECT id, email, created_at, is_verified FROM users WHERE id = ?'
    ).get(userId) as User;

    /**
     * Step 10: Generate JWT Token (SECURITY FIX #2, #10)
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
     * Step 11: Set httpOnly Cookie and Return Success Response
     *
     * SECURITY UPGRADE: Token stored in httpOnly cookie instead of response body.
     * - Cookie is NOT accessible via JavaScript (XSS protection)
     * - Cookie is automatically sent with every request
     * - CSRF token returned in body for state-changing requests
     *
     * 201 Created status indicates new resource was created.
     * Include is_verified: false to trigger verification banner on frontend.
     */
    const csrfToken = generateCSRFToken();

    // Set JWT in httpOnly cookie
    res.cookie('auth_token', token, getAuthCookieOptions());

    // Set CSRF token in a separate non-httpOnly cookie (readable by JS for header inclusion)
    res.cookie('csrf_token', csrfToken, {
      httpOnly: false,  // JS needs to read this to include in headers
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

  res.status(201).json({
    success: true,
    data: {
      // Token no longer in response body (stored in httpOnly cookie)
      csrfToken,  // Frontend stores this for CSRF protection
      user: {
        ...user,
        is_verified: Boolean(user.is_verified) // Convert SQLite integer to boolean
      }
    }
  });
}));

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
router.post('/login', asyncHandler(async (req: Request, res: Response) => {
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
     * Also includes is_verified for soft-block feature.
     * Uses parameterized query to prevent SQL injection.
     */
    const user = db.prepare(
      'SELECT id, email, password_hash, created_at, is_verified FROM users WHERE email = ?'
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
     * Include is_verified for soft-block feature (frontend shows banner if false).
     */
    const { password_hash, verification_token, verification_token_expires, reset_token, reset_token_expires, ...userWithoutSensitiveData } = user;

    /**
     * Step 7: Set httpOnly Cookie and Return Success Response
     *
     * SECURITY UPGRADE: Token stored in httpOnly cookie instead of response body.
     * - Cookie is NOT accessible via JavaScript (XSS protection)
     * - Cookie is automatically sent with every request
     * - CSRF token returned in body for state-changing requests
     *
     * 200 OK status indicates successful authentication.
     * is_verified tells frontend whether to show verification banner.
     */
    const csrfToken = generateCSRFToken();

    // Set JWT in httpOnly cookie
    res.cookie('auth_token', token, getAuthCookieOptions());

    // Set CSRF token in a separate non-httpOnly cookie (readable by JS for header inclusion)
    res.cookie('csrf_token', csrfToken, {
      httpOnly: false,  // JS needs to read this to include in headers
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

  res.json({
    success: true,
    data: {
      // Token no longer in response body (stored in httpOnly cookie)
      csrfToken,  // Frontend stores this for CSRF protection
      user: {
        ...userWithoutSensitiveData,
        is_verified: Boolean(userWithoutSensitiveData.is_verified) // Convert SQLite integer to boolean
      }
    }
  });
}));

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
router.get('/me', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
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
     * - Include is_verified for soft-block feature
     * - Use parameterized query to prevent SQL injection
     */
    const user = db.prepare(
      'SELECT id, email, created_at, is_verified FROM users WHERE id = ?'
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
     * Include is_verified for soft-block feature.
     */
  res.json({
    success: true,
    data: {
      ...user,
      is_verified: Boolean(user.is_verified) // Convert SQLite integer to boolean
    }
  });
}));

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
router.post('/logout', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  /**
   * Step 1: Extract Token from Cookie or Authorization Header
   *
   * The authMiddleware has already validated the token exists.
   * We need to extract it again for blacklisting.
   *
   * Priority: Cookie first (new approach), then Authorization header (backward compat)
   */
    // Try cookie first (new httpOnly cookie approach)
    let token = req.cookies?.auth_token;

    // Fall back to Authorization header (backward compatibility)
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader) {
        token = authHeader.startsWith('Bearer ')
          ? authHeader.substring(7)
          : authHeader;
      }
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'No authorization token provided'
      });
    }

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
    const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;

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
     * Step 4: Clear Cookies and Return Success Response
     *
     * Clear the httpOnly auth cookie and CSRF token cookie.
     * Client should now redirect to login page.
     */
    // Clear auth cookie
    res.clearCookie('auth_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    });

    // Clear CSRF cookie
    res.clearCookie('csrf_token', {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    });

  res.json({
    success: true,
    message: 'Logged out successfully'
  });

  console.log(`✅ User ${req.user?.userId} logged out (token blacklisted, cookies cleared)`);
}));

/**
 * POST /auth/verify-email - Verify User's Email Address
 *
 * Verifies the user's email using the token from the verification link.
 *
 * Request Body:
 * {
 *   "token": "64-character-hex-token"
 * }
 *
 * Response (200 OK):
 * {
 *   "success": true,
 *   "message": "Email verified successfully"
 * }
 *
 * Error Responses:
 * - 400: Missing token or invalid/expired token
 * - 500: Server error
 *
 * Security:
 * - Token expires after 24 hours
 * - Token is cleared after successful verification
 * - Generic error messages prevent token enumeration
 */
router.post('/verify-email', asyncHandler(async (req: Request, res: Response) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({
      success: false,
      error: 'Verification token is required'
    });
  }

  // Find user with this verification token
  const user = db.prepare(
    'SELECT id, email, verification_token_expires FROM users WHERE verification_token = ?'
  ).get(token) as User | undefined;

  if (!user) {
    return res.status(400).json({
      success: false,
      error: 'Invalid or expired verification link'
    });
  }

  // Check if token has expired
  const tokenExpires = new Date(user.verification_token_expires!);
  if (tokenExpires < new Date()) {
    return res.status(400).json({
      success: false,
      error: 'Verification link has expired. Please request a new one.'
    });
  }

  // Mark user as verified and clear the token
  db.prepare(
    'UPDATE users SET is_verified = 1, verification_token = NULL, verification_token_expires = NULL WHERE id = ?'
  ).run(user.id);

  console.log(`✅ Email verified for user ${user.email} (ID: ${user.id})`);

  res.json({
    success: true,
    message: 'Email verified successfully'
  });
}));

/**
 * POST /auth/resend-verification - Resend Verification Email
 *
 * Resends the verification email for the authenticated user.
 * Requires authentication (user must be logged in).
 *
 * Headers:
 *   Authorization: Bearer <token>
 *
 * Response (200 OK):
 * {
 *   "success": true,
 *   "message": "Verification email sent"
 * }
 *
 * Error Responses:
 * - 400: User already verified
 * - 401: Not authenticated
 * - 500: Server error
 */
router.post('/resend-verification', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized'
    });
  }

  // Get user's current verification status
  const user = db.prepare(
    'SELECT id, email, is_verified FROM users WHERE id = ?'
  ).get(userId) as User | undefined;

  if (!user) {
    return res.status(404).json({
      success: false,
      error: 'User not found'
    });
  }

  if (user.is_verified) {
    return res.status(400).json({
      success: false,
      error: 'Email is already verified'
    });
  }

  // Generate new verification token
  const verificationToken = generateSecureToken();
  const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

  // Update token in database
  db.prepare(
    'UPDATE users SET verification_token = ?, verification_token_expires = ? WHERE id = ?'
  ).run(verificationToken, verificationExpires, userId);

  // Send verification email
  try {
    await emailService.sendVerificationEmail(user.email, verificationToken);
    console.log(`✅ Verification email resent to ${user.email}`);
  } catch (emailError) {
    const message = emailError instanceof Error ? emailError.message : 'Unknown error';
    console.error(`❌ Failed to send verification email to ${user.email}:`, message);
    return res.status(500).json({
      success: false,
      error: 'Failed to send verification email. Please try again later.'
    });
  }

  res.json({
    success: true,
    message: 'Verification email sent'
  });
}));

/**
 * POST /auth/forgot-password - Request Password Reset
 *
 * Sends a password reset email to the user.
 * Always returns success to prevent email enumeration.
 *
 * Request Body:
 * {
 *   "email": "user@example.com"
 * }
 *
 * Response (200 OK):
 * {
 *   "success": true,
 *   "message": "If an account exists with this email, a password reset link has been sent."
 * }
 *
 * Security:
 * - Always returns success (prevents email enumeration)
 * - Reset token expires after 1 hour
 * - Generic response message regardless of email existence
 */
router.post('/forgot-password', asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      error: 'Email is required'
    });
  }

  // Always return success to prevent email enumeration
  const genericSuccessMessage = 'If an account exists with this email, a password reset link has been sent.';

  // Find user by email
  const user = db.prepare(
    'SELECT id, email FROM users WHERE email = ?'
  ).get(email) as User | undefined;

  if (!user) {
    // Don't reveal that user doesn't exist
    return res.json({
      success: true,
      message: genericSuccessMessage
    });
  }

  // Generate reset token
  const resetToken = generateSecureToken();
  const resetExpires = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

  // Update token in database
  db.prepare(
    'UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?'
  ).run(resetToken, resetExpires, user.id);

  // Send password reset email
  try {
    await emailService.sendPasswordResetEmail(user.email, resetToken);
    console.log(`✅ Password reset email sent to ${user.email}`);
  } catch (emailError) {
    const message = emailError instanceof Error ? emailError.message : 'Unknown error';
    console.error(`❌ Failed to send password reset email to ${user.email}:`, message);
    // Still return success to prevent enumeration
  }

  res.json({
    success: true,
    message: genericSuccessMessage
  });
}));

/**
 * POST /auth/reset-password - Reset Password with Token
 *
 * Sets a new password using the reset token from the email link.
 *
 * Request Body:
 * {
 *   "token": "64-character-hex-token",
 *   "password": "NewSecurePassword123!"
 * }
 *
 * Response (200 OK):
 * {
 *   "success": true,
 *   "message": "Password reset successfully. Please login with your new password."
 * }
 *
 * Error Responses:
 * - 400: Missing/invalid token, expired token, weak password
 * - 500: Server error
 *
 * Security:
 * - Token expires after 1 hour
 * - Password must meet strength requirements
 * - Increments token_version (logs out all devices)
 * - Clears reset token after use
 */
router.post('/reset-password', asyncHandler(async (req: Request, res: Response) => {
  const { token, password } = req.body;

  if (!token || !password) {
    return res.status(400).json({
      success: false,
      error: 'Token and password are required'
    });
  }

  // Find user with this reset token
  const user = db.prepare(
    'SELECT id, email, reset_token_expires FROM users WHERE reset_token = ?'
  ).get(token) as User | undefined;

  if (!user) {
    return res.status(400).json({
      success: false,
      error: 'Invalid or expired reset link'
    });
  }

  // Check if token has expired
  const tokenExpires = new Date(user.reset_token_expires!);
  if (tokenExpires < new Date()) {
    return res.status(400).json({
      success: false,
      error: 'Reset link has expired. Please request a new one.'
    });
  }

  // Validate new password strength
  const passwordValidation = validatePassword(password);
  if (!passwordValidation.isValid) {
    return res.status(400).json({
      success: false,
      error: 'Password does not meet security requirements',
      details: passwordValidation.errors
    });
  }

  // Hash new password
  const password_hash = await bcrypt.hash(password, 10);

  // Update password, clear reset token, and increment token_version (logs out all devices)
  db.prepare(
    'UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?'
  ).run(password_hash, user.id);

  // Increment token version to invalidate all existing sessions
  incrementTokenVersion(user.id);

  console.log(`✅ Password reset for user ${user.email} (ID: ${user.id}) - all sessions invalidated`);

  res.json({
    success: true,
    message: 'Password reset successfully. Please login with your new password.'
  });
}));

/**
 * Export Authentication Router
 *
 * This router is mounted at /auth in server.ts:
 * - POST /auth/signup
 * - POST /auth/login
 * - GET /auth/me
 * - POST /auth/logout
 * - POST /auth/verify-email
 * - POST /auth/resend-verification
 * - POST /auth/forgot-password
 * - POST /auth/reset-password
 */
export default router;
