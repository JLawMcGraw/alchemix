/**
 * Rate Limiter Configuration
 *
 * Configures express-rate-limit for different API endpoints.
 * Protects against brute force attacks and API abuse.
 *
 * Note: For multi-instance deployments, migrate to Redis store.
 * See REDIS_MIGRATION_PLAN.md for implementation details.
 *
 * @version 1.0.0
 * @date December 2025
 */

import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import { Request, Response } from 'express';

// Extend Express Request type to include rateLimit
declare module 'express-serve-static-core' {
  interface Request {
    rateLimit?: {
      limit: number;
      current: number;
      remaining: number;
      resetTime?: Date;
    };
  }
}

/**
 * Skip rate limiting in test environment
 */
const skipInTest = (req: Request) => process.env.NODE_ENV === 'test';

/**
 * Standard error response for rate limit exceeded
 */
const rateLimitHandler = (req: Request, res: Response) => {
  const retryAfter = req.rateLimit?.resetTime
    ? Math.ceil((req.rateLimit.resetTime.getTime() - Date.now()) / 1000)
    : 900;

  res.status(429).json({
    success: false,
    error: 'Too many requests',
    message: 'Please try again later',
    retryAfter,
  });
};

/**
 * General API Rate Limiter
 *
 * Applies to all /api/* routes.
 * Limit: 100 requests per 15 minutes per IP.
 *
 * Use case: General API protection
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: 'Too many requests, please try again later.',
  standardHeaders: true, // Return rate limit info in RateLimit-* headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
  skip: skipInTest,
  handler: rateLimitHandler,
  keyGenerator: (req) => {
    // Use user ID if authenticated, otherwise IP
    const userId = req.user?.userId;
    return userId ? `user:${userId}` : req.ip || 'unknown';
  },
});

/**
 * Authentication Rate Limiter
 *
 * Applies to /auth/* routes (login, signup, password reset).
 * Stricter limits to prevent brute force attacks.
 * Limit: 5 failed attempts per 15 minutes per IP.
 *
 * Use case: Prevent credential stuffing and brute force attacks
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  skipSuccessfulRequests: true, // Only count failed attempts
  message: 'Too many login attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      error: 'Too many authentication attempts',
      message: 'Please wait 15 minutes before trying again',
      retryAfter: 900,
    });
  },
});

/**
 * AI Service Rate Limiter
 *
 * Applies to /api/messages route (AI bartender).
 * Stricter limits due to API cost.
 * Limit: 30 messages per hour per user.
 *
 * Use case: Control AI API costs and prevent abuse
 */
export const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30, // 30 messages per hour
  message: 'AI service rate limit exceeded.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  handler: (req: Request, res: Response) => {
    const retryAfter = req.rateLimit?.resetTime
      ? Math.ceil((req.rateLimit.resetTime.getTime() - Date.now()) / 1000)
      : 3600;

    res.status(429).json({
      success: false,
      error: 'AI service rate limit exceeded',
      message: 'You have reached the maximum number of AI requests per hour',
      retryAfter,
    });
  },
  keyGenerator: (req) => {
    // Always use user ID for AI rate limiting (requires auth)
    const userId = req.user?.userId;
    return userId ? `ai:${userId}` : `ai:${req.ip || 'unknown'}`;
  },
});

/**
 * CSV Import Rate Limiter
 *
 * Applies to CSV import endpoints.
 * Prevents abuse of resource-intensive import operations.
 * Limit: 10 imports per hour per user.
 *
 * Use case: Prevent DoS via large file uploads
 */
export const importLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 imports per hour
  message: 'Too many import requests.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      error: 'Import rate limit exceeded',
      message: 'You can only perform 10 imports per hour',
      retryAfter: 3600,
    });
  },
  keyGenerator: (req) => {
    const userId = req.user?.userId;
    return userId ? `import:${userId}` : `import:${req.ip || 'unknown'}`;
  },
});

/**
 * Password Reset Rate Limiter
 *
 * Extra strict limits for password reset requests.
 * Prevents email enumeration and spam.
 * Limit: 3 requests per hour per IP.
 *
 * Use case: Prevent password reset abuse
 */
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 requests per hour
  message: 'Too many password reset requests.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      error: 'Too many password reset requests',
      message: 'Please wait before requesting another password reset',
      retryAfter: 3600,
    });
  },
});
