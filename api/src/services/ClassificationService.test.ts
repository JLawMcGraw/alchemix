/**
 * ClassificationService Tests
 *
 * Tests for the classification override service.
 * Updated for PostgreSQL async pattern.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the database module
vi.mock('../database/db', () => ({
  queryOne: vi.fn(),
  queryAll: vi.fn(),
  execute: vi.fn(),
}));

import { queryOne, queryAll, execute } from '../database/db';
import {
  ClassificationService,
  getUserOverrides,
  getAll,
  getOne,
  setOverride,
  deleteOverride,
  deleteAllOverrides,
  countOverrides,
} from './ClassificationService';

describe('ClassificationService', () => {
  const testUserId = 99999;
  const testItemId1 = 88888;
  const testItemId2 = 88889;

  // Helper to create mock classification row
  const createMockRow = (overrides: Partial<{
    id: number;
    user_id: number;
    inventory_item_id: number;
    group_num: number;
    period_num: number;
    created_at: string;
    updated_at: string;
  }> = {}) => ({
    id: 1,
    user_id: testUserId,
    inventory_item_id: testItemId1,
    group_num: 3,
    period_num: 4,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (execute as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [], rowCount: 0 });
  });

  describe('setOverride', () => {
    it('should create a new classification override', async () => {
      const mockRow = createMockRow();
      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({ rowCount: 1 });
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(mockRow);

      const result = await setOverride(testUserId, testItemId1, 3, 4);

      expect(result.inventoryItemId).toBe(testItemId1);
      expect(result.group).toBe(3);
      expect(result.period).toBe(4);
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
    });

    it('should throw error for invalid group (< 1)', async () => {
      await expect(setOverride(testUserId, testItemId1, 0 as any, 3)).rejects.toThrow(
        'Invalid group: 0'
      );
    });

    it('should throw error for invalid group (> 6)', async () => {
      await expect(setOverride(testUserId, testItemId1, 7 as any, 3)).rejects.toThrow(
        'Invalid group: 7'
      );
    });

    it('should throw error for invalid period (< 1)', async () => {
      await expect(setOverride(testUserId, testItemId1, 3, 0 as any)).rejects.toThrow(
        'Invalid period: 0'
      );
    });

    it('should throw error for invalid period (> 6)', async () => {
      await expect(setOverride(testUserId, testItemId1, 3, 7 as any)).rejects.toThrow(
        'Invalid period: 7'
      );
    });

    it('should throw error when save fails', async () => {
      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({ rowCount: 1 });
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(setOverride(testUserId, testItemId1, 3, 4)).rejects.toThrow(
        'Failed to save classification override'
      );
    });
  });

  describe('getOne', () => {
    it('should return override when it exists', async () => {
      const mockRow = createMockRow({ group_num: 2, period_num: 3 });
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(mockRow);

      const result = await getOne(testUserId, testItemId1);

      expect(result).not.toBeNull();
      expect(result!.inventoryItemId).toBe(testItemId1);
      expect(result!.group).toBe(2);
      expect(result!.period).toBe(3);
    });

    it('should return null when override does not exist', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await getOne(testUserId, 999999);

      expect(result).toBeNull();
    });
  });

  describe('getAll', () => {
    it('should return all overrides for a user', async () => {
      const mockRows = [
        createMockRow({ id: 1, inventory_item_id: testItemId1, group_num: 1, period_num: 2 }),
        createMockRow({ id: 2, inventory_item_id: testItemId2, group_num: 3, period_num: 4 }),
      ];
      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue(mockRows);

      const results = await getAll(testUserId);

      expect(results).toHaveLength(2);
      expect(results.map((r) => r.inventoryItemId).sort()).toEqual(
        [testItemId1, testItemId2].sort()
      );
    });

    it('should return empty array when user has no overrides', async () => {
      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const results = await getAll(testUserId);

      expect(results).toEqual([]);
    });
  });

  describe('getUserOverrides', () => {
    it('should return Map of overrides', async () => {
      const mockRows = [
        createMockRow({ id: 1, inventory_item_id: testItemId1, group_num: 2, period_num: 3 }),
        createMockRow({ id: 2, inventory_item_id: testItemId2, group_num: 4, period_num: 5 }),
      ];
      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue(mockRows);

      const overrides = await getUserOverrides(testUserId);

      expect(overrides).toBeInstanceOf(Map);
      expect(overrides.size).toBe(2);
      expect(overrides.get(testItemId1)).toEqual({ group: 2, period: 3 });
      expect(overrides.get(testItemId2)).toEqual({ group: 4, period: 5 });
    });

    it('should return empty Map for user with no overrides', async () => {
      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const overrides = await getUserOverrides(testUserId);

      expect(overrides).toBeInstanceOf(Map);
      expect(overrides.size).toBe(0);
    });
  });

  describe('deleteOverride', () => {
    it('should delete existing override and return true', async () => {
      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({ rowCount: 1 });

      const result = await deleteOverride(testUserId, testItemId1);

      expect(result).toBe(true);
    });

    it('should return false when override does not exist', async () => {
      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({ rowCount: 0 });

      const result = await deleteOverride(testUserId, 999999);

      expect(result).toBe(false);
    });
  });

  describe('deleteAllOverrides', () => {
    it('should delete all overrides for user and return count', async () => {
      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({ rowCount: 5 });

      const deletedCount = await deleteAllOverrides(testUserId);

      expect(deletedCount).toBe(5);
    });

    it('should return 0 when user has no overrides', async () => {
      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({ rowCount: 0 });

      const deletedCount = await deleteAllOverrides(testUserId);

      expect(deletedCount).toBe(0);
    });
  });

  describe('countOverrides', () => {
    it('should return correct count', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue({ count: '5' });

      const count = await countOverrides(testUserId);

      expect(count).toBe(5);
    });

    it('should return 0 for user with no overrides', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue({ count: '0' });

      const count = await countOverrides(testUserId);

      expect(count).toBe(0);
    });

    it('should return 0 when result is null', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const count = await countOverrides(testUserId);

      expect(count).toBe(0);
    });
  });

  describe('ClassificationService object', () => {
    it('should export all functions', () => {
      expect(ClassificationService.getUserOverrides).toBe(getUserOverrides);
      expect(ClassificationService.getAll).toBe(getAll);
      expect(ClassificationService.getOne).toBe(getOne);
      expect(ClassificationService.setOverride).toBe(setOverride);
      expect(ClassificationService.deleteOverride).toBe(deleteOverride);
      expect(ClassificationService.deleteAllOverrides).toBe(deleteAllOverrides);
      expect(ClassificationService.countOverrides).toBe(countOverrides);
    });
  });
});
