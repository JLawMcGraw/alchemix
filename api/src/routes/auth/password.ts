/**
 * Password Routes
 *
 * POST /auth/forgot-password - Request password reset
 * POST /auth/reset-password - Reset password with token
 * POST /auth/change-password - Change password (authenticated)
 */

import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { db } from '../../database/db';
import { authMiddleware, getTokenVersion } from '../../middleware/auth';
import { validatePassword } from '../../utils/passwordValidator';
import { emailService } from '../../services/EmailService';
import { UserRow } from '../../types';
import { asyncHandler } from '../../utils/asyncHandler';
import { generateSecureToken, getClearCookieOptions } from './utils';
import { logger } from '../../utils/logger';

const router = Router();

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
 * Security:
 * - Always returns success (prevents email enumeration)
 * - Reset token expires after 1 hour
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
  ).get(email) as UserRow | undefined;

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
    logger.info('Password reset email sent', { email: user.email, action: 'forgot_password' });
  } catch (emailError) {
    const message = emailError instanceof Error ? emailError.message : 'Unknown error';
    logger.warn('Failed to send password reset email', { email: user.email, error: message, action: 'forgot_password' });
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
  ).get(token) as UserRow | undefined;

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

  // Atomic transaction: Update password, clear reset token, and increment token_version
  const resetPasswordTransaction = db.transaction(() => {
    // Update password and clear reset token
    db.prepare(
      'UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?'
    ).run(password_hash, user.id);

    // Increment token version to invalidate all existing sessions
    const currentVersion = getTokenVersion(user.id);
    const newVersion = currentVersion + 1;
    db.prepare('UPDATE users SET token_version = ? WHERE id = ?').run(newVersion, user.id);

    logger.info('Token version incremented', { userId: user.id, oldVersion: currentVersion, newVersion, action: 'reset_password' });
  });

  resetPasswordTransaction();

  logger.info('Password reset completed', { userId: user.id, email: user.email, action: 'reset_password' });

  res.json({
    success: true,
    message: 'Password reset successfully. Please login with your new password.'
  });
}));

/**
 * POST /auth/change-password - Change Password (Authenticated)
 *
 * Allows authenticated users to change their password.
 * Requires current password verification.
 *
 * Request Body:
 * {
 *   "currentPassword": "OldPassword123!",
 *   "newPassword": "NewSecurePassword456!"
 * }
 *
 * Security:
 * - Requires authentication
 * - Verifies current password before allowing change
 * - Validates new password strength
 * - Increments token_version (logs out all other sessions)
 */
router.post('/change-password', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  const { currentPassword, newPassword } = req.body;

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }

  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      success: false,
      error: 'Current password and new password are required'
    });
  }

  // Get user with password hash
  const user = db.prepare(
    'SELECT id, email, password_hash FROM users WHERE id = ?'
  ).get(userId) as UserRow | undefined;

  if (!user) {
    return res.status(404).json({
      success: false,
      error: 'User not found'
    });
  }

  // Verify current password
  const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash!);
  if (!isValidPassword) {
    return res.status(401).json({
      success: false,
      error: 'Current password is incorrect'
    });
  }

  // Validate new password strength
  const passwordValidation = validatePassword(newPassword);
  if (!passwordValidation.isValid) {
    return res.status(400).json({
      success: false,
      error: 'New password does not meet security requirements',
      details: passwordValidation.errors
    });
  }

  // Hash new password
  const password_hash = await bcrypt.hash(newPassword, 10);

  // Atomic transaction: Update password and increment token_version
  const changePasswordTransaction = db.transaction(() => {
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(password_hash, userId);

    // Increment token version to invalidate all existing sessions
    const currentVersion = getTokenVersion(userId);
    const newVersion = currentVersion + 1;
    db.prepare('UPDATE users SET token_version = ? WHERE id = ?').run(newVersion, userId);

    logger.info('Password changed', { userId, oldVersion: currentVersion, newVersion, action: 'change_password' });
  });

  changePasswordTransaction();

  // Clear cookies to force re-login
  res.clearCookie('auth_token', getClearCookieOptions());
  res.clearCookie('csrf_token', {
    ...getClearCookieOptions(),
    httpOnly: false,
  });

  res.json({
    success: true,
    message: 'Password changed successfully. Please login with your new password.'
  });
}));

export default router;
