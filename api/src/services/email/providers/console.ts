/**
 * Console Email Provider
 *
 * Development fallback that logs emails to console instead of sending.
 * Used when no email provider is configured.
 *
 * Security:
 * - Tokens are redacted from log output
 * - Body preview is limited to 500 characters
 */

import { EmailProvider, EmailOptions } from '../types';
import { getVerificationEmailContent, getPasswordResetEmailContent, getPasswordChangedEmailContent, redactForLogging } from '../templates';
import { logger } from '../../../utils/logger';

export class ConsoleProvider implements EmailProvider {
  readonly name = 'Console';

  /**
   * Console provider is never "configured" in the traditional sense
   * It's the fallback when nothing else is available
   */
  isConfigured(): boolean {
    return false;
  }

  async sendVerificationEmail(to: string, token: string): Promise<void> {
    const { subject, html } = getVerificationEmailContent(token);
    await this.sendEmail({ to, subject, html });
  }

  async sendPasswordResetEmail(to: string, token: string): Promise<void> {
    const { subject, html } = getPasswordResetEmailContent(token);
    await this.sendEmail({ to, subject, html });
  }

  async sendPasswordChangedNotification(to: string): Promise<void> {
    const { subject, html } = getPasswordChangedEmailContent();
    await this.sendEmail({ to, subject, html });
  }

  async sendEmail(options: EmailOptions): Promise<void> {
    const { to, subject, html, attachments } = options;

    logger.info('EMAIL (no provider configured - logging to console)', {
      to,
      subject,
      bodyPreview: redactForLogging(html),
      attachments: attachments?.length ?? 0,
    });
  }
}
