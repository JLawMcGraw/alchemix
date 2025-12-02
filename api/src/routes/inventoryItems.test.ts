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

import inventoryItemsRoutes from './inventoryItems';
import { errorHandler } from '../middleware/errorHandler';

describe('Inventory Items Routes Integration Tests', () => {
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
    app.use('/api/inventory-items', inventoryItemsRoutes);
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

  describe('GET /api/inventory-items', () => {
    it('should reject unauthenticated requests', async () => {
      const response = await request(server!)
        .get('/api/inventory-items')
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('No authorization token provided');
    });

    it('should return empty list when user has no items', async () => {
      const response = await request(server!)
        .get('/api/inventory-items')
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

    it('should return user inventory items with pagination', async () => {
      // Add test items
      testDb.prepare(`
        INSERT INTO inventory_items (user_id, name, category)
        VALUES (?, ?, ?), (?, ?, ?), (?, ?, ?)
      `).run(
        userId, 'Bourbon', 'spirit',
        userId, 'Gin', 'spirit',
        userId, 'Tonic Water', 'mixer'
      );

      const response = await request(server!)
        .get('/api/inventory-items')
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

    it('should support category filtering', async () => {
      // Add mixed category items
      testDb.prepare(`
        INSERT INTO inventory_items (user_id, name, category)
        VALUES (?, ?, ?), (?, ?, ?), (?, ?, ?)
      `).run(
        userId, 'Bourbon', 'spirit',
        userId, 'Gin', 'spirit',
        userId, 'Tonic Water', 'mixer'
      );

      const response = await request(server!)
        .get('/api/inventory-items?category=spirit')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data.every((item: any) => item.category === 'spirit')).toBe(true);
    });

    it('should support custom pagination limits', async () => {
      // Add 10 items
      const stmt = testDb.prepare(`
        INSERT INTO inventory_items (user_id, name, category)
        VALUES (?, ?, ?)
      `);
      for (let i = 1; i <= 10; i++) {
        stmt.run(userId, `Item ${i}`, 'spirit');
      }

      const response = await request(server!)
        .get('/api/inventory-items?limit=5')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(5);
      expect(response.body.pagination).toMatchObject({
        page: 1,
        limit: 5,
        total: 10,
        totalPages: 2,
        hasNextPage: true
      });
    });

    it('should support pagination across multiple pages', async () => {
      // Add 15 items
      const stmt = testDb.prepare(`
        INSERT INTO inventory_items (user_id, name, category)
        VALUES (?, ?, ?)
      `);
      for (let i = 1; i <= 15; i++) {
        stmt.run(userId, `Item ${i}`, 'spirit');
      }

      const response = await request(server!)
        .get('/api/inventory-items?page=2&limit=5')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(5);
      expect(response.body.pagination).toMatchObject({
        page: 2,
        limit: 5,
        total: 15,
        totalPages: 3,
        hasNextPage: true,
        hasPreviousPage: true
      });
    });

    it('should isolate user data (not return other users items)', async () => {
      // Create another user
      const otherUserResult = testDb.prepare(`
        INSERT INTO users (email, password_hash)
        VALUES (?, ?)
      `).run('other@example.com', 'hashedpassword');
      const otherUserId = otherUserResult.lastInsertRowid as number;

      // Add items for both users
      testDb.prepare(`
        INSERT INTO inventory_items (user_id, name, category)
        VALUES (?, ?, ?), (?, ?, ?)
      `).run(
        userId, 'My Bourbon', 'spirit',
        otherUserId, 'Their Gin', 'spirit'
      );

      const response = await request(server!)
        .get('/api/inventory-items')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe('My Bourbon');
      expect(response.body.data[0].user_id).toBe(userId);
    });
  });

  describe('POST /api/inventory-items', () => {
    it('should reject unauthenticated requests', async () => {
      const response = await request(server!)
        .post('/api/inventory-items')
        .send({ name: 'Bourbon', category: 'spirit' })
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should create a new inventory item with required fields', async () => {
      const response = await request(server!)
        .post('/api/inventory-items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Makers Mark',
          category: 'spirit'
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        name: 'Makers Mark',
        category: 'spirit',
        user_id: userId
      });
      expect(response.body.data.id).toBeGreaterThan(0);
    });

    it('should create inventory item with all optional fields', async () => {
      const response = await request(server!)
        .post('/api/inventory-items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Makers Mark',
          category: 'spirit',
          type: 'Bourbon',
          abv: '45',
          stock_number: 123,
          spirit_classification: 'Kentucky Straight Bourbon',
          distillation_method: 'Column Still',
          distillery_location: 'Kentucky, USA',
          age_statement: '7 Year',
          additional_notes: 'Great for cocktails',
          profile_nose: 'Caramel and vanilla',
          palate: 'Smooth and sweet',
          finish: 'Long and warming',
          tasting_notes: 'One of my favorites'
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        name: 'Makers Mark',
        category: 'spirit',
        type: 'Bourbon',
        abv: '45'
      });
    });

    it('should reject invalid category', async () => {
      const response = await request(server!)
        .post('/api/inventory-items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Item',
          category: 'invalid_category'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeTruthy();
    });

    it('should reject missing required fields', async () => {
      const response = await request(server!)
        .post('/api/inventory-items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          category: 'spirit'
          // Missing name
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/inventory-items/:id', () => {
    let itemId: number;

    beforeEach(() => {
      const result = testDb.prepare(`
        INSERT INTO inventory_items (user_id, name, category, type)
        VALUES (?, ?, ?, ?)
      `).run(userId, 'Original Name', 'spirit', 'Bourbon');
      itemId = result.lastInsertRowid as number;
    });

    it('should reject unauthenticated requests', async () => {
      const response = await request(server!)
        .put(`/api/inventory-items/${itemId}`)
        .send({ name: 'Updated Name' })
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should update inventory item fields', async () => {
      const response = await request(server!)
        .put(`/api/inventory-items/${itemId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Updated Name',
          type: 'Rye Whiskey',
          abv: '50'
        })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify update in database
      const updated = testDb.prepare('SELECT * FROM inventory_items WHERE id = ?').get(itemId) as any;
      expect(updated.name).toBe('Updated Name');
      expect(updated.type).toBe('Rye Whiskey');
      expect(updated.abv).toBe('50');
    });

    it('should not allow updating other users items', async () => {
      // Create another user and their item
      const otherUserResult = testDb.prepare(`
        INSERT INTO users (email, password_hash)
        VALUES (?, ?)
      `).run('other@example.com', 'hashedpassword');
      const otherUserId = otherUserResult.lastInsertRowid as number;

      const otherItemResult = testDb.prepare(`
        INSERT INTO inventory_items (user_id, name, category)
        VALUES (?, ?, ?)
      `).run(otherUserId, 'Their Item', 'spirit');
      const otherItemId = otherItemResult.lastInsertRowid as number;

      const response = await request(server!)
        .put(`/api/inventory-items/${otherItemId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Hacked Name' })
        .expect(404);

      expect(response.body.success).toBe(false);

      // Verify item unchanged
      const unchanged = testDb.prepare('SELECT * FROM inventory_items WHERE id = ?').get(otherItemId) as any;
      expect(unchanged.name).toBe('Their Item');
    });

    it('should return 404 for non-existent item', async () => {
      const response = await request(server!)
        .put('/api/inventory-items/99999')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Updated Name' })
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/inventory-items/:id', () => {
    let itemId: number;

    beforeEach(() => {
      const result = testDb.prepare(`
        INSERT INTO inventory_items (user_id, name, category)
        VALUES (?, ?, ?)
      `).run(userId, 'To Delete', 'spirit');
      itemId = result.lastInsertRowid as number;
    });

    it('should reject unauthenticated requests', async () => {
      const response = await request(server!)
        .delete(`/api/inventory-items/${itemId}`)
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should delete inventory item', async () => {
      const response = await request(server!)
        .delete(`/api/inventory-items/${itemId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify deletion
      const deleted = testDb.prepare('SELECT * FROM inventory_items WHERE id = ?').get(itemId);
      expect(deleted).toBeUndefined();
    });

    it('should not allow deleting other users items', async () => {
      // Create another user and their item
      const otherUserResult = testDb.prepare(`
        INSERT INTO users (email, password_hash)
        VALUES (?, ?)
      `).run('other@example.com', 'hashedpassword');
      const otherUserId = otherUserResult.lastInsertRowid as number;

      const otherItemResult = testDb.prepare(`
        INSERT INTO inventory_items (user_id, name, category)
        VALUES (?, ?, ?)
      `).run(otherUserId, 'Their Item', 'spirit');
      const otherItemId = otherItemResult.lastInsertRowid as number;

      const response = await request(server!)
        .delete(`/api/inventory-items/${otherItemId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);

      // Verify item still exists
      const stillExists = testDb.prepare('SELECT * FROM inventory_items WHERE id = ?').get(otherItemId);
      expect(stillExists).toBeDefined();
    });

    it('should return 404 for non-existent item', async () => {
      const response = await request(server!)
        .delete('/api/inventory-items/99999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });
});
