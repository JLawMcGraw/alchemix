/**
 * Classification Service
 *
 * Manages user classification overrides for the Periodic Table of Mixology V2.
 * Works with the periodicTableV2.ts classification engine to provide a hybrid
 * classification system: hardcoded rules + user overrides.
 *
 * Database Table: inventory_classifications
 * - Stores only user manual overrides (not auto-classifications)
 * - One override per user/inventory_item pair
 * - Persists across sessions
 */

import { db } from '../database/db';
import type { MixologyGroup, MixologyPeriod, CellPosition } from '../types/periodicTable';

// ============================================================================
// Types
// ============================================================================

/**
 * Database row for inventory_classifications table
 */
interface ClassificationRow {
  id: number;
  user_id: number;
  inventory_item_id: number;
  group_num: number;
  period_num: number;
  created_at: string;
  updated_at: string;
}

/**
 * Classification override for API responses
 */
export interface ClassificationOverride {
  inventoryItemId: number;
  group: MixologyGroup;
  period: MixologyPeriod;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Prepared Statements (Lazy Initialization)
// ============================================================================

/**
 * Lazy-initialized prepared statements
 *
 * IMPORTANT: Statements are created on first access, not at module load time.
 * This ensures the database tables exist before preparing statements.
 *
 * Why lazy initialization?
 * - Database initialization (initializeDatabase) runs after imports
 * - Eager preparation would fail with "no such table" error
 * - Lazy init defers preparation until first actual use
 */
let _statements: {
  getByUser: ReturnType<typeof db.prepare<[number], ClassificationRow>>;
  getOne: ReturnType<typeof db.prepare<[number, number], ClassificationRow>>;
  upsert: ReturnType<typeof db.prepare<[number, number, number, number]>>;
  delete: ReturnType<typeof db.prepare<[number, number]>>;
  deleteAll: ReturnType<typeof db.prepare<[number]>>;
  count: ReturnType<typeof db.prepare<[number], { count: number }>>;
} | null = null;

function getStatements() {
  if (!_statements) {
    _statements = {
      /**
       * Get all classification overrides for a user
       */
      getByUser: db.prepare<[number], ClassificationRow>(`
        SELECT * FROM inventory_classifications
        WHERE user_id = ?
        ORDER BY updated_at DESC
      `),

      /**
       * Get a single classification override
       */
      getOne: db.prepare<[number, number], ClassificationRow>(`
        SELECT * FROM inventory_classifications
        WHERE user_id = ? AND inventory_item_id = ?
      `),

      /**
       * Insert or update a classification override
       * Uses SQLite's UPSERT syntax (INSERT OR REPLACE)
       */
      upsert: db.prepare<[number, number, number, number]>(`
        INSERT INTO inventory_classifications (user_id, inventory_item_id, group_num, period_num)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id, inventory_item_id) DO UPDATE SET
          group_num = excluded.group_num,
          period_num = excluded.period_num,
          updated_at = CURRENT_TIMESTAMP
      `),

      /**
       * Delete a classification override (revert to auto-classification)
       */
      delete: db.prepare<[number, number]>(`
        DELETE FROM inventory_classifications
        WHERE user_id = ? AND inventory_item_id = ?
      `),

      /**
       * Delete all overrides for a user (bulk reset)
       */
      deleteAll: db.prepare<[number]>(`
        DELETE FROM inventory_classifications
        WHERE user_id = ?
      `),

      /**
       * Count overrides for a user
       */
      count: db.prepare<[number], { count: number }>(`
        SELECT COUNT(*) as count FROM inventory_classifications
        WHERE user_id = ?
      `),
    };
  }
  return _statements;
}

// ============================================================================
// Service Functions
// ============================================================================

/**
 * Get all classification overrides for a user
 *
 * @param userId - User ID
 * @returns Map of inventory item ID to CellPosition for use with classification engine
 */
export function getUserOverrides(userId: number): Map<number, CellPosition> {
  const rows = getStatements().getByUser.all(userId);
  const overrides = new Map<number, CellPosition>();

  for (const row of rows) {
    overrides.set(row.inventory_item_id, {
      group: row.group_num as MixologyGroup,
      period: row.period_num as MixologyPeriod,
    });
  }

  return overrides;
}

/**
 * Get all classification overrides for a user (API format)
 *
 * @param userId - User ID
 * @returns Array of classification overrides
 */
export function getAll(userId: number): ClassificationOverride[] {
  const rows = getStatements().getByUser.all(userId);

  return rows.map((row) => ({
    inventoryItemId: row.inventory_item_id,
    group: row.group_num as MixologyGroup,
    period: row.period_num as MixologyPeriod,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

/**
 * Get a single classification override
 *
 * @param userId - User ID
 * @param inventoryItemId - Inventory item ID
 * @returns Classification override or null if not found
 */
export function getOne(
  userId: number,
  inventoryItemId: number
): ClassificationOverride | null {
  const row = getStatements().getOne.get(userId, inventoryItemId);

  if (!row) return null;

  return {
    inventoryItemId: row.inventory_item_id,
    group: row.group_num as MixologyGroup,
    period: row.period_num as MixologyPeriod,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Set or update a classification override
 *
 * @param userId - User ID
 * @param inventoryItemId - Inventory item ID
 * @param group - Group number (1-6)
 * @param period - Period number (1-6)
 * @returns Updated override
 */
export function setOverride(
  userId: number,
  inventoryItemId: number,
  group: MixologyGroup,
  period: MixologyPeriod
): ClassificationOverride {
  // Validate group and period range
  if (group < 1 || group > 6) {
    throw new Error(`Invalid group: ${group}. Must be 1-6.`);
  }
  if (period < 1 || period > 6) {
    throw new Error(`Invalid period: ${period}. Must be 1-6.`);
  }

  getStatements().upsert.run(userId, inventoryItemId, group, period);

  // Fetch and return the updated row
  const result = getOne(userId, inventoryItemId);
  if (!result) {
    throw new Error('Failed to save classification override');
  }

  return result;
}

/**
 * Delete a classification override (revert to auto-classification)
 *
 * @param userId - User ID
 * @param inventoryItemId - Inventory item ID
 * @returns true if deleted, false if not found
 */
export function deleteOverride(
  userId: number,
  inventoryItemId: number
): boolean {
  const result = getStatements().delete.run(userId, inventoryItemId);
  return result.changes > 0;
}

/**
 * Delete all overrides for a user (bulk reset)
 *
 * @param userId - User ID
 * @returns Number of overrides deleted
 */
export function deleteAllOverrides(userId: number): number {
  const result = getStatements().deleteAll.run(userId);
  return result.changes;
}

/**
 * Get count of overrides for a user
 *
 * @param userId - User ID
 * @returns Number of overrides
 */
export function countOverrides(userId: number): number {
  const result = getStatements().count.get(userId);
  return result?.count ?? 0;
}

// ============================================================================
// Default Export
// ============================================================================

export const ClassificationService = {
  getUserOverrides,
  getAll,
  getOne,
  setOverride,
  deleteOverride,
  deleteAllOverrides,
  countOverrides,
};

export default ClassificationService;
