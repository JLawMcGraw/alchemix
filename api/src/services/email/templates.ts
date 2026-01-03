/**
 * Email Templates
 *
 * Shared HTML email templates for all providers.
 * Maintains consistent branding across different email types.
 *
 * Brand Colors:
 * - Primary (Teal): #0D9488
 * - Background: #F8F9FA
 * - Dark Slate: #0F172A
 * - Text Primary: #1E293B
 * - Text Secondary: #737891
 */

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3001';

/**
 * Generate HTML email template with consistent styling
 * Matches TopNav design: molecule icon + wordmark + tagline
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
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #F8F9FA;">
  <!-- Grid background pattern -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F8F9FA; background-image: linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px); background-size: 32px 32px; padding: 48px 20px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width: 520px; background-color: #ffffff; border-radius: 12px; border: 1px solid #E2E8F0; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
          <!-- Header with Logo -->
          <tr>
            <td style="padding: 32px 40px 28px; text-align: center; border-bottom: 1px solid #E2E8F0;">
              <!-- Molecule dots representing Y-shape nodes -->
              <table cellpadding="0" cellspacing="0" style="margin: 0 auto 12px auto;">
                <tr>
                  <td style="padding: 0 4px;">
                    <div style="width: 10px; height: 10px; background-color: #65A30D; border-radius: 50%; display: inline-block;"></div>
                  </td>
                  <td style="padding: 0 4px;">
                    <div style="width: 10px; height: 10px; background-color: #EC4899; border-radius: 50%; display: inline-block;"></div>
                  </td>
                  <td style="padding: 0 4px;">
                    <div style="width: 10px; height: 10px; background-color: #4A90D9; border-radius: 50%; display: inline-block;"></div>
                  </td>
                  <td style="padding: 0 4px;">
                    <div style="width: 10px; height: 10px; background-color: #F5A623; border-radius: 50%; display: inline-block;"></div>
                  </td>
                </tr>
              </table>
              <!-- Wordmark (Inria Sans fallback to light sans-serif) -->
              <div style="font-family: 'Inria Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 26px; font-weight: 300; color: #1E293B; letter-spacing: 0.08em;">
                ALCHEMIX
              </div>
              <!-- Tagline -->
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 10px; color: #94A3B8; letter-spacing: 0.2em; text-transform: uppercase; margin-top: 8px;">
                Molecular Mixology OS
              </div>
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
            <td style="padding: 24px 40px; text-align: center; background-color: #F8F9FA; border-top: 1px solid #E2E8F0; border-radius: 0 0 12px 12px;">
              <p style="margin: 0; color: #94A3B8; font-size: 12px;">
                If you didn't request this email, you can safely ignore it.
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
    <h2 style="margin: 0 0 12px 0; color: #1E293B; font-size: 22px; font-weight: 600; font-family: 'Inria Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      Welcome to the Lab
    </h2>
    <p style="margin: 0 0 28px 0; color: #64748B; font-size: 15px; line-height: 1.7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      You're one step away from your molecular mixology experience.
      Verify your email to start crafting.
    </p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${verifyUrl}" style="display: inline-block; padding: 14px 28px; background-color: #1E293B; color: #ffffff; text-decoration: none; font-size: 12px; font-weight: 500; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; letter-spacing: 0.06em; text-transform: uppercase; border-radius: 8px;">
        Activate Account
      </a>
    </div>
    <p style="margin: 24px 0 0 0; color: #64748B; font-size: 14px; line-height: 1.6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      This link expires in <strong style="color: #475569;">24 hours</strong>.
    </p>
    <p style="margin: 16px 0 0 0; color: #94A3B8; font-size: 12px; word-break: break-all;">
      <a href="${verifyUrl}" style="color: #0D9488;">${verifyUrl}</a>
    </p>
  `;

  return {
    subject: 'Activate Your AlcheMix Account',
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
    <h2 style="margin: 0 0 12px 0; color: #1E293B; font-size: 22px; font-weight: 600; font-family: 'Inria Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      Reset Your Password
    </h2>
    <p style="margin: 0 0 28px 0; color: #64748B; font-size: 15px; line-height: 1.7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      A password reset was requested for your account.
      Click below to set a new password.
    </p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${resetUrl}" style="display: inline-block; padding: 14px 28px; background-color: #1E293B; color: #ffffff; text-decoration: none; font-size: 12px; font-weight: 500; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; letter-spacing: 0.06em; text-transform: uppercase; border-radius: 8px;">
        Reset Password
      </a>
    </div>
    <p style="margin: 24px 0 0 0; color: #64748B; font-size: 14px; line-height: 1.6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      This link expires in <strong style="color: #475569;">1 hour</strong>. Didn't request this? Ignore this email.
    </p>
    <p style="margin: 16px 0 0 0; color: #94A3B8; font-size: 12px; word-break: break-all;">
      <a href="${resetUrl}" style="color: #0D9488;">${resetUrl}</a>
    </p>
    <div style="margin-top: 28px; padding: 16px 20px; background-color: #F1F5F9; border: 1px solid #E2E8F0; border-radius: 8px;">
      <p style="margin: 0; color: #475569; font-size: 13px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        After resetting, you'll be logged out of all devices.
      </p>
    </div>
  `;

  return {
    subject: 'Reset Your AlcheMix Password',
    html: generateEmailTemplate(content),
  };
}

/**
 * Generate password changed notification email content
 * @returns Object with subject and HTML content
 */
export function getPasswordChangedEmailContent(): { subject: string; html: string } {
  const content = `
    <h2 style="margin: 0 0 12px 0; color: #1E293B; font-size: 22px; font-weight: 600; font-family: 'Inria Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      Password Changed
    </h2>
    <p style="margin: 0 0 28px 0; color: #64748B; font-size: 15px; line-height: 1.7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      Your password was just updated. If you made this change, you're all set.
    </p>
    <div style="margin: 28px 0; padding: 16px 20px; background-color: #FEF2F2; border: 1px solid #FECACA; border-radius: 8px;">
      <p style="margin: 0 0 8px 0; color: #991B1B; font-size: 13px; font-weight: 600; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-transform: uppercase; letter-spacing: 0.04em;">
        Didn't make this change?
      </p>
      <p style="margin: 0; color: #7F1D1D; font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.5;">
        Reset your password immediately using "Forgot Password" on the login page.
      </p>
    </div>
    <p style="margin: 24px 0 0 0; color: #64748B; font-size: 14px; line-height: 1.6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      You've been logged out of all devices and will need to sign in with your new password.
    </p>
  `;

  return {
    subject: 'Your AlcheMix Password Was Changed',
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
