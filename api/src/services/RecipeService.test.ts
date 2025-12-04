import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { createTestDatabase, cleanupTestDatabase } from '../tests/setup';
import { RecipeService, IMemoryService } from './RecipeService';

/**
 * Mock MemoryService for testing
 * Implements IMemoryService interface with no-op implementations
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
  let testDb: Database.Database;
  let userId: number;
  let collectionId: number;
  let recipeService: RecipeService;
  let mockMemoryService: IMemoryService;

  beforeEach(() => {
    // Create test database
    testDb = createTestDatabase();

    // Create test user
    const userResult = testDb.prepare(
      'INSERT INTO users (email, password_hash) VALUES (?, ?)'
    ).run('test@example.com', 'hashed_password');
    userId = Number(userResult.lastInsertRowid);

    // Create test collection
    const collectionResult = testDb.prepare(
      'INSERT INTO collections (user_id, name) VALUES (?, ?)'
    ).run(userId, 'Test Collection');
    collectionId = Number(collectionResult.lastInsertRowid);

    // Create mock memory service
    mockMemoryService = createMockMemoryService();

    // Create service with injected dependencies
    recipeService = new RecipeService(testDb, mockMemoryService);
  });

  afterEach(() => {
    cleanupTestDatabase(testDb);
    vi.restoreAllMocks();
  });

  describe('getAll', () => {
    it('should return empty result when user has no recipes', () => {
      const result = recipeService.getAll(userId, { page: 1, limit: 10 });

      expect(result.items).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
      expect(result.pagination.totalPages).toBe(0);
    });

    it('should return paginated recipes', () => {
      // Insert 15 recipes
      for (let i = 0; i < 15; i++) {
        testDb.prepare(
          'INSERT INTO recipes (user_id, name, ingredients) VALUES (?, ?, ?)'
        ).run(userId, `Recipe ${i}`, '["ingredient"]');
      }

      const result = recipeService.getAll(userId, { page: 1, limit: 10 });

      expect(result.items).toHaveLength(10);
      expect(result.pagination.total).toBe(15);
      expect(result.pagination.totalPages).toBe(2);
      expect(result.pagination.hasNextPage).toBe(true);
    });

    it('should parse ingredients JSON', () => {
      testDb.prepare(
        'INSERT INTO recipes (user_id, name, ingredients) VALUES (?, ?, ?)'
      ).run(userId, 'Martini', JSON.stringify(['2 oz Gin', '1 oz Vermouth']));

      const result = recipeService.getAll(userId, { page: 1, limit: 10 });

      expect(result.items).toHaveLength(1);
      expect(Array.isArray(result.items[0].ingredients)).toBe(true);
      expect(result.items[0].ingredients).toContain('2 oz Gin');
    });

    it('should not return recipes from other users', () => {
      const otherUserResult = testDb.prepare(
        'INSERT INTO users (email, password_hash) VALUES (?, ?)'
      ).run('other@example.com', 'hashed_password');
      const otherUserId = Number(otherUserResult.lastInsertRowid);

      testDb.prepare(
        'INSERT INTO recipes (user_id, name, ingredients) VALUES (?, ?, ?)'
      ).run(userId, 'My Recipe', '[]');
      testDb.prepare(
        'INSERT INTO recipes (user_id, name, ingredients) VALUES (?, ?, ?)'
      ).run(otherUserId, 'Other Recipe', '[]');

      const result = recipeService.getAll(userId, { page: 1, limit: 10 });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].name).toBe('My Recipe');
    });
  });

  describe('getById', () => {
    it('should return recipe when it exists and belongs to user', () => {
      const result = testDb.prepare(
        'INSERT INTO recipes (user_id, name, ingredients, instructions) VALUES (?, ?, ?, ?)'
      ).run(userId, 'Martini', '["Gin", "Vermouth"]', 'Stir and strain');
      const recipeId = Number(result.lastInsertRowid);

      const recipe = recipeService.getById(recipeId, userId);

      expect(recipe).not.toBeNull();
      expect(recipe!.name).toBe('Martini');
      expect(recipe!.instructions).toBe('Stir and strain');
    });

    it('should return null for non-existent recipe', () => {
      const recipe = recipeService.getById(99999, userId);

      expect(recipe).toBeNull();
    });

    it('should return null when recipe belongs to different user', () => {
      const otherUserResult = testDb.prepare(
        'INSERT INTO users (email, password_hash) VALUES (?, ?)'
      ).run('other@example.com', 'hashed_password');
      const otherUserId = Number(otherUserResult.lastInsertRowid);

      const result = testDb.prepare(
        'INSERT INTO recipes (user_id, name, ingredients) VALUES (?, ?, ?)'
      ).run(otherUserId, 'Other Recipe', '[]');
      const recipeId = Number(result.lastInsertRowid);

      const recipe = recipeService.getById(recipeId, userId);

      expect(recipe).toBeNull();
    });
  });

  describe('exists', () => {
    it('should return true when recipe exists and belongs to user', () => {
      const result = testDb.prepare(
        'INSERT INTO recipes (user_id, name, ingredients) VALUES (?, ?, ?)'
      ).run(userId, 'Test Recipe', '[]');
      const recipeId = Number(result.lastInsertRowid);

      expect(recipeService.exists(recipeId, userId)).toBe(true);
    });

    it('should return false for non-existent recipe', () => {
      expect(recipeService.exists(99999, userId)).toBe(false);
    });
  });

  describe('validateCollection', () => {
    it('should return true when collection belongs to user', () => {
      expect(recipeService.validateCollection(collectionId, userId)).toBe(true);
    });

    it('should return false for non-existent collection', () => {
      expect(recipeService.validateCollection(99999, userId)).toBe(false);
    });

    it('should return false when collection belongs to different user', () => {
      const otherUserResult = testDb.prepare(
        'INSERT INTO users (email, password_hash) VALUES (?, ?)'
      ).run('other@example.com', 'hashed_password');
      const otherUserId = Number(otherUserResult.lastInsertRowid);

      const collResult = testDb.prepare(
        'INSERT INTO collections (user_id, name) VALUES (?, ?)'
      ).run(otherUserId, 'Other Collection');
      const otherCollectionId = Number(collResult.lastInsertRowid);

      expect(recipeService.validateCollection(otherCollectionId, userId)).toBe(false);
    });
  });

  describe('sanitizeCreateInput', () => {
    it('should validate and sanitize valid input', () => {
      const result = recipeService.sanitizeCreateInput({
        name: 'Martini',
        ingredients: ['2 oz Gin', '1 oz Vermouth'],
        instructions: 'Stir and strain',
        glass: 'Cocktail Glass',
      }, userId);

      expect(result.valid).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.name).toBe('Martini');
      expect(result.data!.ingredientsStr).toBe('["2 oz Gin","1 oz Vermouth"]');
    });

    it('should fail when name is missing', () => {
      const result = recipeService.sanitizeCreateInput({
        ingredients: ['Gin'],
      } as { name: string; ingredients: string[] }, userId);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('name');
    });

    it('should fail when name is empty after sanitization', () => {
      const result = recipeService.sanitizeCreateInput({
        name: '   ',
        ingredients: ['Gin'],
      }, userId);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('empty');
    });

    it('should validate collection belongs to user', () => {
      const result = recipeService.sanitizeCreateInput({
        name: 'Test Recipe',
        collection_id: 99999,
      }, userId);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Collection not found');
    });

    it('should accept valid collection_id', () => {
      const result = recipeService.sanitizeCreateInput({
        name: 'Test Recipe',
        collection_id: collectionId,
      }, userId);

      expect(result.valid).toBe(true);
      expect(result.data!.collectionId).toBe(collectionId);
    });

    it('should handle ingredients as JSON string', () => {
      const result = recipeService.sanitizeCreateInput({
        name: 'Test Recipe',
        ingredients: '["Gin", "Tonic"]',
      }, userId);

      expect(result.valid).toBe(true);
      expect(result.data!.ingredientsStr).toBe('["Gin", "Tonic"]');
    });

    it('should fail for invalid JSON string ingredients', () => {
      const result = recipeService.sanitizeCreateInput({
        name: 'Test Recipe',
        ingredients: 'not valid json',
      }, userId);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('not valid JSON');
    });

    it('should fail when too many ingredients', () => {
      const ingredients = Array.from({ length: 101 }, (_, i) => `Ingredient ${i}`);
      const result = recipeService.sanitizeCreateInput({
        name: 'Test Recipe',
        ingredients,
      }, userId);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Too many ingredients');
    });
  });

  describe('create', () => {
    it('should create recipe with all fields', () => {
      const data = {
        name: 'Martini',
        ingredientsStr: '["2 oz Gin","1 oz Vermouth"]',
        instructions: 'Stir and strain',
        glass: 'Cocktail Glass',
        category: 'Classic',
        collectionId,
      };

      const recipe = recipeService.create(userId, data);

      expect(recipe.id).toBeDefined();
      expect(recipe.name).toBe('Martini');
      expect(recipe.instructions).toBe('Stir and strain');
      expect(recipe.collection_id).toBe(collectionId);

      // Verify MemMachine was called
      expect(mockMemoryService.storeUserRecipe).toHaveBeenCalled();
    });

    it('should create recipe with minimal fields', () => {
      const data = {
        name: 'Simple Recipe',
        ingredientsStr: '[]',
        instructions: null,
        glass: null,
        category: null,
        collectionId: null,
      };

      const recipe = recipeService.create(userId, data);

      expect(recipe.id).toBeDefined();
      expect(recipe.name).toBe('Simple Recipe');
    });
  });

  describe('update', () => {
    let recipeId: number;

    beforeEach(() => {
      const result = testDb.prepare(
        'INSERT INTO recipes (user_id, name, ingredients, instructions) VALUES (?, ?, ?, ?)'
      ).run(userId, 'Original Recipe', '["Gin"]', 'Original instructions');
      recipeId = Number(result.lastInsertRowid);
    });

    it('should update existing recipe', () => {
      const result = recipeService.update(recipeId, userId, {
        name: 'Updated Recipe',
        instructions: 'Updated instructions',
      });

      expect(result.success).toBe(true);
      expect(result.recipe).toBeDefined();
      expect(result.recipe!.name).toBe('Updated Recipe');
      expect(result.recipe!.instructions).toBe('Updated instructions');
    });

    it('should return error for non-existent recipe', () => {
      const result = recipeService.update(99999, userId, {
        name: 'Updated',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should not update recipe belonging to different user', () => {
      const otherUserResult = testDb.prepare(
        'INSERT INTO users (email, password_hash) VALUES (?, ?)'
      ).run('other@example.com', 'hashed_password');
      const otherUserId = Number(otherUserResult.lastInsertRowid);

      const otherRecipeResult = testDb.prepare(
        'INSERT INTO recipes (user_id, name, ingredients) VALUES (?, ?, ?)'
      ).run(otherUserId, 'Other Recipe', '[]');
      const otherRecipeId = Number(otherRecipeResult.lastInsertRowid);

      const result = recipeService.update(otherRecipeId, userId, {
        name: 'Hacked',
      });

      expect(result.success).toBe(false);

      // Verify original not modified
      const original = testDb.prepare(
        'SELECT name FROM recipes WHERE id = ?'
      ).get(otherRecipeId) as { name: string };
      expect(original.name).toBe('Other Recipe');
    });

    it('should validate name is string', () => {
      const result = recipeService.update(recipeId, userId, {
        name: 123 as unknown as string,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('string');
    });

    it('should fail for empty name after sanitization', () => {
      const result = recipeService.update(recipeId, userId, {
        name: '   ',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('empty');
    });

    it('should validate collection_id belongs to user', () => {
      const result = recipeService.update(recipeId, userId, {
        collection_id: 99999,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Collection not found');
    });

    it('should allow setting collection_id to null', () => {
      // First set a collection
      testDb.prepare(
        'UPDATE recipes SET collection_id = ? WHERE id = ?'
      ).run(collectionId, recipeId);

      const result = recipeService.update(recipeId, userId, {
        collection_id: null,
      });

      expect(result.success).toBe(true);
      expect(result.recipe!.collection_id).toBeNull();
    });

    it('should return current recipe when no fields to update', () => {
      const result = recipeService.update(recipeId, userId, {});

      expect(result.success).toBe(true);
      expect(result.recipe!.name).toBe('Original Recipe');
    });

    it('should reject user_id manipulation attempts (mass assignment protection)', () => {
      const otherUserResult = testDb.prepare(
        'INSERT INTO users (email, password_hash) VALUES (?, ?)'
      ).run('other@example.com', 'hashed_password');
      const otherUserId = Number(otherUserResult.lastInsertRowid);

      // Attempt to change user_id through update
      const result = recipeService.update(recipeId, userId, {
        name: 'Updated',
        user_id: otherUserId, // This should be ignored
      } as { name: string; user_id: number });

      expect(result.success).toBe(true);

      // Verify user_id was not changed
      const recipe = testDb.prepare(
        'SELECT user_id FROM recipes WHERE id = ?'
      ).get(recipeId) as { user_id: number };
      expect(recipe.user_id).toBe(userId);
    });
  });

  describe('delete', () => {
    it('should delete existing recipe', () => {
      const result = testDb.prepare(
        'INSERT INTO recipes (user_id, name, ingredients) VALUES (?, ?, ?)'
      ).run(userId, 'To Delete', '[]');
      const recipeId = Number(result.lastInsertRowid);

      const deleteResult = recipeService.delete(recipeId, userId);

      expect(deleteResult.success).toBe(true);
      expect(recipeService.exists(recipeId, userId)).toBe(false);
    });

    it('should return error for non-existent recipe', () => {
      const result = recipeService.delete(99999, userId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should not delete recipe belonging to different user', () => {
      const otherUserResult = testDb.prepare(
        'INSERT INTO users (email, password_hash) VALUES (?, ?)'
      ).run('other@example.com', 'hashed_password');
      const otherUserId = Number(otherUserResult.lastInsertRowid);

      const otherRecipeResult = testDb.prepare(
        'INSERT INTO recipes (user_id, name, ingredients) VALUES (?, ?, ?)'
      ).run(otherUserId, 'Other Recipe', '[]');
      const otherRecipeId = Number(otherRecipeResult.lastInsertRowid);

      const result = recipeService.delete(otherRecipeId, userId);

      expect(result.success).toBe(false);

      // Verify recipe still exists
      const exists = testDb.prepare(
        'SELECT id FROM recipes WHERE id = ?'
      ).get(otherRecipeId);
      expect(exists).toBeDefined();
    });
  });

  describe('deleteAll', () => {
    it('should delete all recipes for user', () => {
      for (let i = 0; i < 5; i++) {
        testDb.prepare(
          'INSERT INTO recipes (user_id, name, ingredients) VALUES (?, ?, ?)'
        ).run(userId, `Recipe ${i}`, '[]');
      }

      const deleted = recipeService.deleteAll(userId);

      expect(deleted).toBe(5);

      const remaining = testDb.prepare(
        'SELECT COUNT(*) as count FROM recipes WHERE user_id = ?'
      ).get(userId) as { count: number };
      expect(remaining.count).toBe(0);
    });

    it('should not delete recipes from other users', () => {
      const otherUserResult = testDb.prepare(
        'INSERT INTO users (email, password_hash) VALUES (?, ?)'
      ).run('other@example.com', 'hashed_password');
      const otherUserId = Number(otherUserResult.lastInsertRowid);

      testDb.prepare(
        'INSERT INTO recipes (user_id, name, ingredients) VALUES (?, ?, ?)'
      ).run(userId, 'My Recipe', '[]');
      testDb.prepare(
        'INSERT INTO recipes (user_id, name, ingredients) VALUES (?, ?, ?)'
      ).run(otherUserId, 'Other Recipe', '[]');

      recipeService.deleteAll(userId);

      // Verify other user's recipe still exists
      const otherRecipes = testDb.prepare(
        'SELECT COUNT(*) as count FROM recipes WHERE user_id = ?'
      ).get(otherUserId) as { count: number };
      expect(otherRecipes.count).toBe(1);
    });
  });

  describe('bulkDelete', () => {
    it('should delete multiple recipes', () => {
      const ids: number[] = [];
      for (let i = 0; i < 5; i++) {
        const result = testDb.prepare(
          'INSERT INTO recipes (user_id, name, ingredients) VALUES (?, ?, ?)'
        ).run(userId, `Recipe ${i}`, '[]');
        ids.push(Number(result.lastInsertRowid));
      }

      const deleted = recipeService.bulkDelete(ids.slice(0, 3), userId);

      expect(deleted).toBe(3);

      const remaining = testDb.prepare(
        'SELECT COUNT(*) as count FROM recipes WHERE user_id = ?'
      ).get(userId) as { count: number };
      expect(remaining.count).toBe(2);
    });

    it('should only delete recipes belonging to user', () => {
      const otherUserResult = testDb.prepare(
        'INSERT INTO users (email, password_hash) VALUES (?, ?)'
      ).run('other@example.com', 'hashed_password');
      const otherUserId = Number(otherUserResult.lastInsertRowid);

      const myRecipe = testDb.prepare(
        'INSERT INTO recipes (user_id, name, ingredients) VALUES (?, ?, ?)'
      ).run(userId, 'My Recipe', '[]');
      const otherRecipe = testDb.prepare(
        'INSERT INTO recipes (user_id, name, ingredients) VALUES (?, ?, ?)'
      ).run(otherUserId, 'Other Recipe', '[]');

      const deleted = recipeService.bulkDelete(
        [Number(myRecipe.lastInsertRowid), Number(otherRecipe.lastInsertRowid)],
        userId
      );

      expect(deleted).toBe(1);

      // Verify other user's recipe still exists
      const other = testDb.prepare(
        'SELECT id FROM recipes WHERE id = ?'
      ).get(otherRecipe.lastInsertRowid);
      expect(other).toBeDefined();
    });
  });

  describe('importFromCSV', () => {
    it('should import valid records', () => {
      const records = [
        { name: 'Martini', ingredients: 'Gin; Vermouth', instructions: 'Stir and strain' },
        { name: 'Negroni', ingredients: 'Gin; Campari; Sweet Vermouth' },
        { name: 'Daiquiri', ingredients: 'Rum, Lime Juice, Simple Syrup' },
      ];

      const result = recipeService.importFromCSV(userId, records, null);

      expect(result.imported).toBe(3);
      expect(result.failed).toBe(0);
      expect(result.errors).toHaveLength(0);

      // Verify recipes in database
      const recipes = testDb.prepare(
        'SELECT * FROM recipes WHERE user_id = ?'
      ).all(userId);
      expect(recipes).toHaveLength(3);

      // Verify MemMachine batch was called
      expect(mockMemoryService.storeUserRecipesBatch).toHaveBeenCalled();
    });

    it('should track failed records', () => {
      const records = [
        { name: 'Valid Recipe', ingredients: 'Gin' },
        { ingredients: 'No name' }, // Missing name
        { name: '' }, // Empty name
      ];

      const result = recipeService.importFromCSV(userId, records, null);

      expect(result.imported).toBe(1);
      expect(result.failed).toBe(2);
      expect(result.errors).toHaveLength(2);
    });

    it('should assign recipes to collection', () => {
      const records = [
        { name: 'Collection Recipe', ingredients: 'Gin' },
      ];

      recipeService.importFromCSV(userId, records, collectionId);

      const recipe = testDb.prepare(
        'SELECT collection_id FROM recipes WHERE name = ?'
      ).get('Collection Recipe') as { collection_id: number };
      expect(recipe.collection_id).toBe(collectionId);
    });

    it('should parse semicolon-separated ingredients', () => {
      const records = [
        { name: 'Test', ingredients: 'Gin; Vermouth; Olive' },
      ];

      recipeService.importFromCSV(userId, records, null);

      const recipe = testDb.prepare(
        'SELECT ingredients FROM recipes WHERE name = ?'
      ).get('Test') as { ingredients: string };
      const ingredients = JSON.parse(recipe.ingredients);
      expect(ingredients).toHaveLength(3);
      expect(ingredients).toContain('Gin');
      expect(ingredients).toContain('Vermouth');
      expect(ingredients).toContain('Olive');
    });

    it('should parse pipe-separated ingredients', () => {
      const records = [
        { name: 'Test', ingredients: 'Gin | Vermouth | Olive' },
      ];

      recipeService.importFromCSV(userId, records, null);

      const recipe = testDb.prepare(
        'SELECT ingredients FROM recipes WHERE name = ?'
      ).get('Test') as { ingredients: string };
      const ingredients = JSON.parse(recipe.ingredients);
      expect(ingredients).toHaveLength(3);
    });

    it('should parse comma-separated ingredients', () => {
      const records = [
        { name: 'Test', ingredients: 'Gin, Vermouth, Olive' },
      ];

      recipeService.importFromCSV(userId, records, null);

      const recipe = testDb.prepare(
        'SELECT ingredients FROM recipes WHERE name = ?'
      ).get('Test') as { ingredients: string };
      const ingredients = JSON.parse(recipe.ingredients);
      expect(ingredients).toHaveLength(3);
    });

    it('should use flexible column name matching', () => {
      const records = [
        {
          'Recipe Name': 'Martini',
          'Items': 'Gin; Vermouth',
          'Method': 'Stir and strain',
          'Glass Type': 'Cocktail',
          'Style': 'Classic',
        },
      ];

      recipeService.importFromCSV(userId, records, null);

      const recipe = testDb.prepare(
        'SELECT * FROM recipes WHERE name = ?'
      ).get('Martini') as { instructions: string; glass: string; category: string } | undefined;
      expect(recipe).toBeDefined();
      expect(recipe!.instructions).toBe('Stir and strain');
      expect(recipe!.glass).toBe('Cocktail');
      expect(recipe!.category).toBe('Classic');
    });
  });
});
