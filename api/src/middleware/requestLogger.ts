/**
 * Request Logging Middleware
 *
 * Purpose: Logs all HTTP requests with timing, status codes, and context
 *
 * Features:
 * - Logs request start (method, path, userId, IP)
 * - Logs request completion with duration and status code
 * - Captures response time for performance monitoring
 * - Includes correlation ID for tracing
 * - Logs user context if authenticated
 *
 * Metrics Captured:
 * - Request duration (ms)
 * - HTTP status code
 * - Request method and path
 * - User ID (if authenticated)
 * - Client IP address
 *
 * Usage:
 *   import { requestLoggerMiddleware } from './middleware/requestLogger';
 *   app.use(requestIdMiddleware);      // Must come first
 *   app.use(requestLoggerMiddleware);  // Then this
 *
 * Example Log Output:
 *   [INFO] Incoming request { requestId: '...', method: 'GET', path: '/api/inventory', userId: 1, ip: '127.0.0.1' }
 *   [INFO] Request completed { requestId: '...', method: 'GET', path: '/api/inventory', statusCode: 200, duration: 45, userId: 1 }
 */

import { Request, Response, NextFunction } from 'express';
import { logger, logMetric, logSecurityEvent } from '../utils/logger';

/**
 * Sensitive query parameter keys that should be redacted from logs
 *
 * SECURITY: These parameters may contain PII, credentials, or secrets
 * and must NEVER be logged to prevent data leakage.
 *
 * Compliance: Required for GDPR, PCI-DSS, HIPAA, SOC2
 */
const SENSITIVE_QUERY_KEYS = [
  // Passwords and credentials
  'password',
  'newpassword',
  'oldpassword',
  'currentpassword',
  'pass',
  'passwd',

  // Tokens and secrets
  'token',
  'accesstoken',
  'refreshtoken',
  'resettoken',
  'verificationtoken',
  'apikey',
  'api_key',
  'secret',
  'apisecret',
  'clientsecret',

  // Personal Identifiable Information (PII)
  'ssn',
  'socialsecurity',
  'creditcard',
  'cardnumber',
  'cvv',
  'pin',
  'dateofbirth',
  'dob',

  // Financial data
  'accountnumber',
  'routingnumber',
  'bankaccount',
];

/**
 * Sanitize query parameters by redacting sensitive fields
 *
 * @param query - Request query parameters
 * @returns Sanitized query object with sensitive fields redacted
 */
function sanitizeQueryParams(query: any): any {
  if (!query || Object.keys(query).length === 0) {
    return undefined;
  }

  const sanitized: any = {};

  for (const [key, value] of Object.entries(query)) {
    const lowerKey = key.toLowerCase();

    // Check if key matches any sensitive pattern
    const isSensitive = SENSITIVE_QUERY_KEYS.some(
      sensitive => lowerKey.includes(sensitive)
    );

    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Middleware to log HTTP requests with timing and context
 *
 * @param req - Express request
 * @param res - Express response
 * @param next - Next middleware
 */
export function requestLoggerMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const startTime = Date.now();
  const ip = req.ip || req.socket.remoteAddress;

  // Log incoming request with sanitized query parameters
  logger.info('Incoming request', {
    requestId: req.id,
    method: req.method,
    path: req.path,
    query: sanitizeQueryParams(req.query),
    userId: (req as any).user?.userId, // Will be undefined until auth middleware runs
    ip,
    userAgent: req.get('user-agent'),
  });

  // Capture response
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;

    // Determine log level based on status code
    const logLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';

    // Log request completion
    logger.log(logLevel, 'Request completed', {
      requestId: req.id,
      method: req.method,
      path: req.path,
      statusCode,
      duration,
      userId: (req as any).user?.userId,
    });

    // Record performance metric
    logMetric('request_duration', duration, {
      requestId: req.id,
      method: req.method,
      path: req.path,
      statusCode,
    });

    // Log security events for failed auth attempts
    if (statusCode === 401 || statusCode === 403) {
      logSecurityEvent('Authentication/Authorization failure', {
        requestId: req.id,
        method: req.method,
        path: req.path,
        statusCode,
        ip: req.ip || req.socket.remoteAddress,
        userId: (req as any).user?.userId,
      });
    }

    // Log slow requests (>1000ms)
    if (duration > 1000) {
      logger.warn('Slow request detected', {
        requestId: req.id,
        method: req.method,
        path: req.path,
        duration,
        statusCode,
      });
    }
  });

  next();
}

/**
 * Middleware to log errors that occur during request processing
 * Should be used after all route handlers
 *
 * @param err - Error object
 * @param req - Express request
 * @param res - Express response
 * @param next - Next middleware
 */
export function errorLoggerMiddleware(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  logger.error('Request error', {
    requestId: req.id,
    method: req.method,
    path: req.path,
    error: {
      name: err.name,
      message: err.message,
      stack: err.stack,
    },
    userId: (req as any).user?.userId,
    ip: req.ip || req.socket.remoteAddress,
  });

  // Pass error to next error handler
  next(err);
}
