/**
 * Email Service
 *
 * Handles sending transactional emails using Nodemailer with SMTP.
 *
 * Features:
 * - Email verification (welcome + verify link)
 * - Password reset (security alert + reset link)
 * - Graceful fallback when SMTP not configured (logs to console)
 *
 * Configuration (via environment variables):
 * - SMTP_HOST: SMTP server hostname (e.g., smtp.gmail.com)
 * - SMTP_PORT: SMTP port (default: 587 for TLS)
 * - SMTP_USER: SMTP username/email
 * - SMTP_PASS: SMTP password or app-specific password
 * - SMTP_FROM: Sender address (e.g., "AlcheMix <noreply@alchemix.app>")
 * - FRONTEND_URL: Base URL for email links (e.g., http://localhost:3001)
 *
 * Gmail Setup:
 * 1. Enable 2FA on Google account
 * 2. Generate App Password: Google Account > Security > App Passwords
 * 3. Use app password as SMTP_PASS (not account password)
 *
 * Security Notes:
 * - Never log email content or tokens in production
 * - Use TLS (port 587) instead of SSL (port 465)
 * - App passwords are separate from account passwords
 */

import nodemailer from 'nodemailer';

// Configuration from environment
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || 'AlcheMix <noreply@alchemix.app>';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3001';

// Check if SMTP is configured
const isConfigured = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);

// Create transporter only if configured
let transporter: nodemailer.Transporter | null = null;

if (isConfigured) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465, // true for 465, false for other ports (STARTTLS)
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  // Verify connection on startup
  transporter.verify((error) => {
    if (error) {
      console.error('❌ SMTP connection failed:', error.message);
    } else {
      console.log('✅ SMTP server is ready to send emails');
    }
  });
} else {
  console.log('⚠️ SMTP not configured - emails will be logged to console');
  console.log('   Set SMTP_HOST, SMTP_USER, SMTP_PASS environment variables to enable email sending');
}

/**
 * Send an email (or log if SMTP not configured)
 */
async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!transporter) {
    // Development mode: log email to console
    console.log('\n📧 EMAIL (SMTP not configured - logging to console):');
    console.log(`   To: ${to}`);
    console.log(`   Subject: ${subject}`);
    console.log(`   Body:\n${html.replace(/<[^>]*>/g, '')}\n`); // Strip HTML for console
    return;
  }

  try {
    await transporter.sendMail({
      from: SMTP_FROM,
      to,
      subject,
      html,
    });
    console.log(`✅ Email sent successfully to ${to}`);
  } catch (error: any) {
    console.error(`❌ Failed to send email to ${to}:`, error.message);
    throw new Error('Failed to send email. Please try again later.');
  }
}

/**
 * Generate HTML email template with consistent styling
 */
function generateEmailTemplate(content: string): string {
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
 * Email Service - Public API
 */
export const emailService = {
  /**
   * Send Email Verification Email
   *
   * Sent after user signup to verify their email address.
   * Contains a link with a token that expires in 24 hours.
   *
   * @param to - Recipient email address
   * @param token - Verification token (64 chars hex)
   */
  async sendVerificationEmail(to: string, token: string): Promise<void> {
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

    await sendEmail(to, 'Verify your AlcheMix email address', generateEmailTemplate(content));
  },

  /**
   * Send Password Reset Email
   *
   * Sent when user requests to reset their password.
   * Contains a link with a token that expires in 1 hour.
   *
   * @param to - Recipient email address
   * @param token - Reset token (64 chars hex)
   */
  async sendPasswordResetEmail(to: string, token: string): Promise<void> {
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

    await sendEmail(to, 'Reset your AlcheMix password', generateEmailTemplate(content));
  },

  /**
   * Check if email service is properly configured
   */
  isConfigured(): boolean {
    return isConfigured;
  },
};
