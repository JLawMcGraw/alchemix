/**
 * CSRF Middleware Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';

// Mock logger
vi.mock('../utils/logger', () => ({
  logSecurityEvent: vi.fn(),
}));

import { csrfMiddleware } from './csrf';
import { logSecurityEvent } from '../utils/logger';

describe('csrfMiddleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let nextFn: NextFunction;
  let jsonMock: vi.Mock;
  let statusMock: vi.Mock;

  beforeEach(() => {
    vi.clearAllMocks();

    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });

    mockReq = {
      method: 'POST',
      path: '/api/test',
      headers: {},
      cookies: {},
    };

    mockRes = {
      status: statusMock,
      json: jsonMock,
    };

    nextFn = vi.fn();
  });

  describe('Safe methods (skip CSRF)', () => {
    it('should skip CSRF check for GET requests', () => {
      mockReq.method = 'GET';

      csrfMiddleware(mockReq as Request, mockRes as Response, nextFn);

      expect(nextFn).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should skip CSRF check for HEAD requests', () => {
      mockReq.method = 'HEAD';

      csrfMiddleware(mockReq as Request, mockRes as Response, nextFn);

      expect(nextFn).toHaveBeenCalled();
    });

    it('should skip CSRF check for OPTIONS requests', () => {
      mockReq.method = 'OPTIONS';

      csrfMiddleware(mockReq as Request, mockRes as Response, nextFn);

      expect(nextFn).toHaveBeenCalled();
    });
  });

  describe('Authorization header bypass', () => {
    it('should skip CSRF when using Authorization header without cookie', () => {
      mockReq.method = 'POST';
      mockReq.headers = { authorization: 'Bearer token123' };
      mockReq.cookies = {}; // No auth_token cookie

      csrfMiddleware(mockReq as Request, mockRes as Response, nextFn);

      expect(nextFn).toHaveBeenCalled();
    });

    it('should NOT skip CSRF when both Authorization header and cookie are present', () => {
      mockReq.method = 'POST';
      mockReq.headers = { authorization: 'Bearer token123' };
      mockReq.cookies = { auth_token: 'cookie-token' };

      csrfMiddleware(mockReq as Request, mockRes as Response, nextFn);

      // Should fail because no CSRF token provided
      expect(statusMock).toHaveBeenCalledWith(403);
    });
  });

  describe('CSRF token validation', () => {
    it('should reject when header token is missing', () => {
      mockReq.method = 'POST';
      mockReq.headers = {};
      mockReq.cookies = { csrf_token: 'cookie-csrf-token' };

      csrfMiddleware(mockReq as Request, mockRes as Response, nextFn);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'CSRF token missing',
      });
      expect(logSecurityEvent).toHaveBeenCalledWith(
        'CSRF validation failed: Missing token',
        expect.objectContaining({
          hasHeaderToken: false,
          hasCookieToken: true,
        })
      );
    });

    it('should reject when cookie token is missing', () => {
      mockReq.method = 'POST';
      mockReq.headers = { 'x-csrf-token': 'header-csrf-token' };
      mockReq.cookies = {};

      csrfMiddleware(mockReq as Request, mockRes as Response, nextFn);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'CSRF token missing',
      });
    });

    it('should reject when tokens do not match', () => {
      mockReq.method = 'POST';
      mockReq.headers = { 'x-csrf-token': 'header-token' };
      mockReq.cookies = { csrf_token: 'different-cookie-token' };

      csrfMiddleware(mockReq as Request, mockRes as Response, nextFn);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid CSRF token',
      });
      expect(logSecurityEvent).toHaveBeenCalledWith(
        'CSRF validation failed: Token mismatch',
        expect.objectContaining({
          path: '/api/test',
          method: 'POST',
        })
      );
    });

    it('should pass when tokens match', () => {
      const validToken = 'valid-csrf-token-12345';
      mockReq.method = 'POST';
      mockReq.headers = { 'x-csrf-token': validToken };
      mockReq.cookies = { csrf_token: validToken };

      csrfMiddleware(mockReq as Request, mockRes as Response, nextFn);

      expect(nextFn).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });
  });

  describe('State-changing methods', () => {
    const stateMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];

    stateMethods.forEach((method) => {
      it(`should validate CSRF for ${method} requests`, () => {
        mockReq.method = method;
        mockReq.headers = {};
        mockReq.cookies = {};

        csrfMiddleware(mockReq as Request, mockRes as Response, nextFn);

        expect(statusMock).toHaveBeenCalledWith(403);
      });
    });
  });

  describe('Timing-safe comparison', () => {
    it('should use constant-time comparison (different lengths)', () => {
      mockReq.method = 'POST';
      mockReq.headers = { 'x-csrf-token': 'short' };
      mockReq.cookies = { csrf_token: 'much-longer-token' };

      csrfMiddleware(mockReq as Request, mockRes as Response, nextFn);

      // Should still reject with same error (no timing leak)
      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid CSRF token',
      });
    });

    it('should use constant-time comparison (same length, different values)', () => {
      mockReq.method = 'POST';
      mockReq.headers = { 'x-csrf-token': 'token-aaaa' };
      mockReq.cookies = { csrf_token: 'token-bbbb' };

      csrfMiddleware(mockReq as Request, mockRes as Response, nextFn);

      expect(statusMock).toHaveBeenCalledWith(403);
    });
  });
});
