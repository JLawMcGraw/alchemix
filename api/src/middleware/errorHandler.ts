/**
 * Error Handling Middleware
 *
 * Global error handlers for Express application.
 *
 * Purpose:
 * - Catch and handle all errors thrown in routes
 * - Provide consistent error response format
 * - Log errors for debugging and monitoring
 * - Hide internal details in production (security)
 * - Show stack traces in development (debugging)
 *
 * Security Principles:
 * - Never leak stack traces in production
 * - Never expose database errors to client
 * - Never reveal internal paths or code structure
 * - Log detailed errors server-side only
 * - Return generic messages to client
 *
 * Error Flow:
 * 1. Error thrown in route handler
 * 2. Express catches error
 * 3. errorHandler middleware receives error
 * 4. Log error details (server-side only)
 * 5. Return sanitized response to client
 *
 * Example:
 * ```typescript
 * // Route throws error
 * router.get('/users/:id', (req, res) => {
 *   throw new Error('Database connection failed');
 * });
 *
 * // errorHandler catches it
 * // Logs: "Error: Database connection failed" + stack trace
 * // Returns to client: { success: false, error: "Internal server error" }
 * ```
 */

import { Request, Response, NextFunction } from 'express';
import { AppError, isAppError, isOperationalError } from '../errors/AppError';
import { logger, logError } from '../utils/logger';

/**
 * Note: AppError is now imported from ../errors/AppError.ts
 * This provides type-safe custom error classes for different error scenarios.
 */

/**
 * Global Error Handler
 *
 * Catches all errors thrown in Express routes and middleware.
 * Provides consistent error response format.
 *
 * IMPORTANT: Must be registered last in server.ts (after all routes).
 * Express only forwards errors to handlers defined after the error source.
 *
 * Parameters:
 * - err: Error object thrown by route or middleware
 * - req: Express request object (not used, but required by signature)
 * - res: Express response object (used to send error response)
 * - next: Next middleware function (not used, but required by signature)
 *
 * Response Format:
 * {
 *   success: false,
 *   error: "Error message here",
 *   stack: "..." // Only in development
 * }
 *
 * Environment Behavior:
 * - Development:
 *   - Log full error object to console
 *   - Include stack trace in response
 *   - Show original error message
 *
 * - Production:
 *   - Log minimal error info (or send to monitoring service)
 *   - Hide stack trace from response (security)
 *   - Show generic error message for unexpected errors
 *
 * Security Notes:
 * - Stack traces reveal internal file paths (e.g., /var/www/api/src/routes/auth.ts)
 * - Database errors reveal schema info (e.g., "Column 'password_hash' not found")
 * - Hiding these in production prevents information disclosure
 *
 * Example Requests and Responses:
 *
 * 1. Validation Error (Operational):
 *    Request: POST /auth/signup with invalid email
 *    Thrown: { message: "Invalid email format", statusCode: 400 }
 *    Response: { success: false, error: "Invalid email format" }
 *
 * 2. Authentication Error (Operational):
 *    Request: GET /api/inventory without token
 *    Thrown: { message: "Unauthorized", statusCode: 401 }
 *    Response: { success: false, error: "Unauthorized" }
 *
 * 3. Not Found Error (Operational):
 *    Request: GET /api/bottles/9999 (doesn't exist)
 *    Thrown: { message: "Bottle not found", statusCode: 404 }
 *    Response: { success: false, error: "Bottle not found" }
 *
 * 4. Programming Error (Unexpected):
 *    Request: Any request
 *    Thrown: TypeError: Cannot read property 'id' of undefined
 *    Response (Production): { success: false, error: "Internal server error" }
 *    Response (Development): { success: false, error: "Cannot read property 'id' of undefined", stack: "..." }
 *
 * @param err - Error object thrown in route or middleware
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Next middleware function
 */
