/**
 * InventoryService Tests
 *
 * Tests for inventory item management service.
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

import { queryOne, queryAll, execute, transaction } from '../database/db';
import { InventoryService, VALID_CATEGORIES } from './InventoryService';
import { InventoryItem } from '../types';

describe('InventoryService', () => {
  let inventoryService: InventoryService;
  const userId = 1;
  const otherUserId = 2;

  // Helper to create mock inventory item
  const createMockItem = (overrides: Partial<InventoryItem> = {}): InventoryItem => ({
    id: 1,
    user_id: userId,
    name: 'Test Item',
    category: 'spirit',
    type: null,
    abv: null,
    stock_number: null,
    spirit_classification: null,
    distillation_method: null,
    distillery_location: null,
    age_statement: null,
    additional_notes: null,
    profile_nose: null,
    palate: null,
    finish: null,
    tasting_notes: null,
    periodic_group: null,
    periodic_period: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    inventoryService = new InventoryService();

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
    it('should return empty result when user has no items', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue({ total: '0' });
      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const result = await inventoryService.getAll(userId, { page: 1, limit: 10 });

      expect(result.items).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
      expect(result.pagination.totalPages).toBe(0);
      expect(result.pagination.hasNextPage).toBe(false);
      expect(result.pagination.hasPreviousPage).toBe(false);
    });

    it('should return paginated items', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue({ total: '15' });
      const mockItems = Array.from({ length: 10 }, (_, i) =>
        createMockItem({ id: i + 1, name: `Item ${i}` })
      );
      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue(mockItems);

      const result = await inventoryService.getAll(userId, { page: 1, limit: 10 });

      expect(result.items).toHaveLength(10);
      expect(result.pagination.total).toBe(15);
      expect(result.pagination.totalPages).toBe(2);
      expect(result.pagination.hasNextPage).toBe(true);
      expect(result.pagination.hasPreviousPage).toBe(false);
    });

    it('should return second page correctly', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue({ total: '15' });
      const mockItems = Array.from({ length: 5 }, (_, i) =>
        createMockItem({ id: i + 11, name: `Item ${i + 10}` })
      );
      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue(mockItems);

      const result = await inventoryService.getAll(userId, { page: 2, limit: 10 });

      expect(result.items).toHaveLength(5);
      expect(result.pagination.page).toBe(2);
      expect(result.pagination.hasNextPage).toBe(false);
      expect(result.pagination.hasPreviousPage).toBe(true);
    });

    it('should filter by category', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue({ total: '2' });
      const mockItems = [
        createMockItem({ id: 1, name: 'Vodka', category: 'spirit' }),
        createMockItem({ id: 2, name: 'Whiskey', category: 'spirit' }),
      ];
      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue(mockItems);

      const result = await inventoryService.getAll(userId, { page: 1, limit: 10 }, 'spirit');

      expect(result.items).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
      result.items.forEach(item => {
        expect(item.category).toBe('spirit');
      });
    });

    it('should not return items from other users', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue({ total: '1' });
      const mockItems = [createMockItem({ name: 'My Item' })];
      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue(mockItems);

      const result = await inventoryService.getAll(userId, { page: 1, limit: 10 });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].name).toBe('My Item');

      // Verify query was called with correct user ID
      expect(queryAll).toHaveBeenCalledWith(
        expect.stringContaining('user_id = $1'),
        expect.arrayContaining([userId])
      );
    });
  });

  describe('getCategoryCounts', () => {
    it('should return zero counts when user has no items', async () => {
      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const counts = await inventoryService.getCategoryCounts(userId);

      expect(counts.all).toBe(0);
      expect(counts.spirit).toBe(0);
      expect(counts.liqueur).toBe(0);
      expect(counts.mixer).toBe(0);
    });

    it('should return correct counts by category', async () => {
      // First call is for total count
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue({ total: '4' });
      // Second call is for category breakdown
      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue([
        { category: 'spirit', count: '2' },
        { category: 'garnish', count: '1' },
        { category: 'mixer', count: '1' },
      ]);

      const counts = await inventoryService.getCategoryCounts(userId);

      expect(counts.all).toBe(4);
      expect(counts.spirit).toBe(2);
      expect(counts.garnish).toBe(1);
      expect(counts.mixer).toBe(1);
      expect(counts.liqueur).toBe(0);
    });
  });

  describe('getById', () => {
    it('should return item when it exists and belongs to user', async () => {
      const mockItem = createMockItem({ name: 'Test Item', category: 'spirit' });
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(mockItem);

      const item = await inventoryService.getById(1, userId);

      expect(item).not.toBeNull();
      expect(item!.name).toBe('Test Item');
      expect(item!.category).toBe('spirit');
    });

    it('should return null for non-existent item', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const item = await inventoryService.getById(99999, userId);

      expect(item).toBeNull();
    });

    it('should return null when item belongs to different user', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const item = await inventoryService.getById(1, userId);

      expect(item).toBeNull();
    });
  });

  describe('exists', () => {
    it('should return true when item exists and belongs to user', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 1 });

      const result = await inventoryService.exists(1, userId);

      expect(result).toBe(true);
    });

    it('should return false for non-existent item', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await inventoryService.exists(99999, userId);

      expect(result).toBe(false);
    });

    it('should return false when item belongs to different user', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await inventoryService.exists(1, otherUserId);

      expect(result).toBe(false);
    });
  });

  describe('create', () => {
    it('should create item with all fields', async () => {
      const mockItem = createMockItem({
        name: 'Test Vodka',
        category: 'spirit',
        type: 'Vodka',
        abv: '40%',
        stock_number: 2,
      });
      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [mockItem],
        rowCount: 1,
      });

      const data = {
        name: 'Test Vodka',
        category: 'spirit' as const,
        type: 'Vodka',
        abv: '40%',
        stock_number: 2,
        spirit_classification: 'Premium',
        distillation_method: 'Column',
        distillery_location: 'Poland',
        age_statement: null,
        additional_notes: 'Great for cocktails',
        profile_nose: 'Clean',
        palate: 'Smooth',
        finish: 'Crisp',
        tasting_notes: null,
        periodic_group: null,
        periodic_period: null,
      };

      const item = await inventoryService.create(userId, data);

      expect(item.id).toBeDefined();
      expect(item.name).toBe('Test Vodka');
      expect(item.category).toBe('spirit');
    });

    it('should create item with minimal fields', async () => {
      const mockItem = createMockItem({ name: 'Simple Item', category: 'other' });
      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [mockItem],
        rowCount: 1,
      });

      const data = {
        name: 'Simple Item',
        category: 'other' as const,
        type: null,
        abv: null,
        stock_number: null,
        spirit_classification: null,
        distillation_method: null,
        distillery_location: null,
        age_statement: null,
        additional_notes: null,
        profile_nose: null,
        palate: null,
        finish: null,
        tasting_notes: null,
        periodic_group: null,
        periodic_period: null,
      };

      const item = await inventoryService.create(userId, data);

      expect(item.id).toBeDefined();
      expect(item.name).toBe('Simple Item');
      expect(item.category).toBe('other');
    });

    it('should normalize zero stock to null', async () => {
      const mockItem = createMockItem({ name: 'Out of Stock', stock_number: null });
      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [mockItem],
        rowCount: 1,
      });

      const data = {
        name: 'Out of Stock',
        category: 'spirit' as const,
        type: null,
        abv: null,
        stock_number: 0,
        spirit_classification: null,
        distillation_method: null,
        distillery_location: null,
        age_statement: null,
        additional_notes: null,
        profile_nose: null,
        palate: null,
        finish: null,
        tasting_notes: null,
        periodic_group: null,
        periodic_period: null,
      };

      const item = await inventoryService.create(userId, data);

      expect(item.stock_number).toBeNull();
    });

    it('should normalize negative stock to null', async () => {
      const mockItem = createMockItem({ name: 'Negative Stock', stock_number: null });
      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [mockItem],
        rowCount: 1,
      });

      const data = {
        name: 'Negative Stock',
        category: 'spirit' as const,
        type: null,
        abv: null,
        stock_number: -5,
        spirit_classification: null,
        distillation_method: null,
        distillery_location: null,
        age_statement: null,
        additional_notes: null,
        profile_nose: null,
        palate: null,
        finish: null,
        tasting_notes: null,
        periodic_group: null,
        periodic_period: null,
      };

      const item = await inventoryService.create(userId, data);

      expect(item.stock_number).toBeNull();
    });
  });

  describe('update', () => {
    it('should update existing item', async () => {
      // First exists check
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: 1 });
      // Then update returns updated item
      const mockItem = createMockItem({
        name: 'Updated Name',
        category: 'liqueur',
        type: 'Herbal',
      });
      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [mockItem],
        rowCount: 1,
      });

      const data = {
        name: 'Updated Name',
        category: 'liqueur' as const,
        type: 'Herbal',
        abv: '30%',
        stock_number: 3,
        spirit_classification: null,
        distillation_method: null,
        distillery_location: null,
        age_statement: null,
        additional_notes: null,
        profile_nose: null,
        palate: null,
        finish: null,
        tasting_notes: null,
        periodic_group: null,
        periodic_period: null,
      };

      const item = await inventoryService.update(1, userId, data);

      expect(item).not.toBeNull();
      expect(item!.name).toBe('Updated Name');
      expect(item!.category).toBe('liqueur');
      expect(item!.type).toBe('Herbal');
    });

    it('should return null for non-existent item', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const data = {
        name: 'Updated Name',
        category: 'spirit' as const,
        type: null,
        abv: null,
        stock_number: null,
        spirit_classification: null,
        distillation_method: null,
        distillery_location: null,
        age_statement: null,
        additional_notes: null,
        profile_nose: null,
        palate: null,
        finish: null,
        tasting_notes: null,
        periodic_group: null,
        periodic_period: null,
      };

      const item = await inventoryService.update(99999, userId, data);

      expect(item).toBeNull();
    });

    it('should return null when updating item belonging to different user', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const data = {
        name: 'Hacked',
        category: 'spirit' as const,
        type: null,
        abv: null,
        stock_number: null,
        spirit_classification: null,
        distillation_method: null,
        distillery_location: null,
        age_statement: null,
        additional_notes: null,
        profile_nose: null,
        palate: null,
        finish: null,
        tasting_notes: null,
        periodic_group: null,
        periodic_period: null,
      };

      const item = await inventoryService.update(1, userId, data);

      expect(item).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete existing item', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: 1 });
      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({ rowCount: 1 });

      const deleted = await inventoryService.delete(1, userId);

      expect(deleted).toBe(true);
    });

    it('should return false for non-existent item', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const deleted = await inventoryService.delete(99999, userId);

      expect(deleted).toBe(false);
    });

    it('should return false when deleting item belonging to different user', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const deleted = await inventoryService.delete(1, otherUserId);

      expect(deleted).toBe(false);
    });
  });

  describe('bulkDelete', () => {
    it('should delete multiple items', async () => {
      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({ rowCount: 3 });

      const deleted = await inventoryService.bulkDelete([1, 2, 3], userId);

      expect(deleted).toBe(3);
    });

    it('should only delete items belonging to user', async () => {
      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({ rowCount: 1 });

      const deleted = await inventoryService.bulkDelete([1, 2], userId);

      expect(deleted).toBe(1);

      // Verify query includes user_id check
      expect(execute).toHaveBeenCalledWith(
        expect.stringContaining('user_id = $'),
        expect.any(Array)
      );
    });
  });

  describe('validateItemData', () => {
    it('should validate item with standard column names', () => {
      const result = inventoryService.validateItemData({
        name: 'Test Item',
        category: 'spirit',
      });

      expect(result.isValid).toBe(true);
      expect(result.sanitized).toBeDefined();
      expect(result.sanitized!.name).toBe('Test Item');
      expect(result.sanitized!.category).toBe('spirit');
    });

    it('should validate item with alternative column names', () => {
      const result = inventoryService.validateItemData({
        'Spirit Name': 'Test Vodka',
        'Liquor Type': 'Vodka',
      });

      expect(result.isValid).toBe(true);
      expect(result.sanitized!.name).toBe('Test Vodka');
      expect(result.sanitized!.type).toBe('Vodka');
    });

    it('should fail when name is missing', () => {
      const result = inventoryService.validateItemData({
        category: 'spirit',
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Missing name field'))).toBe(true);
    });

    it('should fail when name is empty', () => {
      const result = inventoryService.validateItemData({
        name: '   ',
        category: 'spirit',
      });

      expect(result.isValid).toBe(false);
    });

    it('should fail with invalid category', () => {
      const result = inventoryService.validateItemData({
        name: 'Test Item',
        category: 'invalid_category',
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid category'))).toBe(true);
    });

    it('should auto-categorize spirits', () => {
      const result = inventoryService.validateItemData({
        name: 'Grey Goose Vodka',
      });

      expect(result.isValid).toBe(true);
      expect(result.sanitized!.category).toBe('spirit');
    });

    it('should auto-categorize liqueurs', () => {
      const result = inventoryService.validateItemData({
        name: 'Cointreau Triple Sec',
      });

      expect(result.isValid).toBe(true);
      expect(result.sanitized!.category).toBe('liqueur');
    });

    it('should auto-categorize mixers', () => {
      const result = inventoryService.validateItemData({
        name: 'Angostura Bitters',
      });

      expect(result.isValid).toBe(true);
      expect(result.sanitized!.category).toBe('mixer');
    });

    it('should auto-categorize syrups', () => {
      const result = inventoryService.validateItemData({
        name: 'Simple Syrup',
      });

      expect(result.isValid).toBe(true);
      expect(result.sanitized!.category).toBe('syrup');
    });

    it('should auto-categorize garnishes', () => {
      const result = inventoryService.validateItemData({
        name: 'Maraschino Cherry',
      });

      expect(result.isValid).toBe(true);
      expect(result.sanitized!.category).toBe('garnish');
    });

    it('should default to other when cannot auto-categorize', () => {
      const result = inventoryService.validateItemData({
        name: 'Random Item XYZ',
      });

      expect(result.isValid).toBe(true);
      expect(result.sanitized!.category).toBe('other');
    });
  });

  describe('importFromCSV', () => {
    it('should import valid records', async () => {
      const mockItems = [
        createMockItem({ name: 'Vodka', category: 'spirit' }),
        createMockItem({ name: 'Gin', category: 'spirit' }),
        createMockItem({ name: 'Lime', category: 'garnish' }),
      ];
      let callIndex = 0;
      (execute as ReturnType<typeof vi.fn>).mockImplementation(async () => ({
        rows: [mockItems[callIndex++]],
        rowCount: 1,
      }));

      const records = [
        { name: 'Vodka', category: 'spirit' },
        { name: 'Gin', category: 'spirit' },
        { name: 'Lime', category: 'garnish' },
      ];

      const result = await inventoryService.importFromCSV(userId, records);

      expect(result.imported).toBe(3);
      expect(result.failed).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should track failed records', async () => {
      const mockItem = createMockItem({ name: 'Valid Item' });
      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [mockItem],
        rowCount: 1,
      });

      const records = [
        { name: 'Valid Item', category: 'spirit' },
        { category: 'spirit' }, // Missing name
        { name: 'Invalid Category', category: 'not_a_category' },
      ];

      const result = await inventoryService.importFromCSV(userId, records);

      expect(result.imported).toBe(1);
      expect(result.failed).toBe(2);
      expect(result.errors).toHaveLength(2);
    });

    it('should use correct row numbers in errors', async () => {
      const mockItems = [
        createMockItem({ name: 'Valid 1' }),
        createMockItem({ name: 'Valid 2' }),
      ];
      let callIndex = 0;
      (execute as ReturnType<typeof vi.fn>).mockImplementation(async () => ({
        rows: [mockItems[Math.min(callIndex++, mockItems.length - 1)]],
        rowCount: 1,
      }));

      const records = [
        { name: 'Valid 1', category: 'spirit' },
        { name: 'Valid 2', category: 'spirit' },
        { category: 'spirit' }, // Missing name - this is index 2, row 4
      ];

      const result = await inventoryService.importFromCSV(userId, records);

      expect(result.errors[0].row).toBe(4);
    });
  });

  describe('isValidCategory', () => {
    it('should return true for valid categories', () => {
      for (const category of VALID_CATEGORIES) {
        expect(inventoryService.isValidCategory(category)).toBe(true);
      }
    });

    it('should return false for invalid category', () => {
      expect(inventoryService.isValidCategory('invalid')).toBe(false);
      expect(inventoryService.isValidCategory('')).toBe(false);
      expect(inventoryService.isValidCategory('SPIRIT')).toBe(false); // Case sensitive
    });
  });
});
