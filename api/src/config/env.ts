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

// Load .env file from the api/ directory
// Note: When running via "cd api && npm run dev", cwd is already api/
const result = dotenv.config();

// Debug logging for troubleshooting
if (result.error) {
  console.error('❌ Failed to load .env file:', result.error);
  console.error('   Current working directory:', process.cwd());
  console.error('   Looking for .env at:', path.join(process.cwd(), '.env'));
} else {
  console.log('✅ Environment variables loaded');
  console.log('   JWT_SECRET:', process.env.JWT_SECRET ? `present (${process.env.JWT_SECRET.length} chars)` : 'MISSING');
  console.log('   NODE_ENV:', process.env.NODE_ENV || 'not set');
  console.log('   PORT:', process.env.PORT || 'not set');
}

// Export an empty object to make this a proper module
export {};
