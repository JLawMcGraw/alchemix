/**
 * Send Test Email Script
 *
 * Usage: npx ts-node scripts/send-test-email.ts <email> [type]
 *
 * Types: verification, reset, changed (default: verification)
 */

import 'dotenv/config';
import { emailService } from '../src/services/email';

const email = process.argv[2];
const type = process.argv[3] || 'verification';

if (!email) {
  console.error('Usage: npx ts-node scripts/send-test-email.ts <email> [type]');
  console.error('Types: verification, reset, changed');
  process.exit(1);
}

async function sendTestEmail() {
  console.log(`Sending ${type} email to ${email}...`);

  try {
    switch (type) {
      case 'verification':
        await emailService.sendVerificationEmail(email, 'test-token-12345678901234567890123456789012');
        break;
      case 'reset':
        await emailService.sendPasswordResetEmail(email, 'test-token-12345678901234567890123456789012');
        break;
      case 'changed':
        await emailService.sendPasswordChangedNotification(email);
        break;
      default:
        console.error(`Unknown email type: ${type}`);
        process.exit(1);
    }
    console.log('Email sent successfully!');
  } catch (error) {
    console.error('Failed to send email:', error);
    process.exit(1);
  }
}

sendTestEmail();
