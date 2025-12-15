import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Store original env values
const originalEnv = { ...process.env };

// Create shared mock functions that persist across module resets
const mockInfo = vi.fn();
const mockWarn = vi.fn();
const mockError = vi.fn();
const mockDebug = vi.fn();

// Mock the logger module with shared mock functions
vi.mock('../utils/logger', () => ({
  logger: {
    info: mockInfo,
    warn: mockWarn,
    error: mockError,
    debug: mockDebug,
  },
}));

describe('EmailService', () => {
  beforeEach(() => {
    // Reset modules to pick up env changes
    vi.resetModules();
    // Clear mock call history
    mockInfo.mockClear();
    mockWarn.mockClear();
    mockError.mockClear();
    mockDebug.mockClear();
    // Clear env vars
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.SMTP_FROM;
    delete process.env.FRONTEND_URL;
  });

  afterEach(() => {
    // Restore original env
    process.env = { ...originalEnv };
  });

  describe('isConfigured', () => {
    it('should return false when SMTP_HOST is not set', async () => {
      process.env.SMTP_USER = 'user@test.com';
      process.env.SMTP_PASS = 'password';

      const { emailService } = await import('./EmailService');
      expect(emailService.isConfigured()).toBe(false);
    });

    it('should return false when SMTP_USER is not set', async () => {
      process.env.SMTP_HOST = 'smtp.test.com';
      process.env.SMTP_PASS = 'password';

      const { emailService } = await import('./EmailService');
      expect(emailService.isConfigured()).toBe(false);
    });

    it('should return false when SMTP_PASS is not set', async () => {
      process.env.SMTP_HOST = 'smtp.test.com';
      process.env.SMTP_USER = 'user@test.com';

      const { emailService } = await import('./EmailService');
      expect(emailService.isConfigured()).toBe(false);
    });

    it('should return false when no SMTP vars are set', async () => {
      const { emailService } = await import('./EmailService');
      expect(emailService.isConfigured()).toBe(false);
    });

    it('should return true when all required SMTP vars are set', async () => {
      process.env.SMTP_HOST = 'smtp.test.com';
      process.env.SMTP_USER = 'user@test.com';
      process.env.SMTP_PASS = 'password';

      const { emailService } = await import('./EmailService');
      expect(emailService.isConfigured()).toBe(true);
    });
  });

  describe('sendVerificationEmail', () => {
    it('should not throw when SMTP is not configured (logs via logger)', async () => {
      const { emailService } = await import('./EmailService');

      await expect(
        emailService.sendVerificationEmail('test@example.com', 'abc123token')
      ).resolves.not.toThrow();

      // Verify it logged via logger
      expect(mockInfo).toHaveBeenCalledWith(
        'EMAIL (SMTP not configured - logging to console)',
        expect.objectContaining({
          to: 'test@example.com',
        })
      );
    });

    it('should include the token in the verification URL', async () => {
      const { emailService } = await import('./EmailService');
      const testToken = 'test-verification-token-12345';

      await emailService.sendVerificationEmail('test@example.com', testToken);

      // Check that the token was included in the logged output
      expect(mockInfo).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining(testToken),
        })
      );
    });

    it('should include recipient email in log output', async () => {
      const { emailService } = await import('./EmailService');

      await emailService.sendVerificationEmail('recipient@example.com', 'token123');

      expect(mockInfo).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          to: 'recipient@example.com',
        })
      );
    });

    it('should use FRONTEND_URL env var for verification link', async () => {
      process.env.FRONTEND_URL = 'https://myapp.com';

      const { emailService } = await import('./EmailService');

      await emailService.sendVerificationEmail('test@example.com', 'token');

      expect(mockInfo).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('https://myapp.com/verify-email'),
        })
      );
    });

    it('should default to localhost:3001 when FRONTEND_URL not set', async () => {
      const { emailService } = await import('./EmailService');

      await emailService.sendVerificationEmail('test@example.com', 'token');

      expect(mockInfo).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('http://localhost:3001/verify-email'),
        })
      );
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('should not throw when SMTP is not configured (logs via logger)', async () => {
      const { emailService } = await import('./EmailService');

      await expect(
        emailService.sendPasswordResetEmail('test@example.com', 'reset-token-123')
      ).resolves.not.toThrow();

      expect(mockInfo).toHaveBeenCalledWith(
        'EMAIL (SMTP not configured - logging to console)',
        expect.objectContaining({
          to: 'test@example.com',
        })
      );
    });

    it('should include the token in the reset URL', async () => {
      const { emailService } = await import('./EmailService');
      const resetToken = 'password-reset-token-xyz';

      await emailService.sendPasswordResetEmail('test@example.com', resetToken);

      expect(mockInfo).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining(resetToken),
        })
      );
    });

    it('should include recipient email in log output', async () => {
      const { emailService } = await import('./EmailService');

      await emailService.sendPasswordResetEmail('user@domain.com', 'token');

      expect(mockInfo).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          to: 'user@domain.com',
        })
      );
    });

    it('should use FRONTEND_URL env var for reset link', async () => {
      process.env.FRONTEND_URL = 'https://production.app';

      const { emailService } = await import('./EmailService');

      await emailService.sendPasswordResetEmail('test@example.com', 'token');

      expect(mockInfo).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('https://production.app/reset-password'),
        })
      );
    });

    it('should default to localhost:3001 when FRONTEND_URL not set', async () => {
      const { emailService } = await import('./EmailService');

      await emailService.sendPasswordResetEmail('test@example.com', 'token');

      expect(mockInfo).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('http://localhost:3001/reset-password'),
        })
      );
    });

    it('should mention security tip about device logout', async () => {
      const { emailService } = await import('./EmailService');

      await emailService.sendPasswordResetEmail('test@example.com', 'token');

      // The security tip mentions being logged out of all devices
      expect(mockInfo).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('logged out'),
        })
      );
    });
  });

  describe('Email Content', () => {
    it('should include 24-hour expiry message in verification email', async () => {
      const { emailService } = await import('./EmailService');

      await emailService.sendVerificationEmail('test@example.com', 'token');

      expect(mockInfo).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('24 hours'),
        })
      );
    });

    it('should include 1-hour expiry message in password reset email', async () => {
      const { emailService } = await import('./EmailService');

      await emailService.sendPasswordResetEmail('test@example.com', 'token');

      expect(mockInfo).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('1 hour'),
        })
      );
    });

    it('should include AlcheMix branding in verification email', async () => {
      const { emailService } = await import('./EmailService');

      await emailService.sendVerificationEmail('test@example.com', 'token');

      expect(mockInfo).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('AlcheMix'),
        })
      );
    });

    it('should include AlcheMix branding in password reset email', async () => {
      const { emailService } = await import('./EmailService');

      await emailService.sendPasswordResetEmail('test@example.com', 'token');

      expect(mockInfo).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('AlcheMix'),
        })
      );
    });
  });
});
