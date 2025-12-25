/**
 * Favorites Routes Tests
 *
 * Tests for favorite recipes CRUD operations.
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

// Helper to create mock favorite
const createMockFavorite = (overrides: Partial<{
  id: number;
  user_id: number;
  recipe_name: string;
  recipe_id: number | null;
  created_at: string;
}> = {}) => ({
  id: 1,
  user_id: 1,
  recipe_name: 'Test Recipe',
  recipe_id: 1,
  created_at: new Date().toISOString(),
  ...overrides,
});

describe('Favorites Routes', () => {
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
    const { default: favoritesRouter } = await import('./favorites');
    app.use('/api/favorites', favoritesRouter);

    // Add error handler
    app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      res.status(500).json({ success: false, error: err.message });
    });
  });

  describe('GET /api/favorites', () => {
    it('should return empty array when no favorites exist', async () => {
      // Mock: total count = 0
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue({ total: '0' });
      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const res = await request(app).get('/api/favorites');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
    });

    it('should return all favorites when ?all=true', async () => {
      const mockFavorites = [
        createMockFavorite({ id: 1, recipe_name: 'Old Fashioned' }),
        createMockFavorite({ id: 2, recipe_name: 'Martini' }),
      ];

      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue(mockFavorites);

      const res = await request(app).get('/api/favorites?all=true');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].recipe_name).toBe('Old Fashioned');
      expect(res.body.data[1].recipe_name).toBe('Martini');
      // No pagination when all=true
      expect(res.body.pagination).toBeUndefined();
    });

    it('should return paginated favorites', async () => {
      const mockFavorites = [
        createMockFavorite({ id: 1, recipe_name: 'Recipe 1' }),
        createMockFavorite({ id: 2, recipe_name: 'Recipe 2' }),
      ];

      // Mock total count
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue({ total: '15' });
      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue(mockFavorites);

      const res = await request(app).get('/api/favorites?page=1&limit=2');

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

    it('should only return favorites for authenticated user', async () => {
      const userFavorite = createMockFavorite({ id: 1, user_id: testUserId, recipe_name: 'My Favorite' });

      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue({ total: '1' });
      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue([userFavorite]);

      const res = await request(app).get('/api/favorites');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].recipe_name).toBe('My Favorite');
    });

    it('should return 400 for invalid page parameter', async () => {
      const res = await request(app).get('/api/favorites?page=abc');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Invalid page parameter');
    });

    it('should return 400 for invalid limit parameter', async () => {
      const res = await request(app).get('/api/favorites?limit=abc');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Invalid limit parameter');
    });
  });

  describe('POST /api/favorites', () => {
    it('should create a new favorite', async () => {
      const newFavorite = createMockFavorite({ id: 1, recipe_name: 'Old Fashioned', recipe_id: 42 });

      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [newFavorite],
        rowCount: 1,
      });

      const res = await request(app)
        .post('/api/favorites')
        .send({ recipe_name: 'Old Fashioned', recipe_id: 42 });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.recipe_name).toBe('Old Fashioned');
      expect(res.body.data.recipe_id).toBe(42);
      expect(res.body.data.id).toBeDefined();
    });

    it('should create favorite without recipe_id (external recipe)', async () => {
      const newFavorite = createMockFavorite({ id: 1, recipe_name: 'External Recipe', recipe_id: null });

      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [newFavorite],
        rowCount: 1,
      });

      const res = await request(app)
        .post('/api/favorites')
        .send({ recipe_name: 'External Recipe' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.recipe_name).toBe('External Recipe');
      expect(res.body.data.recipe_id).toBeNull();
    });

    it('should return 400 when recipe_name is missing', async () => {
      const res = await request(app)
        .post('/api/favorites')
        .send({ recipe_id: 1 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Recipe name is required');
    });

    it('should return 400 when recipe_name is empty string', async () => {
      const res = await request(app)
        .post('/api/favorites')
        .send({ recipe_name: '' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 for invalid recipe_id', async () => {
      const res = await request(app)
        .post('/api/favorites')
        .send({ recipe_name: 'Test Recipe', recipe_id: -1 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Invalid recipe ID');
    });

    it('should sanitize recipe name', async () => {
      const newFavorite = createMockFavorite({ id: 1, recipe_name: 'Old Fashioned' });

      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [newFavorite],
        rowCount: 1,
      });

      const res = await request(app)
        .post('/api/favorites')
        .send({ recipe_name: '  Old Fashioned  ' });

      expect(res.status).toBe(201);
      expect(res.body.data.recipe_name).toBe('Old Fashioned');
    });

    it('should handle database constraint error for duplicates', async () => {
      (execute as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('duplicate key value violates unique constraint')
      );

      const res = await request(app)
        .post('/api/favorites')
        .send({ recipe_name: 'Duplicate Recipe' });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  describe('DELETE /api/favorites/:id', () => {
    it('should delete an existing favorite', async () => {
      // Mock: exists check returns true, then delete succeeds
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 1 });
      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({ rowCount: 1 });

      const res = await request(app).delete('/api/favorites/1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Favorite removed successfully');
    });

    it('should return 404 when favorite not found', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const res = await request(app).delete('/api/favorites/999');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 for invalid favorite ID', async () => {
      const res = await request(app).delete('/api/favorites/invalid');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Invalid favorite ID');
    });

    it('should return 400 for zero ID', async () => {
      const res = await request(app).delete('/api/favorites/0');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 for negative ID', async () => {
      const res = await request(app).delete('/api/favorites/-1');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should not delete another user\'s favorite', async () => {
      // Query with user_id check returns null (not found for this user)
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const res = await request(app).delete('/api/favorites/100');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });
});
