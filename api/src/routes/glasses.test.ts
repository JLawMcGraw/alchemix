/**
 * Glasses Routes Tests
 *
 * Tests for custom glassware CRUD operations.
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

// Helper to create mock glass
const createMockGlass = (overrides: Partial<{
  id: number;
  user_id: number;
  name: string;
  created_at: string;
}> = {}) => ({
  id: 1,
  user_id: 1,
  name: 'Test Glass',
  created_at: new Date().toISOString(),
  ...overrides,
});

describe('Glasses Routes', () => {
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
    const { default: glassesRouter } = await import('./glasses');
    app.use('/api/glasses', glassesRouter);

    // Add error handler
    app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      res.status(500).json({ success: false, error: err.message });
    });
  });

  describe('GET /api/glasses', () => {
    it('should return empty array when no custom glasses exist', async () => {
      // Mock: no glasses found
      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const res = await request(app).get('/api/glasses');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
    });

    it('should return user custom glasses', async () => {
      const mockGlasses = [
        createMockGlass({ id: 1, name: 'Hurricane' }),
        createMockGlass({ id: 2, name: 'Tiki Mug' }),
      ];

      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue(mockGlasses);

      const res = await request(app).get('/api/glasses');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].name).toBe('Hurricane');
      expect(res.body.data[1].name).toBe('Tiki Mug');
    });

    it('should only return glasses for authenticated user', async () => {
      const userGlass = createMockGlass({ id: 1, user_id: testUserId, name: 'User 1 Glass' });

      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue([userGlass]);

      const res = await request(app).get('/api/glasses');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].name).toBe('User 1 Glass');
    });
  });

  describe('POST /api/glasses', () => {
    it('should create a new custom glass', async () => {
      const newGlass = createMockGlass({ id: 1, name: 'Hurricane' });

      // No duplicate exists
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [newGlass],
        rowCount: 1,
      });

      const res = await request(app)
        .post('/api/glasses')
        .send({ name: 'Hurricane' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Hurricane');
      expect(res.body.data.id).toBeDefined();
    });

    it('should return 400 when name is missing', async () => {
      const res = await request(app)
        .post('/api/glasses')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Glass name is required');
    });

    it('should return 400 when name is empty string', async () => {
      const res = await request(app)
        .post('/api/glasses')
        .send({ name: '' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 when duplicate glass name exists (case-insensitive)', async () => {
      // Duplicate exists
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 1 });

      const res = await request(app)
        .post('/api/glasses')
        .send({ name: 'Hurricane' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('already exists');
    });

    it('should sanitize glass name', async () => {
      const newGlass = createMockGlass({ id: 1, name: 'Hurricane' });

      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [newGlass],
        rowCount: 1,
      });

      const res = await request(app)
        .post('/api/glasses')
        .send({ name: '  Hurricane  ' });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('Hurricane');
    });
  });

  describe('DELETE /api/glasses/:id', () => {
    it('should delete an existing glass', async () => {
      const existingGlass = createMockGlass({ id: 1, name: 'Hurricane' });

      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(existingGlass);
      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({ rowCount: 1 });

      const res = await request(app).delete('/api/glasses/1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Glass deleted successfully');
    });

    it('should return 404 when glass not found', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const res = await request(app).delete('/api/glasses/999');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 for invalid glass ID', async () => {
      const res = await request(app).delete('/api/glasses/invalid');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Invalid glass ID');
    });

    it('should not delete another user glass', async () => {
      // Query with user_id check returns null (not found for this user)
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const res = await request(app).delete('/api/glasses/100');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });
});
