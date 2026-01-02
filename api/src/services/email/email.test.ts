import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Store original env values
const originalEnv = { ...process.env };

// Create shared mock functions that persist across module resets
const mockInfo = vi.fn();
const mockWarn = vi.fn();
const mockError = vi.fn();
const mockDebug = vi.fn();

// Mock the logger module with shared mock functions
vi.mock('../../utils/logger', () => ({
  logger: {
    info: mockInfo,
    warn: mockWarn,
    error: mockError,
    debug: mockDebug,
  },
}));

// Mock nodemailer
vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(() => ({
      verify: vi.fn((callback) => callback(null)),
      sendMail: vi.fn().mockResolvedValue({ messageId: 'test-id' }),
    })),
  },
}));

// Mock resend
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: vi.fn().mockResolvedValue({ data: { id: 'test-id' }, error: null }),
    },
  })),
}));

describe('Email Service', () => {
  beforeEach(() => {
    // Reset modules to pick up env changes
    vi.resetModules();
    // Clear mock call history
    mockInfo.mockClear();
    mockWarn.mockClear();
    mockError.mockClear();
    mockDebug.mockClear();
    // Clear all email-related env vars
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
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

  describe('ConsoleProvider', () => {
    it('should return false for isConfigured', async () => {
      const { ConsoleProvider } = await import('./providers/console');
      const provider = new ConsoleProvider();
      expect(provider.isConfigured()).toBe(false);
    });

    it('should have name "Console"', async () => {
      const { ConsoleProvider } = await import('./providers/console');
      const provider = new ConsoleProvider();
      expect(provider.name).toBe('Console');
    });

    it('should log verification email without throwing', async () => {
      const { ConsoleProvider } = await import('./providers/console');
      const provider = new ConsoleProvider();

      await expect(
        provider.sendVerificationEmail('test@example.com', 'abc123token')
      ).resolves.not.toThrow();

      expect(mockInfo).toHaveBeenCalledWith(
        'EMAIL (no provider configured - logging to console)',
        expect.objectContaining({
          to: 'test@example.com',
          subject: 'Verify your AlcheMix email address',
        })
      );
    });

    it('should log password reset email without throwing', async () => {
      const { ConsoleProvider } = await import('./providers/console');
      const provider = new ConsoleProvider();

      await expect(
        provider.sendPasswordResetEmail('test@example.com', 'reset123token')
      ).resolves.not.toThrow();

      expect(mockInfo).toHaveBeenCalledWith(
        'EMAIL (no provider configured - logging to console)',
        expect.objectContaining({
          to: 'test@example.com',
          subject: 'Reset your AlcheMix password',
        })
      );
    });

    it('should include bodyPreview in log output', async () => {
      const { ConsoleProvider } = await import('./providers/console');
      const provider = new ConsoleProvider();

      await provider.sendVerificationEmail('test@example.com', 'token');

      expect(mockInfo).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          bodyPreview: expect.any(String),
        })
      );
    });
  });

  describe('SmtpProvider', () => {
    it('should return false for isConfigured when SMTP_HOST is not set', async () => {
      process.env.SMTP_USER = 'user@test.com';
      process.env.SMTP_PASS = 'password';

      const { SmtpProvider } = await import('./providers/smtp');
      const provider = new SmtpProvider();
      expect(provider.isConfigured()).toBe(false);
    });

    it('should return false for isConfigured when SMTP_USER is not set', async () => {
      process.env.SMTP_HOST = 'smtp.test.com';
      process.env.SMTP_PASS = 'password';

      const { SmtpProvider } = await import('./providers/smtp');
      const provider = new SmtpProvider();
      expect(provider.isConfigured()).toBe(false);
    });

    it('should return false for isConfigured when SMTP_PASS is not set', async () => {
      process.env.SMTP_HOST = 'smtp.test.com';
      process.env.SMTP_USER = 'user@test.com';

      const { SmtpProvider } = await import('./providers/smtp');
      const provider = new SmtpProvider();
      expect(provider.isConfigured()).toBe(false);
    });

    it('should return true for isConfigured when all SMTP vars are set', async () => {
      process.env.SMTP_HOST = 'smtp.test.com';
      process.env.SMTP_USER = 'user@test.com';
      process.env.SMTP_PASS = 'password';

      const { SmtpProvider } = await import('./providers/smtp');
      const provider = new SmtpProvider();
      expect(provider.isConfigured()).toBe(true);
    });

    it('should have name "SMTP"', async () => {
      const { SmtpProvider } = await import('./providers/smtp');
      const provider = new SmtpProvider();
      expect(provider.name).toBe('SMTP');
    });

    it('should send verification email when configured', async () => {
      process.env.SMTP_HOST = 'smtp.test.com';
      process.env.SMTP_USER = 'user@test.com';
      process.env.SMTP_PASS = 'password';

      const { SmtpProvider } = await import('./providers/smtp');
      const provider = new SmtpProvider();

      await expect(
        provider.sendVerificationEmail('test@example.com', 'token123')
      ).resolves.not.toThrow();
    });

    it('should send password reset email when configured', async () => {
      process.env.SMTP_HOST = 'smtp.test.com';
      process.env.SMTP_USER = 'user@test.com';
      process.env.SMTP_PASS = 'password';

      const { SmtpProvider } = await import('./providers/smtp');
      const provider = new SmtpProvider();

      await expect(
        provider.sendPasswordResetEmail('test@example.com', 'token123')
      ).resolves.not.toThrow();
    });

    it('should throw when not configured and trying to send', async () => {
      const { SmtpProvider } = await import('./providers/smtp');
      const provider = new SmtpProvider();

      await expect(
        provider.sendVerificationEmail('test@example.com', 'token')
      ).rejects.toThrow('SMTP provider not configured');
    });
  });

  describe('ResendProvider', () => {
    it('should return false for isConfigured when RESEND_API_KEY is not set', async () => {
      const { ResendProvider } = await import('./providers/resend');
      const provider = new ResendProvider();
      expect(provider.isConfigured()).toBe(false);
    });

    it('should return true for isConfigured when RESEND_API_KEY is set', async () => {
      process.env.RESEND_API_KEY = 're_test_key';

      const { ResendProvider } = await import('./providers/resend');
      const provider = new ResendProvider();
      expect(provider.isConfigured()).toBe(true);
    });

    it('should have name "Resend"', async () => {
      const { ResendProvider } = await import('./providers/resend');
      const provider = new ResendProvider();
      expect(provider.name).toBe('Resend');
    });

    it('should send verification email when configured', async () => {
      process.env.RESEND_API_KEY = 're_test_key';

      const { ResendProvider } = await import('./providers/resend');
      const provider = new ResendProvider();

      await expect(
        provider.sendVerificationEmail('test@example.com', 'token123')
      ).resolves.not.toThrow();
    });

    it('should send password reset email when configured', async () => {
      process.env.RESEND_API_KEY = 're_test_key';

      const { ResendProvider } = await import('./providers/resend');
      const provider = new ResendProvider();

      await expect(
        provider.sendPasswordResetEmail('test@example.com', 'token123')
      ).resolves.not.toThrow();
    });

    it('should throw when not configured and trying to send', async () => {
      const { ResendProvider } = await import('./providers/resend');
      const provider = new ResendProvider();

      await expect(
        provider.sendVerificationEmail('test@example.com', 'token')
      ).rejects.toThrow('Resend provider not configured');
    });
  });

  describe('Provider Selection', () => {
    it('should select Resend when RESEND_API_KEY is set', async () => {
      process.env.RESEND_API_KEY = 're_test_key';

      const { emailService } = await import('./index');
      expect(emailService.name).toBe('Resend');
    });

    it('should select SMTP when only SMTP vars are set', async () => {
      process.env.SMTP_HOST = 'smtp.test.com';
      process.env.SMTP_USER = 'user@test.com';
      process.env.SMTP_PASS = 'password';

      const { emailService } = await import('./index');
      expect(emailService.name).toBe('SMTP');
    });

    it('should select Console when no provider is configured', async () => {
      const { emailService } = await import('./index');
      expect(emailService.name).toBe('Console');
    });

    it('should prefer Resend over SMTP when both are configured', async () => {
      process.env.RESEND_API_KEY = 're_test_key';
      process.env.SMTP_HOST = 'smtp.test.com';
      process.env.SMTP_USER = 'user@test.com';
      process.env.SMTP_PASS = 'password';

      const { emailService } = await import('./index');
      expect(emailService.name).toBe('Resend');
    });
  });

  describe('Email Templates', () => {
    it('should include 24-hour expiry in verification email', async () => {
      const { getVerificationEmailContent } = await import('./templates');
      const { html } = getVerificationEmailContent('token');
      expect(html).toContain('24 hours');
    });

    it('should include 1-hour expiry in password reset email', async () => {
      const { getPasswordResetEmailContent } = await import('./templates');
      const { html } = getPasswordResetEmailContent('token');
      expect(html).toContain('1 hour');
    });

    it('should include AlcheMix branding in verification email', async () => {
      const { getVerificationEmailContent } = await import('./templates');
      const { html } = getVerificationEmailContent('token');
      expect(html).toContain('AlcheMix');
    });

    it('should include AlcheMix branding in password reset email', async () => {
      const { getPasswordResetEmailContent } = await import('./templates');
      const { html } = getPasswordResetEmailContent('token');
      expect(html).toContain('AlcheMix');
    });

    it('should include verification URL in verification email', async () => {
      const { getVerificationEmailContent } = await import('./templates');
      const { html } = getVerificationEmailContent('test-token-123');
      expect(html).toContain('/verify-email?token=test-token-123');
    });

    it('should include reset URL in password reset email', async () => {
      const { getPasswordResetEmailContent } = await import('./templates');
      const { html } = getPasswordResetEmailContent('test-token-456');
      expect(html).toContain('/reset-password?token=test-token-456');
    });

    it('should use correct subject for verification email', async () => {
      const { getVerificationEmailContent } = await import('./templates');
      const { subject } = getVerificationEmailContent('token');
      expect(subject).toBe('Verify your AlcheMix email address');
    });

    it('should use correct subject for password reset email', async () => {
      const { getPasswordResetEmailContent } = await import('./templates');
      const { subject } = getPasswordResetEmailContent('token');
      expect(subject).toBe('Reset your AlcheMix password');
    });

    it('should include security tip in password reset email', async () => {
      const { getPasswordResetEmailContent } = await import('./templates');
      const { html } = getPasswordResetEmailContent('token');
      expect(html).toContain('Security tip');
    });

    it('should include welcome message in verification email', async () => {
      const { getVerificationEmailContent } = await import('./templates');
      const { html } = getVerificationEmailContent('token');
      expect(html).toContain('Welcome to AlcheMix');
    });
  });

  describe('Token Redaction', () => {
    it('should remove tokens in URLs when stripping HTML', async () => {
      const { redactForLogging } = await import('./templates');
      // Tokens in href attributes are stripped along with HTML tags
      const html = '<a href="http://example.com/verify?token=abc123def456abc123def456abc123def456">Click</a>';
      const redacted = redactForLogging(html);
      expect(redacted).not.toContain('abc123def456abc123def456abc123def456');
      expect(redacted).toBe('Click'); // Only text content remains
    });

    it('should redact tokens in plain text URLs', async () => {
      const { redactForLogging } = await import('./templates');
      // Tokens in visible text URLs should be redacted
      const html = 'Visit: http://example.com/verify?token=abc123def456abc123def456abc123def456';
      const redacted = redactForLogging(html);
      expect(redacted).not.toContain('abc123def456abc123def456abc123def456');
      expect(redacted).toContain('[REDACTED]');
    });

    it('should strip HTML tags', async () => {
      const { redactForLogging } = await import('./templates');
      const html = '<h1>Hello</h1><p>World</p>';
      const redacted = redactForLogging(html);
      expect(redacted).not.toContain('<h1>');
      expect(redacted).not.toContain('</h1>');
      expect(redacted).toContain('Hello');
      expect(redacted).toContain('World');
    });

    it('should limit output to 500 characters', async () => {
      const { redactForLogging } = await import('./templates');
      const html = 'A'.repeat(1000);
      const redacted = redactForLogging(html);
      expect(redacted.length).toBeLessThanOrEqual(500);
    });
  });
});
