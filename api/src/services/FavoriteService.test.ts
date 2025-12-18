/**
 * FavoriteService Tests
 *
 * Tests for the favorites/bookmarking service.
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
import { FavoriteService } from './FavoriteService';
import { Favorite } from '../types';

describe('FavoriteService', () => {
  let favoriteService: FavoriteService;
  const testUserId = 9999;
  const otherUserId = 9998;
  const testRecipeId = 99999;

  // Helper to create mock favorite
  const createMockFavorite = (overrides: Partial<Favorite> = {}): Favorite => ({
    id: 1,
    user_id: testUserId,
    recipe_name: 'Test Recipe',
    recipe_id: testRecipeId,
    created_at: new Date().toISOString(),
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    favoriteService = new FavoriteService();

    // Default mock implementations
    (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (execute as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [], rowCount: 0 });
  });

  describe('validateRecipeName', () => {
    it('should return sanitized name for valid input', () => {
      const result = favoriteService.validateRecipeName('Margarita');
      expect(result).toBe('Margarita');
    });

    it('should trim whitespace', () => {
      const result = favoriteService.validateRecipeName('  Margarita  ');
      expect(result).toBe('Margarita');
    });

    it('should return null for empty string', () => {
      const result = favoriteService.validateRecipeName('');
      expect(result).toBeNull();
    });

    it('should return null for whitespace only', () => {
      const result = favoriteService.validateRecipeName('   ');
      expect(result).toBeNull();
    });

    it('should return null for non-string input', () => {
      expect(favoriteService.validateRecipeName(null)).toBeNull();
      expect(favoriteService.validateRecipeName(undefined)).toBeNull();
      expect(favoriteService.validateRecipeName(123)).toBeNull();
      expect(favoriteService.validateRecipeName({})).toBeNull();
    });

    it('should truncate very long names', () => {
      const longName = 'A'.repeat(300);
      const result = favoriteService.validateRecipeName(longName);
      expect(result).not.toBeNull();
      expect(result!.length).toBeLessThanOrEqual(255);
    });
  });

  describe('validateRecipeId', () => {
    it('should accept valid positive numbers', () => {
      const result = favoriteService.validateRecipeId(1);
      expect(result.isValid).toBe(true);
      expect(result.value).toBe(1);
    });

    it('should accept null as valid (external recipe)', () => {
      const result = favoriteService.validateRecipeId(null);
      expect(result.isValid).toBe(true);
      expect(result.value).toBeNull();
    });

    it('should accept undefined as valid', () => {
      const result = favoriteService.validateRecipeId(undefined);
      expect(result.isValid).toBe(true);
      expect(result.value).toBeNull();
    });

    it('should accept empty string as valid', () => {
      const result = favoriteService.validateRecipeId('');
      expect(result.isValid).toBe(true);
      expect(result.value).toBeNull();
    });

    it('should reject zero', () => {
      const result = favoriteService.validateRecipeId(0);
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject negative numbers', () => {
      const result = favoriteService.validateRecipeId(-1);
      expect(result.isValid).toBe(false);
    });

    it('should accept numeric strings', () => {
      const result = favoriteService.validateRecipeId('123');
      expect(result.isValid).toBe(true);
      expect(result.value).toBe(123);
    });
  });

  describe('create', () => {
    it('should create a favorite with recipe_id', async () => {
      const mockFavorite = createMockFavorite({ recipe_name: 'Test Cocktail' });
      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [mockFavorite],
        rowCount: 1,
      });

      const favorite = await favoriteService.create(testUserId, 'Test Cocktail', testRecipeId);

      expect(favorite).toBeDefined();
      expect(favorite.id).toBeDefined();
      expect(favorite.user_id).toBe(testUserId);
      expect(favorite.recipe_name).toBe('Test Cocktail');
      expect(favorite.recipe_id).toBe(testRecipeId);
    });

    it('should create a favorite without recipe_id (external)', async () => {
      const mockFavorite = createMockFavorite({
        recipe_name: 'External Recipe',
        recipe_id: null,
      });
      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [mockFavorite],
        rowCount: 1,
      });

      const favorite = await favoriteService.create(testUserId, 'External Recipe', null);

      expect(favorite).toBeDefined();
      expect(favorite.recipe_name).toBe('External Recipe');
      expect(favorite.recipe_id).toBeNull();
    });

    it('should set created_at timestamp', async () => {
      const mockFavorite = createMockFavorite({ recipe_name: 'Timestamped' });
      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [mockFavorite],
        rowCount: 1,
      });

      const favorite = await favoriteService.create(testUserId, 'Timestamped', null);

      expect(favorite.created_at).toBeDefined();
    });
  });

  describe('getAll', () => {
    it('should return empty array for user with no favorites', async () => {
      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const favorites = await favoriteService.getAll(testUserId);

      expect(favorites).toEqual([]);
    });

    it('should return all favorites for user', async () => {
      const mockFavorites = [
        createMockFavorite({ id: 1, recipe_name: 'Fav 1' }),
        createMockFavorite({ id: 2, recipe_name: 'Fav 2' }),
        createMockFavorite({ id: 3, recipe_name: 'Fav 3' }),
      ];
      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue(mockFavorites);

      const favorites = await favoriteService.getAll(testUserId);

      expect(favorites).toHaveLength(3);
    });

    it('should order by created_at DESC (newest first)', async () => {
      const mockFavorites = [
        createMockFavorite({ id: 3, recipe_name: 'Third', created_at: '2025-01-03T00:00:00Z' }),
        createMockFavorite({ id: 2, recipe_name: 'Second', created_at: '2025-01-02T00:00:00Z' }),
        createMockFavorite({ id: 1, recipe_name: 'First', created_at: '2025-01-01T00:00:00Z' }),
      ];
      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue(mockFavorites);

      const favorites = await favoriteService.getAll(testUserId);

      expect(favorites[0].recipe_name).toBe('Third');
      expect(favorites[2].recipe_name).toBe('First');
    });

    it('should not return other users favorites', async () => {
      const mockFavorites = [createMockFavorite({ recipe_name: 'My Fav' })];
      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue(mockFavorites);

      const myFavorites = await favoriteService.getAll(testUserId);

      expect(myFavorites).toHaveLength(1);
      expect(myFavorites[0].recipe_name).toBe('My Fav');

      // Verify query was called with correct user ID
      expect(queryAll).toHaveBeenCalledWith(
        expect.stringContaining('user_id = $1'),
        [testUserId]
      );
    });
  });

  describe('getPaginated', () => {
    it('should return paginated results with metadata', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue({ total: '15' });
      const mockFavorites = Array.from({ length: 5 }, (_, i) =>
        createMockFavorite({ id: i + 1, recipe_name: `Recipe ${i + 1}` })
      );
      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue(mockFavorites);

      const result = await favoriteService.getPaginated(testUserId, 1, 5);

      expect(result.favorites).toHaveLength(5);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(5);
      expect(result.pagination.total).toBe(15);
      expect(result.pagination.totalPages).toBe(3);
      expect(result.pagination.hasNextPage).toBe(true);
      expect(result.pagination.hasPreviousPage).toBe(false);
    });

    it('should return correct page', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue({ total: '15' });
      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const result = await favoriteService.getPaginated(testUserId, 2, 5);

      expect(result.pagination.page).toBe(2);
      expect(result.pagination.hasPreviousPage).toBe(true);
      expect(result.pagination.hasNextPage).toBe(true);
    });

    it('should handle last page', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue({ total: '15' });
      const mockFavorites = Array.from({ length: 5 }, (_, i) =>
        createMockFavorite({ id: i + 11, recipe_name: `Recipe ${i + 11}` })
      );
      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue(mockFavorites);

      const result = await favoriteService.getPaginated(testUserId, 3, 5);

      expect(result.favorites).toHaveLength(5);
      expect(result.pagination.hasNextPage).toBe(false);
      expect(result.pagination.hasPreviousPage).toBe(true);
    });

    it('should clamp page to minimum 1', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue({ total: '15' });
      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const result = await favoriteService.getPaginated(testUserId, -5, 5);

      expect(result.pagination.page).toBe(1);
    });

    it('should clamp limit to maximum 100', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue({ total: '15' });
      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const result = await favoriteService.getPaginated(testUserId, 1, 500);

      expect(result.pagination.limit).toBe(100);
    });

    it('should use default values', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue({ total: '15' });
      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const result = await favoriteService.getPaginated(testUserId);

      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(50);
    });
  });

  describe('getById', () => {
    it('should return favorite by ID', async () => {
      const mockFavorite = createMockFavorite({ recipe_name: 'Find Me' });
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(mockFavorite);

      const found = await favoriteService.getById(1, testUserId);

      expect(found).not.toBeNull();
      expect(found!.recipe_name).toBe('Find Me');
    });

    it('should return null for non-existent ID', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const found = await favoriteService.getById(99999, testUserId);

      expect(found).toBeNull();
    });

    it('should return null for wrong user', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const found = await favoriteService.getById(1, otherUserId);

      expect(found).toBeNull();
    });
  });

  describe('exists', () => {
    it('should return true for existing favorite', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 1 });

      const result = await favoriteService.exists(1, testUserId);

      expect(result).toBe(true);
    });

    it('should return false for non-existent favorite', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await favoriteService.exists(99999, testUserId);

      expect(result).toBe(false);
    });

    it('should return false for wrong user', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await favoriteService.exists(1, otherUserId);

      expect(result).toBe(false);
    });
  });

  describe('delete', () => {
    it('should delete favorite and return true', async () => {
      // First exists check returns true
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: 1 });
      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({ rowCount: 1 });

      const result = await favoriteService.delete(1, testUserId);

      expect(result).toBe(true);
      expect(execute).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM favorites'),
        [1, testUserId]
      );
    });

    it('should return false for non-existent favorite', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await favoriteService.delete(99999, testUserId);

      expect(result).toBe(false);
    });

    it('should return false when trying to delete other users favorite', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await favoriteService.delete(1, otherUserId);

      expect(result).toBe(false);
    });
  });

  describe('isRecipeFavorited', () => {
    it('should return true if recipe is favorited', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 1 });

      const result = await favoriteService.isRecipeFavorited(testUserId, testRecipeId);

      expect(result).toBe(true);
    });

    it('should return false if recipe is not favorited', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await favoriteService.isRecipeFavorited(testUserId, 999);

      expect(result).toBe(false);
    });

    it('should not find other users favorites', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await favoriteService.isRecipeFavorited(otherUserId, testRecipeId);

      expect(result).toBe(false);
    });
  });

  describe('getByRecipeId', () => {
    it('should return favorite by recipe ID', async () => {
      const mockFavorite = createMockFavorite({ recipe_name: 'By Recipe ID' });
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(mockFavorite);

      const found = await favoriteService.getByRecipeId(testUserId, testRecipeId);

      expect(found).not.toBeNull();
      expect(found!.recipe_name).toBe('By Recipe ID');
    });

    it('should return null if not found', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const found = await favoriteService.getByRecipeId(testUserId, 999);

      expect(found).toBeNull();
    });
  });
});
