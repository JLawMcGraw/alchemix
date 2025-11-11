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

/**
 * AppError Interface
 *
 * Extended Error interface with additional properties for error handling.
 *
 * Properties:
 * - name: Error name (inherited from Error, e.g., "ValidationError")
 * - message: Error message (inherited from Error, e.g., "Email is required")
 * - stack: Stack trace (inherited from Error, multiline string)
 * - statusCode: HTTP status code (custom, e.g., 400, 404, 500)
 * - isOperational: Whether error is expected (custom, true for validation errors)
 *
 * Why statusCode and isOperational?
 * - statusCode: Allows routes to specify appropriate HTTP status
 * - isOperational: Distinguishes expected errors from bugs
 *
 * Error Types:
 * 1. Operational Errors (expected, safe to show):
 *    - Validation errors (400 Bad Request)
 *    - Not found errors (404 Not Found)
 *    - Authentication errors (401 Unauthorized)
 *    - Rate limit errors (429 Too Many Requests)
 *
 * 2. Programming Errors (unexpected, hide details):
 *    - Null reference errors (500 Internal Server Error)
 *    - Syntax errors (500 Internal Server Error)
 *    - Database errors (500 Internal Server Error)
 *
 * Usage Example:
 * ```typescript
 * // Operational error (safe to show message)
 * const error: AppError = new Error('Email is required');
 * error.statusCode = 400;
 * error.isOperational = true;
 * throw error;
 *
 * // Programming error (hide details)
 * throw new Error('Cannot read property "id" of undefined');
 * // Returns generic "Internal server error" to client
 * ```
 */
export interface AppError extends Error {
  statusCode?: number;      // HTTP status code (400, 404, 500, etc.)
  isOperational?: boolean;  // Is this an expected error? (true for validation)
}

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
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  /**
   * Step 1: Determine HTTP Status Code
   *
   * Use error's statusCode if provided, otherwise default to 500.
   *
   * Common Status Codes:
   * - 400 Bad Request: Invalid input (validation errors)
   * - 401 Unauthorized: Missing or invalid authentication
   * - 403 Forbidden: Authenticated but not allowed
   * - 404 Not Found: Resource doesn't exist
   * - 409 Conflict: Duplicate resource (e.g., email already exists)
   * - 429 Too Many Requests: Rate limit exceeded
   * - 500 Internal Server Error: Unexpected error (bugs, database issues)
   * - 503 Service Unavailable: External service down (e.g., AI API)
   */
  const statusCode = err.statusCode || 500;

  /**
   * Step 2: Determine Error Message
   *
   * Use error's message if provided, otherwise default to generic message.
   *
   * Security Consideration:
   * - Operational errors (400, 404, etc.): Safe to show message
   * - Programming errors (500): Should show generic message
   * - Current implementation always shows error.message
   * - Future enhancement: Only show message if isOperational === true
   *
   * Improvement for Production (Phase 3+):
   * ```typescript
   * const message = err.isOperational
   *   ? err.message
   *   : 'Internal server error';
   * ```
   */
  const message = err.message || 'Internal server error';

  /**
   * Step 3: Log Error Details (Server-Side Only)
   *
   * In development mode, log full error object to console.
   * Includes:
   * - Error name (e.g., "ValidationError", "TypeError")
   * - Error message
   * - Stack trace (file paths and line numbers)
   * - statusCode (if set)
   * - isOperational (if set)
   *
   * Why Development Only?
   * - Production logs are typically sent to external service
   * - Console.log in production is often ignored
   * - Production should use structured logging (Winston, Pino, etc.)
   *
   * Future Enhancement (Phase 3+):
   * ```typescript
   * if (process.env.NODE_ENV === 'production') {
   *   // Send to monitoring service (Sentry, DataDog, etc.)
   *   logger.error({
   *     message: err.message,
   *     statusCode,
   *     stack: err.stack,
   *     url: req.url,
   *     method: req.method,
   *     userId: req.user?.userId
   *   });
   * } else {
   *   // Development: log to console
   *   console.error('Error:', err);
   * }
   * ```
   */
  if (process.env.NODE_ENV === 'development') {
    console.error('❌ Error caught by error handler:');
    console.error('   Status:', statusCode);
    console.error('   Message:', message);
    console.error('   URL:', req.method, req.url);
    console.error('   Stack:', err.stack);
  }

  /**
   * Step 4: Send Error Response to Client
   *
   * Return JSON error response with consistent format.
   *
   * Response Structure:
   * - success: Always false (indicates error)
   * - error: Error message (operational errors) or generic message (bugs)
   * - stack: Stack trace (development only, for debugging)
   *
   * Security Critical:
   * - NEVER send stack traces in production
   * - Stack traces reveal:
   *   - Internal file structure (/var/www/api/src/routes/auth.ts)
   *   - Library versions (better-sqlite3@9.2.2)
   *   - Code logic and flow
   *   - Potential security vulnerabilities
   *
   * Conditional Stack Trace:
   * - Uses spread operator with conditional: ...condition && { key: value }
   * - If development: Include { stack: err.stack }
   * - If production: Exclude stack property entirely
   *
   * Example Responses:
   *
   * Development:
   * {
   *   "success": false,
   *   "error": "Database connection failed",
   *   "stack": "Error: Database connection failed\n    at Object.get (/api/src/database/db.ts:121:15)\n    ..."
   * }
   *
   * Production:
   * {
   *   "success": false,
   *   "error": "Internal server error"
   * }
   */
  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });

  /**
   * Note: next parameter is not used
   *
   * Why is next required?
   * - Express error handlers must have 4 parameters (err, req, res, next)
   * - Express checks parameter count to identify error handlers
   * - Even if not used, next must be in signature
   *
   * When would we call next()?
   * - If we wanted to pass error to another error handler
   * - If we needed to chain multiple error handlers
   * - Not needed in our case (single handler)
   */
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
   * Step 2: Send 404 Response
   *
   * HTTP 404 status indicates resource not found.
   * Consistent JSON format matches error handler.
   *
   * Why Not Call errorHandler?
   * - 404 is not really an "error" (it's expected)
   * - No need for error logging
   * - No need for stack traces
   * - Simpler to handle directly
   */
  res.status(404).json({
    success: false,
    error: errorMessage
  });

  /**
   * Future Enhancement: Log 404s for Analytics (Phase 3+)
   *
   * ```typescript
   * if (process.env.NODE_ENV === 'production') {
   *   logger.warn({
   *     type: '404_not_found',
   *     method: req.method,
   *     path: req.path,
   *     ip: req.ip,
   *     userAgent: req.get('user-agent')
   *   });
   * }
   * ```
   *
   * Use Cases:
   * - Identify broken links in frontend
   * - Detect API version mismatches
   * - Catch typos in route paths
   * - Monitor for route scanning attacks
   */
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
