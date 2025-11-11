/**
 * Custom Error Classes for Application
 *
 * Purpose: Provides structured, type-safe error handling throughout the application
 *
 * Features:
 * - Base AppError class for all application errors
 * - Specialized error classes for different scenarios
 * - Automatic HTTP status code mapping
 * - Operational vs programming error distinction
 * - Support for additional error details/context
 *
 * Error Types:
 * - AppError: Base class for all application errors
 * - ValidationError: Input validation failures (400)
 * - UnauthorizedError: Authentication failures (401)
 * - ForbiddenError: Authorization failures (403)
 * - NotFoundError: Resource not found (404)
 * - ConflictError: Resource conflicts (409, e.g., duplicate email)
 * - RateLimitError: Rate limit exceeded (429)
 * - InternalError: Server errors (500)
 *
 * Usage:
 *   import { ValidationError, NotFoundError, ConflictError } from './errors/AppError';
 *
 *   // Throw errors in services/controllers
 *   if (!user) {
 *     throw new NotFoundError('User');
 *   }
 *
 *   if (existingUser) {
 *     throw new ConflictError('User already exists with this email');
 *   }
 *
 *   if (!isValidEmail(email)) {
 *     throw new ValidationError('Invalid email format', { field: 'email' });
 *   }
 *
 * Benefits:
 * - Type-safe error handling
 * - Consistent error responses
 * - Easier to test (instanceof checks)
 * - Clear error semantics
 * - Automatic status code mapping
 */

/**
 * Base Application Error Class
 *
 * All custom errors should extend this class
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: any;

  constructor(
    message: string,
    statusCode: number,
    isOperational: boolean = true,
    details?: any
  ) {
    super(message);

    // Maintains proper stack trace for where error was thrown (V8 only)
    Error.captureStackTrace(this, this.constructor);

    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;

    // Ensure instanceof works correctly
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /**
   * Convert error to JSON for API responses
   */
  toJSON(): Record<string, any> {
    return {
      success: false,
      error: this.message,
      ...(this.details && { details: this.details }),
    };
  }
}

/**
 * Validation Error (400 Bad Request)
 *
 * Use when request data fails validation
 *
 * Example:
 *   throw new ValidationError('Invalid email format', { field: 'email', value: 'not-an-email' });
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 400, true, details);
  }
}

/**
 * Unauthorized Error (401 Unauthorized)
 *
 * Use when authentication is required but missing or invalid
 *
 * Example:
 *   throw new UnauthorizedError('Invalid credentials');
 *   throw new UnauthorizedError(); // Default message: 'Unauthorized'
 */
export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401, true);
  }
}

/**
 * Forbidden Error (403 Forbidden)
 *
 * Use when user is authenticated but lacks permission
 *
 * Example:
 *   throw new ForbiddenError('You do not have permission to delete this resource');
 */
export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 403, true);
  }
}

/**
 * Not Found Error (404 Not Found)
 *
 * Use when requested resource doesn't exist
 *
 * Example:
 *   throw new NotFoundError('Bottle');  // "Bottle not found"
 *   throw new NotFoundError('User', { userId: 123 });
 */
export class NotFoundError extends AppError {
  constructor(resource: string, details?: any) {
    super(`${resource} not found`, 404, true, details);
  }
}

/**
 * Conflict Error (409 Conflict)
 *
 * Use when request conflicts with existing state (e.g., duplicate resource)
 *
 * Example:
 *   throw new ConflictError('User already exists with this email');
 *   throw new ConflictError('Bottle with this Stock Number already exists');
 */
export class ConflictError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 409, true, details);
  }
}

/**
 * Rate Limit Error (429 Too Many Requests)
 *
 * Use when rate limit is exceeded
 *
 * Example:
 *   throw new RateLimitError('Rate limit exceeded. Please try again later.');
 *   throw new RateLimitError('Too many login attempts', { retryAfter: 900 });
 */
export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests', details?: any) {
    super(message, 429, true, details);
  }
}

/**
 * Internal Server Error (500 Internal Server Error)
 *
 * Use for unexpected server errors
 * Note: Most 500 errors should be caught by global error handler
 *
 * Example:
 *   throw new InternalError('Database connection failed');
 */
export class InternalError extends AppError {
  constructor(message: string = 'Internal server error', details?: any) {
    super(message, 500, false, details); // Not operational - indicates programming error
  }
}

/**
 * Type guard to check if error is an AppError
 */
export function isAppError(error: any): error is AppError {
  return error instanceof AppError;
}

/**
 * Type guard to check if error is operational (safe to show to client)
 */
export function isOperationalError(error: any): boolean {
  return isAppError(error) && error.isOperational;
}
