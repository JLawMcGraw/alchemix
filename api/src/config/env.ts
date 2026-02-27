/**
 * Environment Variable Configuration
 *
 * This module MUST be imported first, before any other application modules.
 * It loads environment variables from the .env file.
 *
 * CRITICAL: Import this file at the very top of server.ts and any test files
 * that need environment variables.
 */

import dotenv from 'dotenv';
import path from 'path';
import { logger } from '../utils/logger';

// Load .env file from the api/ directory
// Note: When running via "cd api && npm run dev", cwd is already api/
const result = dotenv.config();

// Debug logging for troubleshooting
if (result.error) {
  logger.error('Failed to load .env file', { error: result.error });
  logger.error('Current working directory: %s', { cwd: process.cwd() });
  logger.error('Looking for .env at: %s', { path: path.join(process.cwd(), '.env') });

  // CRITICAL: Fail fast in production if .env file is missing
  if (process.env.NODE_ENV === 'production') {
    logger.error('FATAL: Cannot start server without .env file in production');
    logger.error('Create a .env file based on .env.example with your production values.');
    process.exit(1);
  }
} else {
  logger.info('Environment variables loaded');

  // SECURITY FIX (2025-11-27): Only log JWT_SECRET metadata in development
  // Production logs should NOT contain any secret metadata (length, presence, etc.)
  // Reason: Leaks entropy information that aids brute-force attacks
  if (process.env.NODE_ENV === 'development') {
    logger.info('JWT_SECRET: %s', { status: process.env.JWT_SECRET ? `present (${process.env.JWT_SECRET.length} chars)` : 'MISSING' });
  } else {
    // Production: Only log if MISSING (critical error), not if present
    if (!process.env.JWT_SECRET) {
      logger.error('JWT_SECRET: MISSING (critical error)');
    }
  }

  logger.info('NODE_ENV: %s', { NODE_ENV: process.env.NODE_ENV || 'not set' });
  logger.info('PORT: %s', { PORT: process.env.PORT || 'not set' });
}

// Export an empty object to make this a proper module
export {};
