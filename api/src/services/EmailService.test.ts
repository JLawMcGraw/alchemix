import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Store original env values
const originalEnv = { ...process.env };

describe('EmailService', () => {
  beforeEach(() => {
    // Reset modules to pick up env changes
    vi.resetModules();
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
    vi.restoreAllMocks();
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
    it('should not throw when SMTP is not configured (logs to console)', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const { emailService } = await import('./EmailService');

      await expect(
        emailService.sendVerificationEmail('test@example.com', 'abc123token')
      ).resolves.not.toThrow();

      // Verify it logged to console
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('EMAIL')
      );

      consoleSpy.mockRestore();
    });

    it('should include the token in the verification URL', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const { emailService } = await import('./EmailService');
      const testToken = 'test-verification-token-12345';

      await emailService.sendVerificationEmail('test@example.com', testToken);

      // Check that the token was included in the logged output
      const loggedCalls = consoleSpy.mock.calls.flat().join(' ');
      expect(loggedCalls).toContain(testToken);

      consoleSpy.mockRestore();
    });

    it('should include recipient email in log output', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const { emailService } = await import('./EmailService');

      await emailService.sendVerificationEmail('recipient@example.com', 'token123');

      const loggedCalls = consoleSpy.mock.calls.flat().join(' ');
      expect(loggedCalls).toContain('recipient@example.com');

      consoleSpy.mockRestore();
    });

    it('should use FRONTEND_URL env var for verification link', async () => {
      process.env.FRONTEND_URL = 'https://myapp.com';
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const { emailService } = await import('./EmailService');

      await emailService.sendVerificationEmail('test@example.com', 'token');

      const loggedCalls = consoleSpy.mock.calls.flat().join(' ');
      expect(loggedCalls).toContain('https://myapp.com/verify-email');

      consoleSpy.mockRestore();
    });

    it('should default to localhost:3001 when FRONTEND_URL not set', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const { emailService } = await import('./EmailService');

      await emailService.sendVerificationEmail('test@example.com', 'token');

      const loggedCalls = consoleSpy.mock.calls.flat().join(' ');
      expect(loggedCalls).toContain('http://localhost:3001/verify-email');

      consoleSpy.mockRestore();
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('should not throw when SMTP is not configured (logs to console)', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const { emailService } = await import('./EmailService');

      await expect(
        emailService.sendPasswordResetEmail('test@example.com', 'reset-token-123')
      ).resolves.not.toThrow();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('EMAIL')
      );

      consoleSpy.mockRestore();
    });

    it('should include the token in the reset URL', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const { emailService } = await import('./EmailService');
      const resetToken = 'password-reset-token-xyz';

      await emailService.sendPasswordResetEmail('test@example.com', resetToken);

      const loggedCalls = consoleSpy.mock.calls.flat().join(' ');
      expect(loggedCalls).toContain(resetToken);

      consoleSpy.mockRestore();
    });

    it('should include recipient email in log output', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const { emailService } = await import('./EmailService');

      await emailService.sendPasswordResetEmail('user@domain.com', 'token');

      const loggedCalls = consoleSpy.mock.calls.flat().join(' ');
      expect(loggedCalls).toContain('user@domain.com');

      consoleSpy.mockRestore();
    });

    it('should use FRONTEND_URL env var for reset link', async () => {
      process.env.FRONTEND_URL = 'https://production.app';
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const { emailService } = await import('./EmailService');

      await emailService.sendPasswordResetEmail('test@example.com', 'token');

      const loggedCalls = consoleSpy.mock.calls.flat().join(' ');
      expect(loggedCalls).toContain('https://production.app/reset-password');

      consoleSpy.mockRestore();
    });

    it('should default to localhost:3001 when FRONTEND_URL not set', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const { emailService } = await import('./EmailService');

      await emailService.sendPasswordResetEmail('test@example.com', 'token');

      const loggedCalls = consoleSpy.mock.calls.flat().join(' ');
      expect(loggedCalls).toContain('http://localhost:3001/reset-password');

      consoleSpy.mockRestore();
    });

    it('should mention security tip about device logout', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const { emailService } = await import('./EmailService');

      await emailService.sendPasswordResetEmail('test@example.com', 'token');

      const loggedCalls = consoleSpy.mock.calls.flat().join(' ');
      // The security tip mentions being logged out of all devices
      expect(loggedCalls).toContain('logged out');

      consoleSpy.mockRestore();
    });
  });

  describe('Email Content', () => {
    it('should include 24-hour expiry message in verification email', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const { emailService } = await import('./EmailService');

      await emailService.sendVerificationEmail('test@example.com', 'token');

      const loggedCalls = consoleSpy.mock.calls.flat().join(' ');
      expect(loggedCalls).toContain('24 hours');

      consoleSpy.mockRestore();
    });

    it('should include 1-hour expiry message in password reset email', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const { emailService } = await import('./EmailService');

      await emailService.sendPasswordResetEmail('test@example.com', 'token');

      const loggedCalls = consoleSpy.mock.calls.flat().join(' ');
      expect(loggedCalls).toContain('1 hour');

      consoleSpy.mockRestore();
    });

    it('should include AlcheMix branding in verification email', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const { emailService } = await import('./EmailService');

      await emailService.sendVerificationEmail('test@example.com', 'token');

      const loggedCalls = consoleSpy.mock.calls.flat().join(' ');
      expect(loggedCalls).toContain('AlcheMix');

      consoleSpy.mockRestore();
    });

    it('should include AlcheMix branding in password reset email', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const { emailService } = await import('./EmailService');

      await emailService.sendPasswordResetEmail('test@example.com', 'token');

      const loggedCalls = consoleSpy.mock.calls.flat().join(' ');
      expect(loggedCalls).toContain('AlcheMix');

      consoleSpy.mockRestore();
    });
  });
});
