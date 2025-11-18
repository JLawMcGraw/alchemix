/**
 * Error Classes Barrel Export
 *
 * Centralized export point for all custom error classes.
 * Makes importing errors cleaner and more convenient.
 *
 * Usage:
 *   import { ValidationError, NotFoundError, ConflictError } from '../errors';
 *
 * Instead of:
 *   import { ValidationError } from '../errors/AppError';
 *   import { NotFoundError } from '../errors/AppError';
 *   import { ConflictError } from '../errors/AppError';
 */

export {
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  InternalError,
  isAppError,
  isOperationalError
} from './AppError';
