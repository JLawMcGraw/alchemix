/**
 * Email Service
 *
 * Provides email functionality with automatic provider selection.
 *
 * Provider Priority:
 * 1. Resend (if RESEND_API_KEY is set) - Modern, recommended
 * 2. SMTP (if SMTP_HOST, SMTP_USER, SMTP_PASS are set) - Fallback
 * 3. Console (development fallback) - Logs emails to console
 *
 * Usage:
 * ```typescript
 * import { emailService } from '../services/email';
 *
 * await emailService.sendVerificationEmail('user@example.com', token);
 * await emailService.sendPasswordResetEmail('user@example.com', token);
 * ```
 *
 * Configuration:
 * - See .env.example for environment variable documentation
 * - Resend is recommended for production (free tier: 3,000 emails/month)
 */

import { EmailProvider } from './types';
import { ResendProvider, SmtpProvider, ConsoleProvider } from './providers';
import { logger } from '../../utils/logger';

/**
 * Select the appropriate email provider based on configuration
 */
function selectProvider(): EmailProvider {
  // Priority 1: Resend (modern, recommended)
  if (process.env.RESEND_API_KEY) {
    const provider = new ResendProvider();
    logger.info(`Email provider: ${provider.name}`);
    return provider;
  }

  // Priority 2: SMTP (traditional fallback)
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    const provider = new SmtpProvider();
    logger.info(`Email provider: ${provider.name}`);
    return provider;
  }

  // Priority 3: Console (development fallback)
  const provider = new ConsoleProvider();
  logger.warn('Email provider: Console (no provider configured - emails will be logged)');
  logger.info('Set RESEND_API_KEY or SMTP_HOST/SMTP_USER/SMTP_PASS to enable email sending');
  return provider;
}

/**
 * Email Service Instance
 *
 * Automatically selects the best available provider based on environment configuration.
 */
export const emailService: EmailProvider = selectProvider();

// Re-export types for convenience
export type { EmailProvider, EmailOptions } from './types';
