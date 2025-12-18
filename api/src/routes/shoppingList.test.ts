/**
 * Shopping List Routes Tests
 *
 * Tests for shopping list CRUD and smart recommendations.
 * Updated for PostgreSQL async pattern.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock the database module FIRST (before any imports that use it)
vi.mock('../database/db', () => ({
  queryOne: vi.fn(),
  queryAll: vi.fn(),
  execute: vi.fn(),
}));

// Mock the auth middleware to bypass JWT verification
vi.mock('../middleware/auth', () => ({
  authMiddleware: vi.fn((req: any, _res: any, next: any) => {
    req.user = { userId: 1, email: 'test@example.com' };
    next();
  }),
  generateToken: vi.fn(() => 'mock-token'),
  generateTokenId: vi.fn(() => 'mock-jti'),
}));

// Mock token blacklist
vi.mock('../utils/tokenBlacklist', () => ({
  tokenBlacklist: {
    isBlacklisted: vi.fn().mockResolvedValue(false),
    add: vi.fn(),
  },
}));

// Mock logger
vi.mock('../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  logSecurityEvent: vi.fn(),
}));

import { queryOne, queryAll, execute } from '../database/db';

// Helper to create mock shopping list item
const createMockItem = (overrides: Partial<{
  id: number;
  user_id: number;
  name: string;
  checked: boolean;
  created_at: string;
}> = {}) => ({
  id: 1,
  user_id: 1,
  name: 'Test Item',
  checked: false,
  created_at: new Date().toISOString(),
  ...overrides,
});

describe('Shopping List Routes', () => {
  let app: express.Application;
  const testUserId = 1;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Default mock implementations
    (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (execute as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [], rowCount: 0 });

    // Create fresh app with routes
    app = express();
    app.use(express.json());

    // Import routes fresh (auth is already mocked)
    const { default: shoppingListRouter } = await import('./shoppingList');
    app.use('/api/shopping-list', shoppingListRouter);

    // Add error handler
    app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      res.status(500).json({ success: false, error: err.message });
    });
  });

  describe('GET /api/shopping-list/smart', () => {
    it('should return empty recommendations when user has no inventory', async () => {
      // Mock: no inventory items, no recipes
      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const res = await request(app).get('/api/shopping-list/smart');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
      expect(res.body.stats).toMatchObject({
        totalRecipes: 0,
        craftable: 0,
        nearMisses: 0,
        inventoryItems: 0,
      });
    });

    it('should return recommendations based on near-miss recipes', async () => {
      // Mock inventory and recipes for a near-miss scenario
      // First call: inventory items
      // Second call: recipes
      (queryAll as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce([
          { id: 1, name: 'Bourbon', category: 'spirit', stock_number: 1 },
        ])
        .mockResolvedValueOnce([
          { id: 1, name: 'Old Fashioned', ingredients: JSON.stringify(['2 oz Bourbon', '2 dashes Bitters']) },
        ]);

      const res = await request(app).get('/api/shopping-list/smart');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.stats).toBeDefined();
    });
  });

  describe('GET /api/shopping-list/items', () => {
    it('should return empty array when no items exist', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue({ total: '0' });
      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const res = await request(app).get('/api/shopping-list/items');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
    });

    it('should return all items when ?all=true', async () => {
      const mockItems = [
        createMockItem({ id: 1, name: 'Angostura Bitters', checked: false }),
        createMockItem({ id: 2, name: 'Simple Syrup', checked: true }),
      ];

      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue(mockItems);

      const res = await request(app).get('/api/shopping-list/items?all=true');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].name).toBe('Angostura Bitters');
    });

    it('should return paginated items', async () => {
      const mockItems = [
        createMockItem({ id: 1, name: 'Item 1' }),
        createMockItem({ id: 2, name: 'Item 2' }),
      ];

      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue({ total: '5' });
      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue(mockItems);

      const res = await request(app).get('/api/shopping-list/items?page=1&limit=2');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.total).toBe(5);
    });
  });

  describe('POST /api/shopping-list/items', () => {
    it('should add a new item to the shopping list', async () => {
      const newItem = createMockItem({ id: 1, name: 'Angostura Bitters', checked: false });

      // No duplicate exists
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [newItem],
        rowCount: 1,
      });

      const res = await request(app)
        .post('/api/shopping-list/items')
        .send({ name: 'Angostura Bitters' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Angostura Bitters');
      expect(res.body.data.checked).toBe(false);
    });

    it('should return 400 for empty item name', async () => {
      const res = await request(app)
        .post('/api/shopping-list/items')
        .send({ name: '' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('required');
    });

    it('should return 409 for duplicate item', async () => {
      // Duplicate exists
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 1, name: 'Angostura Bitters' });

      const res = await request(app)
        .post('/api/shopping-list/items')
        .send({ name: 'Angostura Bitters' });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('already');
    });

    it('should trim whitespace from item names', async () => {
      const newItem = createMockItem({ id: 1, name: 'Triple Sec', checked: false });

      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [newItem],
        rowCount: 1,
      });

      const res = await request(app)
        .post('/api/shopping-list/items')
        .send({ name: '  Triple Sec  ' });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('Triple Sec');
    });
  });

  describe('PUT /api/shopping-list/items/:id', () => {
    it('should toggle checked status', async () => {
      const updatedItem = createMockItem({ id: 1, name: 'Test Item', checked: true });

      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: 1 }); // exists check
      (execute as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        rows: [updatedItem],
        rowCount: 1,
      });

      const res = await request(app)
        .put('/api/shopping-list/items/1')
        .send({ checked: true });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.checked).toBe(true);
    });

    it('should rename an item', async () => {
      const updatedItem = createMockItem({ id: 1, name: 'Renamed Item' });

      (queryOne as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ id: 1 }) // exists check
        .mockResolvedValueOnce(null); // duplicate check
      (execute as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        rows: [updatedItem],
        rowCount: 1,
      });

      const res = await request(app)
        .put('/api/shopping-list/items/1')
        .send({ name: 'Renamed Item' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Renamed Item');
    });

    it('should return 404 for non-existent item', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const res = await request(app)
        .put('/api/shopping-list/items/999')
        .send({ checked: true });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 for invalid item ID', async () => {
      const res = await request(app)
        .put('/api/shopping-list/items/invalid')
        .send({ checked: true });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 with no valid fields', async () => {
      const res = await request(app)
        .put('/api/shopping-list/items/1')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('DELETE /api/shopping-list/items/:id', () => {
    it('should delete an item', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 1 });
      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({ rowCount: 1 });

      const res = await request(app).delete('/api/shopping-list/items/1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 404 for non-existent item', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const res = await request(app).delete('/api/shopping-list/items/999');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 for invalid item ID', async () => {
      const res = await request(app).delete('/api/shopping-list/items/invalid');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('DELETE /api/shopping-list/items/checked', () => {
    it('should delete all checked items', async () => {
      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({ rowCount: 2 });

      const res = await request(app).delete('/api/shopping-list/items/checked');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.deleted).toBe(2);
    });

    it('should return 0 deleted when no checked items exist', async () => {
      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({ rowCount: 0 });

      const res = await request(app).delete('/api/shopping-list/items/checked');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.deleted).toBe(0);
    });
  });
});
