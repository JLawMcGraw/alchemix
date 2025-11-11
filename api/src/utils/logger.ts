/**
 * Structured Logging Utility
 *
 * Purpose: Provides structured, searchable logging with correlation IDs for production debugging
 *
 * Features:
 * - JSON format for log aggregation (ELK, DataDog, CloudWatch)
 * - Multiple log levels (error, warn, info, debug)
 * - Correlation IDs for request tracing
 * - File-based logging (error.log, combined.log)
 * - Console logging in development with human-readable format
 * - Automatic error stack trace capture
 *
 * Usage:
 *   import { logger } from './utils/logger';
 *
 *   logger.info('User logged in', { userId, email, requestId: req.id });
 *   logger.error('Database error', { error, query, requestId: req.id });
 *   logger.warn('Rate limit approaching', { userId, currentCount, limit });
 *
 * Best Practices:
 * - Always include requestId for correlation
 * - Include userId for user-specific debugging
 * - Capture error objects with stack traces
 * - Use appropriate log levels (error for failures, warn for anomalies, info for events)
 */

import winston from 'winston';
import path from 'path';
import fs from 'fs';

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * Custom format for development console output
 * Makes logs human-readable with colors and formatting
 */
const developmentFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `${timestamp} [${level}]: ${message} ${metaStr}`;
  })
);

/**
 * Production format - structured JSON for log aggregation
 */
const productionFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

/**
 * Main logger instance
 */
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: productionFormat,
  defaultMeta: {
    service: 'alchemix-api',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    // Error logs - separate file for critical issues
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),

    // Combined logs - all log levels
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
});

/**
 * Add console output in development for better DX
 */
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: developmentFormat,
    })
  );
}

/**
 * Helper function to log HTTP errors with context
 *
 * @param error - Error object
 * @param context - Additional context (requestId, userId, route, etc.)
 */
export function logError(error: Error, context: Record<string, any> = {}): void {
  logger.error(error.message, {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    ...context,
  });
}

/**
 * Helper function to log security events
 * Security events are always logged at 'warn' level for visibility
 *
 * @param event - Security event description
 * @param context - Security context (userId, ip, reason, etc.)
 */
export function logSecurityEvent(event: string, context: Record<string, any> = {}): void {
  logger.warn(`[SECURITY] ${event}`, {
    category: 'security',
    ...context,
  });
}

/**
 * Helper function to log performance metrics
 *
 * @param metric - Metric name (e.g., 'request_duration')
 * @param value - Metric value
 * @param context - Additional context
 */
export function logMetric(metric: string, value: number, context: Record<string, any> = {}): void {
  logger.info(`[METRIC] ${metric}`, {
    category: 'metric',
    metric,
    value,
    ...context,
  });
}

// Export logger as default for convenience
export default logger;
