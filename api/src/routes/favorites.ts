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
import { validateNumber } from '../utils/inputValidator';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * GET /api/favorites - List User's Favorite Recipes
 *
 * Returns recipes favorited by authenticated user with optional pagination.
 * Ordered by most recently added (created_at DESC).
 *
 * Query Parameters:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 50, max: 100)
 * - all: Set to 'true' to skip pagination and get all favorites (backwards compatible)
 *
 * Response (200 OK) - Paginated:
 * {
 *   "success": true,
 *   "data": [...],
 *   "pagination": {
 *     "page": 1,
 *     "limit": 50,
 *     "total": 120,
 *     "totalPages": 3,
 *     "hasNextPage": true,
 *     "hasPreviousPage": false
 *   }
 * }
 *
 * Response (200 OK) - Non-paginated (all=true):
 * {
 *   "success": true,
 *   "data": [...]
 * }
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }

  // Check if pagination should be skipped (backwards compatibility)
  const skipPagination = req.query.all === 'true';

  if (skipPagination) {
    const favorites = await favoriteService.getAll(userId);
    return res.json({
      success: true,
      data: favorites
    });
  }

  // Validate page parameter
  const pageParam = req.query.page as string | undefined;
  const pageValidation = validateNumber(pageParam || '1', 1, undefined);

  if (!pageValidation.isValid) {
    return res.status(400).json({
      success: false,
      error: 'Invalid page parameter',
      details: pageValidation.errors
    });
  }

  const page = pageValidation.sanitized || 1;

  // Validate limit parameter
  const limitParam = req.query.limit as string | undefined;
  const limitValidation = validateNumber(limitParam || '50', 1, 100);

  if (!limitValidation.isValid) {
    return res.status(400).json({
      success: false,
      error: 'Invalid limit parameter',
      details: limitValidation.errors
    });
  }

  const limit = limitValidation.sanitized || 50;

  const result = await favoriteService.getPaginated(userId, page, limit);

  res.json({
    success: true,
    data: result.favorites,
    pagination: result.pagination
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
      error: 'Authentication required'
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

  const favorite = await favoriteService.create(userId, sanitizedName, recipeIdValidation.value);

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
      error: 'Authentication required'
    });
  }

  const favoriteId = parseInt(req.params.id, 10);
  if (isNaN(favoriteId) || favoriteId <= 0) {
    return res.status(400).json({
      success: false,
      error: 'Invalid favorite ID'
    });
  }

  const deleted = await favoriteService.delete(favoriteId, userId);

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
