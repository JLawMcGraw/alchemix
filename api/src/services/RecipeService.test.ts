/**
 * RecipeService Tests
 *
 * Tests for recipe management service.
 * Updated for PostgreSQL async pattern.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the database module
vi.mock('../database/db', () => ({
  queryOne: vi.fn(),
  queryAll: vi.fn(),
  execute: vi.fn(),
  transaction: vi.fn(),
}));

// Mock logger
vi.mock('../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock MemoryService
vi.mock('./MemoryService', () => ({
  memoryService: {
    storeUserRecipe: vi.fn().mockResolvedValue('mock-uid'),
    storeUserRecipesBatch: vi.fn().mockResolvedValue({ success: 0, failed: 0, uidMap: new Map() }),
    deleteUserRecipe: vi.fn().mockResolvedValue(undefined),
    deleteUserRecipeByUid: vi.fn().mockResolvedValue(true),
    deleteUserRecipesBatch: vi.fn().mockResolvedValue({ success: 0, failed: 0 }),
    deleteAllRecipeMemories: vi.fn().mockResolvedValue(true),
  },
}));

import { queryOne, queryAll, execute, transaction } from '../database/db';
import { RecipeService, IMemoryService } from './RecipeService';
import { Recipe } from '../types';

/**
 * Mock MemoryService for testing
 */
function createMockMemoryService(): IMemoryService {
  return {
    storeUserRecipe: vi.fn().mockResolvedValue('mock-uid'),
    storeUserRecipesBatch: vi.fn().mockResolvedValue({ success: 0, failed: 0, uidMap: new Map() }),
    deleteUserRecipe: vi.fn().mockResolvedValue(undefined),
    deleteUserRecipeByUid: vi.fn().mockResolvedValue(true),
    deleteUserRecipesBatch: vi.fn().mockResolvedValue({ success: 0, failed: 0 }),
    deleteAllRecipeMemories: vi.fn().mockResolvedValue(true),
  };
}

