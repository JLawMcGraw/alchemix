/**
 * Authentication Routes
 *
 * Combines all auth-related routes into a single router.
 *
 * Routes:
 * - POST /auth/signup - Create new user account
 * - POST /auth/login - Authenticate user
 * - POST /auth/logout - End user session
 * - GET /auth/me - Get current user info
 * - POST /auth/verify-email - Verify user's email
 * - POST /auth/resend-verification - Resend verification email
 * - POST /auth/forgot-password - Request password reset
 * - POST /auth/reset-password - Reset password with token
 * - POST /auth/change-password - Change password (authenticated)
 * - DELETE /auth/account - Delete user account
 * - GET /auth/export - Export all user data
 * - POST /auth/import - Import user data
 *
 * Security Features:
 * - Password hashing with bcrypt (10 salt rounds)
 * - JWT token generation for session management
 * - Strong password validation
 * - Token blacklist for immediate logout
 * - Session fixation protection via token versioning
 * - Rate limiting on signup/login
 * - Email verification (soft block)
 * - Secure password reset with time-limited tokens
 */

import { Router } from 'express';
import signupRouter from './signup';
import loginRouter from './login';
import verificationRouter from './verification';
import passwordRouter from './password';
import accountRouter from './account';

const router = Router();

// Mount all auth sub-routers
router.use(signupRouter);      // POST /signup
router.use(loginRouter);       // POST /login, POST /logout
router.use(verificationRouter); // POST /verify-email, POST /resend-verification
router.use(passwordRouter);    // POST /forgot-password, POST /reset-password, POST /change-password
router.use(accountRouter);     // GET /me, DELETE /account, GET /export, POST /import

export default router;
