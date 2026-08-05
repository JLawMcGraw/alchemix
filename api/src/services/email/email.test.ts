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

// Shared transport spies so tests can assert on the payload each provider builds
const mockSendMail = vi.fn().mockResolvedValue({ messageId: 'test-id' });
const mockResendSend = vi.fn().mockResolvedValue({ data: { id: 'test-id' }, error: null });

// Mock nodemailer
vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(() => ({
      verify: vi.fn((callback) => callback(null)),
      sendMail: mockSendMail,
    })),
  },
}));

// Mock resend
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: mockResendSend,
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
    mockSendMail.mockClear();
    mockResendSend.mockClear();
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
          subject: 'Activate Your AlcheMix Account',
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
          subject: 'Reset Your AlcheMix Password',
        })
      );
    });

    it('should log password changed notification without throwing', async () => {
      const { ConsoleProvider } = await import('./providers/console');
      const provider = new ConsoleProvider();

      await expect(
        provider.sendPasswordChangedNotification('test@example.com')
      ).resolves.not.toThrow();

      expect(mockInfo).toHaveBeenCalledWith(
        'EMAIL (no provider configured - logging to console)',
        expect.objectContaining({
          to: 'test@example.com',
          subject: 'Your AlcheMix Password Was Changed',
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

    it('should send password changed notification when configured', async () => {
      process.env.SMTP_HOST = 'smtp.test.com';
      process.env.SMTP_USER = 'user@test.com';
      process.env.SMTP_PASS = 'password';

      const { SmtpProvider } = await import('./providers/smtp');
      const provider = new SmtpProvider();

      await expect(
        provider.sendPasswordChangedNotification('test@example.com')
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

    it('should send password changed notification when configured', async () => {
      process.env.RESEND_API_KEY = 're_test_key';

      const { ResendProvider } = await import('./providers/resend');
      const provider = new ResendProvider();

      await expect(
        provider.sendPasswordChangedNotification('test@example.com')
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
      expect(subject).toBe('Activate Your AlcheMix Account');
    });

    it('should use correct subject for password reset email', async () => {
      const { getPasswordResetEmailContent } = await import('./templates');
      const { subject } = getPasswordResetEmailContent('token');
      expect(subject).toBe('Reset Your AlcheMix Password');
    });

    it('should include logout notice in password reset email', async () => {
      const { getPasswordResetEmailContent } = await import('./templates');
      const { html } = getPasswordResetEmailContent('token');
      expect(html).toContain("logged out of all devices");
    });

    it('should include welcome message in verification email', async () => {
      const { getVerificationEmailContent } = await import('./templates');
      const { html } = getVerificationEmailContent('token');
      expect(html).toContain('Welcome to the Lab');
    });

    it('should use correct subject for password changed email', async () => {
      const { getPasswordChangedEmailContent } = await import('./templates');
      const { subject } = getPasswordChangedEmailContent();
      expect(subject).toBe('Your AlcheMix Password Was Changed');
    });

    it('should include AlcheMix branding in password changed email', async () => {
      const { getPasswordChangedEmailContent } = await import('./templates');
      const { html } = getPasswordChangedEmailContent();
      expect(html).toContain('AlcheMix');
    });

    it('should include security warning in password changed email', async () => {
      const { getPasswordChangedEmailContent } = await import('./templates');
      const { html } = getPasswordChangedEmailContent();
      expect(html).toContain("Didn't make this change");
    });

    it('should include session logout notice in password changed email', async () => {
      const { getPasswordChangedEmailContent } = await import('./templates');
      const { html } = getPasswordChangedEmailContent();
      expect(html).toContain('logged out of all devices');
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

  describe('escapeHtml', () => {
    it('should escape all five HTML-significant characters', async () => {
      const { escapeHtml } = await import('./templates');
      expect(escapeHtml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#39;');
    });

    it('should escape the ampersand first so entities are not double-encoded', async () => {
      const { escapeHtml } = await import('./templates');
      // Naive ordering would turn "<" into "&lt;" then the "&" into "&amp;lt;"
      expect(escapeHtml('a < b & c')).toBe('a &lt; b &amp; c');
    });

    it('should leave ordinary text untouched', async () => {
      const { escapeHtml } = await import('./templates');
      expect(escapeHtml('2 oz gin')).toBe('2 oz gin');
    });
  });

  describe('getRecipeShareEmailContent', () => {
    const recipe = {
      name: 'Negroni',
      ingredients: ['1 oz gin', '1 oz Campari', '1 oz sweet vermouth'],
      instructions: 'Stir with ice, strain over a large cube.',
      glass: 'Rocks',
    };

    it('should put the recipe name in the subject', async () => {
      const { getRecipeShareEmailContent } = await import('./templates');
      const { subject } = getRecipeShareEmailContent(recipe);
      expect(subject).toContain('Negroni');
    });

    it('should render every ingredient line in the HTML body', async () => {
      const { getRecipeShareEmailContent } = await import('./templates');
      const { html } = getRecipeShareEmailContent(recipe);
      for (const ingredient of recipe.ingredients) {
        expect(html).toContain(ingredient);
      }
    });

    it('should render instructions and glass in the HTML body', async () => {
      const { getRecipeShareEmailContent } = await import('./templates');
      const { html } = getRecipeShareEmailContent(recipe);
      expect(html).toContain('Stir with ice, strain over a large cube.');
      expect(html).toContain('Rocks');
    });

    it('should render every ingredient line in the plaintext body', async () => {
      const { getRecipeShareEmailContent } = await import('./templates');
      const { text } = getRecipeShareEmailContent(recipe);
      for (const ingredient of recipe.ingredients) {
        expect(text).toContain(ingredient);
      }
      expect(text).toContain('Negroni');
    });

    it('should escape user text in the HTML body', async () => {
      const { getRecipeShareEmailContent } = await import('./templates');
      const { html } = getRecipeShareEmailContent({
        name: 'Gin & Tonic <b>',
        ingredients: ['2 oz gin & ice'],
        instructions: 'Build <in> glass',
        glass: 'Highball & Co',
      });

      expect(html).toContain('Gin &amp; Tonic &lt;b&gt;');
      expect(html).toContain('2 oz gin &amp; ice');
      expect(html).toContain('Build &lt;in&gt; glass');
      expect(html).toContain('Highball &amp; Co');
      // The injected tag must not survive as markup
      expect(html).not.toContain('Tonic <b>');
    });

    it('should NOT escape user text in the subject or plaintext body', async () => {
      const { getRecipeShareEmailContent } = await import('./templates');
      const { subject, text } = getRecipeShareEmailContent({
        name: 'Gin & Tonic',
        ingredients: ['2 oz gin & ice'],
      });

      // Escaping plaintext would show the reader a literal "&amp;"
      expect(subject).toContain('Gin & Tonic');
      expect(subject).not.toContain('&amp;');
      expect(text).toContain('2 oz gin & ice');
      expect(text).not.toContain('&amp;');
    });

    it('should handle a recipe with no instructions or glass', async () => {
      const { getRecipeShareEmailContent } = await import('./templates');
      const { html, text } = getRecipeShareEmailContent({
        name: 'Mystery',
        ingredients: ['gin'],
      });
      expect(html).toContain('gin');
      expect(text).toContain('gin');
      expect(html).not.toContain('undefined');
      expect(text).not.toContain('undefined');
    });
  });

  describe('sendEmail with attachments', () => {
    const attachment = {
      filename: 'negroni-recipe.png',
      content: 'aGVsbG8=', // base64 for "hello"
      contentType: 'image/png',
    };

    it('ResendProvider should pass attachment content through as a base64 string', async () => {
      process.env.RESEND_API_KEY = 're_test_key';
      const { ResendProvider } = await import('./providers/resend');
      const provider = new ResendProvider();

      await provider.sendEmail({
        to: 'test@example.com',
        subject: 'Your recipe',
        html: '<p>hi</p>',
        text: 'hi',
        attachments: [attachment],
      });

      expect(mockResendSend).toHaveBeenCalledTimes(1);
      const payload = mockResendSend.mock.calls[0][0];
      expect(payload.to).toBe('test@example.com');
      expect(payload.text).toBe('hi');
      expect(payload.attachments).toHaveLength(1);
      expect(payload.attachments[0].filename).toBe('negroni-recipe.png');
      // Resend takes a base64 STRING, not a Buffer
      expect(payload.attachments[0].content).toBe('aGVsbG8=');
      expect(typeof payload.attachments[0].content).toBe('string');
    });

    it('SmtpProvider should convert attachment content to a Buffer', async () => {
      process.env.SMTP_HOST = 'smtp.test.com';
      process.env.SMTP_USER = 'user@test.com';
      process.env.SMTP_PASS = 'password';

      const { SmtpProvider } = await import('./providers/smtp');
      const provider = new SmtpProvider();

      await provider.sendEmail({
        to: 'test@example.com',
        subject: 'Your recipe',
        html: '<p>hi</p>',
        text: 'hi',
        attachments: [attachment],
      });

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      const payload = mockSendMail.mock.calls[0][0];
      expect(payload.text).toBe('hi');
      expect(payload.attachments).toHaveLength(1);
      expect(payload.attachments[0].filename).toBe('negroni-recipe.png');
      // Nodemailer takes a Buffer, NOT a base64 string
      expect(Buffer.isBuffer(payload.attachments[0].content)).toBe(true);
      expect(payload.attachments[0].content.toString('utf8')).toBe('hello');
      expect(payload.attachments[0].contentType).toBe('image/png');
    });

    it('should omit the attachments key entirely when there are none', async () => {
      process.env.RESEND_API_KEY = 're_test_key';
      const { ResendProvider } = await import('./providers/resend');
      const provider = new ResendProvider();

      await provider.sendEmail({
        to: 'test@example.com',
        subject: 'No attachment',
        html: '<p>hi</p>',
      });

      const payload = mockResendSend.mock.calls[0][0];
      expect(payload.attachments).toBeUndefined();
    });

    it('ConsoleProvider should log the attachment count', async () => {
      const { ConsoleProvider } = await import('./providers/console');
      const provider = new ConsoleProvider();

      await provider.sendEmail({
        to: 'test@example.com',
        subject: 'Your recipe',
        html: '<p>hi</p>',
        attachments: [attachment],
      });

      expect(mockInfo).toHaveBeenCalled();
      const logged = mockInfo.mock.calls.find((call) => call[1] && 'attachments' in call[1]);
      expect(logged).toBeDefined();
      expect(logged![1].attachments).toBe(1);
    });

    it('should still route the three notification emails through sendEmail', async () => {
      process.env.RESEND_API_KEY = 're_test_key';
      const { ResendProvider } = await import('./providers/resend');
      const provider = new ResendProvider();

      await provider.sendVerificationEmail('test@example.com', 'token123');

      expect(mockResendSend).toHaveBeenCalledTimes(1);
      const payload = mockResendSend.mock.calls[0][0];
      expect(payload.to).toBe('test@example.com');
      expect(payload.html).toContain('token123');
    });
  });
});
