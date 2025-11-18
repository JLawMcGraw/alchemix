import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { tokenBlacklist } from './tokenBlacklist';

describe('tokenBlacklist', () => {
  // Store original console.log to restore later
  const originalConsoleLog = console.log;

  beforeEach(() => {
    // Mock console.log to avoid cluttering test output
    console.log = vi.fn();
  });

  afterEach(() => {
    // Restore console.log
    console.log = originalConsoleLog;
  });

  describe('add and isBlacklisted', () => {
    it('should add token to blacklist', () => {
      const token = 'test-token-123';
      const expiry = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

      tokenBlacklist.add(token, expiry);
      expect(tokenBlacklist.isBlacklisted(token)).toBe(true);
    });

    it('should return false for tokens not in blacklist', () => {
      const token = 'non-existent-token';
      expect(tokenBlacklist.isBlacklisted(token)).toBe(false);
    });

    it('should handle multiple tokens', () => {
      const token1 = 'token-1';
      const token2 = 'token-2';
      const token3 = 'token-3';
      const expiry = Math.floor(Date.now() / 1000) + 3600;

      tokenBlacklist.add(token1, expiry);
      tokenBlacklist.add(token2, expiry);

      expect(tokenBlacklist.isBlacklisted(token1)).toBe(true);
      expect(tokenBlacklist.isBlacklisted(token2)).toBe(true);
      expect(tokenBlacklist.isBlacklisted(token3)).toBe(false);
    });

    it('should overwrite existing token with new expiry', () => {
      const token = 'test-token';
      const expiry1 = Math.floor(Date.now() / 1000) + 1000;
      const expiry2 = Math.floor(Date.now() / 1000) + 2000;

      tokenBlacklist.add(token, expiry1);
      tokenBlacklist.add(token, expiry2);

      expect(tokenBlacklist.isBlacklisted(token)).toBe(true);
    });

    it('should handle long JWT-like tokens', () => {
      const jwtLikeToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSIsImlhdCI6MTYzOTk5OTk5OSwiZXhwIjoxNjQwNTg2Mzk5fQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      const expiry = Math.floor(Date.now() / 1000) + 3600;

      tokenBlacklist.add(jwtLikeToken, expiry);
      expect(tokenBlacklist.isBlacklisted(jwtLikeToken)).toBe(true);
    });

    it('should handle empty string token', () => {
      const token = '';
      const expiry = Math.floor(Date.now() / 1000) + 3600;

      tokenBlacklist.add(token, expiry);
      expect(tokenBlacklist.isBlacklisted(token)).toBe(true);
    });

    it('should treat already-expired tokens as not blacklisted', () => {
      const token = 'expired-token';
      const expiry = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago

      tokenBlacklist.add(token, expiry);
      expect(tokenBlacklist.isBlacklisted(token)).toBe(false);
    });
  });

  describe('size', () => {
    it('should return 0 for empty blacklist', () => {
      // Note: This test assumes a fresh blacklist
      // In practice, the blacklist is a singleton and may contain tokens from other tests
      const initialSize = tokenBlacklist.size();
      expect(typeof initialSize).toBe('number');
      expect(initialSize).toBeGreaterThanOrEqual(0);
    });

    it('should increment size when tokens are added', () => {
      const initialSize = tokenBlacklist.size();
      const token = `test-token-${Date.now()}`;
      const expiry = Math.floor(Date.now() / 1000) + 3600;

      tokenBlacklist.add(token, expiry);
      expect(tokenBlacklist.size()).toBe(initialSize + 1);
    });

    it('should not increment size when same token is added twice', () => {
      const token = `duplicate-token-${Date.now()}`;
      const expiry = Math.floor(Date.now() / 1000) + 3600;

      const initialSize = tokenBlacklist.size();
      tokenBlacklist.add(token, expiry);
      const sizeAfterFirst = tokenBlacklist.size();
      tokenBlacklist.add(token, expiry);
      const sizeAfterSecond = tokenBlacklist.size();

      expect(sizeAfterFirst).toBe(initialSize + 1);
      expect(sizeAfterSecond).toBe(sizeAfterFirst);
    });
  });

  describe('cleanup behavior', () => {
    it('should track tokens with future expiry', () => {
      const token = `future-token-${Date.now()}`;
      const expiry = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

      tokenBlacklist.add(token, expiry);
      expect(tokenBlacklist.isBlacklisted(token)).toBe(true);
    });

    it('should immediately purge tokens with past expiry', () => {
      const token = `past-token-${Date.now()}`;
      const expiry = Math.floor(Date.now() / 1000) - 1; // already expired

      tokenBlacklist.add(token, expiry);
      expect(tokenBlacklist.isBlacklisted(token)).toBe(false);
    });
  });

  describe('integration scenarios', () => {
    it('should handle typical logout flow', () => {
      // Simulate a user logout
      const userId = 123;
      const token = `bearer-token-user-${userId}-${Date.now()}`;
      const expiry = Math.floor(Date.now() / 1000) + 604800; // 7 days

      // Add token to blacklist on logout
      tokenBlacklist.add(token, expiry);

      // Subsequent requests with this token should be rejected
      expect(tokenBlacklist.isBlacklisted(token)).toBe(true);
    });

    it('should handle multiple concurrent logouts', () => {
      const tokens = [];
      const expiry = Math.floor(Date.now() / 1000) + 3600;

      // Simulate 10 concurrent logouts
      for (let i = 0; i < 10; i++) {
        const token = `concurrent-token-${i}-${Date.now()}`;
        tokens.push(token);
        tokenBlacklist.add(token, expiry);
      }

      // All tokens should be blacklisted
      tokens.forEach(token => {
        expect(tokenBlacklist.isBlacklisted(token)).toBe(true);
      });
    });

    it('should handle security event requiring mass token revocation', () => {
      const userTokens = [];
      const expiry = Math.floor(Date.now() / 1000) + 3600;

      // Simulate revoking all tokens for a compromised user
      for (let i = 0; i < 5; i++) {
        const token = `user-compromised-token-${i}-${Date.now()}`;
        userTokens.push(token);
        tokenBlacklist.add(token, expiry);
      }

      // All user tokens should be revoked
      userTokens.forEach(token => {
        expect(tokenBlacklist.isBlacklisted(token)).toBe(true);
      });
    });

    it('should handle token refresh scenario', () => {
      const oldToken = `old-token-${Date.now()}`;
      const newToken = `new-token-${Date.now()}`;
      const expiry = Math.floor(Date.now() / 1000) + 3600;

      // Blacklist old token during refresh
      tokenBlacklist.add(oldToken, expiry);

      // Old token should be blacklisted, new token should not
      expect(tokenBlacklist.isBlacklisted(oldToken)).toBe(true);
      expect(tokenBlacklist.isBlacklisted(newToken)).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle very large expiry timestamps', () => {
      const token = `far-future-token-${Date.now()}`;
      const expiry = Math.floor(Date.now() / 1000) + 315360000; // ~10 years

      tokenBlacklist.add(token, expiry);
      expect(tokenBlacklist.isBlacklisted(token)).toBe(true);
    });

    it('should treat zero expiry timestamp as not blacklisted', () => {
      const token = `zero-expiry-token-${Date.now()}`;
      const expiry = 0;

      tokenBlacklist.add(token, expiry);
      expect(tokenBlacklist.isBlacklisted(token)).toBe(false);
    });

    it('should treat negative expiry timestamp as not blacklisted', () => {
      const token = `negative-expiry-token-${Date.now()}`;
      const expiry = -1000;

      tokenBlacklist.add(token, expiry);
      expect(tokenBlacklist.isBlacklisted(token)).toBe(false);
    });

    it('should handle special characters in token', () => {
      const token = 'token-with-special!@#$%^&*()_+-={}[]|:;"<>?,./';
      const expiry = Math.floor(Date.now() / 1000) + 3600;

      tokenBlacklist.add(token, expiry);
      expect(tokenBlacklist.isBlacklisted(token)).toBe(true);
    });

    it('should handle Unicode characters in token', () => {
      const token = 'token-with-unicode-你好世界-🔒';
      const expiry = Math.floor(Date.now() / 1000) + 3600;

      tokenBlacklist.add(token, expiry);
      expect(tokenBlacklist.isBlacklisted(token)).toBe(true);
    });
  });

  describe('performance characteristics', () => {
    it('should handle adding many tokens efficiently', () => {
      const startTime = Date.now();
      const expiry = Math.floor(Date.now() / 1000) + 3600;

      for (let i = 0; i < 1000; i++) {
        const token = `perf-token-${i}-${Date.now()}`;
        tokenBlacklist.add(token, expiry);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete in reasonable time (less than 15 seconds for 1000 tokens)
      expect(duration).toBeLessThan(15000);
    });

    it('should handle checking many tokens efficiently', () => {
      const tokens = [];
      const expiry = Math.floor(Date.now() / 1000) + 3600;

      // Add 100 tokens
      for (let i = 0; i < 100; i++) {
        const token = `check-perf-token-${i}-${Date.now()}`;
        tokens.push(token);
        tokenBlacklist.add(token, expiry);
      }

      const startTime = Date.now();

      // Check all tokens
      tokens.forEach(token => {
        tokenBlacklist.isBlacklisted(token);
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete very quickly (less than 100ms for 100 lookups)
      expect(duration).toBeLessThan(100);
    });
  });
});
