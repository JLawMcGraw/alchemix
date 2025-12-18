/**
 * Favorite Service
 *
 * Business logic for user's favorited recipes (bookmarking system).
 * Extracted from routes/favorites.ts for testability and reusability.
 *
 * @version 1.0.0
 * @date December 2025
 */

import { queryOne, queryAll, execute } from '../database/db';
import { sanitizeString, validateNumber } from '../utils/inputValidator';
import { Favorite } from '../types';

/**
 * Pagination result
 */
export interface PaginatedFavorites {
  favorites: Favorite[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

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
   * Get all favorites for a user (no pagination - backwards compatible)
   */
  async getAll(userId: number): Promise<Favorite[]> {
    return queryAll<Favorite>(
      'SELECT * FROM favorites WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
  }

  /**
   * Get paginated favorites for a user
   *
   * @param userId - User ID
   * @param page - Page number (1-indexed, default 1)
   * @param limit - Items per page (default 50, max 100)
   */
  async getPaginated(userId: number, page: number = 1, limit: number = 50): Promise<PaginatedFavorites> {
    // Validate and clamp parameters
    const safePage = Math.max(1, Math.floor(page));
    const safeLimit = Math.min(100, Math.max(1, Math.floor(limit)));
    const offset = (safePage - 1) * safeLimit;

    // Get total count
    const countResult = await queryOne<{ total: string }>(
      'SELECT COUNT(*) as total FROM favorites WHERE user_id = $1',
      [userId]
    );

    const total = parseInt(countResult?.total ?? '0', 10);
    const totalPages = Math.ceil(total / safeLimit);

    // Get paginated results
    const favorites = await queryAll<Favorite>(
      'SELECT * FROM favorites WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [userId, safeLimit, offset]
    );

    return {
      favorites,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages,
        hasNextPage: safePage < totalPages,
        hasPreviousPage: safePage > 1
      }
    };
  }

  /**
   * Get a single favorite by ID (with ownership check)
   */
  async getById(favoriteId: number, userId: number): Promise<Favorite | null> {
    return queryOne<Favorite>(
      'SELECT * FROM favorites WHERE id = $1 AND user_id = $2',
      [favoriteId, userId]
    );
  }

  /**
   * Check if a favorite exists and belongs to user
   */
  async exists(favoriteId: number, userId: number): Promise<boolean> {
    const result = await queryOne<{ id: number }>(
      'SELECT id FROM favorites WHERE id = $1 AND user_id = $2',
      [favoriteId, userId]
    );
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

    return { isValid: true, value: validation.sanitized ?? null };
  }

  /**
   * Create a new favorite
   *
   * Expects pre-validated input (use validateRecipeName/validateRecipeId first)
   */
  async create(userId: number, sanitizedName: string, recipeId: number | null): Promise<Favorite> {
    const result = await execute(
      `INSERT INTO favorites (user_id, recipe_name, recipe_id)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [userId, sanitizedName, recipeId]
    );

    return result.rows[0] as Favorite;
  }

  /**
   * Delete a favorite
   *
   * Returns false if favorite doesn't exist or doesn't belong to user.
   */
  async delete(favoriteId: number, userId: number): Promise<boolean> {
    if (!await this.exists(favoriteId, userId)) {
      return false;
    }

    await execute(
      'DELETE FROM favorites WHERE id = $1 AND user_id = $2',
      [favoriteId, userId]
    );

    return true;
  }

  /**
   * Check if a recipe is already favorited by user
   */
  async isRecipeFavorited(userId: number, recipeId: number): Promise<boolean> {
    const result = await queryOne<{ id: number }>(
      'SELECT id FROM favorites WHERE user_id = $1 AND recipe_id = $2',
      [userId, recipeId]
    );
    return !!result;
  }

  /**
   * Get favorite by recipe ID (if exists)
   */
  async getByRecipeId(userId: number, recipeId: number): Promise<Favorite | null> {
    return queryOne<Favorite>(
      'SELECT * FROM favorites WHERE user_id = $1 AND recipe_id = $2',
      [userId, recipeId]
    );
  }
}

// Export singleton instance
export const favoriteService = new FavoriteService();
