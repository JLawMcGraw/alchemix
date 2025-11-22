/**
 * Favorites Routes
 *
 * Handles user's favorited recipes (bookmarking system).
 *
 * Features:
 * - GET /api/favorites - List user's favorite recipes
 * - POST /api/favorites - Add recipe to favorites
 * - DELETE /api/favorites/:id - Remove favorite
 *
 * Data Model:
 * - Favorites store both recipe_name (denormalized) and recipe_id (optional FK)
 * - Supports favoriting both internal recipes and external recipes
 * - Preserves favorite name even if source recipe is deleted
 *
 * Security:
 * - All routes require JWT authentication (authMiddleware)
 * - User isolation: Can only access their own favorites
 * - Input validation: Names sanitized, IDs validated
 * - SQL injection prevention: Parameterized queries
 *
 * SECURITY FIX #15: Added comprehensive input validation
 * - Recipe name sanitization (XSS prevention)
 * - Recipe ID validation (type checking)
 * - Length limits enforced
 */

import { Router, Request, Response } from 'express';
import { db } from '../database/db';
import { authMiddleware } from '../middleware/auth';
import { userRateLimit } from '../middleware/userRateLimit';
import { sanitizeString, validateNumber } from '../utils/inputValidator';
import { Favorite } from '../types';

const router = Router();

/**
 * Authentication Requirement
 *
 * All favorites routes require valid JWT token.
 * Ensures users can only access/modify their own favorites.
 */
router.use(authMiddleware);
// No rate limiting on favorites - users should be able to view their favorites freely

/**
 * GET /api/favorites - List User's Favorite Recipes
 *
 * Returns all recipes favorited by authenticated user.
 * Ordered by most recently added (created_at DESC).
 *
 * Query Parameters: None (future: add pagination)
 *
 * Response (200 OK):
 * {
 *   "success": true,
 *   "data": [
 *     {
 *       "id": 1,
 *       "user_id": 1,
 *       "recipe_name": "Old Fashioned",
 *       "recipe_id": 42,
 *       "created_at": "2025-11-10T14:32:05.123Z"
 *     }
 *   ]
 * }
 *
 * Use Cases:
 * - Display user's favorite recipes list
 * - Show quick access to frequently made cocktails
 * - Export favorites for sharing
 *
 * Error Responses:
 * - 401: Unauthorized (no valid JWT)
 * - 500: Database error
 *
 * Security:
 * - User isolation: WHERE user_id = ? ensures data privacy
 * - SQL injection: Parameterized query
 * - No sensitive data exposure
 *
 * Future Enhancements (Phase 3+):
 * - Add pagination (same as inventory/recipes)
 * - Add search/filter by recipe name
 * - Add sorting options (name, date)
 * - Join with recipes table for full recipe details
 */
router.get('/', (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;

    /**
     * Step 1: Authentication Check
     *
     * This should never fail (authMiddleware prevents it),
     * but we check for type safety and defense in depth.
     */
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    /**
     * Step 2: Fetch User's Favorites
     *
     * SQL Query Breakdown:
     * - SELECT *: All favorite columns (id, user_id, recipe_name, recipe_id, created_at)
     * - WHERE user_id = ?: User isolation for security
     * - ORDER BY created_at DESC: Most recent first
     *
     * Performance Note:
     * - Index on user_id makes this fast (<1ms for 1000 favorites)
     * - No JOIN needed (recipe_name is denormalized)
     *
     * Example SQL:
     * SELECT * FROM favorites WHERE user_id = 1 ORDER BY created_at DESC
     */
    const favorites = db.prepare(
      'SELECT * FROM favorites WHERE user_id = ? ORDER BY created_at DESC'
    ).all(userId) as Favorite[];

    /**
     * Step 3: Return Success Response
     *
     * Return favorites array (may be empty).
     * Empty array indicates user has no favorites yet.
     */
    res.json({
      success: true,
      data: favorites
    });
  } catch (error) {
    /**
     * Error Handling
     *
     * Log detailed error server-side.
     * Return generic error to client (don't leak internals).
     *
     * Common errors:
     * - Database connection failure
     * - SQLite error (database locked)
     */
    console.error('Get favorites error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch favorites'
    });
  }
});

