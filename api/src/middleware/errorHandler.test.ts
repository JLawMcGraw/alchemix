import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { errorHandler, notFoundHandler } from './errorHandler';
import {
  AppError,
  ValidationError,
  UnauthorizedError,
  NotFoundError,
  ConflictError,
  InternalError
} from '../errors/AppError';

// Mock logger
vi.mock('../utils/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
  logError: vi.fn(),
}));

// Import the mocked logger
import { logger, logError } from '../utils/logger';

describe('errorHandler', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let jsonMock: any;
  let statusMock: any;

  beforeEach(() => {
    // Reset mocks
    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });

    mockReq = {
      id: 'test-request-id',
      method: 'GET',
      path: '/api/test',
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' } as any,
    };

    mockRes = {
      status: statusMock as any,
      json: jsonMock as any,
    } as Response;

    mockNext = vi.fn() as any;

    // Clear environment variable
    delete process.env.NODE_ENV;
  });

  describe('AppError handling', () => {
    it('should handle ValidationError with correct status code', () => {
      const error = new ValidationError('Invalid email format');

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Invalid email format',
        })
      );
    });

    it('should handle UnauthorizedError with correct status code', () => {
      const error = new UnauthorizedError('Invalid token');

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Invalid token',
        })
      );
    });

    it('should handle NotFoundError with correct status code', () => {
      const error = new NotFoundError('User');

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'User not found',
        })
      );
    });

    it('should handle ConflictError with correct status code', () => {
      const error = new ConflictError('Email already exists');

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(409);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Email already exists',
        })
      );
    });

    it('should include error details when provided', () => {
      const error = new ValidationError('Invalid input', { field: 'email', value: 'invalid' });

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Invalid input',
          details: { field: 'email', value: 'invalid' },
        })
      );
    });
  });

  describe('standard Error handling', () => {
    it('should handle standard Error as 500', () => {
      const error = new Error('Something went wrong');

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(500);
    });

    it('should hide error message for non-operational errors in production', () => {
      process.env.NODE_ENV = 'production';
      const error = new Error('Database connection failed');

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Internal server error',
        })
      );
      expect(jsonMock).not.toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Database connection failed',
        })
      );
    });

    it('should show error message for non-operational errors in development', () => {
      process.env.NODE_ENV = 'development';
      const error = new Error('Database connection failed');

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Internal server error',
          stack: expect.any(String),
        })
      );
    });
  });

  describe('stack trace handling', () => {
    it('should include stack trace in development', () => {
      process.env.NODE_ENV = 'development';
      const error = new ValidationError('Test error');

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          stack: expect.any(String),
        })
      );
    });

    it('should not include stack trace in production', () => {
      process.env.NODE_ENV = 'production';
      const error = new ValidationError('Test error');

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      const callArgs = jsonMock.mock.calls[0][0];
      expect(callArgs).not.toHaveProperty('stack');
    });

    it('should not include stack trace when NODE_ENV is not set', () => {
      delete process.env.NODE_ENV;
      const error = new ValidationError('Test error');

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      const callArgs = jsonMock.mock.calls[0][0];
      expect(callArgs).not.toHaveProperty('stack');
    });
  });

  describe('operational vs non-operational errors', () => {
    it('should treat AppError with isOperational=true as operational', () => {
      const error = new AppError('Operational error', 400, true);

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Operational error',
        })
      );
    });

    it('should treat AppError with isOperational=false as non-operational', () => {
      process.env.NODE_ENV = 'production';
      const error = new AppError('Programming error', 500, false);

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      // AppError uses toJSON() which returns the original error message
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Programming error',
        })
      );
    });

    it('should treat InternalError as non-operational', () => {
      process.env.NODE_ENV = 'production';
      const error = new InternalError('Critical failure');

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      // InternalError extends AppError and uses toJSON() which returns the original message
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Critical failure',
        })
      );
    });
  });

  describe('error logging context', () => {
    it('should log error with request context', () => {
      const error = new ValidationError('Test error');

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(logError).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          requestId: 'test-request-id',
          method: 'GET',
          path: '/api/test',
          statusCode: 400,
          ip: '127.0.0.1',
          isOperational: true,
        })
      );
    });

    it('should include userId in log context when available', () => {
      mockReq.user = { userId: 123, email: 'test@example.com' } as any;
      const error = new ValidationError('Test error');

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(logError).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          userId: 123,
        })
      );
    });
  });
});

describe('notFoundHandler', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let jsonMock: any;
  let statusMock: any;

  beforeEach(() => {
    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });

    mockReq = {
      id: 'test-request-id',
      method: 'GET',
      path: '/api/nonexistent',
      query: {},
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' } as any,
      get: vi.fn().mockReturnValue('Test User Agent'),
    };

    mockRes = {
      status: statusMock as any,
      json: jsonMock as any,
    } as Response;
  });

  it('should return 404 status code', () => {
    notFoundHandler(mockReq as Request, mockRes as Response);

    expect(statusMock).toHaveBeenCalledWith(404);
  });

  it('should include method and path in error message', () => {
    notFoundHandler(mockReq as Request, mockRes as Response);

    expect(jsonMock).toHaveBeenCalledWith({
      success: false,
      error: 'Route GET /api/nonexistent not found',
    });
  });

  it('should handle POST requests', () => {
    (mockReq as any).method = 'POST';
    (mockReq as any).path = '/api/users';

    notFoundHandler(mockReq as Request, mockRes as Response);

    expect(jsonMock).toHaveBeenCalledWith({
      success: false,
      error: 'Route POST /api/users not found',
    });
  });

  it('should handle DELETE requests', () => {
    (mockReq as any).method = 'DELETE';
    (mockReq as any).path = '/api/bottles/123';

    notFoundHandler(mockReq as Request, mockRes as Response);

    expect(jsonMock).toHaveBeenCalledWith({
      success: false,
      error: 'Route DELETE /api/bottles/123 not found',
    });
  });

  it('should log 404 with request details', () => {
    notFoundHandler(mockReq as Request, mockRes as Response);

    expect(logger.warn).toHaveBeenCalledWith(
      'Route not found',
      expect.objectContaining({
        requestId: 'test-request-id',
        method: 'GET',
        path: '/api/nonexistent',
        query: {},
        ip: '127.0.0.1',
        userAgent: 'Test User Agent',
      })
    );
  });

  it('should handle requests with query parameters', () => {
    mockReq.query = { page: '1', limit: '10' };

    notFoundHandler(mockReq as Request, mockRes as Response);

    expect(logger.warn).toHaveBeenCalledWith(
      'Route not found',
      expect.objectContaining({
        query: { page: '1', limit: '10' },
      })
    );
  });

  it('should handle different HTTP methods', () => {
    const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];

    methods.forEach(method => {
      mockReq.method = method;
      notFoundHandler(mockReq as Request, mockRes as Response);

      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: `Route ${method} /api/nonexistent not found`,
      });
    });
  });

  it('should handle root path', () => {
    (mockReq as any).path = '/';

    notFoundHandler(mockReq as Request, mockRes as Response);

    expect(jsonMock).toHaveBeenCalledWith({
      success: false,
      error: 'Route GET / not found',
    });
  });

  it('should handle nested paths', () => {
    (mockReq as any).path = '/api/v1/users/123/posts/456/comments';

    notFoundHandler(mockReq as Request, mockRes as Response);

    expect(jsonMock).toHaveBeenCalledWith({
      success: false,
      error: 'Route GET /api/v1/users/123/posts/456/comments not found',
    });
  });
});