export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  /**
   * Step 1: Determine if this is an AppError (operational) or unexpected error
   */
  const isOperational = isAppError(err) && err.isOperational;
  const statusCode = isAppError(err) ? err.statusCode : 500;

  /**
   * Step 2: Determine Error Message
   *
   * Security Consideration:
   * - Operational errors (AppError with isOperational=true): Safe to show message
   * - Programming errors (standard Error, isOperational=false): Show generic message
   */
  const message = isOperational ? err.message : 'Internal server error';

  /**
   * Step 3: Log Error Details with Structured Logging
   *
   * Uses Winston logger for consistent, searchable logs.
   * Logs include context for debugging (requestId, userId, route, etc.)
   */
  logError(err, {
    requestId: req.id,
    method: req.method,
    path: req.path,
    statusCode,
    userId: (req as any).user?.userId,
    ip: req.ip || req.socket.remoteAddress,
    isOperational,
  });

  /**
   * Step 4: Send Error Response to Client
   *
   * For AppError instances with toJSON method, use that for response
   * Otherwise, construct standard error response
   *
   * Security Critical:
   * - NEVER send stack traces in production
   * - Only show details for operational errors
   * - Hide programming errors with generic message
   */
  if (isAppError(err)) {
    // Use AppError's toJSON method for consistent format
    res.status(statusCode).json({
      ...err.toJSON(),
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
  } else {
    // Standard Error object
    res.status(statusCode).json({
      success: false,
      error: message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
  }
}

/**
 * 404 Not Found Handler
 *
 * Catches requests to non-existent routes.
 * Should be registered after all route definitions in server.ts.
 *
 * How it works:
 * 1. User requests URL that doesn't match any route
 * 2. Express passes request through all route handlers
 * 3. No route matches, so request reaches this middleware
 * 4. Send 404 response
 *
 * Example Requests:
 * - GET /api/invalid → 404 "Route GET /api/invalid not found"
 * - POST /foo/bar → 404 "Route POST /foo/bar not found"
 * - DELETE /users → 404 "Route DELETE /users not found"
 *
 * Response Format:
 * {
 *   success: false,
 *   error: "Route GET /api/invalid not found"
 * }
 *
 * Why Include Method and Path?
 * - Helps users identify typos in their requests
 * - Makes it clear what was attempted
 * - Useful for API documentation and debugging
 *
 * Security Considerations:
 * - Some APIs hide 404 responses (return 403 or 200)
 * - This prevents route enumeration attacks
 * - We show 404 because routes are documented (OpenAPI spec)
 * - Trade-off: Developer experience vs security through obscurity
 *
 * Future Enhancement (Phase 3+):
 * - Add request logging for 404s (identify broken links)
 * - Add rate limiting (prevent route scanning)
 * - Add suggestions for similar routes (typo correction)
 *
 * Example with Suggestions:
 * ```typescript
 * res.status(404).json({
 *   success: false,
 *   error: `Route ${req.method} ${req.path} not found`,
 *   suggestion: 'Did you mean GET /api/inventory?'
 * });
 * ```
 *
 * @param req - Express request object
 * @param res - Express response object
 */
export function notFoundHandler(req: Request, res: Response) {
  /**
   * Step 1: Build Descriptive Error Message
   *
   * Include HTTP method and requested path.
   * This helps users identify exactly what was attempted.
   *
   * Template: "Route {METHOD} {PATH} not found"
   * Examples:
   * - "Route GET /api/bottles not found"
   * - "Route POST /auth/signin not found" (typo: should be /auth/login)
   * - "Route DELETE /users not found" (route doesn't exist)
   */
  const errorMessage = `Route ${req.method} ${req.path} not found`;

  /**
   * Step 2: Log 404 for Analytics and Debugging
   *
   * Use Cases:
   * - Identify broken links in frontend
   * - Detect API version mismatches
   * - Catch typos in route paths
   * - Monitor for route scanning attacks
   */
  logger.warn('Route not found', {
    requestId: req.id,
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip || req.socket.remoteAddress,
    userAgent: req.get('user-agent'),
  });

  /**
   * Step 3: Send 404 Response
   *
   * HTTP 404 status indicates resource not found.
   * Consistent JSON format matches error handler.
   */
  res.status(404).json({
    success: false,
    error: errorMessage
  });
}

/**
 * Export Error Handlers
 *
 * Both handlers are exported as named exports.
 *
 * Usage in server.ts:
 * ```typescript
 * import { errorHandler, notFoundHandler } from './middleware/errorHandler';
 *
 * // Register routes first
 * app.use('/auth', authRoutes);
 * app.use('/api/inventory', inventoryRoutes);
 *
 * // Then 404 handler (catches unmatched routes)
 * app.use(notFoundHandler);
 *
 * // Finally error handler (catches all errors)
 * app.use(errorHandler);
 * ```
 *
 * Order Matters:
 * 1. Routes: Define all API endpoints
 * 2. 404 Handler: Catches requests that don't match any route
 * 3. Error Handler: Catches errors thrown by routes
 *
 * If ordered incorrectly:
 * - 404 handler before routes → All requests return 404
 * - Error handler before routes → Errors not caught
 * - Error handler before 404 → 404 handler never reached
 */
