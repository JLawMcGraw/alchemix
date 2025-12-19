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

/**
 * Sensitive field names that should be redacted from logs.
 * These patterns are checked case-insensitively against object keys.
 */
const SENSITIVE_FIELDS = [
  'password',
  'password_hash',
  'token',
  'secret',
  'authorization',
  'cookie',
  'api_key',
  'apikey',
  'jwt',
  'credential',
  'private_key',
  'privatekey',
  'access_token',
  'refresh_token',
  'csrf',
  'session',
];

/**
 * Recursively filters sensitive data from objects before logging.
 * Replaces sensitive field values with '[REDACTED]'.
 *
 * @param obj - Object to filter
 * @param depth - Current recursion depth (max 10 to prevent infinite loops)
 * @returns Filtered object safe for logging
 */
export function filterSensitiveData(obj: Record<string, unknown>, depth = 0): Record<string, unknown> {
  // Prevent infinite recursion
  if (depth > 10) {
    return { _truncated: 'Max depth exceeded' };
  }

  const filtered: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();

    // Check if key contains any sensitive field name
    const isSensitive = SENSITIVE_FIELDS.some(field => lowerKey.includes(field));

    if (isSensitive) {
      filtered[key] = '[REDACTED]';
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      // Recursively filter nested objects
      filtered[key] = filterSensitiveData(value as Record<string, unknown>, depth + 1);
    } else if (Array.isArray(value)) {
      // Filter arrays of objects
      filtered[key] = value.map(item =>
        item !== null && typeof item === 'object'
          ? filterSensitiveData(item as Record<string, unknown>, depth + 1)
          : item
      );
    } else {
      filtered[key] = value;
    }
  }

  return filtered;
}

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
 * Automatically filters sensitive data from context to prevent credential leaks.
 *
 * @param error - Error object
 * @param context - Additional context (requestId, userId, route, etc.)
 */
export function logError(error: Error, context: Record<string, unknown> = {}): void {
  // Filter sensitive data from context before logging
  const safeContext = filterSensitiveData(context);

  logger.error(error.message, {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    ...safeContext,
  });
}

/**
 * Helper function to log security events
 * Security events are always logged at 'warn' level for visibility.
 * Automatically filters sensitive data from context.
 *
 * @param event - Security event description
 * @param context - Security context (userId, ip, reason, etc.)
 */
export function logSecurityEvent(event: string, context: Record<string, unknown> = {}): void {
  // Filter sensitive data from context before logging
  const safeContext = filterSensitiveData(context);

  logger.warn(`[SECURITY] ${event}`, {
    category: 'security',
    ...safeContext,
  });
}

/**
 * Helper function to log performance metrics
 * Automatically filters sensitive data from context.
 *
 * @param metric - Metric name (e.g., 'request_duration')
 * @param value - Metric value
 * @param context - Additional context
 */
export function logMetric(metric: string, value: number, context: Record<string, unknown> = {}): void {
  // Filter sensitive data from context before logging
  const safeContext = filterSensitiveData(context);

  logger.info(`[METRIC] ${metric}`, {
    category: 'metric',
    metric,
    value,
    ...safeContext,
  });
}

/**
 * AI Diagnostic Logger
 * Writes full prompt/response pairs to a separate file for easy debugging.
 * Each entry includes timestamp, user query, full prompt, and AI response.
 */
const aiDiagnosticLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, message, ...meta }) => {
      const separator = '='.repeat(80);
      const divider = '-'.repeat(80);
      
      let output = `\n${separator}\n`;
      output += `TIMESTAMP: ${timestamp}\n`;
      output += `${divider}\n`;
      
      if (meta.userId) output += `USER ID: ${meta.userId}\n`;
      if (meta.userQuery) output += `USER QUERY: ${meta.userQuery}\n`;
      output += `${divider}\n`;
      
      if (meta.systemPrompt) {
        output += `SYSTEM PROMPT (${meta.systemPromptTokens || '?'} tokens):\n`;
        output += `${meta.systemPrompt}\n`;
        output += `${divider}\n`;
      }
      
      if (meta.matchedRecipes) {
        output += `MATCHED RECIPES CONTEXT:\n`;
        output += `${meta.matchedRecipes}\n`;
        output += `${divider}\n`;
      }
      
      if (meta.aiResponse) {
        output += `AI RESPONSE (${meta.outputTokens || '?'} tokens):\n`;
        output += `${meta.aiResponse}\n`;
      }
      
      if (meta.error) {
        output += `ERROR: ${meta.error}\n`;
      }
      
      output += `${separator}\n`;
      return output;
    })
  ),
  transports: [
    new winston.transports.File({
      filename: path.join(logsDir, 'ai-diagnostic.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 3,
    }),
  ],
});

/**
 * Log AI prompt/response for diagnostic purposes
 * Writes to a dedicated human-readable log file
 */
export function logAIDiagnostic(data: {
  userId: number;
  userQuery: string;
  systemPrompt?: string;
  systemPromptTokens?: number;
  matchedRecipes?: string;
  aiResponse?: string;
  outputTokens?: number;
  error?: string;
}): void {
  aiDiagnosticLogger.info('AI Diagnostic', data);
}

// Export logger as default for convenience
export default logger;
