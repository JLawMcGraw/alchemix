/**
 * asyncHandler Utility Tests
 *
 * Tests for the async route handler wrapper that automatically
 * catches errors and passes them to Express error middleware.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from './asyncHandler';

describe('asyncHandler', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {};
    mockRes = {
      json: vi.fn(),
      status: vi.fn().mockReturnThis(),
    };
    mockNext = vi.fn();
  });

  describe('successful async operations', () => {
    it('should execute the handler and not call next on success', async () => {
      const handler = asyncHandler(async (req, res) => {
        res.json({ success: true });
      });

      await handler(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({ success: true });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle handlers that return values', async () => {
      const handler = asyncHandler(async (req, res) => {
        res.json({ data: 'test' });
        return 'result';
      });

      await handler(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({ data: 'test' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should work with handlers that call next() explicitly', async () => {
      const handler = asyncHandler(async (req, res, next) => {
        next();
      });

      await handler(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe('error handling', () => {
    it('should catch thrown errors and pass to next()', async () => {
      const testError = new Error('Test error');
      const handler = asyncHandler(async () => {
        throw testError;
      });

      await handler(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(testError);
    });

    it('should catch rejected promises and pass to next()', async () => {
      const testError = new Error('Promise rejection');
      const handler = asyncHandler(async () => {
        return Promise.reject(testError);
      });

      handler(mockReq as Request, mockRes as Response, mockNext);

      // Wait for promise to settle
      await new Promise(resolve => setImmediate(resolve));

      expect(mockNext).toHaveBeenCalledWith(testError);
    });

    it('should handle errors thrown after async operations', async () => {
      const testError = new Error('Async error');
      const handler = asyncHandler(async () => {
        await Promise.resolve(); // Simulate async operation
        throw testError;
      });

      handler(mockReq as Request, mockRes as Response, mockNext);

      // Wait for promise to settle
      await new Promise(resolve => setImmediate(resolve));

      expect(mockNext).toHaveBeenCalledWith(testError);
    });

    it('should handle non-Error objects thrown', async () => {
      const handler = asyncHandler(async () => {
        throw 'string error';
      });

      await handler(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith('string error');
    });

    it('should handle null thrown', async () => {
      const handler = asyncHandler(async () => {
        throw null;
      });

      await handler(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(null);
    });
  });

  describe('request and response access', () => {
    it('should provide access to request object', async () => {
      mockReq = { body: { test: 'data' }, params: { id: '123' } };

      const handler = asyncHandler(async (req, res) => {
        res.json({ body: req.body, params: req.params });
      });

      await handler(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({
        body: { test: 'data' },
        params: { id: '123' }
      });
    });

    it('should provide access to response methods', async () => {
      const handler = asyncHandler(async (req, res) => {
        res.status(201).json({ created: true });
      });

      await handler(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({ created: true });
    });
  });

  describe('edge cases', () => {
    it('should handle synchronous code that throws', async () => {
      const testError = new Error('Sync error');
      const handler = asyncHandler(async () => {
        // This is synchronous but wrapped in async
        if (true) throw testError;
      });

      await handler(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(testError);
    });

    it('should handle empty async function', async () => {
      const handler = asyncHandler(async () => {
        // Empty handler
      });

      await handler(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle multiple sequential awaits', async () => {
      const handler = asyncHandler(async (req, res) => {
        await Promise.resolve(1);
        await Promise.resolve(2);
        await Promise.resolve(3);
        res.json({ success: true });
      });

      handler(mockReq as Request, mockRes as Response, mockNext);

      // Wait for all promises to settle
      await new Promise(resolve => setImmediate(resolve));

      expect(mockRes.json).toHaveBeenCalledWith({ success: true });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});
