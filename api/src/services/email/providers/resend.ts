/**
 * Resend Email Provider
 *
 * Sends emails via Resend API (https://resend.com).
 * Modern, developer-friendly email service with great deliverability.
 *
 * Configuration (via environment variables):
 * - RESEND_API_KEY: API key from Resend dashboard
 * - EMAIL_FROM: Sender address (e.g., "AlcheMix <onboarding@resend.dev>")
 *
 * Setup:
 * 1. Sign up at https://resend.com
 * 2. Get API key from Dashboard > API Keys
 * 3. For testing, use onboarding@resend.dev (no domain verification needed)
 * 4. For production, verify your domain in Resend dashboard
 *
 * Free tier: 3,000 emails/month, 100 emails/day
 */

import { Resend } from 'resend';
import { EmailProvider } from '../types';
import { getVerificationEmailContent, getPasswordResetEmailContent, getPasswordChangedEmailContent } from '../templates';
import { logger } from '../../../utils/logger';

export class ResendProvider implements EmailProvider {
  readonly name = 'Resend';

  private client: Resend | null = null;
  private readonly apiKey: string | undefined;
  private readonly from: string;

  constructor() {
    this.apiKey = process.env.RESEND_API_KEY;
    this.from = process.env.EMAIL_FROM || 'AlcheMix <onboarding@resend.dev>';

    if (this.isConfigured()) {
      this.client = new Resend(this.apiKey);
    }
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async sendVerificationEmail(to: string, token: string): Promise<void> {
    const { subject, html } = getVerificationEmailContent(token);
    await this.sendEmail(to, subject, html);
  }

  async sendPasswordResetEmail(to: string, token: string): Promise<void> {
    const { subject, html } = getPasswordResetEmailContent(token);
    await this.sendEmail(to, subject, html);
  }

  async sendPasswordChangedNotification(to: string): Promise<void> {
    const { subject, html } = getPasswordChangedEmailContent();
    await this.sendEmail(to, subject, html);
  }

  private async sendEmail(to: string, subject: string, html: string): Promise<void> {
    if (!this.client) {
      throw new Error('Resend provider not configured');
    }

    try {
      const { error } = await this.client.emails.send({
        from: this.from,
        to,
        subject,
        html,
      });

      if (error) {
        logger.error('Failed to send email via Resend', { to, error: error.message });
        throw new Error('Failed to send email. Please try again later.');
      }

      logger.info('Email sent successfully via Resend', { to });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to send email via Resend', { to, error: message });
      throw new Error('Failed to send email. Please try again later.');
    }
  }
}
