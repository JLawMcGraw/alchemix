/**
 * Email Service Types
 *
 * Defines the interface for email providers and shared types.
 */

/**
 * A file attached to an outgoing email
 */
export interface EmailAttachment {
  /** Filename shown to the recipient (e.g. "negroni-recipe.png") */
  filename: string;
  /** Base64-encoded file contents, WITHOUT a `data:` URL prefix */
  content: string;
  /** MIME type (e.g. "image/png"). Providers may infer from the filename if omitted. */
  contentType?: string;
}

/**
 * Email options for sending a generic email
 */
export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  /** Plaintext fallback for clients that don't render HTML */
  text?: string;
  attachments?: EmailAttachment[];
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
   * Send a generic email
   *
   * The general-purpose escape hatch used by callers that build their own
   * subject/body (e.g. sharing a recipe). The three methods above are thin
   * wrappers over this.
   *
   * @param options - Recipient, subject, body, and optional attachments
   */
  sendEmail(options: EmailOptions): Promise<void>;

  /**
   * Check if provider is properly configured
   */
  isConfigured(): boolean;
}
