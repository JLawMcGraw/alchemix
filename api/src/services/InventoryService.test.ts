import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { createTestDatabase, cleanupTestDatabase } from '../tests/setup';
import { InventoryService, VALID_CATEGORIES } from './InventoryService';

describe('InventoryService', () => {
  let testDb: Database.Database;
  let userId: number;
  let inventoryService: InventoryService;

  beforeEach(() => {
    // Create test database
    testDb = createTestDatabase();

    // Create test user
    const result = testDb.prepare(
      'INSERT INTO users (email, password_hash) VALUES (?, ?)'
    ).run('test@example.com', 'hashed_password');
    userId = Number(result.lastInsertRowid);

    // Create service with injected test database
    inventoryService = new InventoryService(testDb);
  });

  afterEach(() => {
    cleanupTestDatabase(testDb);
  });

  describe('getAll', () => {
    it('should return empty result when user has no items', () => {
      const result = inventoryService.getAll(userId, { page: 1, limit: 10 });

      expect(result.items).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
      expect(result.pagination.totalPages).toBe(0);
      expect(result.pagination.hasNextPage).toBe(false);
      expect(result.pagination.hasPreviousPage).toBe(false);
    });

    it('should return paginated items', () => {
      // Insert 15 items
      for (let i = 0; i < 15; i++) {
        testDb.prepare(
          'INSERT INTO inventory_items (user_id, name, category) VALUES (?, ?, ?)'
        ).run(userId, `Item ${i}`, 'spirit');
      }

      const result = inventoryService.getAll(userId, { page: 1, limit: 10 });

      expect(result.items).toHaveLength(10);
      expect(result.pagination.total).toBe(15);
      expect(result.pagination.totalPages).toBe(2);
      expect(result.pagination.hasNextPage).toBe(true);
      expect(result.pagination.hasPreviousPage).toBe(false);
    });

    it('should return second page correctly', () => {
      // Insert 15 items
      for (let i = 0; i < 15; i++) {
        testDb.prepare(
          'INSERT INTO inventory_items (user_id, name, category) VALUES (?, ?, ?)'
        ).run(userId, `Item ${i}`, 'spirit');
      }

      const result = inventoryService.getAll(userId, { page: 2, limit: 10 });

      expect(result.items).toHaveLength(5);
      expect(result.pagination.page).toBe(2);
      expect(result.pagination.hasNextPage).toBe(false);
      expect(result.pagination.hasPreviousPage).toBe(true);
    });

    it('should filter by category', () => {
      testDb.prepare(
        'INSERT INTO inventory_items (user_id, name, category) VALUES (?, ?, ?)'
      ).run(userId, 'Vodka', 'spirit');
      testDb.prepare(
        'INSERT INTO inventory_items (user_id, name, category) VALUES (?, ?, ?)'
      ).run(userId, 'Lime', 'garnish');
      testDb.prepare(
        'INSERT INTO inventory_items (user_id, name, category) VALUES (?, ?, ?)'
      ).run(userId, 'Whiskey', 'spirit');

      const result = inventoryService.getAll(userId, { page: 1, limit: 10 }, 'spirit');

      expect(result.items).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
      result.items.forEach(item => {
        expect(item.category).toBe('spirit');
      });
    });

    it('should not return items from other users', () => {
      // Create another user
      const otherUserResult = testDb.prepare(
        'INSERT INTO users (email, password_hash) VALUES (?, ?)'
      ).run('other@example.com', 'hashed_password');
      const otherUserId = Number(otherUserResult.lastInsertRowid);

      // Insert items for both users
      testDb.prepare(
        'INSERT INTO inventory_items (user_id, name, category) VALUES (?, ?, ?)'
      ).run(userId, 'My Item', 'spirit');
      testDb.prepare(
        'INSERT INTO inventory_items (user_id, name, category) VALUES (?, ?, ?)'
      ).run(otherUserId, 'Other Item', 'spirit');

      const result = inventoryService.getAll(userId, { page: 1, limit: 10 });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].name).toBe('My Item');
    });
  });

  describe('getCategoryCounts', () => {
    it('should return zero counts when user has no items', () => {
      const counts = inventoryService.getCategoryCounts(userId);

      expect(counts.all).toBe(0);
      expect(counts.spirit).toBe(0);
      expect(counts.liqueur).toBe(0);
      expect(counts.mixer).toBe(0);
    });

    it('should return correct counts by category', () => {
      testDb.prepare(
        'INSERT INTO inventory_items (user_id, name, category) VALUES (?, ?, ?)'
      ).run(userId, 'Vodka', 'spirit');
      testDb.prepare(
        'INSERT INTO inventory_items (user_id, name, category) VALUES (?, ?, ?)'
      ).run(userId, 'Gin', 'spirit');
      testDb.prepare(
        'INSERT INTO inventory_items (user_id, name, category) VALUES (?, ?, ?)'
      ).run(userId, 'Lime', 'garnish');
      testDb.prepare(
        'INSERT INTO inventory_items (user_id, name, category) VALUES (?, ?, ?)'
      ).run(userId, 'Tonic', 'mixer');

      const counts = inventoryService.getCategoryCounts(userId);

      expect(counts.all).toBe(4);
      expect(counts.spirit).toBe(2);
      expect(counts.garnish).toBe(1);
      expect(counts.mixer).toBe(1);
      expect(counts.liqueur).toBe(0);
    });
  });

  describe('getById', () => {
    it('should return item when it exists and belongs to user', () => {
      const result = testDb.prepare(
        'INSERT INTO inventory_items (user_id, name, category) VALUES (?, ?, ?)'
      ).run(userId, 'Test Item', 'spirit');
      const itemId = Number(result.lastInsertRowid);

      const item = inventoryService.getById(itemId, userId);

      expect(item).not.toBeNull();
      expect(item!.name).toBe('Test Item');
      expect(item!.category).toBe('spirit');
    });

    it('should return null for non-existent item', () => {
      const item = inventoryService.getById(99999, userId);

      expect(item).toBeNull();
    });

    it('should return null when item belongs to different user', () => {
      const otherUserResult = testDb.prepare(
        'INSERT INTO users (email, password_hash) VALUES (?, ?)'
      ).run('other@example.com', 'hashed_password');
      const otherUserId = Number(otherUserResult.lastInsertRowid);

      const result = testDb.prepare(
        'INSERT INTO inventory_items (user_id, name, category) VALUES (?, ?, ?)'
      ).run(otherUserId, 'Other Item', 'spirit');
      const itemId = Number(result.lastInsertRowid);

      const item = inventoryService.getById(itemId, userId);

      expect(item).toBeNull();
    });
  });

  describe('exists', () => {
    it('should return true when item exists and belongs to user', () => {
      const result = testDb.prepare(
        'INSERT INTO inventory_items (user_id, name, category) VALUES (?, ?, ?)'
      ).run(userId, 'Test Item', 'spirit');
      const itemId = Number(result.lastInsertRowid);

      expect(inventoryService.exists(itemId, userId)).toBe(true);
    });

    it('should return false for non-existent item', () => {
      expect(inventoryService.exists(99999, userId)).toBe(false);
    });

    it('should return false when item belongs to different user', () => {
      const otherUserResult = testDb.prepare(
        'INSERT INTO users (email, password_hash) VALUES (?, ?)'
      ).run('other@example.com', 'hashed_password');
      const otherUserId = Number(otherUserResult.lastInsertRowid);

      const result = testDb.prepare(
        'INSERT INTO inventory_items (user_id, name, category) VALUES (?, ?, ?)'
      ).run(otherUserId, 'Other Item', 'spirit');
      const itemId = Number(result.lastInsertRowid);

      expect(inventoryService.exists(itemId, userId)).toBe(false);
    });
  });

  describe('create', () => {
    it('should create item with all fields', () => {
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
      };

      const item = inventoryService.create(userId, data);

      expect(item.id).toBeDefined();
      expect(item.name).toBe('Test Vodka');
      expect(item.category).toBe('spirit');
      expect(item.type).toBe('Vodka');
      expect(item.stock_number).toBe(2);
      expect(item.user_id).toBe(userId);
    });

    it('should create item with minimal fields', () => {
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
      };

      const item = inventoryService.create(userId, data);

      expect(item.id).toBeDefined();
      expect(item.name).toBe('Simple Item');
      expect(item.category).toBe('other');
    });

    it('should normalize zero stock to null', () => {
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
      };

      const item = inventoryService.create(userId, data);

      expect(item.stock_number).toBeNull();
    });

    it('should normalize negative stock to null', () => {
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
      };

      const item = inventoryService.create(userId, data);

      expect(item.stock_number).toBeNull();
    });
  });

  describe('update', () => {
    it('should update existing item', () => {
      const result = testDb.prepare(
        'INSERT INTO inventory_items (user_id, name, category) VALUES (?, ?, ?)'
      ).run(userId, 'Original Name', 'spirit');
      const itemId = Number(result.lastInsertRowid);

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
      };

      const item = inventoryService.update(itemId, userId, data);

      expect(item).not.toBeNull();
      expect(item!.name).toBe('Updated Name');
      expect(item!.category).toBe('liqueur');
      expect(item!.type).toBe('Herbal');
    });

    it('should return null for non-existent item', () => {
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
      };

      const item = inventoryService.update(99999, userId, data);

      expect(item).toBeNull();
    });

    it('should return null when updating item belonging to different user', () => {
      const otherUserResult = testDb.prepare(
        'INSERT INTO users (email, password_hash) VALUES (?, ?)'
      ).run('other@example.com', 'hashed_password');
      const otherUserId = Number(otherUserResult.lastInsertRowid);

      const result = testDb.prepare(
        'INSERT INTO inventory_items (user_id, name, category) VALUES (?, ?, ?)'
      ).run(otherUserId, 'Other Item', 'spirit');
      const itemId = Number(result.lastInsertRowid);

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
      };

      const item = inventoryService.update(itemId, userId, data);

      expect(item).toBeNull();

      // Verify the original item wasn't modified
      const original = testDb.prepare(
        'SELECT name FROM inventory_items WHERE id = ?'
      ).get(itemId) as { name: string };
      expect(original.name).toBe('Other Item');
    });
  });

  describe('delete', () => {
    it('should delete existing item', () => {
      const result = testDb.prepare(
        'INSERT INTO inventory_items (user_id, name, category) VALUES (?, ?, ?)'
      ).run(userId, 'To Delete', 'spirit');
      const itemId = Number(result.lastInsertRowid);

      const deleted = inventoryService.delete(itemId, userId);

      expect(deleted).toBe(true);
      expect(inventoryService.exists(itemId, userId)).toBe(false);
    });

    it('should return false for non-existent item', () => {
      const deleted = inventoryService.delete(99999, userId);

      expect(deleted).toBe(false);
    });

    it('should return false when deleting item belonging to different user', () => {
      const otherUserResult = testDb.prepare(
        'INSERT INTO users (email, password_hash) VALUES (?, ?)'
      ).run('other@example.com', 'hashed_password');
      const otherUserId = Number(otherUserResult.lastInsertRowid);

      const result = testDb.prepare(
        'INSERT INTO inventory_items (user_id, name, category) VALUES (?, ?, ?)'
      ).run(otherUserId, 'Other Item', 'spirit');
      const itemId = Number(result.lastInsertRowid);

      const deleted = inventoryService.delete(itemId, userId);

      expect(deleted).toBe(false);

      // Verify item still exists
      const exists = testDb.prepare(
        'SELECT id FROM inventory_items WHERE id = ?'
      ).get(itemId);
      expect(exists).toBeDefined();
    });
  });

  describe('bulkDelete', () => {
    it('should delete multiple items', () => {
      const ids: number[] = [];
      for (let i = 0; i < 5; i++) {
        const result = testDb.prepare(
          'INSERT INTO inventory_items (user_id, name, category) VALUES (?, ?, ?)'
        ).run(userId, `Item ${i}`, 'spirit');
        ids.push(Number(result.lastInsertRowid));
      }

      const deleted = inventoryService.bulkDelete(ids.slice(0, 3), userId);

      expect(deleted).toBe(3);

      // Verify remaining items
      const remaining = testDb.prepare(
        'SELECT COUNT(*) as count FROM inventory_items WHERE user_id = ?'
      ).get(userId) as { count: number };
      expect(remaining.count).toBe(2);
    });

    it('should only delete items belonging to user', () => {
      const otherUserResult = testDb.prepare(
        'INSERT INTO users (email, password_hash) VALUES (?, ?)'
      ).run('other@example.com', 'hashed_password');
      const otherUserId = Number(otherUserResult.lastInsertRowid);

      const myItem = testDb.prepare(
        'INSERT INTO inventory_items (user_id, name, category) VALUES (?, ?, ?)'
      ).run(userId, 'My Item', 'spirit');
      const otherItem = testDb.prepare(
        'INSERT INTO inventory_items (user_id, name, category) VALUES (?, ?, ?)'
      ).run(otherUserId, 'Other Item', 'spirit');

      const deleted = inventoryService.bulkDelete(
        [Number(myItem.lastInsertRowid), Number(otherItem.lastInsertRowid)],
        userId
      );

      expect(deleted).toBe(1);

      // Verify other user's item still exists
      const other = testDb.prepare(
        'SELECT id FROM inventory_items WHERE id = ?'
      ).get(otherItem.lastInsertRowid);
      expect(other).toBeDefined();
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
    it('should import valid records', () => {
      const records = [
        { name: 'Vodka', category: 'spirit' },
        { name: 'Gin', category: 'spirit' },
        { name: 'Lime', category: 'garnish' },
      ];

      const result = inventoryService.importFromCSV(userId, records);

      expect(result.imported).toBe(3);
      expect(result.failed).toBe(0);
      expect(result.errors).toHaveLength(0);

      // Verify items in database
      const items = testDb.prepare(
        'SELECT * FROM inventory_items WHERE user_id = ?'
      ).all(userId);
      expect(items).toHaveLength(3);
    });

    it('should track failed records', () => {
      const records = [
        { name: 'Valid Item', category: 'spirit' },
        { category: 'spirit' }, // Missing name
        { name: 'Invalid Category', category: 'not_a_category' },
      ];

      const result = inventoryService.importFromCSV(userId, records);

      expect(result.imported).toBe(1);
      expect(result.failed).toBe(2);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0].row).toBe(3); // Row 3 (0-indexed + header row)
      expect(result.errors[1].row).toBe(4); // Row 4
    });

    it('should use correct row numbers in errors', () => {
      const records = [
        { name: 'Valid 1', category: 'spirit' },
        { name: 'Valid 2', category: 'spirit' },
        { category: 'spirit' }, // Missing name - this is index 2, row 4 (2 + 2 for header)
      ];

      const result = inventoryService.importFromCSV(userId, records);

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