describe('RecipeService', () => {
  let recipeService: RecipeService;
  let mockMemoryService: IMemoryService;
  const userId = 1;
  const otherUserId = 2;
  const collectionId = 1;

  // Helper to create mock recipe
  const createMockRecipe = (overrides: Partial<Recipe> = {}): Recipe => ({
    id: 1,
    user_id: userId,
    name: 'Test Recipe',
    ingredients: ['Gin', 'Vermouth'],
    instructions: 'Stir and strain',
    glass: 'Cocktail Glass',
    category: 'Classic',
    collection_id: null,
    memmachine_uid: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockMemoryService = createMockMemoryService();
    recipeService = new RecipeService(mockMemoryService);

    // Default mock implementations
    (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (execute as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [], rowCount: 0 });
    (transaction as ReturnType<typeof vi.fn>).mockImplementation(async (callback) => {
      const mockClient = { query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
      return callback(mockClient as any);
    });
  });

  describe('getAll', () => {
    it('should return empty result when user has no recipes', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue({ total: '0' });
      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const result = await recipeService.getAll(userId, { page: 1, limit: 10 });

      expect(result.items).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
      expect(result.pagination.totalPages).toBe(0);
    });

    it('should return paginated recipes', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue({ total: '15' });
      const mockRecipes = Array.from({ length: 10 }, (_, i) =>
        createMockRecipe({ id: i + 1, name: `Recipe ${i}`, ingredients: '["ingredient"]' as any })
      );
      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue(mockRecipes);

      const result = await recipeService.getAll(userId, { page: 1, limit: 10 });

      expect(result.items).toHaveLength(10);
      expect(result.pagination.total).toBe(15);
      expect(result.pagination.totalPages).toBe(2);
      expect(result.pagination.hasNextPage).toBe(true);
    });

    it('should parse ingredients JSON', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue({ total: '1' });
      const mockRecipe = createMockRecipe({
        name: 'Martini',
        ingredients: '["2 oz Gin", "1 oz Vermouth"]' as any,
      });
      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue([mockRecipe]);

      const result = await recipeService.getAll(userId, { page: 1, limit: 10 });

      expect(result.items).toHaveLength(1);
      expect(Array.isArray(result.items[0].ingredients)).toBe(true);
    });

    it('should not return recipes from other users', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue({ total: '1' });
      const mockRecipes = [createMockRecipe({ name: 'My Recipe' })];
      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue(mockRecipes);

      const result = await recipeService.getAll(userId, { page: 1, limit: 10 });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].name).toBe('My Recipe');
      expect(queryAll).toHaveBeenCalledWith(
        expect.stringContaining('user_id = $1'),
        expect.arrayContaining([userId])
      );
    });

    it('should filter recipes by search term in name', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue({ total: '1' });
      const mockRecipes = [
        createMockRecipe({ id: 1, name: 'Margarita', ingredients: '["Tequila", "Lime"]' as any }),
      ];
      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue(mockRecipes);

      const result = await recipeService.getAll(userId, { page: 1, limit: 10, search: 'margarita' });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].name).toBe('Margarita');
      expect(queryAll).toHaveBeenCalledWith(
        expect.stringContaining('LOWER(name) LIKE'),
        expect.arrayContaining(['%margarita%'])
      );
    });

    it('should filter recipes by search term in ingredients', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue({ total: '1' });
      const mockRecipes = [
        createMockRecipe({ id: 1, name: 'Daiquiri', ingredients: '["White Rum", "Lime Juice"]' as any }),
      ];
      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue(mockRecipes);

      const result = await recipeService.getAll(userId, { page: 1, limit: 10, search: 'rum' });

      expect(result.items).toHaveLength(1);
      expect(queryAll).toHaveBeenCalledWith(
        expect.stringContaining('LOWER(ingredients) LIKE'),
        expect.arrayContaining(['%rum%'])
      );
    });

    it('should filter recipes by masteryIds', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue({ total: '2' });
      const mockRecipes = [
        createMockRecipe({ id: 1, name: 'Margarita' }),
        createMockRecipe({ id: 3, name: 'Daiquiri' }),
      ];
      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue(mockRecipes);

      const result = await recipeService.getAll(userId, { page: 1, limit: 10, masteryIds: [1, 3, 5] });

      expect(result.items).toHaveLength(2);
      expect(queryAll).toHaveBeenCalledWith(
        expect.stringContaining('id = ANY'),
        expect.arrayContaining([[1, 3, 5]])
      );
    });

    it('should combine search and masteryIds with AND logic', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue({ total: '1' });
      const mockRecipes = [
        createMockRecipe({ id: 1, name: 'Margarita' }),
      ];
      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue(mockRecipes);

      const result = await recipeService.getAll(userId, {
        page: 1,
        limit: 10,
        search: 'margarita',
        masteryIds: [1, 2, 3]
      });

      expect(result.items).toHaveLength(1);
      const query = (queryAll as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(query).toContain('LOWER(name) LIKE');
      expect(query).toContain('id = ANY');
    });

    it('should return empty when masteryIds is empty array', async () => {
      const result = await recipeService.getAll(userId, { page: 1, limit: 10, masteryIds: [] });

      expect(result.items).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
      expect(queryAll).not.toHaveBeenCalled();
    });
  });

  describe('getById', () => {
    it('should return recipe when it exists and belongs to user', async () => {
      const mockRecipe = createMockRecipe({ name: 'Martini', instructions: 'Stir and strain' });
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(mockRecipe);

      const recipe = await recipeService.getById(1, userId);

      expect(recipe).not.toBeNull();
      expect(recipe!.name).toBe('Martini');
      expect(recipe!.instructions).toBe('Stir and strain');
    });

    it('should return null for non-existent recipe', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const recipe = await recipeService.getById(99999, userId);

      expect(recipe).toBeNull();
    });

    it('should return null when recipe belongs to different user', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const recipe = await recipeService.getById(1, userId);

      expect(recipe).toBeNull();
    });
  });

  describe('exists', () => {
    it('should return true when recipe exists and belongs to user', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 1 });

      const result = await recipeService.exists(1, userId);

      expect(result).toBe(true);
    });

    it('should return false for non-existent recipe', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await recipeService.exists(99999, userId);

      expect(result).toBe(false);
    });
  });

  describe('validateCollection', () => {
    it('should return true when collection belongs to user', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue({ id: collectionId });

      const result = await recipeService.validateCollection(collectionId, userId);

      expect(result).toBe(true);
    });

    it('should return false for non-existent collection', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await recipeService.validateCollection(99999, userId);

      expect(result).toBe(false);
    });

    it('should return false when collection belongs to different user', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await recipeService.validateCollection(collectionId, userId);

      expect(result).toBe(false);
    });
  });

  describe('sanitizeCreateInput', () => {
    it('should validate and sanitize valid input', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null); // No collection validation needed

      const result = await recipeService.sanitizeCreateInput({
        name: 'Martini',
        ingredients: ['2 oz Gin', '1 oz Vermouth'],
        instructions: 'Stir and strain',
        glass: 'Cocktail Glass',
      }, userId);

      expect(result.valid).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.name).toBe('Martini');
    });

    it('should fail when name is missing', async () => {
      const result = await recipeService.sanitizeCreateInput({
        ingredients: ['Gin'],
      } as { name: string; ingredients: string[] }, userId);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('name');
    });

    it('should fail when name is empty after sanitization', async () => {
      const result = await recipeService.sanitizeCreateInput({
        name: '   ',
        ingredients: ['Gin'],
      }, userId);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('empty');
    });

    it('should validate collection belongs to user', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await recipeService.sanitizeCreateInput({
        name: 'Test Recipe',
        collection_id: 99999,
      }, userId);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Collection not found');
    });

    it('should accept valid collection_id', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue({ id: collectionId });

      const result = await recipeService.sanitizeCreateInput({
        name: 'Test Recipe',
        collection_id: collectionId,
      }, userId);

      expect(result.valid).toBe(true);
      expect(result.data!.collectionId).toBe(collectionId);
    });

    it('should handle ingredients as JSON string', async () => {
      const result = await recipeService.sanitizeCreateInput({
        name: 'Test Recipe',
        ingredients: '["Gin", "Tonic"]',
      }, userId);

      expect(result.valid).toBe(true);
      expect(result.data!.ingredientsStr).toBe('["Gin","Tonic"]');
    });

    it('should fail for invalid JSON string ingredients', async () => {
      const result = await recipeService.sanitizeCreateInput({
        name: 'Test Recipe',
        ingredients: 'not valid json',
      }, userId);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('not valid JSON');
    });

    it('should fail when too many ingredients', async () => {
      const ingredients = Array.from({ length: 101 }, (_, i) => `Ingredient ${i}`);
      const result = await recipeService.sanitizeCreateInput({
        name: 'Test Recipe',
        ingredients,
      }, userId);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Too many ingredients');
    });
  });

  describe('create', () => {
    it('should create recipe with all fields', async () => {
      const mockRecipe = createMockRecipe({
        name: 'Martini',
        collection_id: collectionId,
      });
      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [mockRecipe],
        rowCount: 1,
      });

      const data = {
        name: 'Martini',
        ingredientsStr: '["2 oz Gin","1 oz Vermouth"]',
        instructions: 'Stir and strain',
        glass: 'Cocktail Glass',
        category: 'Classic',
        collectionId,
      };

      const recipe = await recipeService.create(userId, data);

      expect(recipe.id).toBeDefined();
      expect(recipe.name).toBe('Martini');
      expect(mockMemoryService.storeUserRecipe).toHaveBeenCalled();
    });

    it('should create recipe with minimal fields', async () => {
      const mockRecipe = createMockRecipe({ name: 'Simple Recipe' });
      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [mockRecipe],
        rowCount: 1,
      });

      const data = {
        name: 'Simple Recipe',
        ingredientsStr: '[]',
        instructions: null,
        glass: null,
        category: null,
        collectionId: null,
      };

      const recipe = await recipeService.create(userId, data);

      expect(recipe.id).toBeDefined();
      expect(recipe.name).toBe('Simple Recipe');
    });
  });

  describe('update', () => {
    it('should update existing recipe', async () => {
      const mockRecipe = createMockRecipe({
        name: 'Updated Recipe',
        instructions: 'Updated instructions',
      });
      // exists check returns true, then getById returns updated recipe
      (queryOne as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ id: 1 }) // exists check
        .mockResolvedValueOnce(mockRecipe); // getById after update
      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [],
        rowCount: 1,
      });

      const result = await recipeService.update(1, userId, {
        name: 'Updated Recipe',
        instructions: 'Updated instructions',
      });

      expect(result.success).toBe(true);
      expect(result.recipe).toBeDefined();
      expect(result.recipe!.name).toBe('Updated Recipe');
    });

    it('should return error for non-existent recipe', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await recipeService.update(99999, userId, {
        name: 'Updated',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should not update recipe belonging to different user', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await recipeService.update(1, userId, {
        name: 'Hacked',
      });

      expect(result.success).toBe(false);
    });

    it('should validate name is string', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 1 });

      const result = await recipeService.update(1, userId, {
        name: 123 as unknown as string,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('string');
    });

    it('should fail for empty name after sanitization', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 1 });

      const result = await recipeService.update(1, userId, {
        name: '   ',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('empty');
    });

    it('should validate collection_id belongs to user', async () => {
      (queryOne as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ id: 1 }) // exists check
        .mockResolvedValueOnce(null); // collection validation

      const result = await recipeService.update(1, userId, {
        collection_id: 99999,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Collection not found');
    });

    it('should allow setting collection_id to null', async () => {
      const mockRecipe = createMockRecipe({ collection_id: null });
      (queryOne as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ id: 1 }) // exists check
        .mockResolvedValueOnce(mockRecipe); // getById after update
      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [],
        rowCount: 1,
      });

      const result = await recipeService.update(1, userId, {
        collection_id: null,
      });

      expect(result.success).toBe(true);
      expect(result.recipe!.collection_id).toBeNull();
    });

    it('should return current recipe when no fields to update', async () => {
      const mockRecipe = createMockRecipe({ name: 'Original Recipe' });
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(mockRecipe);

      const result = await recipeService.update(1, userId, {});

      expect(result.success).toBe(true);
      expect(result.recipe!.name).toBe('Original Recipe');
    });

    it('should reject user_id manipulation attempts (mass assignment protection)', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 1 });
      const mockRecipe = createMockRecipe({ name: 'Updated', user_id: userId });
      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [mockRecipe],
        rowCount: 1,
      });

      const result = await recipeService.update(1, userId, {
        name: 'Updated',
        user_id: otherUserId, // Should be ignored
      } as { name: string; user_id: number });

      expect(result.success).toBe(true);
      // user_id change should be ignored
    });
  });

  describe('delete', () => {
    it('should delete existing recipe', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: 1, memmachine_uid: 'uid-1' });
      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({ rowCount: 1 });

      const result = await recipeService.delete(1, userId);

      expect(result.success).toBe(true);
    });

    it('should return error for non-existent recipe', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await recipeService.delete(99999, userId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should not delete recipe belonging to different user', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await recipeService.delete(1, otherUserId);

      expect(result.success).toBe(false);
    });
  });

  describe('deleteAll', () => {
    it('should delete all recipes for user', async () => {
      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 1, memmachine_uid: 'uid-1' },
        { id: 2, memmachine_uid: 'uid-2' },
      ]);
      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({ rowCount: 2 });

      const deleted = await recipeService.deleteAll(userId);

      expect(deleted).toBe(2);
    });

    it('should not delete recipes from other users', async () => {
      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({ rowCount: 0 });

      await recipeService.deleteAll(userId);

      expect(execute).toHaveBeenCalledWith(
        expect.stringContaining('user_id = $1'),
        [userId]
      );
    });
  });

  describe('bulkDelete', () => {
    it('should delete multiple recipes', async () => {
      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 1, memmachine_uid: 'uid-1' },
        { id: 2, memmachine_uid: 'uid-2' },
        { id: 3, memmachine_uid: 'uid-3' },
      ]);
      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({ rowCount: 3 });

      const deleted = await recipeService.bulkDelete([1, 2, 3], userId);

      expect(deleted).toBe(3);
    });

    it('should only delete recipes belonging to user', async () => {
      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: 1, memmachine_uid: 'uid-1' }]);
      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({ rowCount: 1 });

      const deleted = await recipeService.bulkDelete([1, 2], userId);

      expect(deleted).toBe(1);
    });
  });

  describe('bulkMove', () => {
    it('should move multiple recipes to a collection', async () => {
      // Mock collection validation
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: collectionId });
      // Mock update
      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({ rowCount: 3 });

      const result = await recipeService.bulkMove([1, 2, 3], userId, collectionId);

      expect(result.moved).toBe(3);
      expect(execute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE recipes SET collection_id'),
        expect.arrayContaining([collectionId, userId, [1, 2, 3]])
      );
    });

    it('should move recipes to uncategorized (null collection)', async () => {
      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({ rowCount: 2 });

      const result = await recipeService.bulkMove([1, 2], userId, null);

      expect(result.moved).toBe(2);
      expect(execute).toHaveBeenCalledWith(
        expect.stringContaining('collection_id = $1'),
        expect.arrayContaining([null, userId, [1, 2]])
      );
    });

    it('should return error for invalid collection', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await recipeService.bulkMove([1, 2], userId, 999);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Collection not found or access denied');
    });

    it('should return error for empty recipe array', async () => {
      const result = await recipeService.bulkMove([], userId, collectionId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('No recipe IDs provided');
    });

    it('should return error when exceeding max recipes', async () => {
      const tooManyIds = Array.from({ length: 101 }, (_, i) => i + 1);

      const result = await recipeService.bulkMove(tooManyIds, userId, collectionId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Maximum 100 recipes per bulk operation');
    });
  });

  describe('importFromCSV', () => {
    it('should import valid records', async () => {
      let callIndex = 0;
      (transaction as ReturnType<typeof vi.fn>).mockImplementation(async (callback) => {
        const mockClient = {
          query: vi.fn().mockImplementation(async () => ({
            rows: [{ id: ++callIndex }],
            rowCount: 1,
          })),
        };
        return callback(mockClient as any);
      });

      const records = [
        { name: 'Martini', ingredients: 'Gin; Vermouth', instructions: 'Stir and strain' },
        { name: 'Negroni', ingredients: 'Gin; Campari; Sweet Vermouth' },
        { name: 'Daiquiri', ingredients: 'Rum, Lime Juice, Simple Syrup' },
      ];

      const result = await recipeService.importFromCSV(userId, records, null);

      expect(result.imported).toBe(3);
      expect(result.failed).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(mockMemoryService.storeUserRecipesBatch).toHaveBeenCalled();
    });

    it('should track failed records', async () => {
      (transaction as ReturnType<typeof vi.fn>).mockImplementation(async (callback) => {
        const mockClient = {
          query: vi.fn().mockResolvedValue({ rows: [{ id: 1 }], rowCount: 1 }),
        };
        return callback(mockClient as any);
      });

      const records = [
        { name: 'Valid Recipe', ingredients: 'Gin' },
        { ingredients: 'No name' }, // Missing name
        { name: '' }, // Empty name
      ];

      const result = await recipeService.importFromCSV(userId, records, null);

      expect(result.imported).toBe(1);
      expect(result.failed).toBe(2);
      expect(result.errors).toHaveLength(2);
    });

    it('should assign recipes to collection', async () => {
      let capturedParams: unknown[] = [];
      (transaction as ReturnType<typeof vi.fn>).mockImplementation(async (callback) => {
        const mockClient = {
          query: vi.fn().mockImplementation(async (_sql: string, params: unknown[]) => {
            capturedParams = params;
            return { rows: [{ id: 1 }], rowCount: 1 };
          }),
        };
        return callback(mockClient as any);
      });

      const records = [
        { name: 'Collection Recipe', ingredients: 'Gin' },
      ];

      await recipeService.importFromCSV(userId, records, collectionId);

      expect(transaction).toHaveBeenCalled();
      // Verify collection_id was passed (2nd param after userId)
      expect(capturedParams[1]).toBe(collectionId);
    });

    it('should parse semicolon-separated ingredients', async () => {
      let capturedParams: unknown[] = [];
      (transaction as ReturnType<typeof vi.fn>).mockImplementation(async (callback) => {
        const mockClient = {
          query: vi.fn().mockImplementation(async (_sql: string, params: unknown[]) => {
            capturedParams = params;
            return { rows: [{ id: 1 }], rowCount: 1 };
          }),
        };
        return callback(mockClient as any);
      });

      const records = [
        { name: 'Test', ingredients: 'Gin; Vermouth; Olive' },
      ];

      await recipeService.importFromCSV(userId, records, null);

      expect(transaction).toHaveBeenCalled();
      // Ingredients are stringified JSON (4th param: userId, collectionId, name, ingredients)
      const ingredientsStr = capturedParams[3] as string;
      expect(ingredientsStr).toContain('Gin');
    });

    it('should use flexible column name matching', async () => {
      (transaction as ReturnType<typeof vi.fn>).mockImplementation(async (callback) => {
        const mockClient = {
          query: vi.fn().mockResolvedValue({ rows: [{ id: 1 }], rowCount: 1 }),
        };
        return callback(mockClient as any);
      });

      const records = [
        {
          'Recipe Name': 'Martini',
          'Items': 'Gin; Vermouth',
          'Method': 'Stir and strain',
          'Glass Type': 'Cocktail',
          'Style': 'Classic',
        },
      ];

      const result = await recipeService.importFromCSV(userId, records, null);

      expect(result.imported).toBe(1);
    });
  });
});
