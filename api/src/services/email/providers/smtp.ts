/**
 * SMTP Email Provider
 *
 * Sends emails via SMTP using Nodemailer.
 * Supports Gmail, SendGrid, Mailgun, Amazon SES, and other SMTP servers.
 *
 * Configuration (via environment variables):
 * - SMTP_HOST: SMTP server hostname (e.g., smtp.gmail.com)
 * - SMTP_PORT: SMTP port (default: 587 for TLS)
 * - SMTP_USER: SMTP username/email
 * - SMTP_PASS: SMTP password or app-specific password
 * - SMTP_FROM: Sender address (e.g., "AlcheMix <noreply@alchemix.app>")
 *
 * Gmail Setup:
 * 1. Enable 2FA on Google account
 * 2. Generate App Password: Google Account > Security > App Passwords
 * 3. Use app password as SMTP_PASS (not account password)
 */

import nodemailer from 'nodemailer';
import { EmailProvider } from '../types';
import { getVerificationEmailContent, getPasswordResetEmailContent } from '../templates';
import { logger } from '../../../utils/logger';

export class SmtpProvider implements EmailProvider {
  readonly name = 'SMTP';

  private transporter: nodemailer.Transporter | null = null;
  private readonly host: string | undefined;
  private readonly port: number;
  private readonly user: string | undefined;
  private readonly pass: string | undefined;
  private readonly from: string;

  constructor() {
    this.host = process.env.SMTP_HOST;
    this.port = parseInt(process.env.SMTP_PORT || '587', 10);
    this.user = process.env.SMTP_USER;
    this.pass = process.env.SMTP_PASS;
    this.from = process.env.SMTP_FROM || 'AlcheMix <noreply@alchemix.app>';

    if (this.isConfigured()) {
      this.initTransporter();
    }
  }

  isConfigured(): boolean {
    return Boolean(this.host && this.user && this.pass);
  }

  private initTransporter(): void {
    this.transporter = nodemailer.createTransport({
      host: this.host,
      port: this.port,
      secure: this.port === 465, // true for 465, false for other ports (STARTTLS)
      auth: {
        user: this.user,
        pass: this.pass,
      },
    });

    // Verify connection on startup
    this.transporter.verify((error) => {
      if (error) {
        logger.error('SMTP connection failed', { error: error.message });
      } else {
        logger.info('SMTP server is ready to send emails');
      }
    });
  }

  async sendVerificationEmail(to: string, token: string): Promise<void> {
    const { subject, html } = getVerificationEmailContent(token);
    await this.sendEmail(to, subject, html);
  }

  async sendPasswordResetEmail(to: string, token: string): Promise<void> {
    const { subject, html } = getPasswordResetEmailContent(token);
    await this.sendEmail(to, subject, html);
  }

  private async sendEmail(to: string, subject: string, html: string): Promise<void> {
    if (!this.transporter) {
      throw new Error('SMTP provider not configured');
    }

    try {
      await this.transporter.sendMail({
        from: this.from,
        to,
        subject,
        html,
      });
      logger.info('Email sent successfully via SMTP', { to });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to send email via SMTP', { to, error: message });
      throw new Error('Failed to send email. Please try again later.');
    }
  }
}
