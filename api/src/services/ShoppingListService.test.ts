/**
 * ShoppingListService Tests
 *
 * Tests for ingredient parsing, matching, and shopping recommendations.
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
import { shoppingListService, BottleData, ShoppingListItem } from './ShoppingListService';

describe('ShoppingListService', () => {
  const testUserId = 8888;
  const otherUserId = 8887;

  // Helper to create mock shopping list item
  const createMockItem = (overrides: Partial<ShoppingListItem> = {}): ShoppingListItem => ({
    id: 1,
    user_id: testUserId,
    name: 'Test Item',
    checked: false,
    created_at: new Date().toISOString(),
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (execute as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [], rowCount: 0 });
  });

  describe('parseIngredientName', () => {
    it('should extract ingredient from measurement string', () => {
      expect(shoppingListService.parseIngredientName('2 oz Bourbon')).toBe('bourbon');
      expect(shoppingListService.parseIngredientName('1.5 oz Rum')).toBe('rum');
      expect(shoppingListService.parseIngredientName('3/4 oz Lime Juice')).toBe('lime juice');
    });

    it('should handle dashes in measurements', () => {
      expect(shoppingListService.parseIngredientName('2 dashes Angostura Bitters')).toBe('bitters');
      expect(shoppingListService.parseIngredientName('3 drops Orange Bitters')).toBe('orange bitters');
    });

    it('should remove brand prefixes', () => {
      expect(shoppingListService.parseIngredientName('Angostura Bitters')).toBe('bitters');
      expect(shoppingListService.parseIngredientName('Luxardo Maraschino')).toBe('maraschino');
    });

    it('should handle boolean operators (or)', () => {
      const result = shoppingListService.parseIngredientName('Bourbon or Rye');
      expect(result).toEqual(['bourbon', 'rye']);
    });

    it('should handle empty/invalid input', () => {
      expect(shoppingListService.parseIngredientName('')).toBe('');
      expect(shoppingListService.parseIngredientName(null as any)).toBe('');
      expect(shoppingListService.parseIngredientName(undefined as any)).toBe('');
    });

    it('should normalize aged rum indicators', () => {
      const result = shoppingListService.parseIngredientName('Anejo Rum');
      expect(typeof result).toBe('string');
    });

    it('should filter non-ingredient phrases', () => {
      expect(shoppingListService.parseIngredientName('Garnish with lime')).toBe('');
      expect(shoppingListService.parseIngredientName('See resources for more')).toBe('');
    });

    it('should handle complex syrup names', () => {
      const result = shoppingListService.parseIngredientName('1 oz Rich Demerara Syrup');
      expect(result).toContain('demerara');
      expect(result).toContain('syrup');
    });

    it('should remove parenthetical content', () => {
      const result = shoppingListService.parseIngredientName('Rum (preferably Jamaican)');
      expect(result).not.toContain('preferably');
      expect(result).not.toContain('jamaican');
    });
  });

  describe('hasIngredient', () => {
    const bottles: BottleData[] = [
      { name: 'Plantation 3 Stars', liquorType: 'Rum', detailedClassification: 'White Rum' },
      { name: 'Buffalo Trace', liquorType: 'Bourbon', detailedClassification: 'Kentucky Straight Bourbon' },
      { name: 'Campari', liquorType: 'Bitter Liqueur', detailedClassification: null },
      { name: 'Sweet Vermouth', liquorType: 'Vermouth', detailedClassification: 'Sweet Vermouth' },
    ];

    it('should match exact bottle name', () => {
      expect(shoppingListService['hasIngredient'](bottles, 'campari')).toBe(true);
    });

    it('should match by liquor type', () => {
      expect(shoppingListService['hasIngredient'](bottles, 'bourbon')).toBe(true);
      expect(shoppingListService['hasIngredient'](bottles, 'rum')).toBe(true);
    });

    it('should match by classification', () => {
      expect(shoppingListService['hasIngredient'](bottles, 'white rum')).toBe(true);
      expect(shoppingListService['hasIngredient'](bottles, 'sweet vermouth')).toBe(true);
    });

    it('should return false for missing ingredients', () => {
      expect(shoppingListService['hasIngredient'](bottles, 'tequila')).toBe(false);
      expect(shoppingListService['hasIngredient'](bottles, 'gin')).toBe(false);
    });

    it('should match synonyms', () => {
      expect(shoppingListService['hasIngredient'](bottles, 'light rum')).toBe(true);
      expect(shoppingListService['hasIngredient'](bottles, 'silver rum')).toBe(true);
    });

    it('should match pantry items without bottles', () => {
      expect(shoppingListService['hasIngredient']([], 'ice')).toBe(true);
      expect(shoppingListService['hasIngredient']([], 'sugar')).toBe(true);
      expect(shoppingListService['hasIngredient']([], 'mint')).toBe(true);
      expect(shoppingListService['hasIngredient']([], 'egg white')).toBe(true);
      expect(shoppingListService['hasIngredient']([], 'nutmeg')).toBe(true);
    });

    it('should handle empty ingredient', () => {
      expect(shoppingListService['hasIngredient'](bottles, '')).toBe(false);
    });
  });

  describe('isCraftable', () => {
    const bottles: BottleData[] = [
      { name: 'White Rum', liquorType: 'Rum', detailedClassification: 'White Rum' },
      { name: 'Simple Syrup', liquorType: 'Syrup', detailedClassification: null },
    ];

    it('should return true when all ingredients available', () => {
      const ingredients = ['2 oz White Rum', '0.75 oz Simple Syrup', 'Ice'];
      expect(shoppingListService.isCraftable(ingredients, bottles)).toBe(true);
    });

    it('should return false when missing ingredients', () => {
      const ingredients = ['2 oz Bourbon', '1 oz Sweet Vermouth', '2 dashes Bitters'];
      expect(shoppingListService.isCraftable(ingredients, bottles)).toBe(false);
    });

    it('should return true with boolean OR ingredients when one available', () => {
      const ingredients = ['2 oz Bourbon or Rum'];
      expect(shoppingListService.isCraftable(ingredients, bottles)).toBe(true);
    });

    it('should return false for empty ingredients array', () => {
      expect(shoppingListService.isCraftable([], bottles)).toBe(false);
    });

    it('should handle empty ingredient strings gracefully', () => {
      const ingredients = ['2 oz White Rum', '', '0.75 oz Simple Syrup'];
      expect(shoppingListService.isCraftable(ingredients, bottles)).toBe(true);
    });
  });

  describe('findMissingIngredients', () => {
    const bottles: BottleData[] = [
      { name: 'Bourbon', liquorType: 'Bourbon', detailedClassification: null },
    ];

    it('should return list of missing ingredients', () => {
      const ingredients = ['2 oz Bourbon', '1 oz Sweet Vermouth', '2 dashes Bitters'];
      const missing = shoppingListService.findMissingIngredients(ingredients, bottles);

      expect(missing).toContain('sweet vermouth');
      expect(missing).toContain('bitters');
      expect(missing).not.toContain('bourbon');
    });

    it('should return empty array when all available', () => {
      const ingredients = ['2 oz Bourbon', '1 oz Sugar', 'Ice'];
      const missing = shoppingListService.findMissingIngredients(ingredients, bottles);

      expect(missing).toHaveLength(0);
    });

    it('should handle OR ingredients', () => {
      const bottles: BottleData[] = [
        { name: 'Rye Whiskey', liquorType: 'Rye', detailedClassification: null },
      ];
      const ingredients = ['2 oz Bourbon or Rye'];
      const missing = shoppingListService.findMissingIngredients(ingredients, bottles);

      expect(missing).toHaveLength(0);
    });

    it('should list OR alternatives when none available', () => {
      const ingredients = ['2 oz Bourbon or Rye'];
      const missing = shoppingListService.findMissingIngredients(ingredients, []);

      expect(missing).toHaveLength(1);
      expect(missing[0]).toContain('or');
    });
  });

  describe('Shopping List CRUD', () => {
    describe('addItem', () => {
      it('should add item to shopping list', async () => {
        const mockItem = createMockItem({ name: 'Campari' });
        (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null); // No duplicate
        (execute as ReturnType<typeof vi.fn>).mockResolvedValue({
          rows: [mockItem],
          rowCount: 1,
        });

        const item = await shoppingListService.addItem(testUserId, 'Campari');

        expect(item).not.toBeNull();
        expect(item!.name).toBe('Campari');
        expect(item!.checked).toBe(false);
      });

      it('should trim whitespace', async () => {
        const mockItem = createMockItem({ name: 'Campari' });
        (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);
        (execute as ReturnType<typeof vi.fn>).mockResolvedValue({
          rows: [mockItem],
          rowCount: 1,
        });

        const item = await shoppingListService.addItem(testUserId, '  Campari  ');

        expect(item!.name).toBe('Campari');
      });

      it('should return null for duplicate (case insensitive)', async () => {
        (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 1 }); // Duplicate exists

        const duplicate = await shoppingListService.addItem(testUserId, 'CAMPARI');

        expect(duplicate).toBeNull();
      });
    });

    describe('getItems', () => {
      it('should return all items for user', async () => {
        const mockItems = [
          createMockItem({ id: 1, name: 'Item 1' }),
          createMockItem({ id: 2, name: 'Item 2' }),
        ];
        (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue(mockItems);

        const items = await shoppingListService.getItems(testUserId);

        expect(items).toHaveLength(2);
      });

      it('should return empty array for user with no items', async () => {
        (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue([]);

        const items = await shoppingListService.getItems(testUserId);

        expect(items).toEqual([]);
      });
    });

    describe('updateItem', () => {
      it('should update checked status', async () => {
        const updatedItem = createMockItem({ id: 1, name: 'Test Item', checked: true });
        (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 1 }); // Exists
        (execute as ReturnType<typeof vi.fn>).mockResolvedValue({
          rows: [updatedItem],
          rowCount: 1,
        });

        const updated = await shoppingListService.updateItem(testUserId, 1, { checked: true });

        expect(updated!.checked).toBe(true);
      });

      it('should update name', async () => {
        const updatedItem = createMockItem({ id: 1, name: 'New Name' });
        (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 1 });
        (execute as ReturnType<typeof vi.fn>).mockResolvedValue({
          rows: [updatedItem],
          rowCount: 1,
        });

        const updated = await shoppingListService.updateItem(testUserId, 1, { name: 'New Name' });

        expect(updated!.name).toBe('New Name');
      });

      it('should return null for non-existent item', async () => {
        (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const updated = await shoppingListService.updateItem(testUserId, 99999, { checked: true });

        expect(updated).toBeNull();
      });

      it('should return null for wrong user', async () => {
        (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const updated = await shoppingListService.updateItem(otherUserId, 1, { checked: true });

        expect(updated).toBeNull();
      });

      it('should return null for empty updates', async () => {
        (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 1 });

        const updated = await shoppingListService.updateItem(testUserId, 1, {});

        expect(updated).toBeNull();
      });
    });

    describe('deleteItem', () => {
      it('should delete item and return true', async () => {
        (execute as ReturnType<typeof vi.fn>).mockResolvedValue({ rowCount: 1 });

        const result = await shoppingListService.deleteItem(testUserId, 1);

        expect(result).toBe(true);
      });

      it('should return false for non-existent item', async () => {
        (execute as ReturnType<typeof vi.fn>).mockResolvedValue({ rowCount: 0 });

        const result = await shoppingListService.deleteItem(testUserId, 99999);

        expect(result).toBe(false);
      });

      it('should return false for wrong user', async () => {
        (execute as ReturnType<typeof vi.fn>).mockResolvedValue({ rowCount: 0 });

        const result = await shoppingListService.deleteItem(otherUserId, 1);

        expect(result).toBe(false);
      });
    });

    describe('deleteCheckedItems', () => {
      it('should delete only checked items and return count', async () => {
        (execute as ReturnType<typeof vi.fn>).mockResolvedValue({ rowCount: 1 });

        const deleted = await shoppingListService.deleteCheckedItems(testUserId);

        expect(deleted).toBe(1);
      });

      it('should return 0 when no checked items', async () => {
        (execute as ReturnType<typeof vi.fn>).mockResolvedValue({ rowCount: 0 });

        const deleted = await shoppingListService.deleteCheckedItems(testUserId);

        expect(deleted).toBe(0);
      });
    });
  });

  describe('getSmartRecommendations', () => {
    it('should return stats about recipes', async () => {
      // Mock inventory
      (queryAll as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce([ // getUserBottles
          { name: 'White Rum', liquorType: 'Rum', detailedClassification: 'White Rum', stockNumber: 1 },
          { name: 'Lime Juice', liquorType: 'Citrus', detailedClassification: null, stockNumber: 1 },
        ])
        .mockResolvedValueOnce([ // getUserRecipes
          { id: 1, name: 'Daiquiri', ingredients: JSON.stringify(['2 oz White Rum', '1 oz Lime Juice', '0.75 oz Simple Syrup']) },
          { id: 2, name: 'Mojito', ingredients: JSON.stringify(['2 oz White Rum', '1 oz Lime Juice', 'Mint', 'Simple Syrup', 'Club Soda']) },
          { id: 3, name: 'Negroni', ingredients: JSON.stringify(['1 oz Gin', '1 oz Campari', '1 oz Sweet Vermouth']) },
        ]);

      const result = await shoppingListService.getSmartRecommendations(testUserId);

      expect(result.stats.totalRecipes).toBe(3);
      expect(result.stats.inventoryItems).toBe(2);
    });

    it('should identify craftable recipes', async () => {
      (queryAll as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce([
          { name: 'White Rum', liquorType: 'Rum', detailedClassification: 'White Rum', stockNumber: 1 },
        ])
        .mockResolvedValueOnce([
          { id: 1, name: 'Simple Drink', ingredients: JSON.stringify(['2 oz White Rum', 'Ice']) },
        ]);

      const result = await shoppingListService.getSmartRecommendations(testUserId);

      expect(result.craftableRecipes).toBeDefined();
      expect(Array.isArray(result.craftableRecipes)).toBe(true);
    });

    it('should identify near-miss recipes', async () => {
      (queryAll as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce([
          { name: 'White Rum', liquorType: 'Rum', detailedClassification: 'White Rum', stockNumber: 1 },
        ])
        .mockResolvedValueOnce([
          { id: 1, name: 'Cuba Libre', ingredients: JSON.stringify(['2 oz White Rum', '4 oz Cola', 'Lime']) },
        ]);

      const result = await shoppingListService.getSmartRecommendations(testUserId);

      expect(result.nearMissRecipes).toBeDefined();
      expect(Array.isArray(result.nearMissRecipes)).toBe(true);
      result.nearMissRecipes.forEach(r => {
        expect(r.missingIngredient).toBeDefined();
      });
    });

    it('should generate recommendations sorted by unlock count', async () => {
      (queryAll as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce([
          { name: 'White Rum', liquorType: 'Rum', detailedClassification: 'White Rum', stockNumber: 1 },
        ])
        .mockResolvedValueOnce([
          { id: 1, name: 'Gin Tonic', ingredients: JSON.stringify(['2 oz Gin', '4 oz Tonic']) },
          { id: 2, name: 'Gimlet', ingredients: JSON.stringify(['2 oz Gin', '1 oz Lime']) },
          { id: 3, name: 'Martini', ingredients: JSON.stringify(['2 oz Gin', '1 oz Vermouth']) },
        ]);

      const result = await shoppingListService.getSmartRecommendations(testUserId);

      expect(result.recommendations).toBeDefined();
      expect(Array.isArray(result.recommendations)).toBe(true);

      if (result.recommendations.length >= 2) {
        expect(result.recommendations[0].unlocks).toBeGreaterThanOrEqual(result.recommendations[1].unlocks);
      }

      result.recommendations.forEach(r => {
        expect(r.ingredient).toBeDefined();
        expect(typeof r.unlocks).toBe('number');
      });
    });
  });

  describe('getUserBottles', () => {
    it('should return bottles with stock > 0', async () => {
      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue([
        { name: 'In Stock', liquorType: 'Spirit', detailedClassification: null, stockNumber: 2 },
      ]);

      const bottles = await shoppingListService.getUserBottles(testUserId);

      expect(bottles).toHaveLength(1);
      expect(bottles[0].name).toBe('In Stock');
    });

    it('should return empty array for user with no inventory', async () => {
      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const bottles = await shoppingListService.getUserBottles(testUserId);

      expect(bottles).toEqual([]);
    });
  });

  describe('getUserRecipes', () => {
    it('should return parsed recipes', async () => {
      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 1, name: 'Test Recipe', ingredients: JSON.stringify(['Ingredient 1', 'Ingredient 2']) },
      ]);

      const recipes = await shoppingListService.getUserRecipes(testUserId);

      expect(recipes).toHaveLength(1);
      expect(recipes[0].name).toBe('Test Recipe');
      expect(recipes[0].ingredients).toEqual(['Ingredient 1', 'Ingredient 2']);
    });

    it('should handle malformed JSON gracefully', async () => {
      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 1, name: 'Bad Recipe', ingredients: 'not valid json' },
      ]);

      const recipes = await shoppingListService.getUserRecipes(testUserId);

      expect(recipes).toHaveLength(1);
      expect(recipes[0].ingredients).toEqual([]);
    });
  });

  describe('getItemsPaginated', () => {
    it('should return paginated results with metadata', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue({ total: '15' });
      const mockItems = Array.from({ length: 5 }, (_, i) =>
        createMockItem({ id: i + 1, name: `Item ${i + 1}` })
      );
      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue(mockItems);

      const result = await shoppingListService.getItemsPaginated(testUserId, 1, 5);

      expect(result.items).toHaveLength(5);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(5);
      expect(result.pagination.total).toBe(15);
      expect(result.pagination.totalPages).toBe(3);
      expect(result.pagination.hasNextPage).toBe(true);
      expect(result.pagination.hasPreviousPage).toBe(false);
    });

    it('should clamp page to minimum 1', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue({ total: '10' });
      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const result = await shoppingListService.getItemsPaginated(testUserId, -5, 5);

      expect(result.pagination.page).toBe(1);
    });

    it('should clamp limit to maximum 100', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue({ total: '10' });
      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const result = await shoppingListService.getItemsPaginated(testUserId, 1, 500);

      expect(result.pagination.limit).toBe(100);
    });
  });
});
