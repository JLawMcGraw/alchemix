/**
 * Signup Route
 *
 * POST /auth/signup - Create new user account
 */

import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { queryOne, execute } from '../../database/db';
import { generateToken, getTokenVersion, generateJTI } from '../../middleware/auth';
import { validatePassword } from '../../utils/passwordValidator';
import { emailService } from '../../services/email';
import { User } from '../../types';
import { asyncHandler } from '../../utils/asyncHandler';
import { generateSecureToken, generateCSRFToken, getAuthCookieOptions, getCSRFCookieOptions } from './utils';
import { logger } from '../../utils/logger';

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
 *     "csrfToken": "...",
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
 * - JWT token stored in httpOnly cookie
 */
router.post('/signup', asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  // Step 1: Basic Input Validation
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: 'Email and password are required'
    });
  }

  // Step 2: Email Format Validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid email format'
    });
  }

  // Step 3: Strong Password Validation
  const passwordValidation = validatePassword(password);
  if (!passwordValidation.isValid) {
    return res.status(400).json({
      success: false,
      error: 'Password does not meet security requirements',
      details: passwordValidation.errors
    });
  }

  // Step 4: Check for Existing User
  const existingUser = await queryOne<{ id: number }>('SELECT id FROM users WHERE email = $1', [email]);
  if (existingUser) {
    // Generic error to prevent email enumeration attacks
    return res.status(400).json({
      success: false,
      error: 'Unable to create account'
    });
  }

  // Step 5: Hash Password with bcrypt
  const password_hash = await bcrypt.hash(password, 10);

  // Step 6: Generate Verification Token
  const verificationToken = generateSecureToken();
  const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

  // Step 7: Create User in Database
  const result = await queryOne<{ id: number }>(
    'INSERT INTO users (email, password_hash, verification_token, verification_token_expires) VALUES ($1, $2, $3, $4) RETURNING id',
    [email, password_hash, verificationToken, verificationExpires]
  );

  const userId = result!.id;

  // Step 8: Send Verification Email (non-blocking)
  try {
    await emailService.sendVerificationEmail(email, verificationToken);
    logger.info('Verification email sent', { email, action: 'signup' });
  } catch (emailError) {
    const message = emailError instanceof Error ? emailError.message : 'Unknown error';
    logger.warn('Failed to send verification email', { email, error: message, action: 'signup' });
    // Continue with signup - user can request new verification email later
  }

  // Step 9: Retrieve Created User
  const user = await queryOne<User>(
    'SELECT id, email, created_at, is_verified, has_seeded_classics FROM users WHERE id = $1',
    [userId]
  );

  // Step 10: Generate JWT Token
  const tokenVersion = await getTokenVersion(user!.id);
  const jti = generateJTI();
  const token = generateToken({
    userId: user!.id,
    email: user!.email,
    tokenVersion: tokenVersion,
    jti: jti
  });

  // Step 11: Set httpOnly Cookie and Return Success Response
  const csrfToken = generateCSRFToken();

  // Set JWT in httpOnly cookie
  res.cookie('auth_token', token, getAuthCookieOptions());

  // Set CSRF token in a separate non-httpOnly cookie
  res.cookie('csrf_token', csrfToken, getCSRFCookieOptions());

  res.status(201).json({
    success: true,
    data: {
      csrfToken,
      user: {
        ...user!,
        is_verified: Boolean(user!.is_verified),
        has_seeded_classics: Boolean(user!.has_seeded_classics)
      }
    }
  });
}));

export default router;
