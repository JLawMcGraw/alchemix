/**
 * Environment Variable Validation
 *
 * Ensures all required environment variables are present and valid on startup.
 * Fail-fast approach: crash immediately if critical config is missing.
 *
 * Import this AFTER env.ts to ensure dotenv has loaded variables.
 *
 * @version 1.0.0
 * @date December 2025
 */

/**
 * Validated configuration interface
 */
export interface Config {
  // Required
  JWT_SECRET: string;
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;

  // Database - PostgreSQL connection string
  DATABASE_URL: string;

  // Optional - AI Services
  OPENAI_API_KEY?: string;
  GEMINI_API_KEY?: string;

  // Optional - MemMachine
  MEMMACHINE_API_URL?: string;
  MEMMACHINE_ENABLED: boolean;

  // Optional - Frontend
  FRONTEND_URL?: string;

  // Optional - Email (all required if SMTP_HOST is set)
  SMTP_HOST?: string;
  SMTP_PORT?: number;
  SMTP_USER?: string;
  SMTP_PASS?: string;
  SMTP_FROM?: string;
}

/**
 * Validate and parse environment variables
 *
 * @throws Error if required variables are missing or invalid
 * @returns Validated configuration object
 */
export function validateEnv(): Config {
  const errors: string[] = [];
  const warnings: string[] = [];

  // ============ Required Variables ============

  // JWT_SECRET - Required, minimum 32 characters
  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET) {
    errors.push('JWT_SECRET is required');
  } else if (JWT_SECRET.length < 32) {
    errors.push(
      `JWT_SECRET must be at least 32 characters long (current: ${JWT_SECRET.length}). ` +
      `Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
    );
  }

  // NODE_ENV - Default to 'development' if not set
  const NODE_ENV = (process.env.NODE_ENV || 'development') as Config['NODE_ENV'];
  if (!['development', 'production', 'test'].includes(NODE_ENV)) {
    errors.push(
      `NODE_ENV must be one of: development, production, test. Got: ${NODE_ENV}`
    );
  }

  // PORT - Default to 3000, validate range
  const PORT = parseInt(process.env.PORT || '3000', 10);
  if (isNaN(PORT) || PORT < 1 || PORT > 65535) {
    errors.push(`PORT must be a number between 1 and 65535. Got: ${process.env.PORT}`);
  }

  // DATABASE_URL - PostgreSQL connection string
  // Default for development: local PostgreSQL
  const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://alchemix:alchemix@localhost:5432/alchemix';
  if (!DATABASE_URL) {
    errors.push(
      'DATABASE_URL is required. ' +
      'Set it to your PostgreSQL connection string (e.g., postgresql://user:pass@host:5432/dbname)'
    );
  } else if (!DATABASE_URL.startsWith('postgresql://') && !DATABASE_URL.startsWith('postgres://')) {
    errors.push(
      'DATABASE_URL must be a valid PostgreSQL connection string starting with postgresql:// or postgres://'
    );
  }

  // ============ Optional Variables ============

  // AI Services
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

  if (!GEMINI_API_KEY && NODE_ENV === 'production') {
    warnings.push('GEMINI_API_KEY not set - AI bartender will be disabled');
  }

  // MemMachine
  const MEMMACHINE_API_URL = process.env.MEMMACHINE_API_URL;
  const MEMMACHINE_ENABLED = process.env.MEMMACHINE_ENABLED === 'true';

  // Frontend URL - REQUIRED in production for CORS
  const FRONTEND_URL = process.env.FRONTEND_URL;
  if (!FRONTEND_URL && NODE_ENV === 'production') {
    errors.push(
      'FRONTEND_URL is required in production for CORS configuration. ' +
      'Set it to your frontend domain (e.g., https://alchemix.example.com)'
    );
  }

  // ============ SMTP Configuration ============
  const SMTP_HOST = process.env.SMTP_HOST;
  const SMTP_PORT = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : undefined;
  const SMTP_USER = process.env.SMTP_USER;
  const SMTP_PASS = process.env.SMTP_PASS;
  const SMTP_FROM = process.env.SMTP_FROM;

  // If SMTP_HOST is set, all SMTP variables are required
  if (SMTP_HOST) {
    const missingSMTP: string[] = [];
    if (!SMTP_PORT) missingSMTP.push('SMTP_PORT');
    if (!SMTP_USER) missingSMTP.push('SMTP_USER');
    if (!SMTP_PASS) missingSMTP.push('SMTP_PASS');
    if (!SMTP_FROM) missingSMTP.push('SMTP_FROM');

    if (missingSMTP.length > 0) {
      warnings.push(
        `SMTP_HOST is set but missing: ${missingSMTP.join(', ')}. ` +
        'Email functionality will be disabled.'
      );
    }
  }

  // ============ Fail if Critical Errors ============
  if (errors.length > 0) {
    const errorMessage = [
      '',
      '╔══════════════════════════════════════════════════════════════╗',
      '║           ENVIRONMENT VALIDATION FAILED                      ║',
      '╚══════════════════════════════════════════════════════════════╝',
      '',
      'The following required environment variables are missing or invalid:',
      '',
      ...errors.map(e => `  ❌ ${e}`),
      '',
      'Please check your .env file or environment configuration.',
      '',
    ].join('\n');

    console.error(errorMessage);
    throw new Error(`Environment validation failed: ${errors.join('; ')}`);
  }

  // ============ Log Warnings ============
  if (warnings.length > 0 && NODE_ENV !== 'test') {
    console.warn('\n⚠️  Environment Warnings:');
    warnings.forEach(w => console.warn(`   ${w}`));
    console.warn('');
  }

  // ============ Return Validated Config ============
  return {
    JWT_SECRET: JWT_SECRET!,
    NODE_ENV,
    PORT,
    DATABASE_URL,
    OPENAI_API_KEY,
    GEMINI_API_KEY,
    MEMMACHINE_API_URL,
    MEMMACHINE_ENABLED,
    FRONTEND_URL,
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASS,
    SMTP_FROM,
  };
}

/**
 * Validated configuration singleton
 *
 * Import this to access validated environment variables:
 * ```typescript
 * import { config } from './config/validateEnv';
 * console.log(config.PORT);
 * ```
 */
export const config = validateEnv();