/**
 * POST /api/favorites - Add Recipe to Favorites
 *
 * Adds a recipe to user's favorites list (bookmark).
 *
 * Request Body:
 * {
 *   "recipe_name": "Old Fashioned",    // REQUIRED (max 255 chars)
 *   "recipe_id": 42                    // OPTIONAL (FK to recipes table)
 * }
 *
 * Use Cases:
 * 1. User favorites their own recipe:
 *    - recipe_name: "Margarita"
 *    - recipe_id: 15 (points to recipes table)
 *
 * 2. User favorites external recipe (future):
 *    - recipe_name: "Aviation"
 *    - recipe_id: null (not in recipes table)
 *
 * Response (201 Created):
 * {
 *   "success": true,
 *   "data": {
 *     "id": 1,
 *     "user_id": 1,
 *     "recipe_name": "Old Fashioned",
 *     "recipe_id": 42,
 *     "created_at": "2025-11-10T14:32:05.123Z"
 *   }
 * }
 *
 * Error Responses:
 * - 400: Missing recipe_name, validation failed
 * - 401: Unauthorized (no valid JWT)
 * - 500: Database error
 *
 * Security:
 * - Input validation: recipe_name sanitized (SECURITY FIX #15)
 * - SQL injection: Parameterized queries only
 * - User ownership: favorite.user_id set to authenticated user
 * - XSS prevention: HTML tags stripped from recipe_name
 * - Length limits: Prevent database bloat
 *
 * Future Enhancements (Phase 3+):
 * - Add UNIQUE constraint (user_id, recipe_id) to prevent duplicates
 * - Verify recipe_id exists in recipes table (if provided)
 * - Add tags/categories to favorites
 * - Add personal notes field
 */
router.post('/', (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;

    /**
     * Step 1: Authentication Check
     */
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    const { recipe_name, recipe_id } = req.body;

    /**
     * Step 2: Validate Required Fields
     *
     * Recipe name is required for favoriting.
     * Recipe ID is optional (may be null for external recipes).
     */
    if (!recipe_name || typeof recipe_name !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Recipe name is required and must be a string'
      });
    }

    /**
     * Step 3: Sanitize Recipe Name (SECURITY FIX #15)
     *
     * Remove HTML tags, trim whitespace, limit length.
     * Prevents XSS attacks and database bloat.
     *
     * Sanitization rules:
     * - Max 255 characters
     * - Strip HTML tags
     * - Remove null bytes
     * - Trim whitespace
     *
     * Example:
     * Input:  "  Old Fashioned<script>alert('xss')</script>  "
     * Output: "Old Fashioned"
     */
    const sanitizedRecipeName = sanitizeString(recipe_name, 255, true);

    if (sanitizedRecipeName.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Recipe name cannot be empty after sanitization'
      });
    }

    /**
     * Step 4: Validate Recipe ID (Optional)
     *
     * If recipe_id is provided, validate it's a positive integer.
     * If null/undefined, that's acceptable (external recipe).
     *
     * Validation:
     * - Must be a number (if provided)
     * - Must be positive (recipe IDs start at 1)
     * - Must be finite (not Infinity)
     */
    let validatedRecipeId: number | null = null;

    if (recipe_id !== null && recipe_id !== undefined && recipe_id !== '') {
      const recipeIdValidation = validateNumber(
        recipe_id,
        1,        // min: recipe IDs start at 1
        undefined // max: no upper limit
      );

      if (!recipeIdValidation.isValid) {
        return res.status(400).json({
          success: false,
          error: 'Invalid recipe ID',
          details: recipeIdValidation.errors
        });
      }

      validatedRecipeId = recipeIdValidation.sanitized;

      /**
       * Optional Future Enhancement: Verify Recipe Exists
       *
       * Check if recipe_id exists in recipes table:
       * ```typescript
       * const recipeExists = db.prepare(
       *   'SELECT id FROM recipes WHERE id = ? AND user_id = ?'
       * ).get(validatedRecipeId, userId);
       *
       * if (!recipeExists) {
       *   return res.status(404).json({
       *     success: false,
       *     error: 'Recipe not found'
       *   });
       * }
       * ```
       *
       * Pros: Ensures referential integrity
       * Cons: Prevents favoriting external recipes (future feature)
       */
    }

    /**
     * Step 5: Check for Duplicate Favorites (Optional)
     *
     * Prevent user from favoriting same recipe twice.
     * Currently not implemented (database allows duplicates).
     *
     * Future Enhancement (Phase 3+):
     * ```typescript
     * if (validatedRecipeId) {
     *   const duplicate = db.prepare(
     *     'SELECT id FROM favorites WHERE user_id = ? AND recipe_id = ?'
     *   ).get(userId, validatedRecipeId);
     *
     *   if (duplicate) {
     *     return res.status(409).json({
     *       success: false,
     *       error: 'Recipe already in favorites'
     *     });
     *   }
     * }
     * ```
     *
     * Alternative: Add UNIQUE constraint in database schema:
     * `UNIQUE (user_id, recipe_id)`
     */

    /**
     * Step 6: Insert Favorite into Database
     *
     * SQL INSERT with 3 parameters (user_id, recipe_name, recipe_id).
     * Parameterized query prevents SQL injection.
     *
     * Database automatically adds:
     * - id: Auto-increment primary key
     * - created_at: Current timestamp (DEFAULT)
     */
    const result = db.prepare(`
      INSERT INTO favorites (user_id, recipe_name, recipe_id)
      VALUES (?, ?, ?)
    `).run(userId, sanitizedRecipeName, validatedRecipeId);

    const favoriteId = result.lastInsertRowid as number;

    /**
     * Step 7: Retrieve Created Favorite
     *
     * Fetch the complete favorite record to return in response.
     * This includes database-generated fields (id, created_at).
     */
    const createdFavorite = db.prepare(
      'SELECT * FROM favorites WHERE id = ?'
    ).get(favoriteId) as Favorite;

    /**
     * Step 8: Return Success Response
     *
     * 201 Created status indicates new resource was created.
     * Return complete favorite object for frontend to display.
     */
    res.status(201).json({
      success: true,
      data: createdFavorite
    });
  } catch (error) {
    /**
     * Error Handling
     *
     * Common errors:
     * - Database constraint violation (e.g., invalid user_id)
     * - SQLite error (database locked, disk full)
     * - Foreign key violation (if recipe_id doesn't exist)
     */
    console.error('Add favorite error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add favorite'
    });
  }
});

