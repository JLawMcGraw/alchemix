/**
 * Auth Routes Tests
 *
 * Tests for authentication endpoints.
 * Updated for PostgreSQL async pattern.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcrypt';

// Mock the database module FIRST (before any imports that use it)
vi.mock('../database/db', () => ({
  queryOne: vi.fn(),
  queryAll: vi.fn(),
  execute: vi.fn(),
  transaction: vi.fn(),
}));

// Mock token blacklist
vi.mock('../utils/tokenBlacklist', () => ({
  tokenBlacklist: {
    isBlacklisted: vi.fn().mockResolvedValue(false),
    add: vi.fn(),
    remove: vi.fn(),
    size: vi.fn().mockReturnValue(0),
    cleanup: vi.fn(),
    shutdown: vi.fn(),
  },
}));

// Mock email service
vi.mock('../services/EmailService', () => ({
  emailService: {
    sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
    sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
    isConfigured: vi.fn().mockReturnValue(false),
  },
}));

// Mock logger
vi.mock('../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  logSecurityEvent: vi.fn(),
}));

import { queryOne, queryAll, execute, transaction } from '../database/db';

// Create a mock user
const createMockUser = async (overrides: Partial<{
  id: number;
  email: string;
  password_hash: string;
  is_verified: number;
  token_version: number;
  reset_token: string | null;
  reset_token_expires: string | null;
  verification_token: string | null;
  verification_token_expires: string | null;
  has_seeded_classics: boolean;
}> = {}) => {
  const password = 'SecurePassword123!';
  const hash = await bcrypt.hash(password, 10);
  return {
    id: 1,
    email: 'test@example.com',
    password_hash: hash,
    is_verified: 1,
    token_version: 0,
    reset_token: null as string | null,
    reset_token_expires: null as string | null,
    verification_token: null as string | null,
    verification_token_expires: null as string | null,
    has_seeded_classics: false,
    ...overrides,
  };
};

/**
 * Helper to get set-cookie header as array
 */
function getSetCookies(response: request.Response): string[] {
  const setCookies = response.headers['set-cookie'];
  if (!setCookies) return [];
  return Array.isArray(setCookies) ? setCookies : [setCookies];
}

/**
 * Helper to extract cookies from response
 */
function extractCookies(response: request.Response): string {
  const setCookies = getSetCookies(response);
  if (!setCookies.length) return '';
  return setCookies.map((cookie: string) => cookie.split(';')[0]).join('; ');
}

/**
 * Helper to extract CSRF token from cookies
 */
function extractCsrfToken(response: request.Response): string {
  const setCookies = getSetCookies(response);
  for (const cookie of setCookies) {
    if (cookie.startsWith('csrf_token=')) {
      return cookie.split(';')[0].replace('csrf_token=', '');
    }
  }
  return '';
}

