/**
 * Favorite Service
 *
 * Business logic for user's favorited recipes (bookmarking system).
 * Extracted from routes/favorites.ts for testability and reusability.
 *
 * @version 1.0.0
 * @date December 2025
 */

import { db } from '../database/db';
import { sanitizeString, validateNumber } from '../utils/inputValidator';
import { Favorite } from '../types';

/**
 * Input for creating a favorite
 */
export interface CreateFavoriteInput {
  recipe_name: string;
  recipe_id?: number | null;
}

/**
 * Validation result for recipe ID
 */
export interface RecipeIdValidation {
  isValid: boolean;
  value: number | null;
  error?: string;
}

/**
 * Result of a create operation
 */
export interface CreateFavoriteResult {
  success: boolean;
  favorite?: Favorite;
  error?: string;
}

/**
 * Favorite Service
 *
 * Handles all favorite business logic independent of HTTP layer.
 */
export class FavoriteService {
  /**
   * Get all favorites for a user
   */
  getAll(userId: number): Favorite[] {
    return db.prepare(
      'SELECT * FROM favorites WHERE user_id = ? ORDER BY created_at DESC'
    ).all(userId) as Favorite[];
  }

  /**
   * Get a single favorite by ID (with ownership check)
   */
  getById(favoriteId: number, userId: number): Favorite | null {
    const favorite = db.prepare(
      'SELECT * FROM favorites WHERE id = ? AND user_id = ?'
    ).get(favoriteId, userId) as Favorite | undefined;

    return favorite || null;
  }

  /**
   * Check if a favorite exists and belongs to user
   */
  exists(favoriteId: number, userId: number): boolean {
    const result = db.prepare(
      'SELECT id FROM favorites WHERE id = ? AND user_id = ?'
    ).get(favoriteId, userId);

    return !!result;
  }

  /**
   * Validate and sanitize recipe name
   *
   * Returns sanitized name or null if invalid
   */
  validateRecipeName(recipeName: unknown): string | null {
    if (!recipeName || typeof recipeName !== 'string') {
      return null;
    }

    const sanitized = sanitizeString(recipeName, 255, true);
    return sanitized.length > 0 ? sanitized : null;
  }

  /**
   * Validate recipe ID
   *
   * Returns validated number, null (if not provided), or error
   */
  validateRecipeId(recipeId: unknown): RecipeIdValidation {
    // Null/undefined/empty is valid (external recipe)
    if (recipeId === null || recipeId === undefined || recipeId === '') {
      return { isValid: true, value: null };
    }

    const validation = validateNumber(recipeId, 1, undefined);

    if (!validation.isValid) {
      return {
        isValid: false,
        value: null,
        error: validation.errors?.join(', ') || 'Invalid recipe ID'
      };
    }

    return { isValid: true, value: validation.sanitized };
  }

  /**
   * Create a new favorite
   *
   * Expects pre-validated input (use validateRecipeName/validateRecipeId first)
   */
  create(userId: number, sanitizedName: string, recipeId: number | null): Favorite {
    const result = db.prepare(`
      INSERT INTO favorites (user_id, recipe_name, recipe_id)
      VALUES (?, ?, ?)
    `).run(userId, sanitizedName, recipeId);

    const favoriteId = result.lastInsertRowid as number;

    return db.prepare(
      'SELECT * FROM favorites WHERE id = ?'
    ).get(favoriteId) as Favorite;
  }

  /**
   * Delete a favorite
   *
   * Returns false if favorite doesn't exist or doesn't belong to user.
   */
  delete(favoriteId: number, userId: number): boolean {
    if (!this.exists(favoriteId, userId)) {
      return false;
    }

    db.prepare('DELETE FROM favorites WHERE id = ? AND user_id = ?')
      .run(favoriteId, userId);

    return true;
  }

  /**
   * Check if a recipe is already favorited by user
   */
  isRecipeFavorited(userId: number, recipeId: number): boolean {
    const result = db.prepare(
      'SELECT id FROM favorites WHERE user_id = ? AND recipe_id = ?'
    ).get(userId, recipeId);

    return !!result;
  }

  /**
   * Get favorite by recipe ID (if exists)
   */
  getByRecipeId(userId: number, recipeId: number): Favorite | null {
    const favorite = db.prepare(
      'SELECT * FROM favorites WHERE user_id = ? AND recipe_id = ?'
    ).get(userId, recipeId) as Favorite | undefined;

    return favorite || null;
  }
}

// Export singleton instance
export const favoriteService = new FavoriteService();
