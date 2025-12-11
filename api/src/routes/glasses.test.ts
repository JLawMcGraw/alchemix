/**
 * Glasses Routes Tests
 *
 * Tests for custom glassware CRUD operations.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createTestDatabase, cleanupTestDatabase } from '../tests/setup';
import type Database from 'better-sqlite3';

// Mock the database module
vi.mock('../database/db', () => ({
  db: null as Database.Database | null,
}));

// Mock auth middleware
vi.mock('../middleware/auth', () => ({
  authMiddleware: (req: any, res: any, next: any) => {
    req.user = { userId: 1, email: 'test@example.com' };
    next();
  },
}));

describe('Glasses Routes', () => {
  let db: Database.Database;
  let app: express.Application;

  beforeEach(async () => {
    // Create test database
    db = createTestDatabase();

    // Add custom_glasses table
    db.exec(`
      CREATE TABLE IF NOT EXISTS custom_glasses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, name COLLATE NOCASE)
      )
    `);

    // Create a test user
    db.prepare(`
      INSERT INTO users (id, email, password_hash)
      VALUES (1, 'test@example.com', 'hashedpassword')
    `).run();

    // Update the mock
    const dbModule = await import('../database/db');
    (dbModule as any).db = db;

    // Reset glass service to use new db
    vi.resetModules();

    // Create fresh app with routes
    app = express();
    app.use(express.json());

    const { default: glassesRouter } = await import('./glasses');
    app.use('/api/glasses', glassesRouter);
  });

  afterEach(() => {
    cleanupTestDatabase(db);
    vi.clearAllMocks();
  });

  describe('GET /api/glasses', () => {
    it('should return empty array when no custom glasses exist', async () => {
      const res = await request(app).get('/api/glasses');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
    });

    it('should return user custom glasses', async () => {
      // Insert test glasses
      db.prepare(`
        INSERT INTO custom_glasses (user_id, name)
        VALUES (1, 'Hurricane'), (1, 'Tiki Mug')
      `).run();

      const res = await request(app).get('/api/glasses');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].name).toBe('Hurricane');
      expect(res.body.data[1].name).toBe('Tiki Mug');
    });

    it('should only return glasses for authenticated user', async () => {
      // Insert glasses for different users
      db.prepare(`
        INSERT INTO users (id, email, password_hash)
        VALUES (2, 'other@example.com', 'hashedpassword')
      `).run();

      db.prepare(`
        INSERT INTO custom_glasses (user_id, name)
        VALUES (1, 'User 1 Glass'), (2, 'User 2 Glass')
      `).run();

      const res = await request(app).get('/api/glasses');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].name).toBe('User 1 Glass');
    });
  });

  describe('POST /api/glasses', () => {
    it('should create a new custom glass', async () => {
      const res = await request(app)
        .post('/api/glasses')
        .send({ name: 'Hurricane' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Hurricane');
      expect(res.body.data.user_id).toBe(1);
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
      // Create first glass
      await request(app)
        .post('/api/glasses')
        .send({ name: 'Hurricane' });

      // Try to create duplicate
      const res = await request(app)
        .post('/api/glasses')
        .send({ name: 'hurricane' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('already exists');
    });

    it('should sanitize glass name', async () => {
      const res = await request(app)
        .post('/api/glasses')
        .send({ name: '  Hurricane  ' });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('Hurricane');
    });
  });

  describe('DELETE /api/glasses/:id', () => {
    it('should delete an existing glass', async () => {
      // Create a glass first
      const createRes = await request(app)
        .post('/api/glasses')
        .send({ name: 'Hurricane' });

      const glassId = createRes.body.data.id;

      const res = await request(app).delete(`/api/glasses/${glassId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Glass deleted successfully');

      // Verify it's deleted
      const glass = db.prepare('SELECT * FROM custom_glasses WHERE id = ?').get(glassId);
      expect(glass).toBeUndefined();
    });

    it('should return 404 when glass not found', async () => {
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
      // Create another user and their glass
      db.prepare(`
        INSERT INTO users (id, email, password_hash)
        VALUES (2, 'other@example.com', 'hashedpassword')
      `).run();

      db.prepare(`
        INSERT INTO custom_glasses (id, user_id, name)
        VALUES (100, 2, 'Other User Glass')
      `).run();

      const res = await request(app).delete('/api/glasses/100');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);

      // Verify glass still exists
      const glass = db.prepare('SELECT * FROM custom_glasses WHERE id = ?').get(100);
      expect(glass).toBeDefined();
    });
  });
});
