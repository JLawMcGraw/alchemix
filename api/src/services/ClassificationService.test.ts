/**
 * ClassificationService Tests
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Use vi.hoisted to create mock functions that are available during vi.mock hoisting
const { mockGet, mockAll, mockRun } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockAll: vi.fn(),
  mockRun: vi.fn(),
}));

// Mock the database module BEFORE importing the service
// This is critical because ClassificationService creates prepared statements at module load time
vi.mock('../database/db', () => ({
  db: {
    prepare: vi.fn(() => ({
      get: mockGet,
      all: mockAll,
      run: mockRun,
    })),
  },
}));

// Import after mock is set up
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

  beforeEach(() => {
    vi.clearAllMocks();
    // Default successful run response
    mockRun.mockReturnValue({ changes: 1 });
  });

  describe('setOverride', () => {
    it('should create a new classification override', () => {
      const mockRow = {
        id: 1,
        user_id: testUserId,
        inventory_item_id: testItemId1,
        group_num: 3,
        period_num: 4,
        created_at: '2025-01-01',
        updated_at: '2025-01-01',
      };
      mockGet.mockReturnValue(mockRow);

      const result = setOverride(testUserId, testItemId1, 3, 4);

      expect(result.inventoryItemId).toBe(testItemId1);
      expect(result.group).toBe(3);
      expect(result.period).toBe(4);
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
    });

    it('should throw error for invalid group (< 1)', () => {
      expect(() => setOverride(testUserId, testItemId1, 0 as any, 3)).toThrow(
        'Invalid group: 0'
      );
    });

    it('should throw error for invalid group (> 6)', () => {
      expect(() => setOverride(testUserId, testItemId1, 7 as any, 3)).toThrow(
        'Invalid group: 7'
      );
    });

    it('should throw error for invalid period (< 1)', () => {
      expect(() => setOverride(testUserId, testItemId1, 3, 0 as any)).toThrow(
        'Invalid period: 0'
      );
    });

    it('should throw error for invalid period (> 6)', () => {
      expect(() => setOverride(testUserId, testItemId1, 3, 7 as any)).toThrow(
        'Invalid period: 7'
      );
    });

    it('should throw error when save fails', () => {
      mockGet.mockReturnValue(null);

      expect(() => setOverride(testUserId, testItemId1, 3, 4)).toThrow(
        'Failed to save classification override'
      );
    });
  });

  describe('getOne', () => {
    it('should return override when it exists', () => {
      const mockRow = {
        id: 1,
        user_id: testUserId,
        inventory_item_id: testItemId1,
        group_num: 2,
        period_num: 3,
        created_at: '2025-01-01',
        updated_at: '2025-01-01',
      };
      mockGet.mockReturnValue(mockRow);

      const result = getOne(testUserId, testItemId1);

      expect(result).not.toBeNull();
      expect(result!.inventoryItemId).toBe(testItemId1);
      expect(result!.group).toBe(2);
      expect(result!.period).toBe(3);
    });

    it('should return null when override does not exist', () => {
      mockGet.mockReturnValue(undefined);

      const result = getOne(testUserId, 999999);

      expect(result).toBeNull();
    });
  });

  describe('getAll', () => {
    it('should return all overrides for a user', () => {
      const mockRows = [
        { id: 1, user_id: testUserId, inventory_item_id: testItemId1, group_num: 1, period_num: 2, created_at: '2025-01-01', updated_at: '2025-01-01' },
        { id: 2, user_id: testUserId, inventory_item_id: testItemId2, group_num: 3, period_num: 4, created_at: '2025-01-01', updated_at: '2025-01-01' },
      ];
      mockAll.mockReturnValue(mockRows);

      const results = getAll(testUserId);

      expect(results).toHaveLength(2);
      expect(results.map((r) => r.inventoryItemId).sort()).toEqual(
        [testItemId1, testItemId2].sort()
      );
    });

    it('should return empty array when user has no overrides', () => {
      mockAll.mockReturnValue([]);

      const results = getAll(testUserId);

      expect(results).toEqual([]);
    });
  });

  describe('getUserOverrides', () => {
    it('should return Map of overrides', () => {
      const mockRows = [
        { id: 1, user_id: testUserId, inventory_item_id: testItemId1, group_num: 2, period_num: 3, created_at: '2025-01-01', updated_at: '2025-01-01' },
        { id: 2, user_id: testUserId, inventory_item_id: testItemId2, group_num: 4, period_num: 5, created_at: '2025-01-01', updated_at: '2025-01-01' },
      ];
      mockAll.mockReturnValue(mockRows);

      const overrides = getUserOverrides(testUserId);

      expect(overrides).toBeInstanceOf(Map);
      expect(overrides.size).toBe(2);
      expect(overrides.get(testItemId1)).toEqual({ group: 2, period: 3 });
      expect(overrides.get(testItemId2)).toEqual({ group: 4, period: 5 });
    });

    it('should return empty Map for user with no overrides', () => {
      mockAll.mockReturnValue([]);

      const overrides = getUserOverrides(testUserId);

      expect(overrides).toBeInstanceOf(Map);
      expect(overrides.size).toBe(0);
    });
  });

  describe('deleteOverride', () => {
    it('should delete existing override and return true', () => {
      mockRun.mockReturnValue({ changes: 1 });

      const result = deleteOverride(testUserId, testItemId1);

      expect(result).toBe(true);
    });

    it('should return false when override does not exist', () => {
      mockRun.mockReturnValue({ changes: 0 });

      const result = deleteOverride(testUserId, 999999);

      expect(result).toBe(false);
    });
  });

  describe('deleteAllOverrides', () => {
    it('should delete all overrides for user and return count', () => {
      mockRun.mockReturnValue({ changes: 5 });

      const deletedCount = deleteAllOverrides(testUserId);

      expect(deletedCount).toBe(5);
    });

    it('should return 0 when user has no overrides', () => {
      mockRun.mockReturnValue({ changes: 0 });

      const deletedCount = deleteAllOverrides(testUserId);

      expect(deletedCount).toBe(0);
    });
  });

  describe('countOverrides', () => {
    it('should return correct count', () => {
      mockGet.mockReturnValue({ count: 5 });

      const count = countOverrides(testUserId);

      expect(count).toBe(5);
    });

    it('should return 0 for user with no overrides', () => {
      mockGet.mockReturnValue({ count: 0 });

      const count = countOverrides(testUserId);

      expect(count).toBe(0);
    });

    it('should return 0 when result is null', () => {
      mockGet.mockReturnValue(null);

      const count = countOverrides(testUserId);

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
