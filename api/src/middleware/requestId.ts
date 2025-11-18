/**
 * Request ID Middleware
 *
 * Purpose: Assigns unique correlation ID to each request for distributed tracing
 *
 * Features:
 * - ALWAYS generates server-side UUID v4 for each request (security-first)
 * - Optionally preserves client-provided ID in separate field for correlation
 * - Validates client IDs before accepting (UUID format only)
 * - Adds server request ID to request object for use in handlers
 * - Returns both IDs in response headers
 *
 * Security (CRITICAL FIX):
 * - NEVER trust client-provided request IDs directly (XSS/log injection risk)
 * - Server ALWAYS generates authoritative request ID
 * - Client IDs are validated and stored separately
 * - Prevents log poisoning and collision attacks
 * - Mitigates OWASP A03:2021 (Injection) and A07:2021 (Auth Failures)
 *
 * Usage:
 *   import { requestIdMiddleware } from './middleware/requestId';
 *   app.use(requestIdMiddleware);
 *
 *   // In route handlers:
 *   logger.info('Processing request', { requestId: req.id }); // Server-generated ID
 *
 * Benefits:
 * - Trace requests across multiple services with server ID
 * - Correlate client-side and server-side logs safely
 * - Debug production issues without security risks
 * - Essential for microservices architecture
 *
 * Example:
 *   Client sends: X-Request-ID: abc123-invalid
 *   Server generates: 7ef08b58-429d-470d-9fef-dde0b2e21b39
 *   Logs use: { requestId: '7ef08b58-429d-470d-9fef-dde0b2e21b39' } (server ID)
 *   Response headers:
 *     X-Request-ID: 7ef08b58-429d-470d-9fef-dde0b2e21b39 (server, authoritative)
 *     X-Client-Request-ID: [rejected - invalid format]
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { logger } from '../utils/logger';

/**
 * UUID v4 validation regex
 * Format: 8-4-4-4-12 hexadecimal characters
 *
 * SECURITY: Only accept properly formatted UUIDs to prevent injection attacks
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Maximum length for client-provided request IDs
 * Prevents buffer overflow and DoS attacks
 */
const MAX_CLIENT_ID_LENGTH = 128;

// Extend Express Request type to include id property and optional clientRequestId
declare global {
  namespace Express {
    interface Request {
      id: string;
      clientRequestId?: string;
    }
  }
}

/**
 * Middleware to generate server-side request correlation IDs
 * and optionally preserve validated client-provided IDs
 *
 * SECURITY: Always generates server-side ID, never trusts client input directly
 *
 * @param req - Express request
 * @param res - Express response
 * @param next - Next middleware
 */
export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // ALWAYS generate server-side request ID (security-first)
  // This is the authoritative ID used in all logs and tracing
  const requestId = crypto.randomUUID();
  req.id = requestId;

  // Optionally preserve client-provided ID for correlation (separate field)
  const clientRequestId = req.header('X-Request-ID');

  if (clientRequestId) {
    // Validate length to prevent DoS
    if (clientRequestId.length > MAX_CLIENT_ID_LENGTH) {
      logger.warn('Client request ID too long - rejected', {
        requestId,
        length: clientRequestId.length,
        maxLength: MAX_CLIENT_ID_LENGTH,
      });
    }
    // Validate format before accepting
    else if (UUID_REGEX.test(clientRequestId)) {
      // Valid UUID format - safe to preserve for correlation
      req.clientRequestId = clientRequestId;

      logger.debug('Client request ID preserved for correlation', {
        requestId,
        clientRequestId,
      });
    } else {
      // Invalid format - log warning and reject
      logger.warn('Invalid client request ID format - rejected', {
        requestId,
        // Truncate client ID to prevent log bloat
        clientRequestId: clientRequestId.substring(0, 50),
        reason: 'Must be valid UUID v4 format',
      });
    }
  }

  // Return OUR server-generated request ID (authoritative)
  res.setHeader('X-Request-ID', requestId);

  // Optionally return client's ID in separate header for correlation
  if (req.clientRequestId) {
    res.setHeader('X-Client-Request-ID', req.clientRequestId);
  }

  next();
}
