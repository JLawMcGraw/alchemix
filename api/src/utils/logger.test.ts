/**
 * Logger Utility Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { filterSensitiveData, logError, logSecurityEvent, logMetric, logger } from './logger';

// Note: We test the exported functions directly rather than mocking winston
// since filterSensitiveData is a pure function we can test in isolation

describe('filterSensitiveData', () => {
  describe('Basic field redaction', () => {
    it('should redact password fields', () => {
      const input = { password: 'secret123', username: 'john' };
      const result = filterSensitiveData(input);

      expect(result.password).toBe('[REDACTED]');
      expect(result.username).toBe('john');
    });

    it('should redact password_hash fields', () => {
      const input = { password_hash: '$2b$10$...', email: 'test@example.com' };
      const result = filterSensitiveData(input);

      expect(result.password_hash).toBe('[REDACTED]');
      expect(result.email).toBe('test@example.com');
    });

    it('should redact token fields', () => {
      const input = { token: 'jwt.token.here', userId: 123 };
      const result = filterSensitiveData(input);

      expect(result.token).toBe('[REDACTED]');
      expect(result.userId).toBe(123);
    });

    it('should redact secret fields', () => {
      const input = { secret: 'my-secret', public: 'data' };
      const result = filterSensitiveData(input);

      expect(result.secret).toBe('[REDACTED]');
      expect(result.public).toBe('data');
    });

    it('should redact authorization headers', () => {
      const input = { authorization: 'Bearer token123', contentType: 'application/json' };
      const result = filterSensitiveData(input);

      expect(result.authorization).toBe('[REDACTED]');
      expect(result.contentType).toBe('application/json');
    });

    it('should redact cookie fields', () => {
      const input = { cookie: 'session=abc123', path: '/api' };
      const result = filterSensitiveData(input);

      expect(result.cookie).toBe('[REDACTED]');
      expect(result.path).toBe('/api');
    });

    it('should redact api_key fields', () => {
      const input = { api_key: 'key123', apikey: 'key456', data: 'safe' };
      const result = filterSensitiveData(input);

      expect(result.api_key).toBe('[REDACTED]');
      expect(result.apikey).toBe('[REDACTED]');
      expect(result.data).toBe('safe');
    });

    it('should redact jwt fields', () => {
      const input = { jwt: 'eyJhbG...', userId: 1 };
      const result = filterSensitiveData(input);

      expect(result.jwt).toBe('[REDACTED]');
    });

    it('should redact credential fields', () => {
      const input = { credential: 'cred123', user: 'test' };
      const result = filterSensitiveData(input);

      expect(result.credential).toBe('[REDACTED]');
    });

    it('should redact private_key fields', () => {
      const input = { private_key: '-----BEGIN RSA...', public_key: 'pub' };
      const result = filterSensitiveData(input);

      expect(result.private_key).toBe('[REDACTED]');
      expect(result.public_key).toBe('pub');
    });

    it('should redact access_token and refresh_token fields', () => {
      const input = { access_token: 'at123', refresh_token: 'rt456', userId: 1 };
      const result = filterSensitiveData(input);

      expect(result.access_token).toBe('[REDACTED]');
      expect(result.refresh_token).toBe('[REDACTED]');
      expect(result.userId).toBe(1);
    });

    it('should redact csrf fields', () => {
      const input = { csrf: 'token123', csrfToken: 'token456', path: '/api' };
      const result = filterSensitiveData(input);

      expect(result.csrf).toBe('[REDACTED]');
      expect(result.csrfToken).toBe('[REDACTED]');
    });

    it('should redact session fields', () => {
      const input = { session: 'sess123', sessionId: 'sid456', data: 'ok' };
      const result = filterSensitiveData(input);

      expect(result.session).toBe('[REDACTED]');
      expect(result.sessionId).toBe('[REDACTED]');
    });
  });

  describe('Case insensitivity', () => {
    it('should redact regardless of case', () => {
      const input = {
        PASSWORD: 'secret',
        Token: 'jwt',
        API_KEY: 'key',
        Authorization: 'bearer',
      };
      const result = filterSensitiveData(input);

      expect(result.PASSWORD).toBe('[REDACTED]');
      expect(result.Token).toBe('[REDACTED]');
      expect(result.API_KEY).toBe('[REDACTED]');
      expect(result.Authorization).toBe('[REDACTED]');
    });

    it('should handle mixed case field names', () => {
      const input = { PassWord: 'secret', toKEN: 'jwt' };
      const result = filterSensitiveData(input);

      expect(result.PassWord).toBe('[REDACTED]');
      expect(result.toKEN).toBe('[REDACTED]');
    });
  });

  describe('Nested object handling', () => {
    it('should recursively filter nested objects', () => {
      const input = {
        user: {
          password: 'secret',
          name: 'John',
        },
        settings: {
          api_key: 'key123',
          theme: 'dark',
        },
      };
      const result = filterSensitiveData(input);

      expect((result.user as any).password).toBe('[REDACTED]');
      expect((result.user as any).name).toBe('John');
      expect((result.settings as any).api_key).toBe('[REDACTED]');
      expect((result.settings as any).theme).toBe('dark');
    });

    it('should handle deeply nested objects', () => {
      const input = {
        level1: {
          level2: {
            level3: {
              token: 'secret',
              data: 'safe',
            },
          },
        },
      };
      const result = filterSensitiveData(input);

      expect((result.level1 as any).level2.level3.token).toBe('[REDACTED]');
      expect((result.level1 as any).level2.level3.data).toBe('safe');
    });

    it('should prevent infinite recursion with max depth', () => {
      // Create deeply nested object (more than 10 levels)
      let nested: Record<string, unknown> = { password: 'secret' };
      for (let i = 0; i < 15; i++) {
        nested = { level: nested };
      }

      const result = filterSensitiveData(nested);

      // Should not throw and should truncate
      expect(result).toBeDefined();
    });
  });

  describe('Array handling', () => {
    it('should filter arrays of objects', () => {
      const input = {
        users: [
          { name: 'John', password: 'secret1' },
          { name: 'Jane', password: 'secret2' },
        ],
      };
      const result = filterSensitiveData(input);

      expect((result.users as any)[0].password).toBe('[REDACTED]');
      expect((result.users as any)[0].name).toBe('John');
      expect((result.users as any)[1].password).toBe('[REDACTED]');
    });

    it('should handle arrays with primitive values', () => {
      const input = {
        ids: [1, 2, 3],
        names: ['John', 'Jane'],
      };
      const result = filterSensitiveData(input);

      expect(result.ids).toEqual([1, 2, 3]);
      expect(result.names).toEqual(['John', 'Jane']);
    });

    it('should handle mixed arrays', () => {
      const input = {
        mixed: [
          'string',
          123,
          { password: 'secret', name: 'test' },
          null,
        ],
      };
      const result = filterSensitiveData(input);

      expect((result.mixed as any)[0]).toBe('string');
      expect((result.mixed as any)[1]).toBe(123);
      expect((result.mixed as any)[2].password).toBe('[REDACTED]');
      expect((result.mixed as any)[3]).toBe(null);
    });
  });

  describe('Edge cases', () => {
    it('should handle null values', () => {
      const input = { password: null, name: 'John' };
      const result = filterSensitiveData(input);

      expect(result.password).toBe('[REDACTED]');
      expect(result.name).toBe('John');
    });

    it('should handle undefined values', () => {
      const input = { token: undefined, name: 'John' };
      const result = filterSensitiveData(input);

      expect(result.token).toBe('[REDACTED]');
    });

    it('should handle empty objects', () => {
      const input = {};
      const result = filterSensitiveData(input);

      expect(result).toEqual({});
    });

    it('should preserve non-sensitive primitive values', () => {
      const input = {
        count: 42,
        active: true,
        name: 'Test',
        nullable: null,
      };
      const result = filterSensitiveData(input);

      expect(result.count).toBe(42);
      expect(result.active).toBe(true);
      expect(result.name).toBe('Test');
      expect(result.nullable).toBe(null);
    });
  });

  describe('Partial field name matching', () => {
    it('should redact fields containing sensitive words', () => {
      const input = {
        userPassword: 'secret',
        oldPassword: 'old',
        newPassword: 'new',
        passwordHash: 'hash',
      };
      const result = filterSensitiveData(input);

      expect(result.userPassword).toBe('[REDACTED]');
      expect(result.oldPassword).toBe('[REDACTED]');
      expect(result.newPassword).toBe('[REDACTED]');
      expect(result.passwordHash).toBe('[REDACTED]');
    });

    it('should redact compound token field names', () => {
      const input = {
        authToken: 'auth',
        accessToken: 'access',
        refreshToken: 'refresh',
        csrfToken: 'csrf',
      };
      const result = filterSensitiveData(input);

      expect(result.authToken).toBe('[REDACTED]');
      expect(result.accessToken).toBe('[REDACTED]');
      expect(result.refreshToken).toBe('[REDACTED]');
      expect(result.csrfToken).toBe('[REDACTED]');
    });
  });
});

describe('Logger helper functions', () => {
  beforeEach(() => {
    vi.spyOn(logger, 'error').mockImplementation(() => logger);
    vi.spyOn(logger, 'warn').mockImplementation(() => logger);
    vi.spyOn(logger, 'info').mockImplementation(() => logger);
  });

  describe('logError', () => {
    it('should log error with filtered context', () => {
      const error = new Error('Test error');
      const context = { userId: 1, password: 'secret' };

      logError(error, context);

      expect(logger.error).toHaveBeenCalledWith(
        'Test error',
        expect.objectContaining({
          error: expect.objectContaining({
            name: 'Error',
            message: 'Test error',
          }),
          userId: 1,
          password: '[REDACTED]',
        })
      );
    });
  });

  describe('logSecurityEvent', () => {
    it('should log security event with filtered context', () => {
      const context = { userId: 1, token: 'secret-token' };

      logSecurityEvent('Login attempt', context);

      expect(logger.warn).toHaveBeenCalledWith(
        '[SECURITY] Login attempt',
        expect.objectContaining({
          category: 'security',
          userId: 1,
          token: '[REDACTED]',
        })
      );
    });
  });

  describe('logMetric', () => {
    it('should log metric with filtered context', () => {
      const context = { path: '/api/test', apiKey: 'key123' };

      logMetric('request_duration', 150, context);

      expect(logger.info).toHaveBeenCalledWith(
        '[METRIC] request_duration',
        expect.objectContaining({
          category: 'metric',
          metric: 'request_duration',
          value: 150,
          path: '/api/test',
          apiKey: '[REDACTED]',
        })
      );
    });
  });
});
