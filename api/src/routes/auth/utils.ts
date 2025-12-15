/**
 * Auth Route Utilities
 *
 * Shared utility functions for authentication routes.
 */

import crypto from 'crypto';

/**
 * Generate a secure random token for email verification or password reset
 * Returns a 64-character hex string (32 bytes of randomness = 256 bits)
 */
export function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate CSRF token
 * Returns a 32-character hex string (16 bytes of randomness = 128 bits)
 */
export function generateCSRFToken(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Cookie Configuration for JWT Token
 *
 * Security settings:
 * - httpOnly: true - Cookie NOT accessible via JavaScript (XSS protection)
 * - secure: true (production) - Cookie only sent over HTTPS
 * - sameSite: 'strict' - Cookie not sent with cross-site requests (CSRF protection)
 * - maxAge: 7 days - Matches JWT expiration
 * - path: '/' - Cookie valid for all routes
 */
export function getAuthCookieOptions(): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'strict' | 'lax' | 'none';
  maxAge: number;
  path: string;
} {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,                          // NOT accessible via JavaScript
    secure: isProduction,                    // HTTPS only in production
    sameSite: 'strict',                      // Strict CSRF protection
    maxAge: 7 * 24 * 60 * 60 * 1000,        // 7 days in milliseconds
    path: '/',                               // Valid for all routes
  };
}

/**
 * Get cookie options for clearing cookies
 */
export function getClearCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
  };
}

/**
 * Get CSRF cookie options (non-httpOnly so JS can read it)
 */
export function getCSRFCookieOptions() {
  return {
    httpOnly: false,  // JS needs to read this to include in headers
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  };
}
