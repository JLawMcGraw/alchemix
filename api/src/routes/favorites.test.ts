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

import favoritesRoutes from './favorites';
import { errorHandler } from '../middleware/errorHandler';

describe('Favorites Routes Integration Tests', () => {
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
    app.use('/api/favorites', favoritesRoutes);
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

  describe('GET /api/favorites', () => {
    it('should reject unauthenticated requests', async () => {
      const response = await request(server!)
        .get('/api/favorites')
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('No authorization token provided');
    });

    it('should return empty list when user has no favorites', async () => {
      const response = await request(server!)
        .get('/api/favorites')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toEqual([]);
    });

    it('should return user favorites', async () => {
      // Add recipes
      const recipe1 = testDb.prepare(`
        INSERT INTO recipes (user_id, name, ingredients)
        VALUES (?, ?, ?)
      `).run(userId, 'Old Fashioned', JSON.stringify(['Bourbon', 'Bitters']));
      const recipe1Id = recipe1.lastInsertRowid as number;

      const recipe2 = testDb.prepare(`
        INSERT INTO recipes (user_id, name, ingredients)
        VALUES (?, ?, ?)
      `).run(userId, 'Martini', JSON.stringify(['Gin', 'Vermouth']));
      const recipe2Id = recipe2.lastInsertRowid as number;

      // Add favorites
      testDb.prepare(`
        INSERT INTO favorites (user_id, recipe_name, recipe_id)
        VALUES (?, ?, ?), (?, ?, ?)
      `).run(
        userId, 'Old Fashioned', recipe1Id,
        userId, 'Martini', recipe2Id
      );

      const response = await request(server!)
        .get('/api/favorites')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data.map((f: any) => f.recipe_name)).toContain('Old Fashioned');
      expect(response.body.data.map((f: any) => f.recipe_name)).toContain('Martini');
    });

    it('should isolate user data', async () => {
      // Create another user
      const otherUserResult = testDb.prepare(`
        INSERT INTO users (email, password_hash)
        VALUES (?, ?)
      `).run('other@example.com', 'hashedpassword');
      const otherUserId = otherUserResult.lastInsertRowid as number;

      // Add recipe
      const recipeResult = testDb.prepare(`
        INSERT INTO recipes (user_id, name, ingredients)
        VALUES (?, ?, ?)
      `).run(userId, 'Test Recipe', JSON.stringify(['Ingredient']));
      const recipeId = recipeResult.lastInsertRowid as number;

      // Add favorites for both users
      testDb.prepare(`
        INSERT INTO favorites (user_id, recipe_name, recipe_id)
        VALUES (?, ?, ?), (?, ?, ?)
      `).run(
        userId, 'Test Recipe', recipeId,
        otherUserId, 'Test Recipe', recipeId
      );

      const response = await request(server!)
        .get('/api/favorites')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].user_id).toBe(userId);
    });
  });

  describe('POST /api/favorites', () => {
    let recipeId: number;

    beforeEach(() => {
      const result = testDb.prepare(`
        INSERT INTO recipes (user_id, name, ingredients)
        VALUES (?, ?, ?)
      `).run(userId, 'Test Recipe', JSON.stringify(['Ingredient']));
      recipeId = result.lastInsertRowid as number;
    });

    it('should reject unauthenticated requests', async () => {
      const response = await request(server!)
        .post('/api/favorites')
        .send({ recipe_name: 'Test Recipe', recipe_id: recipeId })
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should add a recipe to favorites', async () => {
      const response = await request(server!)
        .post('/api/favorites')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          recipe_name: 'Test Recipe',
          recipe_id: recipeId
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        recipe_name: 'Test Recipe',
        recipe_id: recipeId,
        user_id: userId
      });
    });

    it('should allow favoriting recipe by name only', async () => {
      const response = await request(server!)
        .post('/api/favorites')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          recipe_name: 'External Recipe'
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        recipe_name: 'External Recipe'
      });
    });

    it('should reject duplicate favorites', async () => {
      // Add first favorite
      testDb.prepare(`
        INSERT INTO favorites (user_id, recipe_name, recipe_id)
        VALUES (?, ?, ?)
      `).run(userId, 'Test Recipe', recipeId);

      const response = await request(server!)
        .post('/api/favorites')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          recipe_name: 'Test Recipe',
          recipe_id: recipeId
        })
        .expect(500); // SQLite UNIQUE constraint violation

      expect(response.body.success).toBe(false);
    });

    it('should reject missing recipe_name', async () => {
      const response = await request(server!)
        .post('/api/favorites')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          recipe_id: recipeId
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/favorites/:id', () => {
    let favoriteId: number;

    beforeEach(() => {
      const recipeResult = testDb.prepare(`
        INSERT INTO recipes (user_id, name, ingredients)
        VALUES (?, ?, ?)
      `).run(userId, 'Test Recipe', JSON.stringify(['Ingredient']));
      const recipeId = recipeResult.lastInsertRowid as number;

      const favoriteResult = testDb.prepare(`
        INSERT INTO favorites (user_id, recipe_name, recipe_id)
        VALUES (?, ?, ?)
      `).run(userId, 'Test Recipe', recipeId);
      favoriteId = favoriteResult.lastInsertRowid as number;
    });

    it('should reject unauthenticated requests', async () => {
      const response = await request(server!)
        .delete(`/api/favorites/${favoriteId}`)
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should remove favorite', async () => {
      const response = await request(server!)
        .delete(`/api/favorites/${favoriteId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify deletion
      const deleted = testDb.prepare('SELECT * FROM favorites WHERE id = ?').get(favoriteId);
      expect(deleted).toBeUndefined();
    });

    it('should not allow removing other users favorites', async () => {
      // Create another user and their favorite
      const otherUserResult = testDb.prepare(`
        INSERT INTO users (email, password_hash)
        VALUES (?, ?)
      `).run('other@example.com', 'hashedpassword');
      const otherUserId = otherUserResult.lastInsertRowid as number;

      const otherFavoriteResult = testDb.prepare(`
        INSERT INTO favorites (user_id, recipe_name)
        VALUES (?, ?)
      `).run(otherUserId, 'Their Favorite');
      const otherFavoriteId = otherFavoriteResult.lastInsertRowid as number;

      const response = await request(server!)
        .delete(`/api/favorites/${otherFavoriteId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);

      // Verify favorite still exists
      const stillExists = testDb.prepare('SELECT * FROM favorites WHERE id = ?').get(otherFavoriteId);
      expect(stillExists).toBeDefined();
    });

    it('should return 404 for non-existent favorite', async () => {
      const response = await request(server!)
        .delete('/api/favorites/99999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });
});
