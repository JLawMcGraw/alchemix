/**
 * GlassService Tests
 *
 * Tests for the custom glassware service.
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
import { GlassService, CustomGlass } from './GlassService';

describe('GlassService', () => {
  let glassService: GlassService;
  const testUserId = 9999;
  const otherUserId = 9998;

  // Helper to create mock glass
  const createMockGlass = (overrides: Partial<CustomGlass> = {}): CustomGlass => ({
    id: 1,
    user_id: testUserId,
    name: 'Hurricane',
    created_at: new Date().toISOString(),
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    glassService = new GlassService();

    // Default mock implementations
    (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (execute as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [], rowCount: 0 });
  });

  describe('getAll', () => {
    it('should return empty array when no glasses exist', async () => {
      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const glasses = await glassService.getAll(testUserId);

      expect(glasses).toEqual([]);
    });

    it('should return all glasses for a user', async () => {
      const mockGlasses = [
        createMockGlass({ id: 1, name: 'Hurricane' }),
        createMockGlass({ id: 2, name: 'Tiki Mug' }),
      ];
      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue(mockGlasses);

      const glasses = await glassService.getAll(testUserId);

      expect(glasses).toHaveLength(2);
    });

    it('should return glasses in alphabetical order', async () => {
      const mockGlasses = [
        createMockGlass({ id: 1, name: 'Absinthe' }),
        createMockGlass({ id: 2, name: 'Mint Julep' }),
        createMockGlass({ id: 3, name: 'Zombie' }),
      ];
      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue(mockGlasses);

      const glasses = await glassService.getAll(testUserId);

      expect(glasses[0].name).toBe('Absinthe');
      expect(glasses[1].name).toBe('Mint Julep');
      expect(glasses[2].name).toBe('Zombie');
    });

    it('should only return glasses for the specified user', async () => {
      const mockGlasses = [createMockGlass({ name: 'User1 Glass' })];
      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue(mockGlasses);

      const user1Glasses = await glassService.getAll(testUserId);

      expect(user1Glasses).toHaveLength(1);
      expect(user1Glasses[0].name).toBe('User1 Glass');

      // Verify query was called with correct user ID
      expect(queryAll).toHaveBeenCalledWith(
        expect.stringContaining('user_id = $1'),
        [testUserId]
      );
    });
  });

  describe('create', () => {
    it('should create a new glass', async () => {
      const mockGlass = createMockGlass({ name: 'Hurricane' });
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null); // No duplicate
      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [mockGlass],
        rowCount: 1,
      });

      const result = await glassService.create(testUserId, 'Hurricane');

      expect(result.success).toBe(true);
      expect(result.glass).toBeDefined();
      expect(result.glass?.name).toBe('Hurricane');
      expect(result.glass?.user_id).toBe(testUserId);
    });

    it('should fail when name is empty', async () => {
      const result = await glassService.create(testUserId, '');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Glass name is required');
    });

    it('should fail when name is only whitespace', async () => {
      const result = await glassService.create(testUserId, '   ');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Glass name is required');
    });

    it('should trim whitespace from name', async () => {
      const mockGlass = createMockGlass({ name: 'Hurricane' });
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [mockGlass],
        rowCount: 1,
      });

      const result = await glassService.create(testUserId, '  Hurricane  ');

      expect(result.success).toBe(true);
      expect(result.glass?.name).toBe('Hurricane');
    });

    it('should fail when duplicate name exists (case-insensitive)', async () => {
      // First create succeeds
      const mockGlass = createMockGlass({ name: 'Hurricane' });
      (queryOne as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(null) // First create - no duplicate
        .mockResolvedValueOnce({ id: 1 }); // Second create - duplicate exists

      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [mockGlass],
        rowCount: 1,
      });

      await glassService.create(testUserId, 'Hurricane');
      const result = await glassService.create(testUserId, 'HURRICANE');

      expect(result.success).toBe(false);
      expect(result.error).toContain('already exists');
    });

    it('should allow same name for different users', async () => {
      const mockGlass1 = createMockGlass({ id: 1, user_id: testUserId, name: 'Hurricane' });
      const mockGlass2 = createMockGlass({ id: 2, user_id: otherUserId, name: 'Hurricane' });

      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null); // No duplicates
      (execute as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ rows: [mockGlass1], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [mockGlass2], rowCount: 1 });

      const result1 = await glassService.create(testUserId, 'Hurricane');
      const result2 = await glassService.create(otherUserId, 'Hurricane');

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
    });

    it('should sanitize name to prevent XSS', async () => {
      const mockGlass = createMockGlass({ name: 'Hurricane' });
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [mockGlass],
        rowCount: 1,
      });

      const result = await glassService.create(testUserId, '<script>alert("xss")</script>Hurricane');

      expect(result.success).toBe(true);
      // Verify execute was called with sanitized value
      expect(execute).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          testUserId,
          expect.not.stringContaining('<script>'),
        ])
      );
    });

    it('should truncate long names', async () => {
      const mockGlass = createMockGlass({ name: 'A'.repeat(100) });
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [mockGlass],
        rowCount: 1,
      });

      const longName = 'A'.repeat(200);
      const result = await glassService.create(testUserId, longName);

      expect(result.success).toBe(true);
      // Verify execute was called with truncated name
      expect(execute).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          testUserId,
          expect.any(String),
        ])
      );
      const callArgs = (execute as ReturnType<typeof vi.fn>).mock.calls[0][1];
      expect(callArgs[1].length).toBeLessThanOrEqual(100);
    });
  });

  describe('delete', () => {
    it('should delete an existing glass', async () => {
      const mockGlass = createMockGlass({ id: 1, name: 'Hurricane' });
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(mockGlass);
      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({ rowCount: 1 });

      const result = await glassService.delete(testUserId, 1);

      expect(result.success).toBe(true);
      expect(result.glass?.name).toBe('Hurricane');
      expect(execute).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM custom_glasses'),
        [1, testUserId]
      );
    });

    it('should fail when glass does not exist', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await glassService.delete(testUserId, 999);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should fail when glass belongs to different user', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await glassService.delete(testUserId, 100);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });
});
