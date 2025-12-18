/**
 * Login/Logout Routes
 *
 * POST /auth/login - Authenticate user
 * POST /auth/logout - End user session
 */

import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { queryOne } from '../../database/db';
import { generateToken, authMiddleware, getTokenVersion, generateJTI } from '../../middleware/auth';
import { tokenBlacklist } from '../../utils/tokenBlacklist';
import { UserRow } from '../../types';
import { asyncHandler } from '../../utils/asyncHandler';
import { generateCSRFToken, getAuthCookieOptions, getCSRFCookieOptions, getClearCookieOptions } from './utils';
import { logger } from '../../utils/logger';

const router = Router();

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
 *     "csrfToken": "...",
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
 * - Constant-time comparison prevents timing attacks
 * - Generic error message prevents email enumeration
 * - bcrypt comparison is inherently timing-safe
 */
router.post('/login', asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  // Step 1: Basic Input Validation
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: 'Email and password are required'
    });
  }

  // Step 2: Fetch User from Database
  const user = await queryOne<UserRow>(
    'SELECT id, email, password_hash, created_at, is_verified FROM users WHERE email = $1',
    [email]
  );

  // Step 3: Timing Attack Prevention
  // Always run bcrypt.compare() even for non-existent users
  const dummyHash = '$2b$10$YourDummyHashHereForTimingConsistencyProtection1234567890';
  const hashToCompare = user?.password_hash || dummyHash;

  // Step 4: Verify Password (Constant-Time)
  const isValidPassword = await bcrypt.compare(password, hashToCompare);

  // Step 5: Check Authentication Success
  if (!user || !user.password_hash || !isValidPassword) {
    return res.status(401).json({
      success: false,
      error: 'Invalid email or password'
    });
  }

  // Step 6: Generate JWT Token
  const tokenVersion = await getTokenVersion(user.id);
  const jti = generateJTI();
  const token = generateToken({
    userId: user.id,
    email: user.email,
    tokenVersion: tokenVersion,
    jti: jti
  });

  // Step 7: Remove Sensitive Data
  const { password_hash, verification_token, verification_token_expires, reset_token, reset_token_expires, ...userWithoutSensitiveData } = user;

  // Step 8: Set httpOnly Cookie and Return Success Response
  const csrfToken = generateCSRFToken();

  // Set JWT in httpOnly cookie
  res.cookie('auth_token', token, getAuthCookieOptions());

  // Set CSRF token in a separate non-httpOnly cookie
  res.cookie('csrf_token', csrfToken, getCSRFCookieOptions());

  res.json({
    success: true,
    data: {
      csrfToken,
      user: {
        ...userWithoutSensitiveData,
        is_verified: Boolean(userWithoutSensitiveData.is_verified)
      }
    }
  });
}));

/**
 * POST /auth/logout - End User Session
 *
 * Logs out the currently authenticated user by revoking their JWT token.
 *
 * Security:
 * - Token blacklist for immediate logout
 * - Clears httpOnly cookies
 */
router.post('/logout', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  // Step 1: Extract Token from Cookie or Authorization Header
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

  // Step 2: Decode Token to Get Expiry
  const JWT_SECRET = process.env.JWT_SECRET!;
  const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;

  if (!decoded.exp) {
    logger.warn('Token missing exp claim - cannot blacklist properly', { userId: req.user?.userId });
    return res.json({
      success: true,
      message: 'Logged out successfully (warning: token expiry unknown)'
    });
  }

  // Step 3: Add Token to Blacklist
  tokenBlacklist.add(token, decoded.exp);

  // Step 4: Clear Cookies
  res.clearCookie('auth_token', getClearCookieOptions());
  res.clearCookie('csrf_token', {
    ...getClearCookieOptions(),
    httpOnly: false,
  });

  logger.info('User logged out', { userId: req.user?.userId, action: 'logout' });

  res.json({
    success: true,
    message: 'Logged out successfully'
  });
}));

export default router;
