/**
 * Async Handler Utility
 *
 * Purpose: Wraps async route handlers to automatically catch errors and pass to error middleware
 *
 * Problem Without This:
 * ```typescript
 * router.get('/', async (req, res) => {
 *   const data = await someAsyncOperation(); // If this throws, Express doesn't catch it
 *   res.json(data);
 * });
 * ```
 *
 * Solution With AsyncHandler:
 * ```typescript
 * router.get('/', asyncHandler(async (req, res) => {
 *   const data = await someAsyncOperation(); // Error automatically caught and forwarded
 *   res.json(data);
 * }));
 * ```
 *
 * Benefits:
 * - No need for try/catch in every route
 * - Consistent error handling
 * - Cleaner route code
 * - Errors automatically passed to error middleware
 *
 * Usage:
 *   import { asyncHandler } from '../utils/asyncHandler';
 *
 *   router.get('/users', asyncHandler(async (req, res) => {
 *     const users = await userService.getAll();
 *     res.json({ success: true, data: users });
 *   }));
 *
 * How It Works:
 * 1. Wraps async function in Promise.resolve()
 * 2. If promise resolves → normal execution continues
 * 3. If promise rejects → error caught and passed to next() (error middleware)
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Wraps async route handlers to catch errors and pass to error middleware
 *
 * @param fn - Async route handler function
 * @returns Express RequestHandler that automatically handles promise rejections
 *
 * Implementation Note:
 * This uses Promise.resolve().catch() pattern which is concise and performant.
 * Functionally equivalent to async/await with try/catch but more elegant.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export default asyncHandler;
