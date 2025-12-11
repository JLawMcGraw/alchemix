/**
 * Glass Service
 *
 * Business logic for custom glassware types.
 * Users can add custom glass types beyond the default set.
 *
 * @version 1.0.0
 * @date December 2025
 */

import { db } from '../database/db';
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
  getAll(userId: number): CustomGlass[] {
    return db.prepare(`
      SELECT * FROM custom_glasses
      WHERE user_id = ?
      ORDER BY name ASC
    `).all(userId) as CustomGlass[];
  }

  /**
   * Create a new custom glass
   */
  create(userId: number, name: string): GlassResult {
    // Sanitize and validate
    const sanitizedName = sanitizeString(name, 100);

    if (!sanitizedName || sanitizedName.trim().length === 0) {
      return { success: false, error: 'Glass name is required' };
    }

    const trimmedName = sanitizedName.trim();

    // Check for duplicate
    const existing = db.prepare(`
      SELECT id FROM custom_glasses
      WHERE user_id = ? AND LOWER(name) = LOWER(?)
    `).get(userId, trimmedName);

    if (existing) {
      return { success: false, error: 'A glass with this name already exists' };
    }

    try {
      const result = db.prepare(`
        INSERT INTO custom_glasses (user_id, name)
        VALUES (?, ?)
      `).run(userId, trimmedName);

      const glass = db.prepare(`
        SELECT * FROM custom_glasses WHERE id = ?
      `).get(result.lastInsertRowid) as CustomGlass;

      return { success: true, glass };
    } catch (error) {
      console.error('Error creating custom glass:', error);
      return { success: false, error: 'Failed to create custom glass' };
    }
  }

  /**
   * Delete a custom glass
   */
  delete(userId: number, glassId: number): GlassResult {
    // Verify ownership
    const glass = db.prepare(`
      SELECT * FROM custom_glasses
      WHERE id = ? AND user_id = ?
    `).get(glassId, userId) as CustomGlass | undefined;

    if (!glass) {
      return { success: false, error: 'Glass not found or access denied' };
    }

    try {
      db.prepare(`
        DELETE FROM custom_glasses WHERE id = ? AND user_id = ?
      `).run(glassId, userId);

      return { success: true, glass };
    } catch (error) {
      console.error('Error deleting custom glass:', error);
      return { success: false, error: 'Failed to delete custom glass' };
    }
  }
}

// Singleton instance
export const glassService = new GlassService();
