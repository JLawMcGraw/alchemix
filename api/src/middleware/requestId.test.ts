/**
 * Request ID Middleware Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';

// Mock logger
vi.mock('../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

import { requestIdMiddleware } from './requestId';
import { logger } from '../utils/logger';

describe('requestIdMiddleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let nextFn: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();

    mockReq = {
      header: vi.fn().mockReturnValue(undefined),
    };

    mockRes = {
      setHeader: vi.fn(),
    };

    nextFn = vi.fn();
  });

  describe('Server-side ID generation', () => {
    it('should always generate a server-side UUID', () => {
      requestIdMiddleware(mockReq as Request, mockRes as Response, nextFn);

      expect(mockReq.id).toBeDefined();
      expect(mockReq.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });

    it('should set X-Request-ID response header with server ID', () => {
      requestIdMiddleware(mockReq as Request, mockRes as Response, nextFn);

      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Request-ID', mockReq.id);
    });

    it('should generate unique IDs for each request', () => {
      const ids: string[] = [];

      for (let i = 0; i < 10; i++) {
        const req = { header: vi.fn().mockReturnValue(undefined) } as any;
        const res = { setHeader: vi.fn() } as any;

        requestIdMiddleware(req, res, nextFn);
        ids.push(req.id);
      }

      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(10);
    });
  });

  describe('Client request ID handling', () => {
    it('should accept valid UUID client request ID', () => {
      const validUUID = '550e8400-e29b-41d4-a716-446655440000';
      (mockReq.header as vi.Mock).mockReturnValue(validUUID);

      requestIdMiddleware(mockReq as Request, mockRes as Response, nextFn);

      expect(mockReq.clientRequestId).toBe(validUUID);
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Client-Request-ID', validUUID);
    });

    it('should reject invalid client request ID format', () => {
      (mockReq.header as vi.Mock).mockReturnValue('invalid-id-format');

      requestIdMiddleware(mockReq as Request, mockRes as Response, nextFn);

      expect(mockReq.clientRequestId).toBeUndefined();
      expect(logger.warn).toHaveBeenCalledWith(
        'Invalid client request ID format - rejected',
        expect.objectContaining({
          reason: 'Must be valid UUID v4 format',
        })
      );
    });

    it('should reject client ID that is too long', () => {
      const longId = 'a'.repeat(200);
      (mockReq.header as vi.Mock).mockReturnValue(longId);

      requestIdMiddleware(mockReq as Request, mockRes as Response, nextFn);

      expect(mockReq.clientRequestId).toBeUndefined();
      expect(logger.warn).toHaveBeenCalledWith(
        'Client request ID too long - rejected',
        expect.objectContaining({
          length: 200,
          maxLength: 128,
        })
      );
    });

    it('should not set X-Client-Request-ID header when client ID is rejected', () => {
      (mockReq.header as vi.Mock).mockReturnValue('not-a-uuid');

      requestIdMiddleware(mockReq as Request, mockRes as Response, nextFn);

      expect(mockRes.setHeader).not.toHaveBeenCalledWith(
        'X-Client-Request-ID',
        expect.anything()
      );
    });

    it('should handle missing client request ID', () => {
      (mockReq.header as vi.Mock).mockReturnValue(undefined);

      requestIdMiddleware(mockReq as Request, mockRes as Response, nextFn);

      expect(mockReq.clientRequestId).toBeUndefined();
      expect(mockRes.setHeader).toHaveBeenCalledTimes(1); // Only server ID
    });

    it('should accept lowercase UUID', () => {
      const lowercaseUUID = '550e8400-e29b-41d4-a716-446655440000';
      (mockReq.header as vi.Mock).mockReturnValue(lowercaseUUID);

      requestIdMiddleware(mockReq as Request, mockRes as Response, nextFn);

      expect(mockReq.clientRequestId).toBe(lowercaseUUID);
    });

    it('should accept uppercase UUID', () => {
      const uppercaseUUID = '550E8400-E29B-41D4-A716-446655440000';
      (mockReq.header as vi.Mock).mockReturnValue(uppercaseUUID);

      requestIdMiddleware(mockReq as Request, mockRes as Response, nextFn);

      expect(mockReq.clientRequestId).toBe(uppercaseUUID);
    });
  });

  describe('Security considerations', () => {
    it('should never use client ID as the authoritative request ID', () => {
      const clientUUID = '550e8400-e29b-41d4-a716-446655440000';
      (mockReq.header as vi.Mock).mockReturnValue(clientUUID);

      requestIdMiddleware(mockReq as Request, mockRes as Response, nextFn);

      // Server ID should be different from client ID
      expect(mockReq.id).not.toBe(clientUUID);
      // Server ID should be in X-Request-ID header
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Request-ID', mockReq.id);
    });

    it('should truncate long client IDs in warning logs', () => {
      const longInvalidId = 'x'.repeat(100);
      (mockReq.header as vi.Mock).mockReturnValue(longInvalidId);

      requestIdMiddleware(mockReq as Request, mockRes as Response, nextFn);

      expect(logger.warn).toHaveBeenCalledWith(
        'Invalid client request ID format - rejected',
        expect.objectContaining({
          clientRequestId: 'x'.repeat(50), // Truncated to 50 chars
        })
      );
    });
  });

  describe('Middleware chain', () => {
    it('should call next() to continue the chain', () => {
      requestIdMiddleware(mockReq as Request, mockRes as Response, nextFn);

      expect(nextFn).toHaveBeenCalled();
    });

    it('should call next() even when client ID is invalid', () => {
      (mockReq.header as vi.Mock).mockReturnValue('bad-id');

      requestIdMiddleware(mockReq as Request, mockRes as Response, nextFn);

      expect(nextFn).toHaveBeenCalled();
    });
  });
});
