/**
 * Glass Service
 *
 * Business logic for custom glassware types.
 * Users can add custom glass types beyond the default set.
 *
 * @version 1.0.0
 * @date December 2025
 */

import { queryOne, queryAll, execute } from '../database/db';
import { sanitizeString } from '../utils/inputValidator';

/**
 * Custom glass entity as stored in database
 */
export interface CustomGlass {
  id: number;
  user_id: number;
  name: string;
  created_at: string;
}

/**
 * Result of a create/delete operation
 */
export interface GlassResult {
  success: boolean;
  glass?: CustomGlass;
  error?: string;
}

/**
 * Glass Service
 *
 * Handles all custom glass business logic independent of HTTP layer.
 */
export class GlassService {
  /**
   * Get all custom glasses for a user
   */
  async getAll(userId: number): Promise<CustomGlass[]> {
    return queryAll<CustomGlass>(`
      SELECT * FROM custom_glasses
      WHERE user_id = $1
      ORDER BY name ASC
    `, [userId]);
  }

  /**
   * Create a new custom glass
   */
  async create(userId: number, name: string): Promise<GlassResult> {
    // Sanitize and validate
    const sanitizedName = sanitizeString(name, 100);

    if (!sanitizedName || sanitizedName.trim().length === 0) {
      return { success: false, error: 'Glass name is required' };
    }

    const trimmedName = sanitizedName.trim();

    // Check for duplicate (case-insensitive)
    const existing = await queryOne<{ id: number }>(`
      SELECT id FROM custom_glasses
      WHERE user_id = $1 AND LOWER(name) = LOWER($2)
    `, [userId, trimmedName]);

    if (existing) {
      return { success: false, error: 'A glass with this name already exists' };
    }

    try {
      const result = await execute(`
        INSERT INTO custom_glasses (user_id, name)
        VALUES ($1, $2)
        RETURNING *
      `, [userId, trimmedName]);

      const glass = result.rows[0] as CustomGlass;

      return { success: true, glass };
    } catch (error) {
      console.error('Error creating custom glass:', error);
      return { success: false, error: 'Failed to create custom glass' };
    }
  }

  /**
   * Delete a custom glass
   */
  async delete(userId: number, glassId: number): Promise<GlassResult> {
    // Verify ownership and get glass data
    const glass = await queryOne<CustomGlass>(`
      SELECT * FROM custom_glasses
      WHERE id = $1 AND user_id = $2
    `, [glassId, userId]);

    if (!glass) {
      return { success: false, error: 'Glass not found or access denied' };
    }

    try {
      await execute(`
        DELETE FROM custom_glasses WHERE id = $1 AND user_id = $2
      `, [glassId, userId]);

      return { success: true, glass };
    } catch (error) {
      console.error('Error deleting custom glass:', error);
      return { success: false, error: 'Failed to delete custom glass' };
    }
  }
}

// Singleton instance
export const glassService = new GlassService();
