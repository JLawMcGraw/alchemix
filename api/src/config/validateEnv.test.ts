/**
 * validateEnv Tests
 *
 * Tests for environment variable validation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('validateEnv', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    // Start with minimal valid env
    process.env = {
      ...originalEnv,
      JWT_SECRET: 'test-jwt-secret-key-that-is-definitely-at-least-32-characters-long',
      NODE_ENV: 'test',
      PORT: '3000',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('JWT_SECRET validation', () => {
    it('should accept valid JWT_SECRET', async () => {
      process.env.JWT_SECRET = 'a'.repeat(32);

      const { validateEnv } = await import('./validateEnv');
      const config = validateEnv();

      expect(config.JWT_SECRET).toBe('a'.repeat(32));
    });

    it('should reject missing JWT_SECRET', async () => {
      delete process.env.JWT_SECRET;

      // The config singleton throws at import time
      await expect(async () => {
        await import('./validateEnv');
      }).rejects.toThrow('JWT_SECRET is required');
    });

    it('should reject JWT_SECRET shorter than 32 characters', async () => {
      process.env.JWT_SECRET = 'short';

      // The config singleton throws at import time
      await expect(async () => {
        await import('./validateEnv');
      }).rejects.toThrow('at least 32 characters');
    });
  });

  describe('NODE_ENV validation', () => {
    it('should accept development', async () => {
      process.env.NODE_ENV = 'development';

      const { validateEnv } = await import('./validateEnv');
      const config = validateEnv();

      expect(config.NODE_ENV).toBe('development');
    });

    it('should accept production', async () => {
      process.env.NODE_ENV = 'production';
      process.env.FRONTEND_URL = 'https://example.com'; // Required in production

      const { validateEnv } = await import('./validateEnv');
      const config = validateEnv();

      expect(config.NODE_ENV).toBe('production');
    });

    it('should accept test', async () => {
      process.env.NODE_ENV = 'test';

      const { validateEnv } = await import('./validateEnv');
      const config = validateEnv();

      expect(config.NODE_ENV).toBe('test');
    });

    it('should default to development if not set', async () => {
      delete process.env.NODE_ENV;

      const { validateEnv } = await import('./validateEnv');
      const config = validateEnv();

      expect(config.NODE_ENV).toBe('development');
    });

    it('should reject invalid NODE_ENV', async () => {
      process.env.NODE_ENV = 'invalid';

      // The config singleton throws at import time
      await expect(async () => {
        await import('./validateEnv');
      }).rejects.toThrow('NODE_ENV must be one of');
    });
  });

  describe('PORT validation', () => {
    it('should accept valid port numbers', async () => {
      process.env.PORT = '8080';

      const { validateEnv } = await import('./validateEnv');
      const config = validateEnv();

      expect(config.PORT).toBe(8080);
    });

    it('should default to 3000', async () => {
      delete process.env.PORT;

      const { validateEnv } = await import('./validateEnv');
      const config = validateEnv();

      expect(config.PORT).toBe(3000);
    });

    it('should reject invalid port (too low)', async () => {
      process.env.PORT = '0';

      // The config singleton throws at import time
      await expect(async () => {
        await import('./validateEnv');
      }).rejects.toThrow('PORT must be a number between 1 and 65535');
    });

    it('should reject invalid port (too high)', async () => {
      process.env.PORT = '99999';

      // The config singleton throws at import time
      await expect(async () => {
        await import('./validateEnv');
      }).rejects.toThrow('PORT must be a number between 1 and 65535');
    });

    it('should reject non-numeric port', async () => {
      process.env.PORT = 'not-a-number';

      // The config singleton throws at import time
      await expect(async () => {
        await import('./validateEnv');
      }).rejects.toThrow('PORT must be a number');
    });
  });

  describe('DATABASE_PATH', () => {
    it('should use provided path', async () => {
      process.env.DATABASE_PATH = '/custom/path/db.sqlite';

      const { validateEnv } = await import('./validateEnv');
      const config = validateEnv();

      expect(config.DATABASE_PATH).toBe('/custom/path/db.sqlite');
    });

    it('should default to ./data/alchemix.db', async () => {
      delete process.env.DATABASE_PATH;

      const { validateEnv } = await import('./validateEnv');
      const config = validateEnv();

      expect(config.DATABASE_PATH).toBe('./data/alchemix.db');
    });
  });

  describe('FRONTEND_URL validation', () => {
    it('should be optional in development', async () => {
      process.env.NODE_ENV = 'development';
      delete process.env.FRONTEND_URL;

      const { validateEnv } = await import('./validateEnv');
      const config = validateEnv();

      expect(config.FRONTEND_URL).toBeUndefined();
    });

    it('should be required in production', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.FRONTEND_URL;

      // The config singleton throws at import time, so we need to catch that
      await expect(async () => {
        await import('./validateEnv');
      }).rejects.toThrow('FRONTEND_URL is required in production');
    });

    it('should accept valid URL in production', async () => {
      process.env.NODE_ENV = 'production';
      process.env.FRONTEND_URL = 'https://alchemix.example.com';

      const { validateEnv } = await import('./validateEnv');
      const config = validateEnv();

      expect(config.FRONTEND_URL).toBe('https://alchemix.example.com');
    });
  });

  describe('Optional AI Services', () => {
    it('should accept ANTHROPIC_API_KEY', async () => {
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';

      const { validateEnv } = await import('./validateEnv');
      const config = validateEnv();

      expect(config.ANTHROPIC_API_KEY).toBe('sk-ant-test-key');
    });

    it('should accept OPENAI_API_KEY', async () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';

      const { validateEnv } = await import('./validateEnv');
      const config = validateEnv();

      expect(config.OPENAI_API_KEY).toBe('sk-test-key');
    });
  });

  describe('MemMachine configuration', () => {
    it('should accept MEMMACHINE_API_URL', async () => {
      process.env.MEMMACHINE_API_URL = 'http://localhost:8080';

      const { validateEnv } = await import('./validateEnv');
      const config = validateEnv();

      expect(config.MEMMACHINE_API_URL).toBe('http://localhost:8080');
    });

    it('should parse MEMMACHINE_ENABLED boolean', async () => {
      process.env.MEMMACHINE_ENABLED = 'true';

      const { validateEnv } = await import('./validateEnv');
      const config = validateEnv();

      expect(config.MEMMACHINE_ENABLED).toBe(true);
    });

    it('should default MEMMACHINE_ENABLED to false', async () => {
      delete process.env.MEMMACHINE_ENABLED;

      const { validateEnv } = await import('./validateEnv');
      const config = validateEnv();

      expect(config.MEMMACHINE_ENABLED).toBe(false);
    });
  });

  describe('SMTP configuration', () => {
    it('should accept complete SMTP configuration', async () => {
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_PORT = '587';
      process.env.SMTP_USER = 'user@example.com';
      process.env.SMTP_PASS = 'password123';
      process.env.SMTP_FROM = 'noreply@example.com';

      const { validateEnv } = await import('./validateEnv');
      const config = validateEnv();

      expect(config.SMTP_HOST).toBe('smtp.example.com');
      expect(config.SMTP_PORT).toBe(587);
      expect(config.SMTP_USER).toBe('user@example.com');
      expect(config.SMTP_PASS).toBe('password123');
      expect(config.SMTP_FROM).toBe('noreply@example.com');
    });

    it('should warn if SMTP_HOST set without other SMTP vars', async () => {
      // Set NODE_ENV to development so warnings are shown (suppressed in 'test' mode)
      process.env.NODE_ENV = 'development';
      process.env.SMTP_HOST = 'smtp.example.com';
      // Missing other SMTP variables

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const { validateEnv } = await import('./validateEnv');
      validateEnv();

      // Should not throw, just warn
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Config singleton', () => {
    it('should export validated config object', async () => {
      const { config } = await import('./validateEnv');

      expect(config).toBeDefined();
      expect(config.JWT_SECRET).toBeDefined();
      expect(config.NODE_ENV).toBeDefined();
      expect(config.PORT).toBeDefined();
    });
  });
});
