/**
 * User Rate Limit Middleware Tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';

// Mock logger
vi.mock('../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  logSecurityEvent: vi.fn(),
}));

import {
  userRateLimit,
  getUserRateLimitStatus,
  resetUserRateLimit,
  shutdownUserRateLimit,
} from './userRateLimit';
import { logSecurityEvent } from '../utils/logger';

describe('userRateLimit', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let nextFn: NextFunction;
  let jsonMock: vi.Mock;
  let statusMock: vi.Mock;
  let setMock: vi.Mock;

  beforeEach(() => {
    vi.clearAllMocks();

    jsonMock = vi.fn();
    setMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });

    mockReq = {
      method: 'GET',
      baseUrl: '/api',
      path: '/test',
      originalUrl: '/api/test',
      route: { path: '/test' },
      user: { userId: 1 },
    };

    mockRes = {
      status: statusMock,
      json: jsonMock,
      set: setMock,
    };

    nextFn = vi.fn();

    // Reset rate limits for test user
    resetUserRateLimit(1);
  });

  afterEach(() => {
    // Clean up after tests
    resetUserRateLimit(1);
    resetUserRateLimit(2);
    resetUserRateLimit(999);
  });

  describe('Rate limit enforcement', () => {
    it('should allow requests within limit', () => {
      const middleware = userRateLimit(5, 15);

      // Make 3 requests (under limit of 5)
      for (let i = 0; i < 3; i++) {
        middleware(mockReq as Request, mockRes as Response, nextFn);
      }

      expect(nextFn).toHaveBeenCalledTimes(3);
      expect(statusMock).not.toHaveBeenCalledWith(429);
    });

    it('should block requests exceeding limit', () => {
      const middleware = userRateLimit(3, 15);

      // Make 4 requests (over limit of 3)
      for (let i = 0; i < 4; i++) {
        middleware(mockReq as Request, mockRes as Response, nextFn);
      }

      // First 3 should pass, 4th should be blocked
      expect(nextFn).toHaveBeenCalledTimes(3);
      expect(statusMock).toHaveBeenCalledWith(429);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('Rate limit exceeded'),
        })
      );
    });

    it('should log security event when rate limit exceeded', () => {
      const middleware = userRateLimit(2, 15);

      // Exceed limit
      for (let i = 0; i < 3; i++) {
        middleware(mockReq as Request, mockRes as Response, nextFn);
      }

      expect(logSecurityEvent).toHaveBeenCalledWith(
        'Rate limit exceeded',
        expect.objectContaining({
          userId: 1,
          maxRequests: 2,
        })
      );
    });
  });

  describe('Rate limit headers', () => {
    it('should set X-RateLimit-Limit header', () => {
      const middleware = userRateLimit(100, 15);
      middleware(mockReq as Request, mockRes as Response, nextFn);

      expect(setMock).toHaveBeenCalledWith('X-RateLimit-Limit', '100');
    });

    it('should set X-RateLimit-Remaining header', () => {
      const middleware = userRateLimit(100, 15);
      middleware(mockReq as Request, mockRes as Response, nextFn);

      expect(setMock).toHaveBeenCalledWith('X-RateLimit-Remaining', '99');
    });

    it('should set X-RateLimit-Reset header', () => {
      const middleware = userRateLimit(100, 15);
      middleware(mockReq as Request, mockRes as Response, nextFn);

      expect(setMock).toHaveBeenCalledWith(
        'X-RateLimit-Reset',
        expect.any(String)
      );
    });

    it('should set Retry-After header when limit exceeded', () => {
      const middleware = userRateLimit(1, 15);

      // Exceed limit
      middleware(mockReq as Request, mockRes as Response, nextFn);
      middleware(mockReq as Request, mockRes as Response, nextFn);

      expect(setMock).toHaveBeenCalledWith('Retry-After', expect.any(String));
    });
  });

  describe('User isolation', () => {
    it('should track rate limits separately per user', () => {
      const middleware = userRateLimit(2, 15);

      // User 1 makes 2 requests
      mockReq.user = { userId: 1 };
      middleware(mockReq as Request, mockRes as Response, nextFn);
      middleware(mockReq as Request, mockRes as Response, nextFn);

      // User 2 should still have quota
      mockReq.user = { userId: 2 };
      middleware(mockReq as Request, mockRes as Response, nextFn);

      // User 1's 3rd request should be blocked
      mockReq.user = { userId: 1 };
      middleware(mockReq as Request, mockRes as Response, nextFn);

      expect(nextFn).toHaveBeenCalledTimes(3); // 2 for user1, 1 for user2
      expect(statusMock).toHaveBeenCalledWith(429);
    });
  });

  describe('Missing authentication handling', () => {
    it('should allow request when userId is missing (logs warning)', () => {
      const middleware = userRateLimit(5, 15);
      mockReq.user = undefined;

      middleware(mockReq as Request, mockRes as Response, nextFn);

      expect(nextFn).toHaveBeenCalled();
    });
  });

  describe('getUserRateLimitStatus', () => {
    it('should return current rate limit status', () => {
      const middleware = userRateLimit(10, 15);

      // Make 3 requests
      for (let i = 0; i < 3; i++) {
        middleware(mockReq as Request, mockRes as Response, nextFn);
      }

      const status = getUserRateLimitStatus(1, undefined, 15);

      expect(status.userId).toBe(1);
      expect(status.requestCount).toBeGreaterThanOrEqual(3);
      expect(status.windowMinutes).toBe(15);
    });

    it('should return zero count for user with no requests', () => {
      const status = getUserRateLimitStatus(999, undefined, 15);

      expect(status.requestCount).toBe(0);
      expect(status.oldestRequest).toBeNull();
      expect(status.newestRequest).toBeNull();
    });
  });

  describe('resetUserRateLimit', () => {
    it('should reset rate limit for specified user', () => {
      const middleware = userRateLimit(2, 15);

      // User makes 2 requests (reaches limit)
      middleware(mockReq as Request, mockRes as Response, nextFn);
      middleware(mockReq as Request, mockRes as Response, nextFn);

      // Reset user's limit
      resetUserRateLimit(1);

      // User should be able to make requests again
      middleware(mockReq as Request, mockRes as Response, nextFn);

      expect(nextFn).toHaveBeenCalledTimes(3);
    });

    it('should not affect other users when resetting', () => {
      const middleware = userRateLimit(2, 15);

      // User 1 makes requests
      mockReq.user = { userId: 1 };
      middleware(mockReq as Request, mockRes as Response, nextFn);

      // User 2 makes requests
      mockReq.user = { userId: 2 };
      middleware(mockReq as Request, mockRes as Response, nextFn);

      // Reset only user 1
      resetUserRateLimit(1);

      // Check user 2 still has their history
      const user2Status = getUserRateLimitStatus(2, undefined, 15);
      expect(user2Status.requestCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Scope-based rate limiting', () => {
    it('should use route path in scope identifier', () => {
      const middleware = userRateLimit(2, 15);

      // Make requests to different paths
      mockReq.route = { path: '/recipes' };
      mockReq.baseUrl = '/api';
      middleware(mockReq as Request, mockRes as Response, nextFn);
      middleware(mockReq as Request, mockRes as Response, nextFn);

      // This path should have its own limit
      mockReq.route = { path: '/inventory' };
      middleware(mockReq as Request, mockRes as Response, nextFn);

      expect(nextFn).toHaveBeenCalledTimes(3);
    });
  });
});

describe('shutdownUserRateLimit', () => {
  it('should clear cleanup interval without throwing', () => {
    expect(() => shutdownUserRateLimit()).not.toThrow();
  });
});
