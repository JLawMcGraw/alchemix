/**
 * Glass Service Tests
 *
 * Unit tests for the GlassService business logic.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createTestDatabase, cleanupTestDatabase } from '../tests/setup';
import type Database from 'better-sqlite3';

// Mock the database module
vi.mock('../database/db', () => ({
  db: null as Database.Database | null,
}));

describe('GlassService', () => {
  let db: Database.Database;
  let GlassService: any;
  let glassService: any;

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

    // Reset modules and import fresh
    vi.resetModules();
    const serviceModule = await import('./GlassService');
    GlassService = serviceModule.GlassService;
    glassService = new GlassService();
  });

  afterEach(() => {
    cleanupTestDatabase(db);
    vi.clearAllMocks();
  });

  describe('getAll', () => {
    it('should return empty array when no glasses exist', () => {
      const glasses = glassService.getAll(1);
      expect(glasses).toEqual([]);
    });

    it('should return all glasses for a user', () => {
      db.prepare(`
        INSERT INTO custom_glasses (user_id, name) VALUES (1, 'Hurricane'), (1, 'Tiki Mug')
      `).run();

      const glasses = glassService.getAll(1);
      expect(glasses).toHaveLength(2);
    });

    it('should return glasses in alphabetical order', () => {
      db.prepare(`
        INSERT INTO custom_glasses (user_id, name) VALUES (1, 'Zombie'), (1, 'Absinthe'), (1, 'Mint Julep')
      `).run();

      const glasses = glassService.getAll(1);
      expect(glasses[0].name).toBe('Absinthe');
      expect(glasses[1].name).toBe('Mint Julep');
      expect(glasses[2].name).toBe('Zombie');
    });

    it('should only return glasses for the specified user', () => {
      db.prepare(`INSERT INTO users (id, email, password_hash) VALUES (2, 'other@example.com', 'hash')`).run();
      db.prepare(`
        INSERT INTO custom_glasses (user_id, name) VALUES (1, 'User1 Glass'), (2, 'User2 Glass')
      `).run();

      const user1Glasses = glassService.getAll(1);
      expect(user1Glasses).toHaveLength(1);
      expect(user1Glasses[0].name).toBe('User1 Glass');

      const user2Glasses = glassService.getAll(2);
      expect(user2Glasses).toHaveLength(1);
      expect(user2Glasses[0].name).toBe('User2 Glass');
    });
  });

  describe('create', () => {
    it('should create a new glass', () => {
      const result = glassService.create(1, 'Hurricane');

      expect(result.success).toBe(true);
      expect(result.glass).toBeDefined();
      expect(result.glass?.name).toBe('Hurricane');
      expect(result.glass?.user_id).toBe(1);
    });

    it('should fail when name is empty', () => {
      const result = glassService.create(1, '');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Glass name is required');
    });

    it('should fail when name is only whitespace', () => {
      const result = glassService.create(1, '   ');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Glass name is required');
    });

    it('should trim whitespace from name', () => {
      const result = glassService.create(1, '  Hurricane  ');

      expect(result.success).toBe(true);
      expect(result.glass?.name).toBe('Hurricane');
    });

    it('should fail when duplicate name exists (case-insensitive)', () => {
      glassService.create(1, 'Hurricane');
      const result = glassService.create(1, 'HURRICANE');

      expect(result.success).toBe(false);
      expect(result.error).toContain('already exists');
    });

    it('should allow same name for different users', () => {
      db.prepare(`INSERT INTO users (id, email, password_hash) VALUES (2, 'other@example.com', 'hash')`).run();

      const result1 = glassService.create(1, 'Hurricane');
      const result2 = glassService.create(2, 'Hurricane');

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
    });

    it('should sanitize name to prevent XSS', () => {
      const result = glassService.create(1, '<script>alert("xss")</script>Hurricane');

      expect(result.success).toBe(true);
      expect(result.glass?.name).not.toContain('<script>');
    });

    it('should truncate long names', () => {
      const longName = 'A'.repeat(200);
      const result = glassService.create(1, longName);

      expect(result.success).toBe(true);
      expect(result.glass?.name.length).toBeLessThanOrEqual(100);
    });
  });

  describe('delete', () => {
    it('should delete an existing glass', () => {
      const createResult = glassService.create(1, 'Hurricane');
      const glassId = createResult.glass!.id;

      const deleteResult = glassService.delete(1, glassId);

      expect(deleteResult.success).toBe(true);
      expect(deleteResult.glass?.name).toBe('Hurricane');

      // Verify deleted
      const glasses = glassService.getAll(1);
      expect(glasses).toHaveLength(0);
    });

    it('should fail when glass does not exist', () => {
      const result = glassService.delete(1, 999);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should fail when glass belongs to different user', () => {
      db.prepare(`INSERT INTO users (id, email, password_hash) VALUES (2, 'other@example.com', 'hash')`).run();
      db.prepare(`INSERT INTO custom_glasses (id, user_id, name) VALUES (100, 2, 'Other Glass')`).run();

      const result = glassService.delete(1, 100);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');

      // Verify glass still exists
      const glass = db.prepare('SELECT * FROM custom_glasses WHERE id = 100').get();
      expect(glass).toBeDefined();
    });
  });
});
