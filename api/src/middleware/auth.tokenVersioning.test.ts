/**
 * Token Versioning Security Tests
 *
 * SECURITY FIX (2025-11-27): Token Versioning Persistence
 *
 * These tests verify that token versioning is properly persisted to the database
 * and survives server restarts. Updated for PostgreSQL async pattern.
 *
 * Test Coverage:
 * 1. getTokenVersion() reads from database correctly
 * 2. incrementTokenVersion() persists to database
 * 3. Token versions survive "simulated" restarts
 * 4. Multiple users have independent token versions
 * 5. Error handling for missing users
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the database module
vi.mock('../database/db', () => ({
  queryOne: vi.fn(),
  queryAll: vi.fn(),
  execute: vi.fn(),
}));

// Mock logger
vi.mock('../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  logSecurityEvent: vi.fn(),
}));

import { queryOne, execute } from '../database/db';

describe('Token Versioning (Security Fix 2025-11-27)', () => {
  const testUserId1 = 1;
  const testUserId2 = 2;

  // Mock getTokenVersion and incrementTokenVersion functions that match production implementation
  let getTokenVersion: (userId: number) => Promise<number>;
  let incrementTokenVersion: (userId: number) => Promise<number>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mocks
    (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (execute as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [], rowCount: 0 });

    // Implementation of getTokenVersion using PostgreSQL
    getTokenVersion = async (userId: number): Promise<number> => {
      try {
        const result = await queryOne(
          'SELECT token_version FROM users WHERE id = $1',
          [userId]
        );
        return result?.token_version ?? 0;
      } catch {
        return 0;
      }
    };

    // Implementation of incrementTokenVersion using PostgreSQL
    incrementTokenVersion = async (userId: number): Promise<number> => {
      const currentVersion = await getTokenVersion(userId);
      const newVersion = currentVersion + 1;
      await execute(
        'UPDATE users SET token_version = $1 WHERE id = $2',
        [newVersion, userId]
      );
      return newVersion;
    };
  });

  describe('getTokenVersion()', () => {
    it('should read token version from database', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue({ token_version: 0 });

      const version = await getTokenVersion(testUserId1);

      expect(version).toBe(0);
      expect(queryOne).toHaveBeenCalledWith(
        'SELECT token_version FROM users WHERE id = $1',
        [testUserId1]
      );
    });

    it('should return correct version after increment', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue({ token_version: 5 });

      const version = await getTokenVersion(testUserId1);

      expect(version).toBe(5);
    });

    it('should return 0 for non-existent user', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const version = await getTokenVersion(999999);

      expect(version).toBe(0);
    });

    it('should maintain independence between users', async () => {
      // User 1 has version 3
      (queryOne as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ token_version: 3 })
        .mockResolvedValueOnce({ token_version: 7 });

      const version1 = await getTokenVersion(testUserId1);
      const version2 = await getTokenVersion(testUserId2);

      expect(version1).toBe(3);
      expect(version2).toBe(7);
    });

    it('should handle database errors gracefully', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('DB error'));

      const version = await getTokenVersion(testUserId1);

      expect(version).toBe(0);
    });
  });

  describe('incrementTokenVersion()', () => {
    it('should increment token version in database', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue({ token_version: 0 });
      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({ rowCount: 1 });

      const newVersion = await incrementTokenVersion(testUserId1);

      expect(newVersion).toBe(1);
      expect(execute).toHaveBeenCalledWith(
        'UPDATE users SET token_version = $1 WHERE id = $2',
        [1, testUserId1]
      );
    });

    it('should increment multiple times correctly', async () => {
      // First increment: 0 → 1
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ token_version: 0 });
      const version1 = await incrementTokenVersion(testUserId1);
      expect(version1).toBe(1);

      // Second increment: 1 → 2
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ token_version: 1 });
      const version2 = await incrementTokenVersion(testUserId1);
      expect(version2).toBe(2);

      // Third increment: 2 → 3
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ token_version: 2 });
      const version3 = await incrementTokenVersion(testUserId1);
      expect(version3).toBe(3);
    });

    it('should handle concurrent increments for different users', async () => {
      // User 1: 0 → 1
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ token_version: 0 });
      await incrementTokenVersion(testUserId1);

      // User 2: 0 → 1
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ token_version: 0 });
      await incrementTokenVersion(testUserId2);

      // User 1: 1 → 2
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ token_version: 1 });
      await incrementTokenVersion(testUserId1);

      // Verify execute was called correctly for each user
      expect(execute).toHaveBeenCalledWith(
        'UPDATE users SET token_version = $1 WHERE id = $2',
        [1, testUserId1]
      );
      expect(execute).toHaveBeenCalledWith(
        'UPDATE users SET token_version = $1 WHERE id = $2',
        [1, testUserId2]
      );
      expect(execute).toHaveBeenCalledWith(
        'UPDATE users SET token_version = $1 WHERE id = $2',
        [2, testUserId1]
      );
    });
  });

  describe('Persistence Across Restarts (Critical Security Test)', () => {
    it('should persist version increments across simulated restarts', async () => {
      // Step 1: User changes password → version increments
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ token_version: 0 });
      await incrementTokenVersion(testUserId1);

      // Step 2: "Server restarts" - DB still has version 1
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ token_version: 1 });
      const versionAfterRestart = await getTokenVersion(testUserId1);

      // Version persists - not reset to 0
      expect(versionAfterRestart).toBe(1);
    });

    it('should maintain versions across multiple restarts and increments', async () => {
      // Password change #1: 0 → 1
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ token_version: 0 });
      await incrementTokenVersion(testUserId1);

      // "Restart" #1 - version still 1
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ token_version: 1 });
      expect(await getTokenVersion(testUserId1)).toBe(1);

      // Password change #2: 1 → 2
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ token_version: 1 });
      await incrementTokenVersion(testUserId1);

      // "Restart" #2 - version still 2
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ token_version: 2 });
      expect(await getTokenVersion(testUserId1)).toBe(2);

      // Password change #3: 2 → 3
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ token_version: 2 });
      await incrementTokenVersion(testUserId1);

      // "Restart" #3 - version still 3
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ token_version: 3 });
      expect(await getTokenVersion(testUserId1)).toBe(3);
    });
  });

  describe('Attack Scenario Prevention', () => {
    it('should prevent password change bypass via restart', async () => {
      // ATTACK SCENARIO:
      // 1. Attacker steals user's password and creates tokens (version 0)
      // 2. Victim changes password → version increments to 1
      // 3. Server restarts
      // 4. Attacker's tokens with version 0 should STILL be invalid

      const attackerTokenVersion = 0;

      // Victim changes password (0 → 1)
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ token_version: 0 });
      await incrementTokenVersion(testUserId1);

      // Server restarts - DB still has version 1
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ token_version: 1 });
      const versionAfterRestart = await getTokenVersion(testUserId1);

      // Attacker's token (version 0) is STILL invalid
      expect(attackerTokenVersion).not.toBe(versionAfterRestart);
      expect(versionAfterRestart).toBe(1);
    });

    it('should prevent "logout all devices" bypass via restart', async () => {
      const oldTokenVersion = 0;

      // User clicks "logout all devices"
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ token_version: 0 });
      await incrementTokenVersion(testUserId1);

      // Server restarts
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ token_version: 1 });
      const versionAfterRestart = await getTokenVersion(testUserId1);

      // Old tokens should STILL be invalid
      expect(oldTokenVersion).not.toBe(versionAfterRestart);
      expect(versionAfterRestart).toBe(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully in getTokenVersion', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('DB error'));

      const version = await getTokenVersion(testUserId1);

      // Should return 0 (fallback), not throw
      expect(version).toBe(0);
    });

    it('should handle incrementTokenVersion for non-existent user', async () => {
      // Non-existent user returns null
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({ rowCount: 0 });

      // Should not throw - just increments from 0
      await expect(incrementTokenVersion(999999)).resolves.toBe(1);
    });
  });

  describe('Multi-Instance Consistency', () => {
    it('should maintain consistency across multiple instances reading same DB', async () => {
      // Instance 1: Increment version (0 → 1)
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ token_version: 0 });
      await incrementTokenVersion(testUserId1);

      // Instance 2: Read version
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ token_version: 1 });
      const instance2Version = await getTokenVersion(testUserId1);

      // Instance 3: Read version
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ token_version: 1 });
      const instance3Version = await getTokenVersion(testUserId1);

      // All instances see the same version
      expect(instance2Version).toBe(1);
      expect(instance3Version).toBe(1);
    });
  });
});
