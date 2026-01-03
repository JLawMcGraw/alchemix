/**
 * Email Service Types
 *
 * Defines the interface for email providers and shared types.
 */

/**
 * Email options for sending a generic email
 */
export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

/**
 * Email Provider Interface
 *
 * All email providers must implement this interface.
 * This allows for easy swapping between providers (Resend, SMTP, etc.)
 */
export interface EmailProvider {
  /** Provider name for logging */
  readonly name: string;

  /**
   * Send email verification email
   * @param to - Recipient email address
   * @param token - Verification token (64 chars hex)
   */
  sendVerificationEmail(to: string, token: string): Promise<void>;

  /**
   * Send password reset email
   * @param to - Recipient email address
   * @param token - Reset token (64 chars hex)
   */
  sendPasswordResetEmail(to: string, token: string): Promise<void>;

  /**
   * Send password changed notification email
   * @param to - Recipient email address
   */
  sendPasswordChangedNotification(to: string): Promise<void>;

  /**
   * Check if provider is properly configured
   */
  isConfigured(): boolean;
}
