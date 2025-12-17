/**
 * CORS Configuration Tests
 *
 * Tests for CORS origin validation and security policies.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { corsOptions } from './corsConfig';

describe('corsConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('origin validation', () => {
    it('should allow localhost:3001 (Next.js dev server)', () => {
      const callback = vi.fn();
      const origin = corsOptions.origin as Function;

      origin('http://localhost:3001', callback);

      expect(callback).toHaveBeenCalledWith(null, true);
    });

    it('should allow localhost:3000 (alternative port)', () => {
      const callback = vi.fn();
      const origin = corsOptions.origin as Function;

      origin('http://localhost:3000', callback);

      expect(callback).toHaveBeenCalledWith(null, true);
    });

    it('should reject unauthorized origins', () => {
      const callback = vi.fn();
      const origin = corsOptions.origin as Function;

      origin('http://evil-site.com', callback);

      expect(callback).toHaveBeenCalledWith(expect.any(Error));
      expect(callback.mock.calls[0][0].message).toBe('Not allowed by CORS');
    });

    it('should reject origins with different protocols', () => {
      const callback = vi.fn();
      const origin = corsOptions.origin as Function;

      // https vs http
      origin('https://localhost:3001', callback);

      expect(callback).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should reject origins with different ports', () => {
      const callback = vi.fn();
      const origin = corsOptions.origin as Function;

      origin('http://localhost:9999', callback);

      expect(callback).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('null/undefined origin handling', () => {
    describe('in development mode', () => {
      beforeEach(() => {
        process.env.NODE_ENV = 'development';
      });

      it('should allow requests with no origin in development', () => {
        const callback = vi.fn();
        const origin = corsOptions.origin as Function;

        origin(undefined, callback);

        expect(callback).toHaveBeenCalledWith(null, true);
      });

      it('should allow requests with null origin in development', () => {
        const callback = vi.fn();
        const origin = corsOptions.origin as Function;

        origin(null, callback);

        expect(callback).toHaveBeenCalledWith(null, true);
      });
    });

    describe('in production mode', () => {
      beforeEach(() => {
        process.env.NODE_ENV = 'production';
      });

      it('should reject requests with no origin in production', () => {
        const callback = vi.fn();
        const origin = corsOptions.origin as Function;

        origin(undefined, callback);

        expect(callback).toHaveBeenCalledWith(expect.any(Error));
        expect(callback.mock.calls[0][0].message).toBe('Origin header required in production');
      });
    });
  });

  describe('CORS options', () => {
    it('should have credentials enabled', () => {
      expect(corsOptions.credentials).toBe(true);
    });

    it('should allow required HTTP methods', () => {
      expect(corsOptions.methods).toContain('GET');
      expect(corsOptions.methods).toContain('POST');
      expect(corsOptions.methods).toContain('PUT');
      expect(corsOptions.methods).toContain('DELETE');
      expect(corsOptions.methods).toContain('OPTIONS');
    });

    it('should allow required headers', () => {
      expect(corsOptions.allowedHeaders).toContain('Content-Type');
      expect(corsOptions.allowedHeaders).toContain('Authorization');
      expect(corsOptions.allowedHeaders).toContain('X-CSRF-Token');
    });

    it('should expose Set-Cookie header', () => {
      expect(corsOptions.exposedHeaders).toContain('Set-Cookie');
    });
  });

  describe('FRONTEND_URL environment variable', () => {
    it('should allow custom FRONTEND_URL when set', async () => {
      process.env.FRONTEND_URL = 'https://alchemix.example.com';

      // Re-import to pick up new env
      vi.resetModules();
      const { corsOptions: freshOptions } = await import('./corsConfig');

      const callback = vi.fn();
      const origin = freshOptions.origin as Function;

      origin('https://alchemix.example.com', callback);

      expect(callback).toHaveBeenCalledWith(null, true);
    });
  });
});
