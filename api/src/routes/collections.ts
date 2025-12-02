/**
 * Collections Routes
 *
 * Handles HTTP layer for recipe collections (books/groups).
 * Business logic delegated to CollectionService.
 *
 * Features:
 * - GET /api/collections - List user's collections
 * - POST /api/collections - Create new collection
 * - PUT /api/collections/:id - Update collection
 * - DELETE /api/collections/:id - Delete collection
 *
 * Security:
 * - All routes require JWT authentication (authMiddleware)
 * - User isolation: Can only access their own collections
 * - Input validation: Names and text fields sanitized (in service)
 * - SQL injection prevention: Parameterized queries (in service)
 */

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { collectionService } from '../services/CollectionService';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * GET /api/collections - List User's Collections
 *
 * Returns all collections owned by authenticated user.
 *
 * Response (200 OK):
 * {
 *   "success": true,
 *   "data": [
 *     {
 *       "id": 1,
 *       "user_id": 1,
 *       "name": "Classic Cocktails",
 *       "description": "Traditional recipes",
 *       "recipe_count": 15,
 *       "created_at": "2025-11-15T18:45:00.000Z"
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

  const collections = collectionService.getAll(userId);

  res.json({
    success: true,
    data: collections
  });
}));

/**
 * POST /api/collections - Create New Collection
 *
 * Request Body:
 * {
 *   "name": "Classic Cocktails",        // REQUIRED
 *   "description": "Traditional recipes" // Optional
 * }
 *
 * Response (201 Created):
 * {
 *   "success": true,
 *   "data": {
 *     "id": 1,
 *     "user_id": 1,
 *     "name": "Classic Cocktails",
 *     "description": "Traditional recipes",
 *     "created_at": "2025-11-15T18:45:00.000Z"
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

  const { name, description } = req.body;

  // Validate required fields
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Collection name is required'
    });
  }

  const collection = collectionService.create(userId, { name, description });

  res.status(201).json({
    success: true,
    data: collection
  });
}));

/**
 * PUT /api/collections/:id - Update Collection
 *
 * Request Body:
 * {
 *   "name": "Updated Name",             // Optional
 *   "description": "Updated description" // Optional
 * }
 *
 * Response (200 OK):
 * {
 *   "success": true,
 *   "data": {
 *     "id": 1,
 *     "name": "Updated Name",
 *     "description": "Updated description",
 *     ...
 *   }
 * }
 */
router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized'
    });
  }

  const collectionId = parseInt(req.params.id, 10);
  if (isNaN(collectionId)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid collection ID'
    });
  }

  const { name, description } = req.body;

  const result = collectionService.update(collectionId, userId, { name, description });

  if (!result.success) {
    const status = result.error === 'Collection not found or access denied' ? 404 : 400;
    return res.status(status).json({
      success: false,
      error: result.error
    });
  }

  res.json({
    success: true,
    data: result.collection
  });
}));

/**
 * DELETE /api/collections/:id - Delete Collection
 *
 * Deletes collection. Recipes in this collection will have
 * collection_id set to NULL (not deleted).
 *
 * Response (200 OK):
 * {
 *   "success": true,
 *   "message": "Collection deleted successfully"
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

  const collectionId = parseInt(req.params.id, 10);
  if (isNaN(collectionId)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid collection ID'
    });
  }

  const deleted = collectionService.delete(collectionId, userId);

  if (!deleted) {
    return res.status(404).json({
      success: false,
      error: 'Collection not found or access denied'
    });
  }

  res.json({
    success: true,
    message: 'Collection deleted successfully'
  });
}));

export default router;
