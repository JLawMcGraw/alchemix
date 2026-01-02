/**
 * Email Templates
 *
 * Shared HTML email templates for all providers.
 * Maintains consistent branding across different email types.
 */

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3001';

/**
 * Generate HTML email template with consistent styling
 */
export function generateEmailTemplate(content: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AlcheMix</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 40px; text-align: center; border-bottom: 1px solid #eee;">
              <h1 style="margin: 0; color: #1a1a1a; font-size: 28px; font-weight: 600;">
                AlcheMix
              </h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; text-align: center; background-color: #fafafa; border-top: 1px solid #eee; border-radius: 0 0 8px 8px;">
              <p style="margin: 0; color: #888; font-size: 13px;">
                This email was sent by AlcheMix. If you didn't request this, you can safely ignore it.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Generate verification email content
 * @param token - Verification token
 * @returns Object with subject and HTML content
 */
export function getVerificationEmailContent(token: string): { subject: string; html: string } {
  const verifyUrl = `${FRONTEND_URL}/verify-email?token=${token}`;

  const content = `
    <h2 style="margin: 0 0 16px 0; color: #1a1a1a; font-size: 24px; font-weight: 600;">
      Welcome to AlcheMix!
    </h2>
    <p style="margin: 0 0 24px 0; color: #444; font-size: 16px; line-height: 1.6;">
      Thanks for signing up! Please verify your email address to unlock all features.
    </p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${verifyUrl}" style="display: inline-block; padding: 14px 32px; background-color: #2563eb; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 500; border-radius: 6px;">
        Verify Email Address
      </a>
    </div>
    <p style="margin: 24px 0 0 0; color: #666; font-size: 14px; line-height: 1.6;">
      This link will expire in <strong>24 hours</strong>. If you didn't create an account, you can safely ignore this email.
    </p>
    <p style="margin: 16px 0 0 0; color: #888; font-size: 13px;">
      If the button doesn't work, copy and paste this link into your browser:<br>
      <a href="${verifyUrl}" style="color: #2563eb; word-break: break-all;">${verifyUrl}</a>
    </p>
  `;

  return {
    subject: 'Verify your AlcheMix email address',
    html: generateEmailTemplate(content),
  };
}

/**
 * Generate password reset email content
 * @param token - Reset token
 * @returns Object with subject and HTML content
 */
export function getPasswordResetEmailContent(token: string): { subject: string; html: string } {
  const resetUrl = `${FRONTEND_URL}/reset-password?token=${token}`;

  const content = `
    <h2 style="margin: 0 0 16px 0; color: #1a1a1a; font-size: 24px; font-weight: 600;">
      Reset Your Password
    </h2>
    <p style="margin: 0 0 24px 0; color: #444; font-size: 16px; line-height: 1.6;">
      We received a request to reset your password. Click the button below to create a new password.
    </p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${resetUrl}" style="display: inline-block; padding: 14px 32px; background-color: #dc2626; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 500; border-radius: 6px;">
        Reset Password
      </a>
    </div>
    <p style="margin: 24px 0 0 0; color: #666; font-size: 14px; line-height: 1.6;">
      This link will expire in <strong>1 hour</strong> for security reasons. If you didn't request a password reset, you can safely ignore this email - your password will remain unchanged.
    </p>
    <p style="margin: 16px 0 0 0; color: #888; font-size: 13px;">
      If the button doesn't work, copy and paste this link into your browser:<br>
      <a href="${resetUrl}" style="color: #2563eb; word-break: break-all;">${resetUrl}</a>
    </p>
    <div style="margin-top: 32px; padding: 16px; background-color: #fef3c7; border-radius: 6px;">
      <p style="margin: 0; color: #92400e; font-size: 14px;">
        <strong>Security tip:</strong> After resetting your password, you'll be logged out of all devices for your protection.
      </p>
    </div>
  `;

  return {
    subject: 'Reset your AlcheMix password',
    html: generateEmailTemplate(content),
  };
}

/**
 * Redact tokens from HTML content for safe logging
 * @param html - HTML content to redact
 * @returns Redacted plain text (max 500 chars)
 */
export function redactForLogging(html: string): string {
  return html
    .replace(/<[^>]*>/g, '') // Strip HTML tags
    .replace(/token=[a-f0-9]{32,}/gi, 'token=[REDACTED]') // Redact token params
    .replace(/\/verify\/[a-f0-9]{32,}/gi, '/verify/[REDACTED]') // Redact verify URLs
    .replace(/\/reset\/[a-f0-9]{32,}/gi, '/reset/[REDACTED]') // Redact reset URLs
    .substring(0, 500); // Limit length for logs
}
