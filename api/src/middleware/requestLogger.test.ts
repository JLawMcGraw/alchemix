/**
 * Request Logger Middleware Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';

// Use vi.hoisted for mocks that need to be available during vi.mock hoisting
const { mockLogger, mockLogMetric, mockLogSecurityEvent } = vi.hoisted(() => ({
  mockLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    log: vi.fn(),
  },
  mockLogMetric: vi.fn(),
  mockLogSecurityEvent: vi.fn(),
}));

vi.mock('../utils/logger', () => ({
  logger: mockLogger,
  logMetric: mockLogMetric,
  logSecurityEvent: mockLogSecurityEvent,
}));

import { requestLoggerMiddleware, errorLoggerMiddleware } from './requestLogger';

describe('requestLoggerMiddleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let nextFn: NextFunction;
  let finishCallback: (() => void) | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    finishCallback = undefined;

    mockReq = {
      id: 'test-request-id',
      method: 'GET',
      path: '/api/test',
      query: {},
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' } as any,
      get: vi.fn().mockReturnValue('test-user-agent'),
    };

    mockRes = {
      statusCode: 200,
      on: vi.fn((event: string, callback: () => void) => {
        if (event === 'finish') {
          finishCallback = callback;
        }
        return mockRes as Response;
      }),
    };

    nextFn = vi.fn();
  });

  describe('sanitizeQueryParams', () => {
    it('should redact password in query params', () => {
      mockReq.query = { password: 'secret123', name: 'test' };

      requestLoggerMiddleware(mockReq as Request, mockRes as Response, nextFn);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Incoming request',
        expect.objectContaining({
          query: expect.objectContaining({
            password: '[REDACTED]',
            name: 'test',
          }),
        })
      );
    });

    it('should redact token in query params', () => {
      mockReq.query = { token: 'abc123', page: '1' };

      requestLoggerMiddleware(mockReq as Request, mockRes as Response, nextFn);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Incoming request',
        expect.objectContaining({
          query: expect.objectContaining({
            token: '[REDACTED]',
            page: '1',
          }),
        })
      );
    });

    it('should redact apiKey variations', () => {
      mockReq.query = { apikey: 'key123', api_key: 'key456' };

      requestLoggerMiddleware(mockReq as Request, mockRes as Response, nextFn);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Incoming request',
        expect.objectContaining({
          query: expect.objectContaining({
            apikey: '[REDACTED]',
            api_key: '[REDACTED]',
          }),
        })
      );
    });

    it('should redact creditcard and ssn', () => {
      mockReq.query = { creditcard: '4111111111111111', ssn: '123-45-6789' };

      requestLoggerMiddleware(mockReq as Request, mockRes as Response, nextFn);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Incoming request',
        expect.objectContaining({
          query: expect.objectContaining({
            creditcard: '[REDACTED]',
            ssn: '[REDACTED]',
          }),
        })
      );
    });

    it('should handle empty query params', () => {
      mockReq.query = {};

      requestLoggerMiddleware(mockReq as Request, mockRes as Response, nextFn);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Incoming request',
        expect.objectContaining({
          query: undefined,
        })
      );
    });

    it('should preserve non-sensitive query params', () => {
      mockReq.query = { page: '1', limit: '10', sort: 'name' };

      requestLoggerMiddleware(mockReq as Request, mockRes as Response, nextFn);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Incoming request',
        expect.objectContaining({
          query: { page: '1', limit: '10', sort: 'name' },
        })
      );
    });
  });

  describe('request logging', () => {
    it('should log incoming request with request details', () => {
      requestLoggerMiddleware(mockReq as Request, mockRes as Response, nextFn);

      expect(mockLogger.info).toHaveBeenCalledWith('Incoming request', {
        requestId: 'test-request-id',
        method: 'GET',
        path: '/api/test',
        query: undefined,
        userId: undefined,
        ip: '127.0.0.1',
        userAgent: 'test-user-agent',
      });
    });

    it('should log userId if authenticated', () => {
      (mockReq as any).user = { userId: 123 };

      requestLoggerMiddleware(mockReq as Request, mockRes as Response, nextFn);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Incoming request',
        expect.objectContaining({
          userId: 123,
        })
      );
    });

    it('should call next() to continue middleware chain', () => {
      requestLoggerMiddleware(mockReq as Request, mockRes as Response, nextFn);

      expect(nextFn).toHaveBeenCalled();
    });
  });

  describe('response logging', () => {
    it('should log request completion on response finish', () => {
      requestLoggerMiddleware(mockReq as Request, mockRes as Response, nextFn);

      expect(mockRes.on).toHaveBeenCalledWith('finish', expect.any(Function));

      // Simulate response finish
      finishCallback?.();

      expect(mockLogger.log).toHaveBeenCalledWith(
        'info',
        'Request completed',
        expect.objectContaining({
          requestId: 'test-request-id',
          method: 'GET',
          path: '/api/test',
          statusCode: 200,
          duration: expect.any(Number),
        })
      );
    });

    it('should use warn level for 4xx status codes', () => {
      mockRes.statusCode = 404;

      requestLoggerMiddleware(mockReq as Request, mockRes as Response, nextFn);
      finishCallback?.();

      expect(mockLogger.log).toHaveBeenCalledWith(
        'warn',
        'Request completed',
        expect.objectContaining({ statusCode: 404 })
      );
    });

    it('should use error level for 5xx status codes', () => {
      mockRes.statusCode = 500;

      requestLoggerMiddleware(mockReq as Request, mockRes as Response, nextFn);
      finishCallback?.();

      expect(mockLogger.log).toHaveBeenCalledWith(
        'error',
        'Request completed',
        expect.objectContaining({ statusCode: 500 })
      );
    });

    it('should log performance metric', () => {
      requestLoggerMiddleware(mockReq as Request, mockRes as Response, nextFn);
      finishCallback?.();

      expect(mockLogMetric).toHaveBeenCalledWith(
        'request_duration',
        expect.any(Number),
        expect.objectContaining({
          requestId: 'test-request-id',
          method: 'GET',
          path: '/api/test',
          statusCode: 200,
        })
      );
    });

    it('should log security event for 401 responses', () => {
      mockRes.statusCode = 401;

      requestLoggerMiddleware(mockReq as Request, mockRes as Response, nextFn);
      finishCallback?.();

      expect(mockLogSecurityEvent).toHaveBeenCalledWith(
        'Authentication/Authorization failure',
        expect.objectContaining({
          statusCode: 401,
          path: '/api/test',
        })
      );
    });

    it('should log security event for 403 responses', () => {
      mockRes.statusCode = 403;

      requestLoggerMiddleware(mockReq as Request, mockRes as Response, nextFn);
      finishCallback?.();

      expect(mockLogSecurityEvent).toHaveBeenCalledWith(
        'Authentication/Authorization failure',
        expect.objectContaining({
          statusCode: 403,
        })
      );
    });
  });
});

describe('errorLoggerMiddleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let nextFn: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();

    mockReq = {
      id: 'test-request-id',
      method: 'POST',
      path: '/api/error-test',
      ip: '192.168.1.1',
      socket: { remoteAddress: '192.168.1.1' } as any,
    };

    mockRes = {};
    nextFn = vi.fn();
  });

  it('should log error with full details', () => {
    const testError = new Error('Test error message');
    testError.stack = 'Error stack trace';

    errorLoggerMiddleware(testError, mockReq as Request, mockRes as Response, nextFn);

    expect(mockLogger.error).toHaveBeenCalledWith('Request error', {
      requestId: 'test-request-id',
      method: 'POST',
      path: '/api/error-test',
      error: {
        name: 'Error',
        message: 'Test error message',
        stack: 'Error stack trace',
      },
      userId: undefined,
      ip: '192.168.1.1',
    });
  });

  it('should include userId if authenticated', () => {
    const testError = new Error('Auth error');
    (mockReq as any).user = { userId: 456 };

    errorLoggerMiddleware(testError, mockReq as Request, mockRes as Response, nextFn);

    expect(mockLogger.error).toHaveBeenCalledWith(
      'Request error',
      expect.objectContaining({
        userId: 456,
      })
    );
  });

  it('should pass error to next handler', () => {
    const testError = new Error('Pass through error');

    errorLoggerMiddleware(testError, mockReq as Request, mockRes as Response, nextFn);

    expect(nextFn).toHaveBeenCalledWith(testError);
  });
});
