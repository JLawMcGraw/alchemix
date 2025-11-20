import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express, { Express } from 'express';
import { createServer, Server } from 'http';
import request from 'supertest';
import { createTestDatabase, cleanupTestDatabase } from '../tests/setup';
import Database from 'better-sqlite3';
import jwt from 'jsonwebtoken';

// Mock the database module
let testDb: Database.Database;

vi.mock('../database/db', () => ({
  db: {
    prepare: (sql: string) => testDb.prepare(sql),
    pragma: (pragma: string, options?: any) => testDb.pragma(pragma, options),
  },
}));

// Mock token blacklist
vi.mock('../utils/tokenBlacklist', () => ({
  tokenBlacklist: {
    add: vi.fn(),
    remove: vi.fn(),
    isBlacklisted: vi.fn().mockReturnValue(false),
    size: vi.fn().mockReturnValue(0),
    cleanup: vi.fn(),
    shutdown: vi.fn(),
  },
}));

import collectionsRoutes from './collections';
import { errorHandler } from '../middleware/errorHandler';

describe('Collections Routes Integration Tests', () => {
  let app: Express;
  let authToken: string;
  let userId: number;
  let server: Server | null = null;

  beforeEach(() => {
    // Create test database
    testDb = createTestDatabase();

    // Create a test user
    const result = testDb.prepare(`
      INSERT INTO users (email, password_hash)
      VALUES (?, ?)
    `).run('test@example.com', 'hashedpassword');

    userId = result.lastInsertRowid as number;

    // Generate JWT token for authentication
    authToken = jwt.sign(
      { userId, email: 'test@example.com' },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );

    // Create Express app
    app = express();
    app.use(express.json());
    app.use('/api/collections', collectionsRoutes);
    app.use(errorHandler);

    server = createServer(app);
  });

  afterEach(() => {
    if (server) {
      server.close();
      server = null;
    }
    cleanupTestDatabase(testDb);
  });

  describe('GET /api/collections', () => {
    it('should reject unauthenticated requests', async () => {
      const response = await request(server!)
        .get('/api/collections')
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('No authorization token provided');
    });

    it('should return empty list when user has no collections', async () => {
      const response = await request(server!)
        .get('/api/collections')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toEqual([]);
    });

    it('should return user collections with recipe counts', async () => {
      // Add test collections
      const col1 = testDb.prepare(`
        INSERT INTO collections (user_id, name, description)
        VALUES (?, ?, ?)
      `).run(userId, 'Classic Cocktails', 'Timeless recipes');
      const col1Id = col1.lastInsertRowid as number;

      const col2 = testDb.prepare(`
        INSERT INTO collections (user_id, name)
        VALUES (?, ?)
      `).run(userId, 'Summer Drinks');
      const col2Id = col2.lastInsertRowid as number;

      // Add recipes to collections
      testDb.prepare(`
        INSERT INTO recipes (user_id, collection_id, name, ingredients)
        VALUES (?, ?, ?, ?), (?, ?, ?, ?)
      `).run(
        userId, col1Id, 'Old Fashioned', JSON.stringify(['Bourbon', 'Bitters']),
        userId, col1Id, 'Manhattan', JSON.stringify(['Rye', 'Vermouth'])
      );

      const response = await request(server!)
        .get('/api/collections')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);

      const classicCol = response.body.data.find((c: any) => c.name === 'Classic Cocktails');
      expect(classicCol).toBeDefined();
      expect(classicCol.description).toBe('Timeless recipes');
      expect(classicCol.recipe_count).toBe(2);
    });

    it('should isolate user data', async () => {
      // Create another user
      const otherUserResult = testDb.prepare(`
        INSERT INTO users (email, password_hash)
        VALUES (?, ?)
      `).run('other@example.com', 'hashedpassword');
      const otherUserId = otherUserResult.lastInsertRowid as number;

      // Add collections for both users
      testDb.prepare(`
        INSERT INTO collections (user_id, name)
        VALUES (?, ?), (?, ?)
      `).run(
        userId, 'My Collection',
        otherUserId, 'Their Collection'
      );

      const response = await request(server!)
        .get('/api/collections')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe('My Collection');
    });
  });

  describe('POST /api/collections', () => {
    it('should reject unauthenticated requests', async () => {
      const response = await request(server!)
        .post('/api/collections')
        .send({ name: 'Test Collection' })
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should create a new collection with required fields', async () => {
      const response = await request(server!)
        .post('/api/collections')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Tiki Drinks'
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        name: 'Tiki Drinks',
        user_id: userId
      });
      expect(response.body.data.id).toBeGreaterThan(0);
    });

    it('should create collection with description', async () => {
      const response = await request(server!)
        .post('/api/collections')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Holiday Specials',
          description: 'Festive cocktails for celebrations'
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        name: 'Holiday Specials',
        description: 'Festive cocktails for celebrations'
      });
    });

    it('should reject missing name field', async () => {
      const response = await request(server!)
        .post('/api/collections')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: 'Collection without name'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/collections/:id', () => {
    let collectionId: number;

    beforeEach(() => {
      const result = testDb.prepare(`
        INSERT INTO collections (user_id, name, description)
        VALUES (?, ?, ?)
      `).run(userId, 'Original Name', 'Original description');
      collectionId = result.lastInsertRowid as number;
    });

    it('should reject unauthenticated requests', async () => {
      const response = await request(server!)
        .put(`/api/collections/${collectionId}`)
        .send({ name: 'Updated Name' })
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should update collection fields', async () => {
      const response = await request(server!)
        .put(`/api/collections/${collectionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Updated Name',
          description: 'Updated description'
        })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify update in database
      const updated = testDb.prepare('SELECT * FROM collections WHERE id = ?').get(collectionId) as any;
      expect(updated.name).toBe('Updated Name');
      expect(updated.description).toBe('Updated description');
    });

    it('should not allow updating other users collections', async () => {
      // Create another user and their collection
      const otherUserResult = testDb.prepare(`
        INSERT INTO users (email, password_hash)
        VALUES (?, ?)
      `).run('other@example.com', 'hashedpassword');
      const otherUserId = otherUserResult.lastInsertRowid as number;

      const otherCollectionResult = testDb.prepare(`
        INSERT INTO collections (user_id, name)
        VALUES (?, ?)
      `).run(otherUserId, 'Their Collection');
      const otherCollectionId = otherCollectionResult.lastInsertRowid as number;

      const response = await request(server!)
        .put(`/api/collections/${otherCollectionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Hacked Name' })
        .expect(404);

      expect(response.body.success).toBe(false);

      // Verify collection unchanged
      const unchanged = testDb.prepare('SELECT * FROM collections WHERE id = ?').get(otherCollectionId) as any;
      expect(unchanged.name).toBe('Their Collection');
    });

    it('should return 404 for non-existent collection', async () => {
      const response = await request(server!)
        .put('/api/collections/99999')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Updated Name' })
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/collections/:id', () => {
    let collectionId: number;

    beforeEach(() => {
      const result = testDb.prepare(`
        INSERT INTO collections (user_id, name)
        VALUES (?, ?)
      `).run(userId, 'To Delete');
      collectionId = result.lastInsertRowid as number;
    });

    it('should reject unauthenticated requests', async () => {
      const response = await request(server!)
        .delete(`/api/collections/${collectionId}`)
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should delete collection', async () => {
      const response = await request(server!)
        .delete(`/api/collections/${collectionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify deletion
      const deleted = testDb.prepare('SELECT * FROM collections WHERE id = ?').get(collectionId);
      expect(deleted).toBeUndefined();
    });

    it('should set collection_id to NULL for recipes when collection is deleted', async () => {
      // Add recipe to collection
      const recipeResult = testDb.prepare(`
        INSERT INTO recipes (user_id, collection_id, name, ingredients)
        VALUES (?, ?, ?, ?)
      `).run(userId, collectionId, 'Test Recipe', JSON.stringify(['Ingredient']));
      const recipeId = recipeResult.lastInsertRowid as number;

      await request(server!)
        .delete(`/api/collections/${collectionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Verify recipe still exists but collection_id is NULL
      const recipe = testDb.prepare('SELECT * FROM recipes WHERE id = ?').get(recipeId) as any;
      expect(recipe).toBeDefined();
      expect(recipe.collection_id).toBeNull();
    });

    it('should not allow deleting other users collections', async () => {
      // Create another user and their collection
      const otherUserResult = testDb.prepare(`
        INSERT INTO users (email, password_hash)
        VALUES (?, ?)
      `).run('other@example.com', 'hashedpassword');
      const otherUserId = otherUserResult.lastInsertRowid as number;

      const otherCollectionResult = testDb.prepare(`
        INSERT INTO collections (user_id, name)
        VALUES (?, ?)
      `).run(otherUserId, 'Their Collection');
      const otherCollectionId = otherCollectionResult.lastInsertRowid as number;

      const response = await request(server!)
        .delete(`/api/collections/${otherCollectionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);

      // Verify collection still exists
      const stillExists = testDb.prepare('SELECT * FROM collections WHERE id = ?').get(otherCollectionId);
      expect(stillExists).toBeDefined();
    });

    it('should return 404 for non-existent collection', async () => {
      const response = await request(server!)
        .delete('/api/collections/99999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });
});
