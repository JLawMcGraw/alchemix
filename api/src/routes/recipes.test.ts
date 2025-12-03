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

// Mock MemoryService - use inline functions since vi.mock is hoisted
vi.mock('../services/MemoryService', () => ({
  memoryService: {
    deleteUserRecipeByUid: vi.fn().mockResolvedValue(undefined),
    deleteUserRecipe: vi.fn().mockResolvedValue(undefined),
    bulkDeleteUserRecipesByUid: vi.fn().mockResolvedValue(undefined),
    deleteUserRecipesBatch: vi.fn().mockResolvedValue(undefined),
    deleteAllRecipeMemories: vi.fn().mockResolvedValue(undefined),
    storeUserRecipe: vi.fn().mockResolvedValue('mock-uid-12345'),
    storeUserRecipesBatch: vi.fn().mockResolvedValue(undefined),
    isEnabled: vi.fn().mockReturnValue(true),
    fullSyncUserRecipes: vi.fn().mockResolvedValue(undefined),
  },
}));

import recipesRoutes from './recipes';
import { errorHandler } from '../middleware/errorHandler';

describe('Recipes Routes Integration Tests', () => {
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
    app.use('/api/recipes', recipesRoutes);
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

  describe('GET /api/recipes', () => {
    it('should reject unauthenticated requests', async () => {
      const response = await request(server!)
        .get('/api/recipes')
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('No authorization token provided');
    });

    it('should return empty list when user has no recipes', async () => {
      const response = await request(server!)
        .get('/api/recipes')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toEqual([]);
      expect(response.body.pagination).toMatchObject({
        page: 1,
        limit: 50,
        total: 0,
        totalPages: 0
      });
    });

    it('should return user recipes with pagination', async () => {
      // Add test recipes
      testDb.prepare(`
        INSERT INTO recipes (user_id, name, ingredients, instructions)
        VALUES (?, ?, ?, ?), (?, ?, ?, ?), (?, ?, ?, ?)
      `).run(
        userId, 'Old Fashioned', JSON.stringify(['2 oz Bourbon', '1 sugar cube', '2 dashes bitters']), 'Stir with ice',
        userId, 'Martini', JSON.stringify(['2 oz Gin', '1 oz Dry vermouth']), 'Stir and strain',
        userId, 'Negroni', JSON.stringify(['1 oz Gin', '1 oz Campari', '1 oz Sweet vermouth']), 'Stir over ice'
      );

      const response = await request(server!)
        .get('/api/recipes')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(3);
      expect(response.body.pagination).toMatchObject({
        page: 1,
        limit: 50,
        total: 3,
        totalPages: 1
      });
    });

    it('should parse JSON ingredients correctly', async () => {
      testDb.prepare(`
        INSERT INTO recipes (user_id, name, ingredients, instructions)
        VALUES (?, ?, ?, ?)
      `).run(
        userId, 'Margarita', JSON.stringify(['2 oz Tequila', '1 oz Lime juice', '1 oz Triple sec']), 'Shake with ice'
      );

      const response = await request(server!)
        .get('/api/recipes')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data[0].ingredients).toEqual(['2 oz Tequila', '1 oz Lime juice', '1 oz Triple sec']);
    });

    it('should support custom pagination limits', async () => {
      // Add 10 recipes
      const stmt = testDb.prepare(`
        INSERT INTO recipes (user_id, name, ingredients, instructions)
        VALUES (?, ?, ?, ?)
      `);
      for (let i = 1; i <= 10; i++) {
        stmt.run(userId, `Recipe ${i}`, JSON.stringify(['Ingredient']), 'Instructions');
      }

      const response = await request(server!)
        .get('/api/recipes?limit=5')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(5);
      expect(response.body.pagination).toMatchObject({
        page: 1,
        limit: 5,
        total: 10,
        totalPages: 2
      });
    });

    it('should isolate user data', async () => {
      // Create another user
      const otherUserResult = testDb.prepare(`
        INSERT INTO users (email, password_hash)
        VALUES (?, ?)
      `).run('other@example.com', 'hashedpassword');
      const otherUserId = otherUserResult.lastInsertRowid as number;

      // Add recipes for both users
      testDb.prepare(`
        INSERT INTO recipes (user_id, name, ingredients, instructions)
        VALUES (?, ?, ?, ?), (?, ?, ?, ?)
      `).run(
        userId, 'My Recipe', JSON.stringify(['Ingredient']), 'Instructions',
        otherUserId, 'Their Recipe', JSON.stringify(['Ingredient']), 'Instructions'
      );

      const response = await request(server!)
        .get('/api/recipes')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe('My Recipe');
    });
  });

  describe('POST /api/recipes', () => {
    it('should reject unauthenticated requests', async () => {
      const response = await request(server!)
        .post('/api/recipes')
        .send({ name: 'Test Recipe', ingredients: ['Ingredient'], instructions: 'Instructions' })
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should create a new recipe with required fields', async () => {
      const response = await request(server!)
        .post('/api/recipes')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Mojito',
          ingredients: ['2 oz Rum', '1 oz Lime juice', 'Mint leaves', 'Soda water'],
          instructions: 'Muddle mint with lime juice and sugar. Add rum and ice. Top with soda.'
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        name: 'Mojito',
        user_id: userId
      });
      expect(response.body.data.id).toBeGreaterThan(0);
    });

    it('should create recipe with optional fields', async () => {
      const response = await request(server!)
        .post('/api/recipes')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Manhattan',
          ingredients: ['2 oz Rye', '1 oz Sweet vermouth', '2 dashes bitters'],
          instructions: 'Stir with ice and strain',
          glass: 'Coupe',
          category: 'Classic'
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        name: 'Manhattan',
        glass: 'Coupe',
        category: 'Classic'
      });
    });

    it('should accept ingredients as string array', async () => {
      const response = await request(server!)
        .post('/api/recipes')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Recipe',
          ingredients: ['Ingredient 1', 'Ingredient 2', 'Ingredient 3'],
          instructions: 'Mix together'
        })
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    it('should reject missing name field', async () => {
      const response = await request(server!)
        .post('/api/recipes')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          ingredients: ['Ingredient'],
          instructions: 'Instructions'
          // Missing name
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/recipes/:id', () => {
    let recipeId: number;

    beforeEach(() => {
      const result = testDb.prepare(`
        INSERT INTO recipes (user_id, name, ingredients, instructions)
        VALUES (?, ?, ?, ?)
      `).run(userId, 'Original Recipe', JSON.stringify(['Ingredient']), 'Original Instructions');
      recipeId = result.lastInsertRowid as number;
    });

    it('should reject unauthenticated requests', async () => {
      const response = await request(server!)
        .put(`/api/recipes/${recipeId}`)
        .send({ name: 'Updated Recipe' })
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should update recipe fields', async () => {
      const response = await request(server!)
        .put(`/api/recipes/${recipeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Updated Recipe',
          instructions: 'New instructions',
          glass: 'Highball'
        })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify update in database
      const updated = testDb.prepare('SELECT * FROM recipes WHERE id = ?').get(recipeId) as any;
      expect(updated.name).toBe('Updated Recipe');
      expect(updated.instructions).toBe('New instructions');
      expect(updated.glass).toBe('Highball');
    });

    it('should not allow updating other users recipes', async () => {
      // Create another user and their recipe
      const otherUserResult = testDb.prepare(`
        INSERT INTO users (email, password_hash)
        VALUES (?, ?)
      `).run('other@example.com', 'hashedpassword');
      const otherUserId = otherUserResult.lastInsertRowid as number;

      const otherRecipeResult = testDb.prepare(`
        INSERT INTO recipes (user_id, name, ingredients, instructions)
        VALUES (?, ?, ?, ?)
      `).run(otherUserId, 'Their Recipe', JSON.stringify(['Ingredient']), 'Instructions');
      const otherRecipeId = otherRecipeResult.lastInsertRowid as number;

      const response = await request(server!)
        .put(`/api/recipes/${otherRecipeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Hacked Recipe' })
        .expect(404);

      expect(response.body.success).toBe(false);

      // Verify recipe unchanged
      const unchanged = testDb.prepare('SELECT * FROM recipes WHERE id = ?').get(otherRecipeId) as any;
      expect(unchanged.name).toBe('Their Recipe');
    });

    it('should return 404 for non-existent recipe', async () => {
      const response = await request(server!)
        .put('/api/recipes/99999')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Updated Recipe' })
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/recipes/:id', () => {
    let recipeId: number;

    beforeEach(() => {
      const result = testDb.prepare(`
        INSERT INTO recipes (user_id, name, ingredients, instructions)
        VALUES (?, ?, ?, ?)
      `).run(userId, 'To Delete', JSON.stringify(['Ingredient']), 'Instructions');
      recipeId = result.lastInsertRowid as number;
    });

    it('should reject unauthenticated requests', async () => {
      const response = await request(server!)
        .delete(`/api/recipes/${recipeId}`)
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should delete recipe', async () => {
      const response = await request(server!)
        .delete(`/api/recipes/${recipeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify deletion
      const deleted = testDb.prepare('SELECT * FROM recipes WHERE id = ?').get(recipeId);
      expect(deleted).toBeUndefined();
    });

    it('should not allow deleting other users recipes', async () => {
      // Create another user and their recipe
      const otherUserResult = testDb.prepare(`
        INSERT INTO users (email, password_hash)
        VALUES (?, ?)
      `).run('other@example.com', 'hashedpassword');
      const otherUserId = otherUserResult.lastInsertRowid as number;

      const otherRecipeResult = testDb.prepare(`
        INSERT INTO recipes (user_id, name, ingredients, instructions)
        VALUES (?, ?, ?, ?)
      `).run(otherUserId, 'Their Recipe', JSON.stringify(['Ingredient']), 'Instructions');
      const otherRecipeId = otherRecipeResult.lastInsertRowid as number;

      const response = await request(server!)
        .delete(`/api/recipes/${otherRecipeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);

      // Verify recipe still exists
      const stillExists = testDb.prepare('SELECT * FROM recipes WHERE id = ?').get(otherRecipeId);
      expect(stillExists).toBeDefined();
    });

    it('should return 404 for non-existent recipe', async () => {
      const response = await request(server!)
        .delete('/api/recipes/99999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/recipes/bulk', () => {
    let recipeIds: number[];

    beforeEach(() => {
      const stmt = testDb.prepare(`
        INSERT INTO recipes (user_id, name, ingredients, instructions)
        VALUES (?, ?, ?, ?)
      `);

      recipeIds = [];
      for (let i = 1; i <= 5; i++) {
        const result = stmt.run(userId, `Recipe ${i}`, JSON.stringify(['Ingredient']), 'Instructions');
        recipeIds.push(result.lastInsertRowid as number);
      }
    });

    it('should reject unauthenticated requests', async () => {
      const response = await request(server!)
        .delete('/api/recipes/bulk')
        .send({ ids: recipeIds })
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should delete multiple recipes', async () => {
      const idsToDelete = [recipeIds[0], recipeIds[2], recipeIds[4]];

      const response = await request(server!)
        .delete('/api/recipes/bulk')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ ids: idsToDelete })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.deleted).toBe(3);

      // Verify deletions
      const remaining = testDb.prepare('SELECT * FROM recipes WHERE user_id = ?').all(userId);
      expect(remaining).toHaveLength(2);
    });

    it('should only delete user own recipes', async () => {
      // Create another user and their recipe
      const otherUserResult = testDb.prepare(`
        INSERT INTO users (email, password_hash)
        VALUES (?, ?)
      `).run('other@example.com', 'hashedpassword');
      const otherUserId = otherUserResult.lastInsertRowid as number;

      const otherRecipeResult = testDb.prepare(`
        INSERT INTO recipes (user_id, name, ingredients, instructions)
        VALUES (?, ?, ?, ?)
      `).run(otherUserId, 'Their Recipe', JSON.stringify(['Ingredient']), 'Instructions');
      const otherRecipeId = otherRecipeResult.lastInsertRowid as number;

      const response = await request(server!)
        .delete('/api/recipes/bulk')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ ids: [recipeIds[0], otherRecipeId] })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.deleted).toBe(1); // Only deleted own recipe

      // Verify other user's recipe still exists
      const stillExists = testDb.prepare('SELECT * FROM recipes WHERE id = ?').get(otherRecipeId);
      expect(stillExists).toBeDefined();
    });
  });

  describe('DELETE /api/recipes/all', () => {
    beforeEach(() => {
      const stmt = testDb.prepare(`
        INSERT INTO recipes (user_id, name, ingredients, instructions)
        VALUES (?, ?, ?, ?)
      `);

      for (let i = 1; i <= 5; i++) {
        stmt.run(userId, `Recipe ${i}`, JSON.stringify(['Ingredient']), 'Instructions');
      }
    });

    it('should reject unauthenticated requests', async () => {
      const response = await request(server!)
        .delete('/api/recipes/all')
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should delete all user recipes', async () => {
      const response = await request(server!)
        .delete('/api/recipes/all')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.deleted).toBe(5);

      // Verify all deleted
      const remaining = testDb.prepare('SELECT * FROM recipes WHERE user_id = ?').all(userId);
      expect(remaining).toHaveLength(0);
    });

    it('should only delete user own recipes', async () => {
      // Create another user and their recipes
      const otherUserResult = testDb.prepare(`
        INSERT INTO users (email, password_hash)
        VALUES (?, ?)
      `).run('other@example.com', 'hashedpassword');
      const otherUserId = otherUserResult.lastInsertRowid as number;

      testDb.prepare(`
        INSERT INTO recipes (user_id, name, ingredients, instructions)
        VALUES (?, ?, ?, ?)
      `).run(otherUserId, 'Their Recipe', JSON.stringify(['Ingredient']), 'Instructions');

      const response = await request(server!)
        .delete('/api/recipes/all')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.deleted).toBe(5);

      // Verify other user's recipes still exist
      const otherRecipes = testDb.prepare('SELECT * FROM recipes WHERE user_id = ?').all(otherUserId);
      expect(otherRecipes).toHaveLength(1);
    });
  });

  describe('MemMachine UUID Tracking', () => {

    describe('Recipe with memmachine_uid', () => {
      it('should store memmachine_uid in database', async () => {
        // Create recipe with UUID
        const result = testDb.prepare(`
          INSERT INTO recipes (user_id, name, ingredients, instructions, memmachine_uid)
          VALUES (?, ?, ?, ?, ?)
        `).run(userId, 'UUID Recipe', JSON.stringify(['Ingredient']), 'Instructions', 'test-uid-abc123');

        const recipeId = result.lastInsertRowid as number;

        // Verify UUID is stored
        const recipe = testDb.prepare('SELECT memmachine_uid FROM recipes WHERE id = ?').get(recipeId) as any;
        expect(recipe.memmachine_uid).toBe('test-uid-abc123');
      });

      it('should return memmachine_uid in GET response', async () => {
        // Create recipe with UUID
        testDb.prepare(`
          INSERT INTO recipes (user_id, name, ingredients, instructions, memmachine_uid)
          VALUES (?, ?, ?, ?, ?)
        `).run(userId, 'UUID Recipe', JSON.stringify(['Ingredient']), 'Instructions', 'get-test-uid');

        const response = await request(server!)
          .get('/api/recipes')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data[0].memmachine_uid).toBe('get-test-uid');
      });

      it('should allow recipe without memmachine_uid (null)', async () => {
        testDb.prepare(`
          INSERT INTO recipes (user_id, name, ingredients, instructions)
          VALUES (?, ?, ?, ?)
        `).run(userId, 'No UUID Recipe', JSON.stringify(['Ingredient']), 'Instructions');

        const response = await request(server!)
          .get('/api/recipes')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        // memmachine_uid should be null or undefined for recipes without it
        const recipe = response.body.data[0];
        expect(recipe.memmachine_uid === null || recipe.memmachine_uid === undefined).toBe(true);
      });
    });

    describe('DELETE with UUID tracking', () => {
      it('should delete recipe with UUID from database', async () => {
        const result = testDb.prepare(`
          INSERT INTO recipes (user_id, name, ingredients, instructions, memmachine_uid)
          VALUES (?, ?, ?, ?, ?)
        `).run(userId, 'Delete UUID Recipe', JSON.stringify(['Ingredient']), 'Instructions', 'delete-uuid-123');

        const recipeId = result.lastInsertRowid as number;

        const response = await request(server!)
          .delete(`/api/recipes/${recipeId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);

        // Verify deleted from database
        const deleted = testDb.prepare('SELECT * FROM recipes WHERE id = ?').get(recipeId);
        expect(deleted).toBeUndefined();
      });

      it('should delete recipe without UUID from database', async () => {
        const result = testDb.prepare(`
          INSERT INTO recipes (user_id, name, ingredients, instructions)
          VALUES (?, ?, ?, ?)
        `).run(userId, 'No UUID Recipe', JSON.stringify(['Ingredient']), 'Instructions');

        const recipeId = result.lastInsertRowid as number;

        const response = await request(server!)
          .delete(`/api/recipes/${recipeId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);

        // Verify deleted from database
        const deleted = testDb.prepare('SELECT * FROM recipes WHERE id = ?').get(recipeId);
        expect(deleted).toBeUndefined();
      });
    });

    describe('Bulk DELETE with UUID tracking', () => {
      it('should delete multiple recipes with UUIDs', async () => {
        const ids: number[] = [];

        // Create recipes with UUIDs
        for (let i = 0; i < 3; i++) {
          const result = testDb.prepare(`
            INSERT INTO recipes (user_id, name, ingredients, instructions, memmachine_uid)
            VALUES (?, ?, ?, ?, ?)
          `).run(userId, `UUID Recipe ${i}`, JSON.stringify(['Ingredient']), 'Instructions', `bulk-uuid-${i}`);
          ids.push(result.lastInsertRowid as number);
        }

        const response = await request(server!)
          .delete('/api/recipes/bulk')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ ids })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.deleted).toBe(3);

        // Verify all deleted from database
        const remaining = testDb.prepare('SELECT * FROM recipes WHERE user_id = ?').all(userId);
        expect(remaining).toHaveLength(0);
      });

      it('should delete mixed recipes (some with UUID, some without)', async () => {
        const ids: number[] = [];

        // Create recipe with UUID
        const result1 = testDb.prepare(`
          INSERT INTO recipes (user_id, name, ingredients, instructions, memmachine_uid)
          VALUES (?, ?, ?, ?, ?)
        `).run(userId, 'With UUID', JSON.stringify(['Ingredient']), 'Instructions', 'mixed-uuid-1');
        ids.push(result1.lastInsertRowid as number);

        // Create recipe without UUID
        const result2 = testDb.prepare(`
          INSERT INTO recipes (user_id, name, ingredients, instructions)
          VALUES (?, ?, ?, ?)
        `).run(userId, 'Without UUID', JSON.stringify(['Ingredient']), 'Instructions');
        ids.push(result2.lastInsertRowid as number);

        // Create another recipe with UUID
        const result3 = testDb.prepare(`
          INSERT INTO recipes (user_id, name, ingredients, instructions, memmachine_uid)
          VALUES (?, ?, ?, ?, ?)
        `).run(userId, 'With UUID 2', JSON.stringify(['Ingredient']), 'Instructions', 'mixed-uuid-2');
        ids.push(result3.lastInsertRowid as number);

        const response = await request(server!)
          .delete('/api/recipes/bulk')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ ids })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.deleted).toBe(3);

        // Verify all deleted from database
        const remaining = testDb.prepare('SELECT * FROM recipes WHERE user_id = ?').all(userId);
        expect(remaining).toHaveLength(0);
      });

      it('should handle empty UUID list gracefully', async () => {
        // Create recipes without UUIDs
        const ids: number[] = [];
        for (let i = 0; i < 2; i++) {
          const result = testDb.prepare(`
            INSERT INTO recipes (user_id, name, ingredients, instructions)
            VALUES (?, ?, ?, ?)
          `).run(userId, `No UUID Recipe ${i}`, JSON.stringify(['Ingredient']), 'Instructions');
          ids.push(result.lastInsertRowid as number);
        }

        const response = await request(server!)
          .delete('/api/recipes/bulk')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ ids })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.deleted).toBe(2);

        // Verify all deleted
        const remaining = testDb.prepare('SELECT * FROM recipes WHERE user_id = ?').all(userId);
        expect(remaining).toHaveLength(0);
      });
    });

    describe('DELETE ALL with UUID tracking', () => {
      it('should delete all recipes including those with UUIDs', async () => {
        // Create mix of recipes with and without UUIDs
        testDb.prepare(`
          INSERT INTO recipes (user_id, name, ingredients, instructions, memmachine_uid)
          VALUES (?, ?, ?, ?, ?)
        `).run(userId, 'With UUID', JSON.stringify(['Ingredient']), 'Instructions', 'all-uuid-1');

        testDb.prepare(`
          INSERT INTO recipes (user_id, name, ingredients, instructions)
          VALUES (?, ?, ?, ?)
        `).run(userId, 'Without UUID', JSON.stringify(['Ingredient']), 'Instructions');

        testDb.prepare(`
          INSERT INTO recipes (user_id, name, ingredients, instructions, memmachine_uid)
          VALUES (?, ?, ?, ?, ?)
        `).run(userId, 'With UUID 2', JSON.stringify(['Ingredient']), 'Instructions', 'all-uuid-2');

        const response = await request(server!)
          .delete('/api/recipes/all')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.deleted).toBe(3);

        // Verify all deleted from database
        const remaining = testDb.prepare('SELECT * FROM recipes WHERE user_id = ?').all(userId);
        expect(remaining).toHaveLength(0);
      });
    });

    describe('UUID Index', () => {
      it('should be able to query by memmachine_uid', async () => {
        testDb.prepare(`
          INSERT INTO recipes (user_id, name, ingredients, instructions, memmachine_uid)
          VALUES (?, ?, ?, ?, ?)
        `).run(userId, 'Indexed Recipe', JSON.stringify(['Ingredient']), 'Instructions', 'index-test-uid');

        // Query by UUID (simulating MemMachine sync scenario)
        const recipe = testDb.prepare('SELECT * FROM recipes WHERE memmachine_uid = ?')
          .get('index-test-uid') as any;

        expect(recipe).toBeDefined();
        expect(recipe.name).toBe('Indexed Recipe');
        expect(recipe.memmachine_uid).toBe('index-test-uid');
      });

      it('should handle duplicate UUID prevention if needed', async () => {
        // First insert
        testDb.prepare(`
          INSERT INTO recipes (user_id, name, ingredients, instructions, memmachine_uid)
          VALUES (?, ?, ?, ?, ?)
        `).run(userId, 'First Recipe', JSON.stringify(['Ingredient']), 'Instructions', 'unique-uuid-test');

        // UUID column doesn't have UNIQUE constraint, so duplicates are allowed
        // (different users might theoretically have same UUID from MemMachine, though unlikely)
        // This test verifies the behavior is as expected
        const secondInsert = () => {
          testDb.prepare(`
            INSERT INTO recipes (user_id, name, ingredients, instructions, memmachine_uid)
            VALUES (?, ?, ?, ?, ?)
          `).run(userId, 'Second Recipe', JSON.stringify(['Ingredient']), 'Instructions', 'unique-uuid-test');
        };

        // Should not throw - duplicates allowed in current schema
        expect(secondInsert).not.toThrow();

        // Verify both recipes exist
        const recipes = testDb.prepare('SELECT * FROM recipes WHERE memmachine_uid = ?')
          .all('unique-uuid-test');
        expect(recipes).toHaveLength(2);
      });
    });
  });
});
