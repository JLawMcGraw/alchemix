/**
 * Collection Service Tests
 *
 * Unit tests for the CollectionService business logic.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createTestDatabase, cleanupTestDatabase } from '../tests/setup';
import type Database from 'better-sqlite3';

// Mock the database module
vi.mock('../database/db', () => ({
  db: null as Database.Database | null,
}));

// Mock MemoryService to avoid external API calls
vi.mock('./MemoryService', () => ({
  memoryService: {
    storeUserCollection: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('CollectionService', () => {
  let db: Database.Database;
  let CollectionService: any;
  let collectionService: any;

  beforeEach(async () => {
    // Create test database
    db = createTestDatabase();

    // Create test user
    db.prepare(`
      INSERT INTO users (id, email, password_hash)
      VALUES (1, 'test@example.com', 'hashedpassword')
    `).run();

    // Update the mock
    const dbModule = await import('../database/db');
    (dbModule as any).db = db;

    // Reset modules and import fresh
    vi.resetModules();
    const serviceModule = await import('./CollectionService');
    CollectionService = serviceModule.CollectionService;
    collectionService = new CollectionService();
  });

  afterEach(() => {
    cleanupTestDatabase(db);
    vi.clearAllMocks();
  });

  describe('getAll', () => {
    it('should return empty array when no collections exist', () => {
      const collections = collectionService.getAll(1);
      expect(collections).toEqual([]);
    });

    it('should return all collections for a user with recipe counts', () => {
      // Create collections
      db.prepare(`INSERT INTO collections (id, user_id, name, description) VALUES (1, 1, 'Classics', 'Classic cocktails')`).run();
      db.prepare(`INSERT INTO collections (id, user_id, name, description) VALUES (2, 1, 'Tiki', 'Tropical drinks')`).run();

      // Add recipes to collections
      db.prepare(`INSERT INTO recipes (user_id, collection_id, name, ingredients) VALUES (1, 1, 'Martini', 'gin, vermouth')`).run();
      db.prepare(`INSERT INTO recipes (user_id, collection_id, name, ingredients) VALUES (1, 1, 'Negroni', 'gin, campari, vermouth')`).run();
      db.prepare(`INSERT INTO recipes (user_id, collection_id, name, ingredients) VALUES (1, 2, 'Mai Tai', 'rum, lime')`).run();

      const collections = collectionService.getAll(1);

      expect(collections).toHaveLength(2);
      // Collections are ordered by created_at DESC, so most recent first
      const classics = collections.find((c: any) => c.name === 'Classics');
      const tiki = collections.find((c: any) => c.name === 'Tiki');

      expect(classics.recipe_count).toBe(2);
      expect(tiki.recipe_count).toBe(1);
    });

    it('should only return collections for the specified user', () => {
      db.prepare(`INSERT INTO users (id, email, password_hash) VALUES (2, 'other@example.com', 'hash')`).run();
      db.prepare(`INSERT INTO collections (user_id, name) VALUES (1, 'User1 Collection')`).run();
      db.prepare(`INSERT INTO collections (user_id, name) VALUES (2, 'User2 Collection')`).run();

      const collections = collectionService.getAll(1);

      expect(collections).toHaveLength(1);
      expect(collections[0].name).toBe('User1 Collection');
    });
  });

  describe('getById', () => {
    it('should return collection when it exists and belongs to user', () => {
      db.prepare(`INSERT INTO collections (id, user_id, name, description) VALUES (1, 1, 'Classics', 'Classic cocktails')`).run();

      const collection = collectionService.getById(1, 1);

      expect(collection).not.toBeNull();
      expect(collection?.name).toBe('Classics');
      expect(collection?.description).toBe('Classic cocktails');
    });

    it('should return null when collection does not exist', () => {
      const collection = collectionService.getById(999, 1);
      expect(collection).toBeNull();
    });

    it('should return null when collection belongs to different user', () => {
      db.prepare(`INSERT INTO users (id, email, password_hash) VALUES (2, 'other@example.com', 'hash')`).run();
      db.prepare(`INSERT INTO collections (id, user_id, name) VALUES (1, 2, 'Other Collection')`).run();

      const collection = collectionService.getById(1, 1);
      expect(collection).toBeNull();
    });
  });

  describe('exists', () => {
    it('should return true when collection exists and belongs to user', () => {
      db.prepare(`INSERT INTO collections (id, user_id, name) VALUES (1, 1, 'Test')`).run();
      expect(collectionService.exists(1, 1)).toBe(true);
    });

    it('should return false when collection does not exist', () => {
      expect(collectionService.exists(999, 1)).toBe(false);
    });

    it('should return false when collection belongs to different user', () => {
      db.prepare(`INSERT INTO users (id, email, password_hash) VALUES (2, 'other@example.com', 'hash')`).run();
      db.prepare(`INSERT INTO collections (id, user_id, name) VALUES (1, 2, 'Other')`).run();

      expect(collectionService.exists(1, 1)).toBe(false);
    });
  });

  describe('create', () => {
    it('should create a new collection with name only', () => {
      const collection = collectionService.create(1, { name: 'Classics' });

      expect(collection).toBeDefined();
      expect(collection.name).toBe('Classics');
      expect(collection.description).toBeNull();
      expect(collection.user_id).toBe(1);
      expect(collection.id).toBeDefined();
    });

    it('should create a new collection with name and description', () => {
      const collection = collectionService.create(1, {
        name: 'Classics',
        description: 'Classic cocktails from the golden age',
      });

      expect(collection.name).toBe('Classics');
      expect(collection.description).toBe('Classic cocktails from the golden age');
    });

    it('should sanitize input to prevent XSS', () => {
      const collection = collectionService.create(1, {
        name: '<script>alert("xss")</script>Classics',
        description: '<img onerror="alert(1)" src="x">Description',
      });

      expect(collection.name).not.toContain('<script>');
      expect(collection.description).not.toContain('onerror');
    });

    it('should truncate long names and descriptions', () => {
      const collection = collectionService.create(1, {
        name: 'A'.repeat(200),
        description: 'B'.repeat(600),
      });

      expect(collection.name.length).toBeLessThanOrEqual(100);
      expect(collection.description.length).toBeLessThanOrEqual(500);
    });
  });

  describe('update', () => {
    beforeEach(() => {
      db.prepare(`INSERT INTO collections (id, user_id, name, description) VALUES (1, 1, 'Original', 'Original description')`).run();
    });

    it('should update collection name', () => {
      const result = collectionService.update(1, 1, { name: 'Updated' });

      expect(result.success).toBe(true);
      expect(result.collection?.name).toBe('Updated');
      expect(result.collection?.description).toBe('Original description');
    });

    it('should update collection description', () => {
      const result = collectionService.update(1, 1, { description: 'New description' });

      expect(result.success).toBe(true);
      expect(result.collection?.name).toBe('Original');
      expect(result.collection?.description).toBe('New description');
    });

    it('should update both name and description', () => {
      const result = collectionService.update(1, 1, {
        name: 'Updated',
        description: 'New description',
      });

      expect(result.success).toBe(true);
      expect(result.collection?.name).toBe('Updated');
      expect(result.collection?.description).toBe('New description');
    });

    it('should allow setting description to null', () => {
      const result = collectionService.update(1, 1, { description: null });

      expect(result.success).toBe(true);
      expect(result.collection?.description).toBeNull();
    });

    it('should fail when collection does not exist', () => {
      const result = collectionService.update(999, 1, { name: 'Updated' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should fail when collection belongs to different user', () => {
      db.prepare(`INSERT INTO users (id, email, password_hash) VALUES (2, 'other@example.com', 'hash')`).run();

      const result = collectionService.update(1, 2, { name: 'Updated' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should fail when no valid fields provided', () => {
      const result = collectionService.update(1, 1, {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('No valid fields');
    });
  });

  describe('delete', () => {
    it('should delete an existing collection', () => {
      db.prepare(`INSERT INTO collections (id, user_id, name) VALUES (1, 1, 'To Delete')`).run();

      const result = collectionService.delete(1, 1);

      expect(result).toBe(true);

      // Verify deleted
      const collection = db.prepare('SELECT * FROM collections WHERE id = 1').get();
      expect(collection).toBeUndefined();
    });

    it('should return false when collection does not exist', () => {
      const result = collectionService.delete(999, 1);
      expect(result).toBe(false);
    });

    it('should return false when collection belongs to different user', () => {
      db.prepare(`INSERT INTO users (id, email, password_hash) VALUES (2, 'other@example.com', 'hash')`).run();
      db.prepare(`INSERT INTO collections (id, user_id, name) VALUES (1, 2, 'Other')`).run();

      const result = collectionService.delete(1, 1);

      expect(result).toBe(false);

      // Verify not deleted
      const collection = db.prepare('SELECT * FROM collections WHERE id = 1').get();
      expect(collection).toBeDefined();
    });

    it('should set recipe collection_id to NULL when collection is deleted', () => {
      db.prepare(`INSERT INTO collections (id, user_id, name) VALUES (1, 1, 'To Delete')`).run();
      db.prepare(`INSERT INTO recipes (id, user_id, collection_id, name, ingredients) VALUES (1, 1, 1, 'Test Recipe', 'ingredients')`).run();

      collectionService.delete(1, 1);

      // Recipe should still exist but with null collection_id
      const recipe = db.prepare('SELECT * FROM recipes WHERE id = 1').get() as any;
      expect(recipe).toBeDefined();
      expect(recipe.collection_id).toBeNull();
    });
  });
});
