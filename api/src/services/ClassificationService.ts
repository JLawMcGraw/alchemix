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

import { queryOne, queryAll, execute } from '../database/db';
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
// Service Functions
// ============================================================================

/**
 * Get all classification overrides for a user
 *
 * @param userId - User ID
 * @returns Map of inventory item ID to CellPosition for use with classification engine
 */
export async function getUserOverrides(userId: number): Promise<Map<number, CellPosition>> {
  const rows = await queryAll<ClassificationRow>(
    `SELECT * FROM inventory_classifications
     WHERE user_id = $1
     ORDER BY updated_at DESC`,
    [userId]
  );

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
export async function getAll(userId: number): Promise<ClassificationOverride[]> {
  const rows = await queryAll<ClassificationRow>(
    `SELECT * FROM inventory_classifications
     WHERE user_id = $1
     ORDER BY updated_at DESC`,
    [userId]
  );

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
export async function getOne(
  userId: number,
  inventoryItemId: number
): Promise<ClassificationOverride | null> {
  const row = await queryOne<ClassificationRow>(
    `SELECT * FROM inventory_classifications
     WHERE user_id = $1 AND inventory_item_id = $2`,
    [userId, inventoryItemId]
  );

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
export async function setOverride(
  userId: number,
  inventoryItemId: number,
  group: MixologyGroup,
  period: MixologyPeriod
): Promise<ClassificationOverride> {
  // Validate group and period range
  if (group < 1 || group > 6) {
    throw new Error(`Invalid group: ${group}. Must be 1-6.`);
  }
  if (period < 1 || period > 6) {
    throw new Error(`Invalid period: ${period}. Must be 1-6.`);
  }

  // PostgreSQL UPSERT using ON CONFLICT
  await execute(
    `INSERT INTO inventory_classifications (user_id, inventory_item_id, group_num, period_num)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, inventory_item_id) DO UPDATE SET
       group_num = EXCLUDED.group_num,
       period_num = EXCLUDED.period_num,
       updated_at = NOW()`,
    [userId, inventoryItemId, group, period]
  );

  // Fetch and return the updated row
  const result = await getOne(userId, inventoryItemId);
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
export async function deleteOverride(
  userId: number,
  inventoryItemId: number
): Promise<boolean> {
  const result = await execute(
    `DELETE FROM inventory_classifications
     WHERE user_id = $1 AND inventory_item_id = $2`,
    [userId, inventoryItemId]
  );
  return (result.rowCount ?? 0) > 0;
}

/**
 * Delete all overrides for a user (bulk reset)
 *
 * @param userId - User ID
 * @returns Number of overrides deleted
 */
export async function deleteAllOverrides(userId: number): Promise<number> {
  const result = await execute(
    `DELETE FROM inventory_classifications WHERE user_id = $1`,
    [userId]
  );
  return result.rowCount ?? 0;
}

/**
 * Get count of overrides for a user
 *
 * @param userId - User ID
 * @returns Number of overrides
 */
export async function countOverrides(userId: number): Promise<number> {
  const result = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM inventory_classifications WHERE user_id = $1`,
    [userId]
  );
  return parseInt(result?.count ?? '0', 10);
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