/**
 * DELETE /api/favorites/:id - Remove Favorite
 *
 * Removes a recipe from user's favorites permanently.
 *
 * Route Parameters:
 * - id: Favorite ID to delete (must be positive integer)
 *
 * Response (200 OK):
 * {
 *   "success": true,
 *   "message": "Favorite removed successfully"
 * }
 *
 * Error Responses:
 * - 400: Invalid favorite ID (not a number)
 * - 401: Unauthorized (no valid JWT)
 * - 404: Favorite not found or doesn't belong to user
 * - 500: Database error
 *
 * Security:
 * - User ownership: WHERE user_id = ? ensures users can only delete own favorites
 * - SQL injection: Parameterized query
 * - Authorization: Even with valid ID, users can't delete others' favorites
 *
 * Note: This is a hard delete (permanent removal).
 * Favorites are bookmarks, so soft delete is less critical than for bottles/recipes.
 *
 * Future Enhancements (Phase 3+):
 * - Add bulk delete (delete multiple favorites at once)
 * - Add "undo" functionality (soft delete + restore)
 * - Track deletion timestamp for analytics
 */
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const favoriteId = parseInt(req.params.id);

    /**
     * Step 1: Authentication Check
     */
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    /**
     * Step 2: Validate Favorite ID
     *
     * Ensure ID is a valid positive integer.
     * parseInt() returns NaN for non-numeric strings.
     */
    if (isNaN(favoriteId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid favorite ID'
      });
    }

    /**
     * Step 3: Verify Ownership
     *
     * Check that favorite exists AND belongs to authenticated user.
     * This prevents users from deleting others' favorites.
     *
     * Security Note:
     * - WHERE id = ? AND user_id = ? ensures both conditions
     * - If favorite exists but belongs to another user → 404 (not 403)
     * - Prevents leaking information about other users' favorites
     */
    const existingFavorite = db.prepare(
      'SELECT id FROM favorites WHERE id = ? AND user_id = ?'
    ).get(favoriteId, userId);

    if (!existingFavorite) {
      return res.status(404).json({
        success: false,
        error: 'Favorite not found'
      });
    }

    /**
     * Step 4: Delete Favorite
     *
     * Permanent removal from database.
     * WHERE clause ensures user ownership (defense in depth).
     *
     * SQL: DELETE FROM favorites WHERE id = ? AND user_id = ?
     *
     * Note on Foreign Keys:
     * - Deleting a favorite does NOT delete the source recipe
     * - favorites.recipe_id is optional FK with ON DELETE SET NULL
     * - Deleting a recipe sets recipe_id to null but keeps favorite
     */
    db.prepare('DELETE FROM favorites WHERE id = ? AND user_id = ?')
      .run(favoriteId, userId);

    /**
     * Step 5: Return Success Response
     *
     * 200 OK with confirmation message.
     * No data returned (favorite is deleted).
     */
    res.json({
      success: true,
      message: 'Favorite removed successfully'
    });
  } catch (error) {
    /**
     * Error Handling
     *
     * Common errors:
     * - Database constraint violation (rare for DELETE)
     * - SQLite error (database locked)
     */
    console.error('Delete favorite error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove favorite'
    });
  }
});

/**
 * Export Favorites Router
 *
 * Mounted at /api/favorites in server.ts:
 * - GET    /api/favorites     - List favorites
 * - POST   /api/favorites     - Add favorite
 * - DELETE /api/favorites/:id - Remove favorite
 *
 * All routes require authentication (authMiddleware applied to router).
 *
 * Future Enhancements (Phase 3+):
 * - GET /api/favorites/:id           - Get single favorite details
 * - PUT /api/favorites/:id           - Update favorite (add notes/tags)
 * - GET /api/favorites/recipe/:id    - Get all favorites for specific recipe
 * - POST /api/favorites/bulk         - Add multiple favorites at once
 * - DELETE /api/favorites/bulk       - Remove multiple favorites
 * - GET /api/favorites/export        - Export favorites as JSON/CSV
 */
export default router;
