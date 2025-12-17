/**
 * Email Verification Routes
 *
 * POST /auth/verify-email - Verify user's email address
 * POST /auth/resend-verification - Resend verification email
 */

import { Router, Request, Response } from 'express';
import { db } from '../../database/db';
import { authMiddleware } from '../../middleware/auth';
import { emailService } from '../../services/EmailService';
import { UserRow } from '../../types';
import { asyncHandler } from '../../utils/asyncHandler';
import { generateSecureToken } from './utils';
import { logger } from '../../utils/logger';

const router = Router();

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
  ).get(token) as UserRow | undefined;

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

  logger.info('Email verified', { userId: user.id, email: user.email, action: 'verify_email' });

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
      error: 'Authentication required'
    });
  }

  // Get user's current verification status
  const user = db.prepare(
    'SELECT id, email, is_verified FROM users WHERE id = ?'
  ).get(userId) as UserRow | undefined;

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
    logger.info('Verification email resent', { email: user.email, action: 'resend_verification' });
  } catch (emailError) {
    const message = emailError instanceof Error ? emailError.message : 'Unknown error';
    logger.error('Failed to send verification email', { email: user.email, error: message, action: 'resend_verification' });
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

export default router;