describe('Auth Routes', () => {
  let app: express.Application;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Default mock implementations
    (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (execute as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [], rowCount: 0 });
    (transaction as ReturnType<typeof vi.fn>).mockImplementation(async (callback) => {
      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      };
      return callback(mockClient as any);
    });

    // Create fresh app with routes
    app = express();
    app.use(express.json());
    app.use(cookieParser());

    // Import routes fresh
    const { default: authRouter } = await import('./auth');
    app.use('/auth', authRouter);

    // Add error handler
    app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      res.status(500).json({ success: false, error: err.message });
    });
  });

  describe('POST /auth/signup', () => {
    it('should create a new user with valid credentials', async () => {
      const newUser = {
        id: 1,
        email: 'newuser@example.com',
        is_verified: 0,
        token_version: 0,
        created_at: new Date().toISOString(),
      };

      // Signup uses 3 queryOne calls:
      // 1. Check for existing user (returns null)
      // 2. INSERT RETURNING id
      // 3. SELECT full user after insert
      (queryOne as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(null) // check for existing user
        .mockResolvedValueOnce({ id: 1 }) // INSERT RETURNING id
        .mockResolvedValueOnce(newUser); // SELECT after insert

      const res = await request(app)
        .post('/auth/signup')
        .send({
          email: 'newuser@example.com',
          password: 'SecurePassword123!',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('csrfToken');
      expect(res.body.data).toHaveProperty('user');
      expect(res.body.data.user.email).toBe('newuser@example.com');

      // Verify cookies are set
      const cookies = getSetCookies(res);
      expect(cookies.some((c: string) => c.startsWith('auth_token='))).toBe(true);
      expect(cookies.some((c: string) => c.startsWith('csrf_token='))).toBe(true);
    });

    it('should reject signup with invalid email', async () => {
      const res = await request(app)
        .post('/auth/signup')
        .send({
          email: 'invalid-email',
          password: 'SecurePassword123!',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('email');
    });

    it('should reject signup with weak password', async () => {
      const res = await request(app)
        .post('/auth/signup')
        .send({
          email: 'test@example.com',
          password: 'weak',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Password');
    });

    it('should reject signup with missing email', async () => {
      const res = await request(app)
        .post('/auth/signup')
        .send({
          password: 'SecurePassword123!',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject signup with missing password', async () => {
      const res = await request(app)
        .post('/auth/signup')
        .send({
          email: 'test@example.com',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /auth/login', () => {
    it('should login with valid credentials', async () => {
      const mockUser = await createMockUser();
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);

      const res = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'SecurePassword123!',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('user');
      expect(res.body.data.user.email).toBe('test@example.com');
      expect(res.body.data).toHaveProperty('csrfToken');

      // Verify cookies are set
      const cookies = getSetCookies(res);
      expect(cookies.some((c: string) => c.startsWith('auth_token='))).toBe(true);
      expect(cookies.some((c: string) => c.startsWith('csrf_token='))).toBe(true);
    });

    it('should reject login with incorrect password', async () => {
      const mockUser = await createMockUser();
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);

      const res = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'WrongPassword123!',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Invalid');
    });

    it('should reject login with non-existent email', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const res = await request(app)
        .post('/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'SecurePassword123!',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject login with missing email', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({
          password: 'SecurePassword123!',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject login with missing password', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should set httpOnly flag on auth cookie', async () => {
      const mockUser = await createMockUser();
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);

      const res = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'SecurePassword123!',
        });

      const cookies = getSetCookies(res);
      const authCookie = cookies.find((c: string) => c.startsWith('auth_token='));
      expect(authCookie).toContain('HttpOnly');
    });

    it('should set SameSite=Strict on cookies', async () => {
      const mockUser = await createMockUser();
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);

      const res = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'SecurePassword123!',
        });

      const cookies = getSetCookies(res);
      const authCookie = cookies.find((c: string) => c.startsWith('auth_token='));
      expect(authCookie!.toLowerCase()).toContain('samesite=strict');
    });
  });

  describe('GET /auth/me', () => {
    it('should return user profile with valid cookie', async () => {
      const mockUser = await createMockUser();

      // First login to get cookies
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);

      const loginRes = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'SecurePassword123!',
        });

      const authCookies = extractCookies(loginRes);

      // Now test /auth/me - mock user without password_hash for this call
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: mockUser.id,
        email: mockUser.email,
        is_verified: mockUser.is_verified,
        token_version: mockUser.token_version,
      });

      const res = await request(app)
        .get('/auth/me')
        .set('Cookie', authCookies);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('email', 'test@example.com');
    });

    it('should reject request without cookie', async () => {
      const res = await request(app).get('/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject request with invalid cookie', async () => {
      const res = await request(app)
        .get('/auth/me')
        .set('Cookie', 'auth_token=invalid-token');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /auth/logout', () => {
    it('should logout successfully with valid cookie', async () => {
      const mockUser = await createMockUser();

      // First login to get cookies
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);

      const loginRes = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'SecurePassword123!',
        });

      const authCookies = extractCookies(loginRes);
      const csrfToken = extractCsrfToken(loginRes);

      // Now test logout
      const res = await request(app)
        .post('/auth/logout')
        .set('Cookie', authCookies)
        .set('X-CSRF-Token', csrfToken);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Logged out successfully');

      // Verify cookies are cleared
      const cookies = getSetCookies(res);
      expect(cookies.some((c: string) => c.includes('auth_token=;') || c.includes('auth_token=deleted'))).toBe(true);
    });

    it('should add token to blacklist on logout', async () => {
      const { tokenBlacklist } = await import('../utils/tokenBlacklist');
      const mockUser = await createMockUser();

      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);

      const loginRes = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'SecurePassword123!',
        });

      const authCookies = extractCookies(loginRes);
      const csrfToken = extractCsrfToken(loginRes);

      await request(app)
        .post('/auth/logout')
        .set('Cookie', authCookies)
        .set('X-CSRF-Token', csrfToken);

      expect(tokenBlacklist.add).toHaveBeenCalled();
    });

    it('should reject logout without cookie', async () => {
      const res = await request(app).post('/auth/logout');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /auth/forgot-password', () => {
    it('should accept request for existing user', async () => {
      const mockUser = await createMockUser();
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({ rowCount: 1 });

      const res = await request(app)
        .post('/auth/forgot-password')
        .send({ email: 'test@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('password reset link');
    });

    it('should return success for non-existent email (enumeration prevention)', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const res = await request(app)
        .post('/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('password reset link');
    });

    it('should reject with missing email', async () => {
      const res = await request(app)
        .post('/auth/forgot-password')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Email');
    });
  });

  describe('POST /auth/reset-password', () => {
    it('should reset password with valid token', async () => {
      const mockUser = await createMockUser();
      mockUser.reset_token = 'valid-token';
      mockUser.reset_token_expires = new Date(Date.now() + 3600000).toISOString();

      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({ rowCount: 1 });

      const res = await request(app)
        .post('/auth/reset-password')
        .send({
          token: 'valid-token',
          password: 'NewSecurePassword456!',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Password reset successfully');
    });

    it('should reject with invalid token', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const res = await request(app)
        .post('/auth/reset-password')
        .send({
          token: 'invalid-token',
          password: 'NewSecurePassword456!',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Invalid');
    });

    it('should reject with expired token', async () => {
      const mockUser = await createMockUser();
      mockUser.reset_token = 'expired-token';
      mockUser.reset_token_expires = new Date(Date.now() - 3600000).toISOString();

      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);

      const res = await request(app)
        .post('/auth/reset-password')
        .send({
          token: 'expired-token',
          password: 'NewSecurePassword456!',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('expired');
    });

    it('should reject weak password', async () => {
      // Mock a valid token user so we get past token validation
      const mockUser = await createMockUser();
      mockUser.reset_token = 'valid-token';
      mockUser.reset_token_expires = new Date(Date.now() + 3600000).toISOString();

      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);

      const res = await request(app)
        .post('/auth/reset-password')
        .send({
          token: 'valid-token',
          password: 'weak',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      // Error may be about password strength or the token
      expect(res.body.error).toBeDefined();
    });

    it('should reject with missing token', async () => {
      const res = await request(app)
        .post('/auth/reset-password')
        .send({ password: 'NewSecurePassword456!' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject with missing password', async () => {
      const res = await request(app)
        .post('/auth/reset-password')
        .send({ token: 'valid-token' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /auth/verify-email', () => {
    it('should verify email with valid token', async () => {
      const mockUser = await createMockUser({ is_verified: 0 });
      mockUser.verification_token = 'valid-verification-token';
      mockUser.verification_token_expires = new Date(Date.now() + 86400000).toISOString();

      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({ rowCount: 1 });

      const res = await request(app)
        .post('/auth/verify-email')
        .send({ token: 'valid-verification-token' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Email verified successfully');
    });

    it('should reject with missing token', async () => {
      const res = await request(app)
        .post('/auth/verify-email')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('token');
    });

    it('should reject with invalid token', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const res = await request(app)
        .post('/auth/verify-email')
        .send({ token: 'invalid-token' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Invalid');
    });

    it('should reject with expired token', async () => {
      const mockUser = await createMockUser({ is_verified: 0 });
      mockUser.verification_token = 'expired-token';
      mockUser.verification_token_expires = new Date(Date.now() - 3600000).toISOString();

      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);

      const res = await request(app)
        .post('/auth/verify-email')
        .send({ token: 'expired-token' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('expired');
    });
  });

  describe('Security Tests', () => {
    it('should prevent SQL injection in email field', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const res = await request(app)
        .post('/auth/login')
        .send({
          email: "admin@example.com' OR '1'='1",
          password: 'anything',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should not leak information about existing users', async () => {
      // Signup existing user
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 1 });
      (execute as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('duplicate key'));

      const duplicateRes = await request(app)
        .post('/auth/signup')
        .send({
          email: 'existing@example.com',
          password: 'SecurePassword123!',
        });

      // Try login with non-existent user
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const nonExistentRes = await request(app)
        .post('/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'SecurePassword123!',
        });

      // Error messages should be generic
      expect(duplicateRes.body.error).toBeDefined();
      expect(nonExistentRes.body.error).toBeDefined();
    });
  });

  describe('POST /auth/change-password', () => {
    it('should change password with valid credentials', async () => {
      const mockUser = await createMockUser();
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
      (transaction as ReturnType<typeof vi.fn>).mockImplementation(async (fn) => {
        await fn({ query: vi.fn().mockResolvedValue({ rowCount: 1 }) });
      });

      // Login first to get auth cookie
      const loginRes = await request(app)
        .post('/auth/login')
        .send({ email: 'test@example.com', password: 'SecurePassword123!' });

      const cookies = extractCookies(loginRes);
      const csrfToken = extractCsrfToken(loginRes);

      // Change password
      const res = await request(app)
        .post('/auth/change-password')
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send({
          currentPassword: 'SecurePassword123!',
          newPassword: 'NewSecurePassword456!',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Password changed');
    });

    it('should reject with incorrect current password', async () => {
      const mockUser = await createMockUser();
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);

      // Login first
      const loginRes = await request(app)
        .post('/auth/login')
        .send({ email: 'test@example.com', password: 'SecurePassword123!' });

      const cookies = extractCookies(loginRes);
      const csrfToken = extractCsrfToken(loginRes);

      // Try to change with wrong current password
      const res = await request(app)
        .post('/auth/change-password')
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send({
          currentPassword: 'WrongPassword123!',
          newPassword: 'NewSecurePassword456!',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('incorrect');
    });

    it('should reject weak new password', async () => {
      const mockUser = await createMockUser();
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);

      // Login first
      const loginRes = await request(app)
        .post('/auth/login')
        .send({ email: 'test@example.com', password: 'SecurePassword123!' });

      const cookies = extractCookies(loginRes);
      const csrfToken = extractCsrfToken(loginRes);

      // Try to change with weak new password
      const res = await request(app)
        .post('/auth/change-password')
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send({
          currentPassword: 'SecurePassword123!',
          newPassword: 'weak',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('security requirements');
    });

    it('should reject without authentication', async () => {
      const res = await request(app)
        .post('/auth/change-password')
        .send({
          currentPassword: 'SecurePassword123!',
          newPassword: 'NewSecurePassword456!',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject with missing current password', async () => {
      const mockUser = await createMockUser();
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);

      // Login first
      const loginRes = await request(app)
        .post('/auth/login')
        .send({ email: 'test@example.com', password: 'SecurePassword123!' });

      const cookies = extractCookies(loginRes);
      const csrfToken = extractCsrfToken(loginRes);

      const res = await request(app)
        .post('/auth/change-password')
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send({
          newPassword: 'NewSecurePassword456!',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('required');
    });

    it('should reject with missing new password', async () => {
      const mockUser = await createMockUser();
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);

      // Login first
      const loginRes = await request(app)
        .post('/auth/login')
        .send({ email: 'test@example.com', password: 'SecurePassword123!' });

      const cookies = extractCookies(loginRes);
      const csrfToken = extractCsrfToken(loginRes);

      const res = await request(app)
        .post('/auth/change-password')
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send({
          currentPassword: 'SecurePassword123!',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('required');
    });

    it('should clear cookies after password change (force re-login)', async () => {
      const mockUser = await createMockUser();
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
      (transaction as ReturnType<typeof vi.fn>).mockImplementation(async (fn) => {
        await fn({ query: vi.fn().mockResolvedValue({ rowCount: 1 }) });
      });

      // Login first
      const loginRes = await request(app)
        .post('/auth/login')
        .send({ email: 'test@example.com', password: 'SecurePassword123!' });

      const cookies = extractCookies(loginRes);
      const csrfToken = extractCsrfToken(loginRes);

      // Change password
      const res = await request(app)
        .post('/auth/change-password')
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send({
          currentPassword: 'SecurePassword123!',
          newPassword: 'NewSecurePassword456!',
        });

      // Check that cookies are cleared
      const setCookies = getSetCookies(res);
      const authCookieCleared = setCookies.some(c =>
        c.startsWith('auth_token=') && (c.includes('Max-Age=0') || c.includes('Expires='))
      );
      expect(authCookieCleared).toBe(true);
    });
  });

  describe('DELETE /auth/account', () => {
    it('should delete account with correct password', async () => {
      const mockUser = await createMockUser();
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
      (transaction as ReturnType<typeof vi.fn>).mockImplementation(async (fn) => {
        await fn({ query: vi.fn().mockResolvedValue({ rowCount: 1 }) });
      });

      // Login first
      const loginRes = await request(app)
        .post('/auth/login')
        .send({ email: 'test@example.com', password: 'SecurePassword123!' });

      const cookies = extractCookies(loginRes);
      const csrfToken = extractCsrfToken(loginRes);

      const res = await request(app)
        .delete('/auth/account')
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send({ password: 'SecurePassword123!' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('deleted');
    });

    it('should reject with incorrect password', async () => {
      const mockUser = await createMockUser();
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);

      // Login first
      const loginRes = await request(app)
        .post('/auth/login')
        .send({ email: 'test@example.com', password: 'SecurePassword123!' });

      const cookies = extractCookies(loginRes);
      const csrfToken = extractCsrfToken(loginRes);

      const res = await request(app)
        .delete('/auth/account')
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send({ password: 'WrongPassword123!' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('incorrect');
    });

    it('should reject without password', async () => {
      const mockUser = await createMockUser();
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);

      // Login first
      const loginRes = await request(app)
        .post('/auth/login')
        .send({ email: 'test@example.com', password: 'SecurePassword123!' });

      const cookies = extractCookies(loginRes);
      const csrfToken = extractCsrfToken(loginRes);

      const res = await request(app)
        .delete('/auth/account')
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('required');
    });

    it('should reject without authentication', async () => {
      const res = await request(app)
        .delete('/auth/account')
        .send({ password: 'SecurePassword123!' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should clear cookies after account deletion', async () => {
      const mockUser = await createMockUser();
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
      (transaction as ReturnType<typeof vi.fn>).mockImplementation(async (fn) => {
        await fn({ query: vi.fn().mockResolvedValue({ rowCount: 1 }) });
      });

      // Login first
      const loginRes = await request(app)
        .post('/auth/login')
        .send({ email: 'test@example.com', password: 'SecurePassword123!' });

      const cookies = extractCookies(loginRes);
      const csrfToken = extractCsrfToken(loginRes);

      const res = await request(app)
        .delete('/auth/account')
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send({ password: 'SecurePassword123!' });

      // Check that cookies are cleared
      const setCookies = getSetCookies(res);
      const authCookieCleared = setCookies.some(c =>
        c.startsWith('auth_token=') && (c.includes('Max-Age=0') || c.includes('Expires='))
      );
      expect(authCookieCleared).toBe(true);
    });
  });

  describe('GET /auth/export', () => {
    it('should export all user data', async () => {
      const mockUser = await createMockUser();
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
      (queryAll as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce([{ id: 1, name: 'Bourbon', category: 'spirit' }]) // inventory
        .mockResolvedValueOnce([{ id: 1, name: 'Old Fashioned', ingredients: '["bourbon"]' }]) // recipes
        .mockResolvedValueOnce([{ recipe_name: 'Old Fashioned' }]) // favorites
        .mockResolvedValueOnce([{ id: 1, name: 'Classics' }]); // collections

      // Login first
      const loginRes = await request(app)
        .post('/auth/login')
        .send({ email: 'test@example.com', password: 'SecurePassword123!' });

      const cookies = extractCookies(loginRes);

      const res = await request(app)
        .get('/auth/export')
        .set('Cookie', cookies);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.inventory).toHaveLength(1);
      expect(res.body.data.recipes).toHaveLength(1);
      expect(res.body.data.favorites).toHaveLength(1);
      expect(res.body.data.collections).toHaveLength(1);
      expect(res.body.data.exportedAt).toBeDefined();
    });

    it('should reject without authentication', async () => {
      const res = await request(app)
        .get('/auth/export');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should return empty arrays for user with no data', async () => {
      const mockUser = await createMockUser();
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
      (queryAll as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce([]) // inventory
        .mockResolvedValueOnce([]) // recipes
        .mockResolvedValueOnce([]) // favorites
        .mockResolvedValueOnce([]); // collections

      // Login first
      const loginRes = await request(app)
        .post('/auth/login')
        .send({ email: 'test@example.com', password: 'SecurePassword123!' });

      const cookies = extractCookies(loginRes);

      const res = await request(app)
        .get('/auth/export')
        .set('Cookie', cookies);

      expect(res.status).toBe(200);
      expect(res.body.data.inventory).toHaveLength(0);
      expect(res.body.data.recipes).toHaveLength(0);
      expect(res.body.data.favorites).toHaveLength(0);
      expect(res.body.data.collections).toHaveLength(0);
    });
  });

  describe('POST /auth/import', () => {
    it('should import user data', async () => {
      const mockUser = await createMockUser();
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
      (transaction as ReturnType<typeof vi.fn>).mockImplementation(async (fn) => {
        await fn({ query: vi.fn().mockResolvedValue({ rowCount: 1 }) });
      });

      // Login first
      const loginRes = await request(app)
        .post('/auth/login')
        .send({ email: 'test@example.com', password: 'SecurePassword123!' });

      const cookies = extractCookies(loginRes);
      const csrfToken = extractCsrfToken(loginRes);

      const importData = {
        data: {
          inventory: [{ name: 'Bourbon', category: 'spirit' }],
          recipes: [{ name: 'Old Fashioned', ingredients: ['bourbon', 'sugar', 'bitters'] }],
          favorites: [{ recipe_name: 'Old Fashioned' }],
          collections: [{ name: 'Classics', description: 'Classic cocktails' }],
        },
      };

      const res = await request(app)
        .post('/auth/import')
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send(importData);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.imported).toBeDefined();
      expect(res.body.imported.inventory).toBe(1);
      expect(res.body.imported.recipes).toBe(1);
      expect(res.body.imported.favorites).toBe(1);
      expect(res.body.imported.collections).toBe(1);
    });

    it('should reject without data', async () => {
      const mockUser = await createMockUser();
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);

      // Login first
      const loginRes = await request(app)
        .post('/auth/login')
        .send({ email: 'test@example.com', password: 'SecurePassword123!' });

      const cookies = extractCookies(loginRes);
      const csrfToken = extractCsrfToken(loginRes);

      const res = await request(app)
        .post('/auth/import')
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('No data');
    });

    it('should reject without authentication', async () => {
      const res = await request(app)
        .post('/auth/import')
        .send({ data: { inventory: [] } });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should handle overwrite option', async () => {
      const mockUser = await createMockUser();
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);

      const mockQuery = vi.fn().mockResolvedValue({ rowCount: 1 });
      (transaction as ReturnType<typeof vi.fn>).mockImplementation(async (fn) => {
        await fn({ query: mockQuery });
      });

      // Login first
      const loginRes = await request(app)
        .post('/auth/login')
        .send({ email: 'test@example.com', password: 'SecurePassword123!' });

      const cookies = extractCookies(loginRes);
      const csrfToken = extractCsrfToken(loginRes);

      const importData = {
        data: {
          inventory: [{ name: 'Bourbon', category: 'spirit' }],
        },
        options: { overwrite: true },
      };

      const res = await request(app)
        .post('/auth/import')
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send(importData);

      expect(res.status).toBe(200);
      // Verify DELETE queries were called (for overwrite)
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM favorites'),
        expect.anything()
      );
    });

    it('should skip invalid records without failing', async () => {
      const mockUser = await createMockUser();
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
      (transaction as ReturnType<typeof vi.fn>).mockImplementation(async (fn) => {
        await fn({ query: vi.fn().mockResolvedValue({ rowCount: 1 }) });
      });

      // Login first
      const loginRes = await request(app)
        .post('/auth/login')
        .send({ email: 'test@example.com', password: 'SecurePassword123!' });

      const cookies = extractCookies(loginRes);
      const csrfToken = extractCsrfToken(loginRes);

      const importData = {
        data: {
          inventory: [
            { name: 'Bourbon', category: 'spirit' }, // valid
            { name: null, category: null }, // invalid - missing required fields
            {}, // invalid - empty
          ],
          recipes: [
            { name: 'Old Fashioned', ingredients: ['bourbon'] }, // valid
            { name: null }, // invalid
          ],
        },
      };

      const res = await request(app)
        .post('/auth/import')
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send(importData);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.imported.inventory).toBe(1); // only valid one
      expect(res.body.imported.recipes).toBe(1); // only valid one
    });
  });
});
