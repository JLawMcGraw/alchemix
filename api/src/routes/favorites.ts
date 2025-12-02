/**
 * Favorites Routes
 *
 * Handles HTTP layer for user's favorited recipes (bookmarking system).
 * Business logic delegated to FavoriteService.
 *
 * Features:
 * - GET /api/favorites - List user's favorite recipes
 * - POST /api/favorites - Add recipe to favorites
 * - DELETE /api/favorites/:id - Remove favorite
 *
 * Security:
 * - All routes require JWT authentication (authMiddleware)
 * - User isolation: Can only access their own favorites
 * - Input validation: Names sanitized, IDs validated (in service)
 * - SQL injection prevention: Parameterized queries (in service)
 */

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { favoriteService } from '../services/FavoriteService';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * GET /api/favorites - List User's Favorite Recipes
 *
 * Returns all recipes favorited by authenticated user.
 * Ordered by most recently added (created_at DESC).
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
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized'
    });
  }

  const favorites = favoriteService.getAll(userId);

  res.json({
    success: true,
    data: favorites
  });
}));

/**
 * POST /api/favorites - Add Recipe to Favorites
 *
 * Request Body:
 * {
 *   "recipe_name": "Old Fashioned",    // REQUIRED (max 255 chars)
 *   "recipe_id": 42                    // OPTIONAL (FK to recipes table)
 * }
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
 */
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized'
    });
  }

  const { recipe_name, recipe_id } = req.body;

  // Validate recipe name
  const sanitizedName = favoriteService.validateRecipeName(recipe_name);
  if (!sanitizedName) {
    return res.status(400).json({
      success: false,
      error: 'Recipe name is required and must be a non-empty string'
    });
  }

  // Validate recipe ID (optional)
  const recipeIdValidation = favoriteService.validateRecipeId(recipe_id);
  if (!recipeIdValidation.isValid) {
    return res.status(400).json({
      success: false,
      error: 'Invalid recipe ID',
      details: recipeIdValidation.error
    });
  }

  const favorite = favoriteService.create(userId, sanitizedName, recipeIdValidation.value);

  res.status(201).json({
    success: true,
    data: favorite
  });
}));

/**
 * DELETE /api/favorites/:id - Remove Favorite
 *
 * Removes a recipe from user's favorites permanently.
 *
 * Response (200 OK):
 * {
 *   "success": true,
 *   "message": "Favorite removed successfully"
 * }
 */
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized'
    });
  }

  const favoriteId = parseInt(req.params.id, 10);
  if (isNaN(favoriteId)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid favorite ID'
    });
  }

  const deleted = favoriteService.delete(favoriteId, userId);

  if (!deleted) {
    return res.status(404).json({
      success: false,
      error: 'Favorite not found'
    });
  }

  res.json({
    success: true,
    message: 'Favorite removed successfully'
  });
}));

export default router;
