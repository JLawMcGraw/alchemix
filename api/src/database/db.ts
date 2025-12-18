/**
 * Database Configuration and Initialization
 *
 * This module sets up the PostgreSQL database connection and schema for AlcheMix.
 *
 * Database Choice: PostgreSQL
 * - Robust multi-user support with connection pooling
 * - ACID compliant with full transaction support
 * - Scales horizontally for production workloads
 * - Native support for concurrent connections
 *
 * Library: pg (node-postgres)
 * - Async/await API
 * - Connection pooling built-in
 * - Parameterized queries prevent SQL injection
 * - Type-safe with TypeScript
 *
 * Schema Overview:
 * - users: Authentication and user accounts
 * - inventory_items: User's bar inventory
 * - collections: Recipe organization
 * - recipes: Cocktail recipe library
 * - favorites: User's saved favorite recipes
 * - shopping_list_items: Shopping list
 * - custom_glasses: User-defined glassware
 * - inventory_classifications: Periodic table overrides
 * - token_blacklist: Revoked JWT tokens
 *
 * Foreign Key Relationships:
 * - All user data cascades on user deletion
 * - recipes.collection_id SET NULL on collection delete
 * - favorites.recipe_id SET NULL on recipe delete
 */

// IMPORTANT: Load environment variables BEFORE creating Pool
import '../config/env';

import { Pool, PoolClient, QueryResult } from 'pg';
import fs from 'fs';
import path from 'path';

/**
 * Database Connection Pool
 *
 * Uses DATABASE_URL environment variable (provided by Railway).
 *
 * Pool Configuration:
 * - max: 20 connections (suitable for moderate traffic)
 * - idleTimeoutMillis: Close idle connections after 30s
 * - connectionTimeoutMillis: Fail fast if can't connect in 2s
 *
 * Connection String Format:
 * postgresql://user:password@host:port/database
 *
 * Railway provides this automatically via:
 * DATABASE_URL=${{Postgres.DATABASE_URL}}
 */
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  // SSL required for Railway (production)
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
});

// Handle pool errors gracefully (e.g., database shutdown)
pool.on('error', (err) => {
  // Connection terminated by server (e.g., docker-compose down)
  if (err.message.includes('terminating connection')) {
    console.log('🔌 Database connection terminated (server shutdown)');
    return;
  }
  console.error('Unexpected database pool error:', err);
});

/**
 * Query Helper: Single Row
 *
 * Returns first row or null if not found.
 * Use for SELECT queries expecting 0 or 1 result.
 *
 * @example
 * const user = await queryOne<User>('SELECT * FROM users WHERE id = $1', [userId]);
 */
export async function queryOne<T>(sql: string, params?: unknown[]): Promise<T | null> {
  const { rows } = await pool.query(sql, params);
  return (rows[0] as T) || null;
}

/**
 * Query Helper: Multiple Rows
 *
 * Returns array of rows (empty array if none found).
 * Use for SELECT queries expecting 0 or more results.
 *
 * @example
 * const recipes = await queryAll<Recipe>('SELECT * FROM recipes WHERE user_id = $1', [userId]);
 */
export async function queryAll<T>(sql: string, params?: unknown[]): Promise<T[]> {
  const { rows } = await pool.query(sql, params);
  return rows as T[];
}

/**
 * Query Helper: Execute (INSERT/UPDATE/DELETE)
 *
 * Returns full QueryResult for row count, returning clause, etc.
 *
 * @example
 * const result = await execute('DELETE FROM recipes WHERE id = $1', [id]);
 * console.log(`Deleted ${result.rowCount} rows`);
 *
 * @example
 * const result = await execute(
 *   'INSERT INTO recipes (name, user_id) VALUES ($1, $2) RETURNING id',
 *   [name, userId]
 * );
 * const newId = result.rows[0].id;
 */
export async function execute(sql: string, params?: unknown[]): Promise<QueryResult> {
  return pool.query(sql, params);
}

/**
 * Transaction Helper
 *
 * Executes a function within a transaction.
 * Automatically commits on success, rolls back on error.
 *
 * @example
 * await transaction(async (client) => {
 *   await client.query('INSERT INTO users ...', [...]);
 *   await client.query('INSERT INTO inventory_items ...', [...]);
 * });
 */
export async function transaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Initialize Database Schema
 *
 * Reads and executes schema.sql to create all tables.
 * Safe to run multiple times (uses IF NOT EXISTS).
 *
 * Called once on server startup (see server.ts).
 */
export async function initializeDatabase(): Promise<void> {
  const isProduction = process.env.NODE_ENV === 'production';
  const log = (msg: string) => {
    if (!isProduction) console.log(msg);
  };

  log('🔧 Initializing PostgreSQL database schema...');

  try {
    // Read schema file
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    // Execute schema
    await pool.query(schema);

    log('✅ Database schema initialized successfully!');
    log(`📍 Connected to PostgreSQL`);
  } catch (error) {
    console.error('❌ Failed to initialize database schema:', error);
    throw error;
  }
}

/**
 * Check Database Connection
 *
 * Verifies the database is reachable.
 * Used by health check endpoints.
 */
export async function checkConnection(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

/**
 * Graceful Shutdown
 *
 * Closes all pool connections cleanly.
 * Called on SIGINT/SIGTERM.
 */
export async function closeDatabase(): Promise<void> {
  console.log('🛑 Closing database connections...');
  await pool.end();
  console.log('✅ Database connections closed.');
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 SIGINT received');
  await closeDatabase();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 SIGTERM received');
  await closeDatabase();
  process.exit(0);
});
