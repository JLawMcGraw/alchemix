/**
 * Database Operations Tests (PostgreSQL)
 *
 * These tests verify the database layer functions work correctly.
 * They use mocks to simulate PostgreSQL responses without requiring
 * an actual database connection.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Pool, PoolClient, QueryResult } from 'pg';

// Mock pg module
vi.mock('pg', () => {
  const mockQuery = vi.fn();
  const mockRelease = vi.fn();
  const mockConnect = vi.fn();

  const MockPoolClient = {
    query: mockQuery,
    release: mockRelease,
  };

  const MockPool = vi.fn(() => ({
    query: mockQuery,
    connect: mockConnect.mockResolvedValue(MockPoolClient),
    end: vi.fn(),
    on: vi.fn(), // Handle pool.on('error', ...) calls
  }));

  return {
    Pool: MockPool,
    __mockQuery: mockQuery,
    __mockConnect: mockConnect,
    __mockRelease: mockRelease,
    __MockPoolClient: MockPoolClient,
  };
});

// Mock logger
vi.mock('../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Import after mocking
import { queryOne, queryAll, execute, transaction, pool } from './db';

// Get mock functions
const pg = await import('pg') as typeof import('pg') & {
  __mockQuery: ReturnType<typeof vi.fn>;
  __mockConnect: ReturnType<typeof vi.fn>;
  __MockPoolClient: { query: ReturnType<typeof vi.fn>; release: ReturnType<typeof vi.fn> };
};

describe('Database Operations (PostgreSQL)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('queryOne', () => {
    it('should return first row when results exist', async () => {
      const mockUser = { id: 1, email: 'test@example.com', password_hash: 'hashed' };
      pg.__mockQuery.mockResolvedValue({ rows: [mockUser], rowCount: 1 });

      const result = await queryOne<typeof mockUser>(
        'SELECT * FROM users WHERE email = $1',
        ['test@example.com']
      );

      expect(result).toEqual(mockUser);
      expect(pg.__mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE email = $1',
        ['test@example.com']
      );
    });

    it('should return null when no results', async () => {
      pg.__mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });

      const result = await queryOne<{ id: number }>(
        'SELECT * FROM users WHERE id = $1',
        [999]
      );

      expect(result).toBeNull();
    });

    it('should handle query errors', async () => {
      pg.__mockQuery.mockRejectedValue(new Error('Connection failed'));

      await expect(
        queryOne('SELECT * FROM users WHERE id = $1', [1])
      ).rejects.toThrow('Connection failed');
    });
  });

  describe('queryAll', () => {
    it('should return all rows', async () => {
      const mockUsers = [
        { id: 1, email: 'user1@example.com' },
        { id: 2, email: 'user2@example.com' },
      ];
      pg.__mockQuery.mockResolvedValue({ rows: mockUsers, rowCount: 2 });

      const result = await queryAll<(typeof mockUsers)[0]>(
        'SELECT * FROM users'
      );

      expect(result).toEqual(mockUsers);
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no results', async () => {
      pg.__mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });

      const result = await queryAll<{ id: number }>('SELECT * FROM users WHERE id > $1', [1000]);

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should handle parameterized queries', async () => {
      const mockRecipes = [{ id: 1, name: 'Martini', user_id: 1 }];
      pg.__mockQuery.mockResolvedValue({ rows: mockRecipes, rowCount: 1 });

      await queryAll('SELECT * FROM recipes WHERE user_id = $1', [1]);

      expect(pg.__mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM recipes WHERE user_id = $1',
        [1]
      );
    });
  });

  describe('execute', () => {
    it('should execute INSERT and return result', async () => {
      pg.__mockQuery.mockResolvedValue({
        rows: [{ id: 1 }],
        rowCount: 1,
        command: 'INSERT',
      });

      const result = await execute(
        'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id',
        ['test@example.com', 'hashed']
      );

      expect(result.rowCount).toBe(1);
      expect(result.rows[0]).toEqual({ id: 1 });
    });

    it('should execute UPDATE and return affected rows', async () => {
      pg.__mockQuery.mockResolvedValue({
        rows: [],
        rowCount: 3,
        command: 'UPDATE',
      });

      const result = await execute(
        'UPDATE users SET is_verified = $1 WHERE email LIKE $2',
        [true, '%@example.com']
      );

      expect(result.rowCount).toBe(3);
    });

    it('should execute DELETE and return affected rows', async () => {
      pg.__mockQuery.mockResolvedValue({
        rows: [],
        rowCount: 5,
        command: 'DELETE',
      });

      const result = await execute(
        'DELETE FROM token_blacklist WHERE expires_at < $1',
        [Math.floor(Date.now() / 1000)]
      );

      expect(result.rowCount).toBe(5);
    });

    it('should handle constraint violations', async () => {
      const uniqueError = new Error('duplicate key value violates unique constraint');
      pg.__mockQuery.mockRejectedValue(uniqueError);

      await expect(
        execute('INSERT INTO users (email, password_hash) VALUES ($1, $2)', ['existing@example.com', 'hash'])
      ).rejects.toThrow('duplicate key value');
    });
  });

  describe('transaction', () => {
    it('should execute callback with client and commit on success', async () => {
      const mockClient = pg.__MockPoolClient;
      mockClient.query.mockResolvedValue({ rows: [{ id: 1 }], rowCount: 1 });

      const result = await transaction(async (client) => {
        await client.query('INSERT INTO users (email) VALUES ($1)', ['test@example.com']);
        return { success: true };
      });

      expect(result).toEqual({ success: true });
      // Transaction should have been committed (COMMIT query)
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('should rollback on error', async () => {
      const mockClient = pg.__MockPoolClient;
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockRejectedValueOnce(new Error('Insert failed')) // INSERT
        .mockResolvedValueOnce({}); // ROLLBACK

      await expect(
        transaction(async (client) => {
          await client.query('INSERT INTO users (email) VALUES ($1)', ['test@example.com']);
          return { success: true };
        })
      ).rejects.toThrow('Insert failed');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });

    it('should release client after transaction', async () => {
      const mockClient = pg.__MockPoolClient;
      mockClient.query.mockResolvedValue({});

      await transaction(async () => {
        return 'done';
      });

      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should support multiple queries in transaction', async () => {
      const mockClient = pg.__MockPoolClient;
      mockClient.query.mockResolvedValue({ rows: [], rowCount: 1 });

      await transaction(async (client) => {
        await client.query('DELETE FROM favorites WHERE user_id = $1', [1]);
        await client.query('DELETE FROM recipes WHERE user_id = $1', [1]);
        await client.query('DELETE FROM users WHERE id = $1', [1]);
        return { deleted: true };
      });

      // BEGIN + 3 queries + COMMIT = 5 calls
      expect(mockClient.query).toHaveBeenCalledTimes(5);
    });
  });

  describe('pool', () => {
    it('should export the pool instance', () => {
      expect(pool).toBeDefined();
    });
  });

  describe('SQL Injection Prevention', () => {
    it('should use parameterized queries for user input', async () => {
      pg.__mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });

      // Attempt SQL injection
      const maliciousInput = "'; DROP TABLE users; --";
      await queryOne('SELECT * FROM users WHERE email = $1', [maliciousInput]);

      // The malicious input should be passed as a parameter, not interpolated
      expect(pg.__mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE email = $1',
        [maliciousInput]
      );
    });

    it('should handle special characters safely', async () => {
      pg.__mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });

      const specialInput = "test'\"\\;--/**/";
      await queryAll('SELECT * FROM recipes WHERE name LIKE $1', [`%${specialInput}%`]);

      expect(pg.__mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM recipes WHERE name LIKE $1',
        [`%${specialInput}%`]
      );
    });
  });

  describe('Data Type Handling', () => {
    it('should handle boolean values correctly', async () => {
      pg.__mockQuery.mockResolvedValue({
        rows: [{ id: 1, is_verified: true }],
        rowCount: 1,
      });

      const result = await queryOne<{ id: number; is_verified: boolean }>(
        'SELECT * FROM users WHERE is_verified = $1',
        [true]
      );

      expect(result?.is_verified).toBe(true);
    });

    it('should handle null values correctly', async () => {
      pg.__mockQuery.mockResolvedValue({
        rows: [{ id: 1, instructions: null }],
        rowCount: 1,
      });

      const result = await queryOne<{ id: number; instructions: string | null }>(
        'SELECT * FROM recipes WHERE id = $1',
        [1]
      );

      expect(result?.instructions).toBeNull();
    });

    it('should handle timestamp values', async () => {
      const now = new Date();
      pg.__mockQuery.mockResolvedValue({
        rows: [{ id: 1, created_at: now }],
        rowCount: 1,
      });

      const result = await queryOne<{ id: number; created_at: Date }>(
        'SELECT * FROM users WHERE id = $1',
        [1]
      );

      expect(result?.created_at).toEqual(now);
    });

    it('should handle integer arrays', async () => {
      pg.__mockQuery.mockResolvedValue({
        rows: [{ ids: [1, 2, 3] }],
        rowCount: 1,
      });

      const result = await queryOne<{ ids: number[] }>(
        'SELECT ARRAY_AGG(id) as ids FROM recipes WHERE user_id = $1',
        [1]
      );

      expect(result?.ids).toEqual([1, 2, 3]);
    });
  });

  describe('Error Handling', () => {
    it('should propagate database errors', async () => {
      const dbError = new Error('Connection refused');
      pg.__mockQuery.mockRejectedValue(dbError);

      await expect(queryOne('SELECT 1')).rejects.toThrow('Connection refused');
    });

    it('should handle timeout errors', async () => {
      const timeoutError = new Error('Query read timeout');
      pg.__mockQuery.mockRejectedValue(timeoutError);

      await expect(
        queryAll('SELECT * FROM large_table')
      ).rejects.toThrow('Query read timeout');
    });
  });

  describe('RETURNING Clause', () => {
    it('should return inserted row with RETURNING *', async () => {
      const insertedRow = {
        id: 1,
        email: 'new@example.com',
        password_hash: 'hashed',
        created_at: new Date(),
      };
      pg.__mockQuery.mockResolvedValue({ rows: [insertedRow], rowCount: 1 });

      const result = await execute(
        'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING *',
        ['new@example.com', 'hashed']
      );

      expect(result.rows[0]).toEqual(insertedRow);
    });

    it('should return updated row with RETURNING *', async () => {
      const updatedRow = {
        id: 1,
        name: 'Updated Recipe',
        ingredients: '["Gin", "Vermouth"]',
      };
      pg.__mockQuery.mockResolvedValue({ rows: [updatedRow], rowCount: 1 });

      const result = await execute(
        'UPDATE recipes SET name = $1 WHERE id = $2 RETURNING *',
        ['Updated Recipe', 1]
      );

      expect(result.rows[0]).toEqual(updatedRow);
    });
  });
});
