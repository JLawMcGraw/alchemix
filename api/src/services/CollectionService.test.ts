/**
 * CollectionService Tests
 *
 * Tests for the collection/books service.
 * Updated for PostgreSQL async pattern.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the database module
vi.mock('../database/db', () => ({
  queryOne: vi.fn(),
  queryAll: vi.fn(),
  execute: vi.fn(),
}));

// Mock MemoryService
vi.mock('./MemoryService', () => ({
  memoryService: {
    storeUserCollection: vi.fn().mockResolvedValue(undefined),
  },
}));

import { queryOne, queryAll, execute } from '../database/db';
import { CollectionService, Collection, CollectionWithCount } from './CollectionService';

describe('CollectionService', () => {
  let collectionService: CollectionService;
  const testUserId = 9999;
  const otherUserId = 9998;

  // Helper to create mock collection
  const createMockCollection = (overrides: Partial<Collection> = {}): Collection => ({
    id: 1,
    user_id: testUserId,
    name: 'Test Collection',
    description: 'Test description',
    created_at: new Date().toISOString(),
    ...overrides,
  });

  // Helper to create mock collection with count
  const createMockCollectionWithCount = (overrides: Partial<CollectionWithCount> = {}): CollectionWithCount => ({
    ...createMockCollection(),
    recipe_count: 0,
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    collectionService = new CollectionService();

    // Default mock implementations
    (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (execute as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [], rowCount: 0 });
  });

  describe('getAll', () => {
    it('should return empty array when no collections exist', async () => {
      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const collections = await collectionService.getAll(testUserId);

      expect(collections).toEqual([]);
    });

    it('should return all collections for a user with recipe counts', async () => {
      const mockCollections = [
        createMockCollectionWithCount({ id: 1, name: 'Classics', recipe_count: 2 }),
        createMockCollectionWithCount({ id: 2, name: 'Tiki', recipe_count: 1 }),
      ];
      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue(mockCollections);

      const collections = await collectionService.getAll(testUserId);

      expect(collections).toHaveLength(2);
      const classics = collections.find(c => c.name === 'Classics');
      const tiki = collections.find(c => c.name === 'Tiki');

      expect(classics?.recipe_count).toBe(2);
      expect(tiki?.recipe_count).toBe(1);
    });

    it('should only return collections for the specified user', async () => {
      const mockCollections = [
        createMockCollectionWithCount({ name: 'User1 Collection' }),
      ];
      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue(mockCollections);

      const collections = await collectionService.getAll(testUserId);

      expect(collections).toHaveLength(1);
      expect(collections[0].name).toBe('User1 Collection');

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
      const mockCollections = Array.from({ length: 5 }, (_, i) =>
        createMockCollectionWithCount({ id: i + 1, name: `Collection ${i + 1}` })
      );
      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue(mockCollections);

      const result = await collectionService.getPaginated(testUserId, 1, 5);

      expect(result.collections).toHaveLength(5);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(5);
      expect(result.pagination.total).toBe(15);
      expect(result.pagination.totalPages).toBe(3);
      expect(result.pagination.hasNextPage).toBe(true);
      expect(result.pagination.hasPreviousPage).toBe(false);
    });

    it('should handle last page', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue({ total: '15' });
      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue([
        createMockCollectionWithCount({ id: 15, name: 'Last Collection' }),
      ]);

      const result = await collectionService.getPaginated(testUserId, 3, 5);

      expect(result.pagination.hasNextPage).toBe(false);
      expect(result.pagination.hasPreviousPage).toBe(true);
    });

    it('should clamp page to minimum 1', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue({ total: '10' });
      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const result = await collectionService.getPaginated(testUserId, -5, 5);

      expect(result.pagination.page).toBe(1);
    });

    it('should clamp limit to maximum 100', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue({ total: '10' });
      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const result = await collectionService.getPaginated(testUserId, 1, 500);

      expect(result.pagination.limit).toBe(100);
    });
  });

  describe('getById', () => {
    it('should return collection when it exists and belongs to user', async () => {
      const mockCollection = createMockCollection({ name: 'Classics', description: 'Classic cocktails' });
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(mockCollection);

      const collection = await collectionService.getById(1, testUserId);

      expect(collection).not.toBeNull();
      expect(collection?.name).toBe('Classics');
      expect(collection?.description).toBe('Classic cocktails');
    });

    it('should return null when collection does not exist', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const collection = await collectionService.getById(999, testUserId);

      expect(collection).toBeNull();
    });

    it('should return null when collection belongs to different user', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const collection = await collectionService.getById(1, otherUserId);

      expect(collection).toBeNull();
    });
  });

  describe('exists', () => {
    it('should return true when collection exists and belongs to user', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 1 });

      const result = await collectionService.exists(1, testUserId);

      expect(result).toBe(true);
    });

    it('should return false when collection does not exist', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await collectionService.exists(999, testUserId);

      expect(result).toBe(false);
    });

    it('should return false when collection belongs to different user', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await collectionService.exists(1, otherUserId);

      expect(result).toBe(false);
    });
  });

  describe('create', () => {
    it('should create a new collection with name only', async () => {
      const mockCollection = createMockCollection({
        id: 1,
        name: 'Classics',
        description: null,
      });
      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [mockCollection],
        rowCount: 1,
      });

      const collection = await collectionService.create(testUserId, { name: 'Classics' });

      expect(collection).toBeDefined();
      expect(collection.name).toBe('Classics');
      expect(collection.description).toBeNull();
      expect(collection.id).toBeDefined();
    });

    it('should create a new collection with name and description', async () => {
      const mockCollection = createMockCollection({
        name: 'Classics',
        description: 'Classic cocktails from the golden age',
      });
      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [mockCollection],
        rowCount: 1,
      });

      const collection = await collectionService.create(testUserId, {
        name: 'Classics',
        description: 'Classic cocktails from the golden age',
      });

      expect(collection.name).toBe('Classics');
      expect(collection.description).toBe('Classic cocktails from the golden age');
    });

    it('should sanitize input to prevent XSS', async () => {
      const mockCollection = createMockCollection({
        name: 'Classics',
        description: 'Description',
      });
      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [mockCollection],
        rowCount: 1,
      });

      const collection = await collectionService.create(testUserId, {
        name: '<script>alert("xss")</script>Classics',
        description: '<img onerror="alert(1)" src="x">Description',
      });

      // Verify execute was called with sanitized values (no script tags)
      expect(execute).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          testUserId,
          expect.not.stringContaining('<script>'),
          expect.not.stringContaining('onerror'),
        ])
      );
    });
  });

  describe('update', () => {
    it('should update collection name', async () => {
      // First call to exists
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: 1 });

      const updatedCollection = createMockCollection({
        name: 'Updated',
        description: 'Original description',
      });
      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [updatedCollection],
        rowCount: 1,
      });

      const result = await collectionService.update(1, testUserId, { name: 'Updated' });

      expect(result.success).toBe(true);
      expect(result.collection?.name).toBe('Updated');
      expect(result.collection?.description).toBe('Original description');
    });

    it('should update collection description', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: 1 });

      const updatedCollection = createMockCollection({
        name: 'Original',
        description: 'New description',
      });
      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [updatedCollection],
        rowCount: 1,
      });

      const result = await collectionService.update(1, testUserId, { description: 'New description' });

      expect(result.success).toBe(true);
      expect(result.collection?.name).toBe('Original');
      expect(result.collection?.description).toBe('New description');
    });

    it('should update both name and description', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: 1 });

      const updatedCollection = createMockCollection({
        name: 'Updated',
        description: 'New description',
      });
      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [updatedCollection],
        rowCount: 1,
      });

      const result = await collectionService.update(1, testUserId, {
        name: 'Updated',
        description: 'New description',
      });

      expect(result.success).toBe(true);
      expect(result.collection?.name).toBe('Updated');
      expect(result.collection?.description).toBe('New description');
    });

    it('should allow setting description to null', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: 1 });

      const updatedCollection = createMockCollection({
        name: 'Original',
        description: null,
      });
      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [updatedCollection],
        rowCount: 1,
      });

      const result = await collectionService.update(1, testUserId, { description: null });

      expect(result.success).toBe(true);
      expect(result.collection?.description).toBeNull();
    });

    it('should fail when collection does not exist', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await collectionService.update(999, testUserId, { name: 'Updated' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should fail when collection belongs to different user', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await collectionService.update(1, otherUserId, { name: 'Updated' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should fail when no valid fields provided', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: 1 });

      const result = await collectionService.update(1, testUserId, {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('No valid fields');
    });
  });

  describe('delete', () => {
    it('should delete an existing collection', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: 1 });
      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({ rowCount: 1 });

      const result = await collectionService.delete(1, testUserId);

      expect(result).toBe(true);
      expect(execute).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM collections'),
        [1]
      );
    });

    it('should return false when collection does not exist', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await collectionService.delete(999, testUserId);

      expect(result).toBe(false);
    });

    it('should return false when collection belongs to different user', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await collectionService.delete(1, otherUserId);

      expect(result).toBe(false);
    });
  });

  describe('deleteWithRecipes', () => {
    it('should delete collection and all its recipes', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: 1 });
      (execute as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ rowCount: 3 }) // Delete recipes
        .mockResolvedValueOnce({ rowCount: 1 }); // Delete collection

      const result = await collectionService.deleteWithRecipes(1, testUserId);

      expect(result.success).toBe(true);
      expect(result.recipesDeleted).toBe(3);
    });

    it('should return success false when collection does not exist', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await collectionService.deleteWithRecipes(999, testUserId);

      expect(result.success).toBe(false);
      expect(result.recipesDeleted).toBe(0);
    });
  });
});
