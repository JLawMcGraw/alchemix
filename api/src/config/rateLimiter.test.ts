/**
 * Rate Limiter Configuration Tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  apiLimiter,
  authLimiter,
  aiLimiter,
  importLimiter,
  passwordResetLimiter,
  logoutLimiter,
  changePasswordLimiter,
  verificationLimiter,
  bulkOperationsLimiter,
} from './rateLimiter';

describe('Rate Limiter Configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set test environment to skip rate limiting
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Limiter exports', () => {
    it('apiLimiter should be a middleware function', () => {
      expect(typeof apiLimiter).toBe('function');
      expect(apiLimiter.length).toBeGreaterThanOrEqual(2);
    });

    it('authLimiter should be a middleware function', () => {
      expect(typeof authLimiter).toBe('function');
      expect(authLimiter.length).toBeGreaterThanOrEqual(2);
    });

    it('aiLimiter should be a middleware function', () => {
      expect(typeof aiLimiter).toBe('function');
      expect(aiLimiter.length).toBeGreaterThanOrEqual(2);
    });

    it('importLimiter should be a middleware function', () => {
      expect(typeof importLimiter).toBe('function');
      expect(importLimiter.length).toBeGreaterThanOrEqual(2);
    });

    it('passwordResetLimiter should be a middleware function', () => {
      expect(typeof passwordResetLimiter).toBe('function');
      expect(passwordResetLimiter.length).toBeGreaterThanOrEqual(2);
    });

    it('logoutLimiter should be a middleware function', () => {
      expect(typeof logoutLimiter).toBe('function');
      expect(logoutLimiter.length).toBeGreaterThanOrEqual(2);
    });

    it('changePasswordLimiter should be a middleware function', () => {
      expect(typeof changePasswordLimiter).toBe('function');
      expect(changePasswordLimiter.length).toBeGreaterThanOrEqual(2);
    });

    it('verificationLimiter should be a middleware function', () => {
      expect(typeof verificationLimiter).toBe('function');
      expect(verificationLimiter.length).toBeGreaterThanOrEqual(2);
    });

    it('bulkOperationsLimiter should be a middleware function', () => {
      expect(typeof bulkOperationsLimiter).toBe('function');
      expect(bulkOperationsLimiter.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('All limiters configuration', () => {
    it('should have all 9 rate limiters exported', () => {
      const limiters = [
        apiLimiter,
        authLimiter,
        aiLimiter,
        importLimiter,
        passwordResetLimiter,
        logoutLimiter,
        changePasswordLimiter,
        verificationLimiter,
        bulkOperationsLimiter,
      ];

      expect(limiters).toHaveLength(9);
      limiters.forEach((limiter) => {
        expect(typeof limiter).toBe('function');
      });
    });

    it('all limiters should accept Express middleware signature', () => {
      const limiters = [
        apiLimiter,
        authLimiter,
        aiLimiter,
        importLimiter,
        passwordResetLimiter,
        logoutLimiter,
        changePasswordLimiter,
        verificationLimiter,
        bulkOperationsLimiter,
      ];

      limiters.forEach((limiter) => {
        // Express middleware functions should have at least 2 parameters (req, res)
        // or 3 (req, res, next) - the .length property shows expected parameters
        expect(limiter.length).toBeGreaterThanOrEqual(2);
      });
    });
  });
});
