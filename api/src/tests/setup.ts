import { beforeAll, vi } from 'vitest';
import { Pool, PoolClient, QueryResult } from 'pg';

/**
 * Test Setup for PostgreSQL Migration
 *
 * This provides mock implementations for the PostgreSQL database layer.
 * Tests should mock the db module and use these helpers.
 */

// Type definitions for test data
interface TestRow {
  [key: string]: unknown;
}

/**
 * In-Memory Test Store
 * Simulates PostgreSQL tables using Maps for fast test execution.
 */
class TestStore {
  private tables: Map<string, Map<number, TestRow>> = new Map();
  private sequences: Map<string, number> = new Map();

  constructor() {
    this.reset();
  }

  reset(): void {
    this.tables.clear();
    this.sequences.clear();

    // Initialize tables
    const tableNames = [
      'users', 'inventory_items', 'recipes', 'favorites',
      'collections', 'shopping_list_items', 'token_blacklist',
      'bottles', 'glasses', 'messages', 'classifications'
    ];

    for (const name of tableNames) {
      this.tables.set(name, new Map());
      this.sequences.set(name, 1);
    }
  }

  getTable(name: string): Map<number, TestRow> {
    if (!this.tables.has(name)) {
      this.tables.set(name, new Map());
      this.sequences.set(name, 1);
    }
    return this.tables.get(name)!;
  }

  nextId(table: string): number {
    const current = this.sequences.get(table) || 1;
    this.sequences.set(table, current + 1);
    return current;
  }

  insert(table: string, row: TestRow): TestRow {
    const id = this.nextId(table);
    const rowWithId = { ...row, id, created_at: new Date().toISOString() };
    this.getTable(table).set(id, rowWithId);
    return rowWithId;
  }

  findById(table: string, id: number): TestRow | undefined {
    return this.getTable(table).get(id);
  }

  findAll(table: string, predicate?: (row: TestRow) => boolean): TestRow[] {
    const rows = Array.from(this.getTable(table).values());
    return predicate ? rows.filter(predicate) : rows;
  }

  update(table: string, id: number, updates: Partial<TestRow>): TestRow | undefined {
    const row = this.findById(table, id);
    if (!row) return undefined;
    const updated = { ...row, ...updates };
    this.getTable(table).set(id, updated);
    return updated;
  }

  delete(table: string, id: number): boolean {
    return this.getTable(table).delete(id);
  }

  deleteWhere(table: string, predicate: (row: TestRow) => boolean): number {
    const tableData = this.getTable(table);
    let deleted = 0;
    for (const [id, row] of tableData.entries()) {
      if (predicate(row)) {
        tableData.delete(id);
        deleted++;
      }
    }
    return deleted;
  }
}

// Global test store instance
export const testStore = new TestStore();

/**
 * Create mock database functions matching the PostgreSQL db.ts API
 */
export function createMockDbFunctions() {
  return {
    queryOne: vi.fn().mockImplementation(async <T>(_sql: string, _params?: unknown[]): Promise<T | null> => {
      // Default implementation returns null
      // Override in specific tests
      return null;
    }),

    queryAll: vi.fn().mockImplementation(async <T>(_sql: string, _params?: unknown[]): Promise<T[]> => {
      // Default implementation returns empty array
      // Override in specific tests
      return [];
    }),

    execute: vi.fn().mockImplementation(async (_sql: string, _params?: unknown[]): Promise<QueryResult> => {
      // Default implementation returns success with 0 rows
      return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
    }),

    transaction: vi.fn().mockImplementation(async <T>(callback: (client: PoolClient) => Promise<T>): Promise<T> => {
      // Mock client with query method
      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      } as unknown as PoolClient;
      return callback(mockClient);
    }),

    getPool: vi.fn().mockReturnValue({} as Pool),
  };
}

/**
 * Reset test store before each test
 */
export function resetTestStore(): void {
  testStore.reset();
}

/**
 * Create a test user and return their ID
 */
export async function createTestUser(
  mockDb: ReturnType<typeof createMockDbFunctions>,
  email: string = 'test@example.com',
  passwordHash: string = 'hashed_password'
): Promise<number> {
  const user = testStore.insert('users', {
    email,
    password_hash: passwordHash,
    token_version: 0,
    is_verified: true,
  });

  // Configure mock to return this user
  mockDb.queryOne.mockImplementation(async (sql: string, params?: unknown[]) => {
    if (sql.includes('FROM users') && params?.[0] === email) {
      return user;
    }
    if (sql.includes('FROM users') && sql.includes('id =') && params?.[0] === user.id) {
      return user;
    }
    return null;
  });

  return user.id as number;
}

/**
 * Create a test recipe and return it
 */
export async function createTestRecipe(
  userId: number,
  name: string = 'Test Recipe',
  ingredients: string = '["Gin", "Vermouth"]'
): Promise<TestRow> {
  return testStore.insert('recipes', {
    user_id: userId,
    name,
    ingredients,
    instructions: 'Test instructions',
  });
}

/**
 * Test user fixtures
 */
export const testUsers = {
  validUser: {
    email: 'test@example.com',
    password: 'SecurePass123!',
  },
  invalidEmail: {
    email: 'invalid-email',
    password: 'SecurePass123!',
  },
  weakPassword: {
    email: 'test2@example.com',
    password: 'weak',
  },
};

/**
 * Test bottle fixtures
 */
export const testBottles = {
  validBottle: {
    name: 'Bombay Sapphire',
    category: 'Spirits',
    subcategory: 'Gin',
    quantity: 750,
  },
  validBottle2: {
    name: 'Grey Goose',
    category: 'Spirits',
    subcategory: 'Vodka',
    quantity: 1000,
  },
};

/**
 * Test recipe fixtures
 */
export const testRecipes = {
  validRecipe: {
    name: 'Martini',
    ingredients: '2 oz Gin, 1 oz Dry Vermouth',
    instructions: 'Stir with ice and strain into a chilled glass',
  },
  validRecipe2: {
    name: 'Negroni',
    ingredients: '1 oz Gin, 1 oz Campari, 1 oz Sweet Vermouth',
    instructions: 'Stir with ice and strain over ice',
  },
};

// Ensure test directory exists (for any file-based tests)
beforeAll(() => {
  // No-op - we no longer use file-based SQLite for tests
});

// ============================================================================
// LEGACY EXPORTS - For backwards compatibility during migration
// These are deprecated and will be removed once all tests are updated
// ============================================================================

/**
 * @deprecated Use createMockDbFunctions() instead
 * Legacy function to create test database - now returns mock functions
 */
export function createTestDatabase(): ReturnType<typeof createMockDbFunctions> {
  console.warn('createTestDatabase() is deprecated. Use createMockDbFunctions() instead.');
  return createMockDbFunctions();
}

/**
 * @deprecated No longer needed with mock-based tests
 * Legacy cleanup function - now a no-op
 */
export function cleanupTestDatabase(_db: unknown): void {
  // No-op - test cleanup is handled by resetTestStore()
  resetTestStore();
}
