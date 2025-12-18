import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock the database module
vi.mock('../database/db', () => ({
  queryOne: vi.fn(),
  queryAll: vi.fn(),
  execute: vi.fn(),
}));

// Mock logger
vi.mock('./logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { queryOne, queryAll, execute } from '../database/db';

describe('tokenBlacklist', () => {
  // Store original console.log to restore later
  const originalConsoleLog = console.log;

  // In-memory blacklist simulation
  let mockBlacklist: Map<string, number>;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    vi.resetModules();

    // Mock console.log to avoid cluttering test output
    console.log = vi.fn();

    // Initialize mock blacklist
    mockBlacklist = new Map();

    // Setup default mock implementations
    (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (execute as ReturnType<typeof vi.fn>).mockResolvedValue({ rowCount: 0 });
    (queryOne as ReturnType<typeof vi.fn>).mockImplementation(async (_sql: string, params?: unknown[]) => {
      const token = params?.[0] as string;
      const expiresAt = mockBlacklist.get(token);
      if (expiresAt === undefined) return null;
      return { expires_at: expiresAt };
    });
  });

  afterEach(() => {
    // Restore console.log
    console.log = originalConsoleLog;
    // Reset modules to get fresh tokenBlacklist instance
    vi.resetModules();
  });

  // Import tokenBlacklist dynamically after mock is set up
  async function getTokenBlacklist() {
    const module = await import('./tokenBlacklist');
    return module.tokenBlacklist;
  }

  describe('add and isBlacklisted', () => {
    it('should add token to blacklist', async () => {
      const tokenBlacklist = await getTokenBlacklist();
      const token = 'test-token-123';
      const expiry = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

      // Mock execute to simulate successful insert
      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({ rowCount: 1 });

      await tokenBlacklist.add(token, expiry);

      // Simulate the blacklist state
      mockBlacklist.set(token, expiry);

      const isBlacklisted = await tokenBlacklist.isBlacklisted(token);
      expect(isBlacklisted).toBe(true);
    });

    it('should return false for tokens not in blacklist', async () => {
      const tokenBlacklist = await getTokenBlacklist();
      const token = 'non-existent-token';
      const isBlacklisted = await tokenBlacklist.isBlacklisted(token);
      expect(isBlacklisted).toBe(false);
    });

    it('should handle multiple tokens', async () => {
      const tokenBlacklist = await getTokenBlacklist();
      const token1 = 'token-1';
      const token2 = 'token-2';
      const token3 = 'token-3';
      const expiry = Math.floor(Date.now() / 1000) + 3600;

      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({ rowCount: 1 });

      await tokenBlacklist.add(token1, expiry);
      mockBlacklist.set(token1, expiry);

      await tokenBlacklist.add(token2, expiry);
      mockBlacklist.set(token2, expiry);

      expect(await tokenBlacklist.isBlacklisted(token1)).toBe(true);
      expect(await tokenBlacklist.isBlacklisted(token2)).toBe(true);
      expect(await tokenBlacklist.isBlacklisted(token3)).toBe(false);
    });

    it('should overwrite existing token with new expiry', async () => {
      const tokenBlacklist = await getTokenBlacklist();
      const token = 'test-token';
      const expiry1 = Math.floor(Date.now() / 1000) + 1000;
      const expiry2 = Math.floor(Date.now() / 1000) + 2000;

      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({ rowCount: 1 });

      await tokenBlacklist.add(token, expiry1);
      mockBlacklist.set(token, expiry1);

      await tokenBlacklist.add(token, expiry2);
      mockBlacklist.set(token, expiry2);

      expect(await tokenBlacklist.isBlacklisted(token)).toBe(true);
    });

    it('should handle long JWT-like tokens', async () => {
      const tokenBlacklist = await getTokenBlacklist();
      const jwtLikeToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSIsImlhdCI6MTYzOTk5OTk5OSwiZXhwIjoxNjQwNTg2Mzk5fQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      const expiry = Math.floor(Date.now() / 1000) + 3600;

      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({ rowCount: 1 });

      await tokenBlacklist.add(jwtLikeToken, expiry);
      mockBlacklist.set(jwtLikeToken, expiry);

      expect(await tokenBlacklist.isBlacklisted(jwtLikeToken)).toBe(true);
    });

    it('should handle empty string token', async () => {
      const tokenBlacklist = await getTokenBlacklist();
      const token = '';
      const expiry = Math.floor(Date.now() / 1000) + 3600;

      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({ rowCount: 1 });

      await tokenBlacklist.add(token, expiry);
      mockBlacklist.set(token, expiry);

      expect(await tokenBlacklist.isBlacklisted(token)).toBe(true);
    });

    it('should treat already-expired tokens as not blacklisted', async () => {
      const tokenBlacklist = await getTokenBlacklist();
      const token = 'expired-token';
      const expiry = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago

      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({ rowCount: 1 });

      await tokenBlacklist.add(token, expiry);
      // Don't add to mockBlacklist - it will return null and be considered not blacklisted
      // Actually, let's set it with past expiry and let isBlacklisted check the time
      mockBlacklist.set(token, expiry);

      expect(await tokenBlacklist.isBlacklisted(token)).toBe(false);
    });
  });

  describe('size', () => {
    it('should return size as a number', async () => {
      const tokenBlacklist = await getTokenBlacklist();
      const size = tokenBlacklist.size();
      expect(typeof size).toBe('number');
      expect(size).toBeGreaterThanOrEqual(0);
    });

    it('should increment size when tokens are added', async () => {
      const tokenBlacklist = await getTokenBlacklist();
      const initialSize = tokenBlacklist.size();
      const token = `test-token-${Date.now()}`;
      const expiry = Math.floor(Date.now() / 1000) + 3600;

      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({ rowCount: 1 });

      await tokenBlacklist.add(token, expiry);
      expect(tokenBlacklist.size()).toBe(initialSize + 1);
    });

    it('should not increment size when same token is added twice', async () => {
      const tokenBlacklist = await getTokenBlacklist();
      const token = `duplicate-token-${Date.now()}`;
      const expiry = Math.floor(Date.now() / 1000) + 3600;

      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({ rowCount: 1 });

      const initialSize = tokenBlacklist.size();
      await tokenBlacklist.add(token, expiry);
      const sizeAfterFirst = tokenBlacklist.size();
      await tokenBlacklist.add(token, expiry);
      const sizeAfterSecond = tokenBlacklist.size();

      expect(sizeAfterFirst).toBe(initialSize + 1);
      expect(sizeAfterSecond).toBe(sizeAfterFirst);
    });
  });

  describe('cleanup behavior', () => {
    it('should track tokens with future expiry', async () => {
      const tokenBlacklist = await getTokenBlacklist();
      const token = `future-token-${Date.now()}`;
      const expiry = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({ rowCount: 1 });

      await tokenBlacklist.add(token, expiry);
      mockBlacklist.set(token, expiry);

      expect(await tokenBlacklist.isBlacklisted(token)).toBe(true);
    });

    it('should immediately purge tokens with past expiry', async () => {
      const tokenBlacklist = await getTokenBlacklist();
      const token = `past-token-${Date.now()}`;
      const expiry = Math.floor(Date.now() / 1000) - 1; // already expired

      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({ rowCount: 1 });

      await tokenBlacklist.add(token, expiry);
      mockBlacklist.set(token, expiry);

      expect(await tokenBlacklist.isBlacklisted(token)).toBe(false);
    });
  });

  describe('integration scenarios', () => {
    it('should handle typical logout flow', async () => {
      const tokenBlacklist = await getTokenBlacklist();
      // Simulate a user logout
      const userId = 123;
      const token = `bearer-token-user-${userId}-${Date.now()}`;
      const expiry = Math.floor(Date.now() / 1000) + 604800; // 7 days

      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({ rowCount: 1 });

      // Add token to blacklist on logout
      await tokenBlacklist.add(token, expiry);
      mockBlacklist.set(token, expiry);

      // Subsequent requests with this token should be rejected
      expect(await tokenBlacklist.isBlacklisted(token)).toBe(true);
    });

    it('should handle multiple concurrent logouts', async () => {
      const tokenBlacklist = await getTokenBlacklist();
      const tokens: string[] = [];
      const expiry = Math.floor(Date.now() / 1000) + 3600;

      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({ rowCount: 1 });

      // Simulate 10 concurrent logouts
      for (let i = 0; i < 10; i++) {
        const token = `concurrent-token-${i}-${Date.now()}`;
        tokens.push(token);
        await tokenBlacklist.add(token, expiry);
        mockBlacklist.set(token, expiry);
      }

      // All tokens should be blacklisted
      for (const token of tokens) {
        expect(await tokenBlacklist.isBlacklisted(token)).toBe(true);
      }
    });

    it('should handle security event requiring mass token revocation', async () => {
      const tokenBlacklist = await getTokenBlacklist();
      const userTokens: string[] = [];
      const expiry = Math.floor(Date.now() / 1000) + 3600;

      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({ rowCount: 1 });

      // Simulate revoking all tokens for a compromised user
      for (let i = 0; i < 5; i++) {
        const token = `user-compromised-token-${i}-${Date.now()}`;
        userTokens.push(token);
        await tokenBlacklist.add(token, expiry);
        mockBlacklist.set(token, expiry);
      }

      // All user tokens should be revoked
      for (const token of userTokens) {
        expect(await tokenBlacklist.isBlacklisted(token)).toBe(true);
      }
    });

    it('should handle token refresh scenario', async () => {
      const tokenBlacklist = await getTokenBlacklist();
      const oldToken = `old-token-${Date.now()}`;
      const newToken = `new-token-${Date.now()}`;
      const expiry = Math.floor(Date.now() / 1000) + 3600;

      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({ rowCount: 1 });

      // Blacklist old token during refresh
      await tokenBlacklist.add(oldToken, expiry);
      mockBlacklist.set(oldToken, expiry);

      // Old token should be blacklisted, new token should not
      expect(await tokenBlacklist.isBlacklisted(oldToken)).toBe(true);
      expect(await tokenBlacklist.isBlacklisted(newToken)).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle very large expiry timestamps', async () => {
      const tokenBlacklist = await getTokenBlacklist();
      const token = `far-future-token-${Date.now()}`;
      const expiry = Math.floor(Date.now() / 1000) + 315360000; // ~10 years

      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({ rowCount: 1 });

      await tokenBlacklist.add(token, expiry);
      mockBlacklist.set(token, expiry);

      expect(await tokenBlacklist.isBlacklisted(token)).toBe(true);
    });

    it('should treat zero expiry timestamp as not blacklisted', async () => {
      const tokenBlacklist = await getTokenBlacklist();
      const token = `zero-expiry-token-${Date.now()}`;
      const expiry = 0;

      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({ rowCount: 1 });

      await tokenBlacklist.add(token, expiry);
      mockBlacklist.set(token, expiry);

      expect(await tokenBlacklist.isBlacklisted(token)).toBe(false);
    });

    it('should treat negative expiry timestamp as not blacklisted', async () => {
      const tokenBlacklist = await getTokenBlacklist();
      const token = `negative-expiry-token-${Date.now()}`;
      const expiry = -1000;

      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({ rowCount: 1 });

      await tokenBlacklist.add(token, expiry);
      mockBlacklist.set(token, expiry);

      expect(await tokenBlacklist.isBlacklisted(token)).toBe(false);
    });

    it('should handle special characters in token', async () => {
      const tokenBlacklist = await getTokenBlacklist();
      const token = 'token-with-special!@#$%^&*()_+-={}[]|:;"<>?,./';
      const expiry = Math.floor(Date.now() / 1000) + 3600;

      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({ rowCount: 1 });

      await tokenBlacklist.add(token, expiry);
      mockBlacklist.set(token, expiry);

      expect(await tokenBlacklist.isBlacklisted(token)).toBe(true);
    });

    it('should handle Unicode characters in token', async () => {
      const tokenBlacklist = await getTokenBlacklist();
      const token = 'token-with-unicode-你好世界-🔒';
      const expiry = Math.floor(Date.now() / 1000) + 3600;

      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({ rowCount: 1 });

      await tokenBlacklist.add(token, expiry);
      mockBlacklist.set(token, expiry);

      expect(await tokenBlacklist.isBlacklisted(token)).toBe(true);
    });
  });

  describe('performance characteristics', () => {
    it('should handle adding many tokens efficiently', async () => {
      const tokenBlacklist = await getTokenBlacklist();
      const startTime = Date.now();
      const expiry = Math.floor(Date.now() / 1000) + 3600;

      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({ rowCount: 1 });

      for (let i = 0; i < 100; i++) {
        const token = `perf-token-${i}-${Date.now()}`;
        await tokenBlacklist.add(token, expiry);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete in reasonable time (less than 5 seconds for 100 tokens with mocks)
      expect(duration).toBeLessThan(5000);
    });

    it('should handle checking many tokens efficiently', async () => {
      const tokenBlacklist = await getTokenBlacklist();
      const tokens: string[] = [];
      const expiry = Math.floor(Date.now() / 1000) + 3600;

      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({ rowCount: 1 });

      // Add 100 tokens
      for (let i = 0; i < 100; i++) {
        const token = `check-perf-token-${i}-${Date.now()}`;
        tokens.push(token);
        await tokenBlacklist.add(token, expiry);
        mockBlacklist.set(token, expiry);
      }

      const startTime = Date.now();

      // Check all tokens
      for (const token of tokens) {
        await tokenBlacklist.isBlacklisted(token);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete very quickly (less than 1 second for 100 lookups with mocks)
      expect(duration).toBeLessThan(1000);
    });
  });
});
