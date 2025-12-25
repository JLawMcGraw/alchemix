/**
 * Collections Routes Tests
 *
 * Tests for recipe collections CRUD operations.
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

import { queryOne, queryAll, execute, transaction } from '../database/db';

// Helper to create mock collection
const createMockCollection = (overrides: Partial<{
  id: number;
  user_id: number;
  name: string;
  description: string | null;
  recipe_count: number;
  created_at: string;
}> = {}) => ({
  id: 1,
  user_id: 1,
  name: 'Test Collection',
  description: null,
  recipe_count: 0,
  created_at: new Date().toISOString(),
  ...overrides,
});

describe('Collections Routes', () => {
  let app: express.Application;
  const testUserId = 1;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Default mock implementations
    (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (execute as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [], rowCount: 0 });
    (transaction as ReturnType<typeof vi.fn>).mockImplementation(async (callback) => {
      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      };
      return callback(mockClient as any);
    });

    // Create fresh app with routes
    app = express();
    app.use(express.json());

    // Import routes fresh (auth is already mocked)
    const { default: collectionsRouter } = await import('./collections');
    app.use('/api/collections', collectionsRouter);

    // Add error handler
    app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      res.status(500).json({ success: false, error: err.message });
    });
  });

  describe('GET /api/collections', () => {
    it('should return empty array when no collections exist', async () => {
      // Mock: total count = 0
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue({ total: '0' });
      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const res = await request(app).get('/api/collections');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
    });

    it('should return all collections when ?all=true', async () => {
      const mockCollections = [
        createMockCollection({ id: 1, name: 'Classic Cocktails', description: 'Timeless recipes', recipe_count: 2 }),
        createMockCollection({ id: 2, name: 'Summer Drinks', recipe_count: 0 }),
      ];

      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue(mockCollections);

      const res = await request(app).get('/api/collections?all=true');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].name).toBe('Classic Cocktails');
      expect(res.body.data[0].description).toBe('Timeless recipes');
      expect(res.body.data[0].recipe_count).toBe(2);
      // No pagination when all=true
      expect(res.body.pagination).toBeUndefined();
    });

    it('should return paginated collections', async () => {
      const mockCollections = [
        createMockCollection({ id: 1, name: 'Collection 1' }),
        createMockCollection({ id: 2, name: 'Collection 2' }),
      ];

      // Mock total count
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue({ total: '15' });
      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue(mockCollections);

      const res = await request(app).get('/api/collections?page=1&limit=2');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.limit).toBe(2);
      expect(res.body.pagination.total).toBe(15);
      expect(res.body.pagination.totalPages).toBe(8);
      expect(res.body.pagination.hasNextPage).toBe(true);
      expect(res.body.pagination.hasPreviousPage).toBe(false);
    });

    it('should only return collections for authenticated user', async () => {
      const userCollection = createMockCollection({ id: 1, user_id: testUserId, name: 'My Collection' });

      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue({ total: '1' });
      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue([userCollection]);

      const res = await request(app).get('/api/collections');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].name).toBe('My Collection');
    });

    it('should return 400 for invalid page parameter', async () => {
      const res = await request(app).get('/api/collections?page=abc');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Invalid page parameter');
    });

    it('should return 400 for invalid limit parameter', async () => {
      const res = await request(app).get('/api/collections?limit=abc');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Invalid limit parameter');
    });
  });

  describe('POST /api/collections', () => {
    it('should create a new collection with required fields', async () => {
      const newCollection = createMockCollection({ id: 1, name: 'Tiki Drinks' });

      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [newCollection],
        rowCount: 1,
      });

      const res = await request(app)
        .post('/api/collections')
        .send({ name: 'Tiki Drinks' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Tiki Drinks');
      expect(res.body.data.user_id).toBe(testUserId);
      expect(res.body.data.id).toBeDefined();
    });

    it('should create collection with description', async () => {
      const newCollection = createMockCollection({
        id: 1,
        name: 'Holiday Specials',
        description: 'Festive cocktails for celebrations',
      });

      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [newCollection],
        rowCount: 1,
      });

      const res = await request(app)
        .post('/api/collections')
        .send({
          name: 'Holiday Specials',
          description: 'Festive cocktails for celebrations',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Holiday Specials');
      expect(res.body.data.description).toBe('Festive cocktails for celebrations');
    });

    it('should return 400 when name is missing', async () => {
      const res = await request(app)
        .post('/api/collections')
        .send({ description: 'Collection without name' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Collection name is required');
    });

    it('should return 400 when name is empty string', async () => {
      const res = await request(app)
        .post('/api/collections')
        .send({ name: '' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 when name is whitespace only', async () => {
      const res = await request(app)
        .post('/api/collections')
        .send({ name: '   ' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('PUT /api/collections/:id', () => {
    it('should update collection fields', async () => {
      const updatedCollection = createMockCollection({
        id: 1,
        name: 'Updated Name',
        description: 'Updated description',
      });

      // Mock: exists check returns true, then execute returns updated collection
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: 1 }); // exists check
      (execute as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        rows: [updatedCollection],
        rowCount: 1,
      });

      const res = await request(app)
        .put('/api/collections/1')
        .send({
          name: 'Updated Name',
          description: 'Updated description',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Updated Name');
      expect(res.body.data.description).toBe('Updated description');
    });

    it('should return 404 when collection not found', async () => {
      // Reset mocks and set default to null for this test
      vi.clearAllMocks();
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const res = await request(app)
        .put('/api/collections/999')
        .send({ name: 'Updated Name' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 for invalid collection ID', async () => {
      const res = await request(app)
        .put('/api/collections/invalid')
        .send({ name: 'Updated Name' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Invalid collection ID');
    });

    it('should return 400 for zero ID', async () => {
      const res = await request(app)
        .put('/api/collections/0')
        .send({ name: 'Updated Name' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should not allow updating other user\'s collection', async () => {
      // Query with user_id check returns null (not found for this user)
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const res = await request(app)
        .put('/api/collections/100')
        .send({ name: 'Hacked Name' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('DELETE /api/collections/:id', () => {
    it('should delete collection', async () => {
      // Mock: exists check returns true, then delete succeeds
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 1 });
      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({ rowCount: 1 });

      const res = await request(app).delete('/api/collections/1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Collection deleted successfully');
    });

    it('should delete collection with recipes when ?deleteRecipes=true', async () => {
      // Mock: exists check, then count recipes, then delete all
      (queryOne as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ id: 1 }); // exists check

      // Mock transaction for deleteWithRecipes
      (transaction as ReturnType<typeof vi.fn>).mockImplementation(async (callback) => {
        const mockClient = {
          query: vi.fn()
            .mockResolvedValueOnce({ rows: [{ count: '3' }] }) // count recipes
            .mockResolvedValueOnce({ rowCount: 3 }) // delete recipes
            .mockResolvedValueOnce({ rowCount: 1 }), // delete collection
        };
        return callback(mockClient as any);
      });

      const res = await request(app).delete('/api/collections/1?deleteRecipes=true');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('recipe(s) deleted');
      expect(res.body.recipesDeleted).toBeDefined();
    });

    it('should return 404 when collection not found', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const res = await request(app).delete('/api/collections/999');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 for invalid collection ID', async () => {
      const res = await request(app).delete('/api/collections/invalid');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Invalid collection ID');
    });

    it('should return 400 for zero ID', async () => {
      const res = await request(app).delete('/api/collections/0');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 for negative ID', async () => {
      const res = await request(app).delete('/api/collections/-1');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should not delete another user\'s collection', async () => {
      // Query with user_id check returns null (not found for this user)
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const res = await request(app).delete('/api/collections/100');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });
});
