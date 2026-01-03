/**
 * Inventory Items Routes Tests
 *
 * Tests for inventory items CRUD operations.
 * Updated for PostgreSQL async pattern.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import express, { Request, Response, NextFunction } from 'express';
import request from 'supertest';

// Mock the database module FIRST (before any imports that use it)
vi.mock('../database/db', () => ({
  queryOne: vi.fn(),
  queryAll: vi.fn(),
  execute: vi.fn(),
  transaction: vi.fn(),
}));

// Mock the auth middleware to bypass JWT verification
vi.mock('../middleware/auth', () => ({
  authMiddleware: vi.fn((req: Request & { user?: { userId: number; email: string } }, _res: Response, next: NextFunction) => {
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

// Helper to create mock inventory item
const createMockItem = (overrides: Partial<{
  id: number;
  user_id: number;
  name: string;
  category: string;
  type: string | null;
  abv: string | null;
  created_at: string;
}> = {}) => ({
  id: 1,
  user_id: 1,
  name: 'Test Spirit',
  category: 'spirit',
  type: null,
  abv: null,
  created_at: new Date().toISOString(),
  ...overrides,
});

describe('Inventory Items Routes', () => {
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
    const { default: inventoryItemsRouter } = await import('./inventoryItems');
    app.use('/api/inventory-items', inventoryItemsRouter);

    // Add error handler
    app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      res.status(500).json({ success: false, error: err.message });
    });
  });

  describe('GET /api/inventory-items', () => {
    it('should return empty list when user has no items', async () => {
      // Mock: total count = 0
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue({ total: '0' });
      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const res = await request(app).get('/api/inventory-items');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
      expect(res.body.pagination).toMatchObject({
        page: 1,
        limit: 50,
        total: 0,
        totalPages: 0,
      });
    });

    it('should return user inventory items with pagination', async () => {
      const mockItems = [
        createMockItem({ id: 1, name: 'Bourbon', category: 'spirit' }),
        createMockItem({ id: 2, name: 'Gin', category: 'spirit' }),
        createMockItem({ id: 3, name: 'Tonic Water', category: 'mixer' }),
      ];

      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue({ total: '3' });
      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue(mockItems);

      const res = await request(app).get('/api/inventory-items');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(3);
      expect(res.body.pagination).toMatchObject({
        page: 1,
        limit: 50,
        total: 3,
        totalPages: 1,
      });
    });

    it('should support category filtering', async () => {
      const spiritItems = [
        createMockItem({ id: 1, name: 'Bourbon', category: 'spirit' }),
        createMockItem({ id: 2, name: 'Gin', category: 'spirit' }),
      ];

      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue({ total: '2' });
      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue(spiritItems);

      const res = await request(app).get('/api/inventory-items?category=spirit');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data.every((item: { category: string }) => item.category === 'spirit')).toBe(true);
    });

    it('should support custom pagination limits', async () => {
      const mockItems = Array.from({ length: 5 }, (_, i) =>
        createMockItem({ id: i + 1, name: `Item ${i + 1}` })
      );

      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue({ total: '10' });
      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue(mockItems);

      const res = await request(app).get('/api/inventory-items?limit=5');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(5);
      expect(res.body.pagination).toMatchObject({
        page: 1,
        limit: 5,
        total: 10,
        totalPages: 2,
        hasNextPage: true,
      });
    });

    it('should support pagination across multiple pages', async () => {
      const mockItems = Array.from({ length: 5 }, (_, i) =>
        createMockItem({ id: i + 6, name: `Item ${i + 6}` })
      );

      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue({ total: '15' });
      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue(mockItems);

      const res = await request(app).get('/api/inventory-items?page=2&limit=5');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(5);
      expect(res.body.pagination).toMatchObject({
        page: 2,
        limit: 5,
        total: 15,
        totalPages: 3,
        hasNextPage: true,
        hasPreviousPage: true,
      });
    });

    it('should only return items for authenticated user', async () => {
      const userItem = createMockItem({ id: 1, user_id: testUserId, name: 'My Bourbon' });

      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue({ total: '1' });
      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue([userItem]);

      const res = await request(app).get('/api/inventory-items');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].name).toBe('My Bourbon');
      expect(res.body.data[0].user_id).toBe(testUserId);
    });

    it('should return 400 for invalid page parameter', async () => {
      const res = await request(app).get('/api/inventory-items?page=abc');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Invalid page parameter');
    });

    it('should return 400 for invalid limit parameter', async () => {
      const res = await request(app).get('/api/inventory-items?limit=abc');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Invalid limit parameter');
    });

    it('should accept limit up to 500 (for periodic table support)', async () => {
      const mockItems = Array.from({ length: 10 }, (_, i) =>
        createMockItem({ id: i + 1, name: `Item ${i + 1}` })
      );

      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue({ total: '10' });
      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue(mockItems);

      const res = await request(app).get('/api/inventory-items?limit=500');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.pagination.limit).toBe(500);
    });

    it('should return 400 when limit exceeds 500', async () => {
      const res = await request(app).get('/api/inventory-items?limit=501');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Invalid limit parameter');
    });

    it('should return 400 for invalid category parameter', async () => {
      const res = await request(app).get('/api/inventory-items?category=invalid_category');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Invalid category parameter');
    });
  });

  describe('POST /api/inventory-items', () => {
    it('should create a new inventory item with required fields', async () => {
      const newItem = createMockItem({ id: 1, name: 'Makers Mark', category: 'spirit' });

      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [newItem],
        rowCount: 1,
      });

      const res = await request(app)
        .post('/api/inventory-items')
        .send({
          name: 'Makers Mark',
          category: 'spirit',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Makers Mark');
      expect(res.body.data.category).toBe('spirit');
      expect(res.body.data.user_id).toBe(testUserId);
      expect(res.body.data.id).toBeDefined();
    });

    it('should create inventory item with all optional fields', async () => {
      const newItem = createMockItem({
        id: 1,
        name: 'Makers Mark',
        category: 'spirit',
        type: 'Bourbon',
        abv: '45',
      });

      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [newItem],
        rowCount: 1,
      });

      const res = await request(app)
        .post('/api/inventory-items')
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
          tasting_notes: 'One of my favorites',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Makers Mark');
      expect(res.body.data.category).toBe('spirit');
      expect(res.body.data.type).toBe('Bourbon');
      expect(res.body.data.abv).toBe('45');
    });

    it('should return 400 for invalid category', async () => {
      const res = await request(app)
        .post('/api/inventory-items')
        .send({
          name: 'Test Item',
          category: 'invalid_category',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeTruthy();
    });

    it('should return 400 when name is missing', async () => {
      const res = await request(app)
        .post('/api/inventory-items')
        .send({
          category: 'spirit',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should auto-categorize item when category is missing', async () => {
      const newItem = createMockItem({
        id: 1,
        name: 'Test Item',
        category: 'other', // auto-categorized to 'other' when no category provided
      });

      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [newItem],
        rowCount: 1,
      });

      const res = await request(app)
        .post('/api/inventory-items')
        .send({
          name: 'Test Item',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.category).toBe('other');
    });
  });

  describe('PUT /api/inventory-items/:id', () => {
    it('should update inventory item fields', async () => {
      const updatedItem = createMockItem({
        id: 1,
        name: 'Updated Name',
        type: 'Rye Whiskey',
        abv: '50',
      });

      // Mock: exists check returns true, then execute returns updated item
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: 1 }); // exists check
      (execute as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        rows: [updatedItem],
        rowCount: 1,
      });

      const res = await request(app)
        .put('/api/inventory-items/1')
        .send({
          name: 'Updated Name',
          category: 'spirit',
          type: 'Rye Whiskey',
          abv: '50',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Updated Name');
      expect(res.body.data.type).toBe('Rye Whiskey');
      expect(res.body.data.abv).toBe('50');
    });

    it('should return 404 when item not found', async () => {
      vi.clearAllMocks();
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const res = await request(app)
        .put('/api/inventory-items/999')
        .send({ name: 'Updated Name', category: 'spirit' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 for invalid item ID', async () => {
      const res = await request(app)
        .put('/api/inventory-items/invalid')
        .send({ name: 'Updated Name', category: 'spirit' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Invalid item ID');
    });

    it('should return 400 for zero ID', async () => {
      const res = await request(app)
        .put('/api/inventory-items/0')
        .send({ name: 'Updated Name', category: 'spirit' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should not allow updating other user\'s items', async () => {
      // Query with user_id check returns null (not found for this user)
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const res = await request(app)
        .put('/api/inventory-items/100')
        .send({ name: 'Hacked Name', category: 'spirit' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('DELETE /api/inventory-items/:id', () => {
    it('should delete inventory item', async () => {
      // Mock: exists check returns true, then delete succeeds
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 1 });
      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({ rowCount: 1 });

      const res = await request(app).delete('/api/inventory-items/1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Item deleted successfully');
    });

    it('should return 404 when item not found', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const res = await request(app).delete('/api/inventory-items/999');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 for invalid item ID', async () => {
      const res = await request(app).delete('/api/inventory-items/invalid');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Invalid item ID');
    });

    it('should return 400 for zero ID', async () => {
      const res = await request(app).delete('/api/inventory-items/0');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should not delete another user\'s item', async () => {
      // Query with user_id check returns null (not found for this user)
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const res = await request(app).delete('/api/inventory-items/100');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('DELETE /api/inventory-items/bulk', () => {
    it('should bulk delete items', async () => {
      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({ rowCount: 3 });

      const res = await request(app)
        .delete('/api/inventory-items/bulk')
        .send({ ids: [1, 2, 3] });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.deleted).toBe(3);
    });

    it('should return 400 when ids is not an array', async () => {
      const res = await request(app)
        .delete('/api/inventory-items/bulk')
        .send({ ids: 'not-an-array' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('ids must be an array');
    });

    it('should return 400 when ids is empty', async () => {
      const res = await request(app)
        .delete('/api/inventory-items/bulk')
        .send({ ids: [] });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('No items specified');
    });

    it('should return 400 when too many ids', async () => {
      const tooManyIds = Array.from({ length: 501 }, (_, i) => i + 1);

      const res = await request(app)
        .delete('/api/inventory-items/bulk')
        .send({ ids: tooManyIds });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('max 500');
    });

    it('should return 400 when ids contain invalid values', async () => {
      const res = await request(app)
        .delete('/api/inventory-items/bulk')
        .send({ ids: [1, 'invalid', 3] });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('valid numbers');
    });
  });

  describe('POST /api/inventory-items/backfill-periodic-tags', () => {
    it('should backfill periodic tags for items missing them', async () => {
      const itemsWithoutTags = [
        createMockItem({ id: 1, name: 'Makers Mark Bourbon', category: 'spirit', type: 'Bourbon' }),
        createMockItem({ id: 2, name: 'Tanqueray Gin', category: 'spirit', type: 'Gin' }),
      ];

      // First call: queryAll returns items without tags
      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValueOnce(itemsWithoutTags);
      // Second call: execute for bulk update
      (execute as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ rowCount: 2 });

      const res = await request(app).post('/api/inventory-items/backfill-periodic-tags');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Successfully classified');
      expect(res.body.updated).toBe(2);
      expect(res.body.total).toBe(2);
    });

    it('should return success with zero updates when no items need backfill', async () => {
      // No items without tags
      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);

      const res = await request(app).post('/api/inventory-items/backfill-periodic-tags');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.updated).toBe(0);
      expect(res.body.total).toBe(0);
    });

    it('should classify spirit items correctly', async () => {
      const bourbonItem = createMockItem({
        id: 1,
        name: 'Buffalo Trace',
        category: 'spirit',
        type: 'Bourbon',
      });

      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValueOnce([bourbonItem]);
      (execute as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ rowCount: 1 });

      const res = await request(app).post('/api/inventory-items/backfill-periodic-tags');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.updated).toBe(1);
      // Verify execute was called with the correct classification
      expect(execute).toHaveBeenCalled();
    });
  });

  describe('POST /api/inventory-items/backfill-categories', () => {
    it('should re-categorize all items', async () => {
      const items = [
        createMockItem({ id: 1, name: 'Makers Mark', category: 'pantry', type: 'Bourbon' }),
        createMockItem({ id: 2, name: 'Angostura Bitters', category: 'pantry', type: null }),
        createMockItem({ id: 3, name: 'Simple Syrup', category: 'pantry', type: null }),
      ];

      // First call: queryAll returns all items
      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValueOnce(items);
      // Second call: execute for bulk update
      (execute as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ rowCount: 3 });

      const res = await request(app).post('/api/inventory-items/backfill-categories');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Successfully re-categorized');
      expect(res.body.updated).toBe(3);
      expect(res.body.total).toBe(3);
    });

    it('should return success with zero updates when user has no items', async () => {
      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);

      const res = await request(app).post('/api/inventory-items/backfill-categories');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.updated).toBe(0);
      expect(res.body.total).toBe(0);
    });

    it('should correctly categorize spirits', async () => {
      const bourbonItem = createMockItem({
        id: 1,
        name: 'Buffalo Trace',
        category: 'pantry', // Wrong category
        type: 'Bourbon',
      });

      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValueOnce([bourbonItem]);
      (execute as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ rowCount: 1 });

      const res = await request(app).post('/api/inventory-items/backfill-categories');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // Execute should be called with category update
      expect(execute).toHaveBeenCalled();
      const executeCall = (execute as ReturnType<typeof vi.fn>).mock.calls[0];
      // The params should include 'spirit' as the new category
      expect(executeCall[1]).toContain('spirit');
    });

    it('should correctly categorize bitters', async () => {
      const bittersItem = createMockItem({
        id: 1,
        name: 'Angostura Bitters',
        category: 'pantry', // Wrong category
        type: null,
      });

      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValueOnce([bittersItem]);
      (execute as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ rowCount: 1 });

      const res = await request(app).post('/api/inventory-items/backfill-categories');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(execute).toHaveBeenCalled();
      const executeCall = (execute as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(executeCall[1]).toContain('bitters');
    });

    it('should correctly categorize syrups', async () => {
      const syrupItem = createMockItem({
        id: 1,
        name: 'Simple Syrup',
        category: 'pantry', // Wrong category
        type: null,
      });

      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValueOnce([syrupItem]);
      (execute as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ rowCount: 1 });

      const res = await request(app).post('/api/inventory-items/backfill-categories');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(execute).toHaveBeenCalled();
      const executeCall = (execute as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(executeCall[1]).toContain('syrup');
    });

    it('should correctly categorize liqueurs', async () => {
      const liqueurItem = createMockItem({
        id: 1,
        name: 'Cointreau',
        category: 'spirit', // Wrong category
        type: 'Triple Sec',
      });

      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValueOnce([liqueurItem]);
      (execute as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ rowCount: 1 });

      const res = await request(app).post('/api/inventory-items/backfill-categories');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(execute).toHaveBeenCalled();
      const executeCall = (execute as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(executeCall[1]).toContain('liqueur');
    });

    it('should correctly categorize garnishes', async () => {
      const garnishItem = createMockItem({
        id: 1,
        name: 'Fresh Mint',
        category: 'pantry', // Wrong category
        type: null,
      });

      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValueOnce([garnishItem]);
      (execute as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ rowCount: 1 });

      const res = await request(app).post('/api/inventory-items/backfill-categories');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(execute).toHaveBeenCalled();
      const executeCall = (execute as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(executeCall[1]).toContain('garnish');
    });

    it('should correctly categorize mixers', async () => {
      const mixerItem = createMockItem({
        id: 1,
        name: 'Tonic Water',
        category: 'pantry', // Wrong category
        type: null,
      });

      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValueOnce([mixerItem]);
      (execute as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ rowCount: 1 });

      const res = await request(app).post('/api/inventory-items/backfill-categories');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(execute).toHaveBeenCalled();
      const executeCall = (execute as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(executeCall[1]).toContain('mixer');
    });

    it('should handle large batch of items', async () => {
      // Create items with type='vodka' but category='pantry' so they'll get recategorized to 'spirit'
      const manyItems = Array.from({ length: 100 }, (_, i) =>
        createMockItem({ id: i + 1, name: `Vodka ${i + 1}`, type: 'vodka', category: 'pantry' })
      );

      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValueOnce(manyItems);

      const res = await request(app).post('/api/inventory-items/backfill-categories');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.updated).toBe(100);
      expect(res.body.total).toBe(100);
    });
  });
});
