/**
 * Glasses Routes
 *
 * Handles HTTP layer for custom glassware types.
 * Business logic delegated to GlassService.
 *
 * Features:
 * - GET /api/glasses - List user's custom glasses
 * - POST /api/glasses - Create new custom glass
 * - DELETE /api/glasses/:id - Delete custom glass
 *
 * Security:
 * - All routes require JWT authentication (authMiddleware)
 * - User isolation: Can only access their own custom glasses
 * - Input validation: Names sanitized (in service)
 * - SQL injection prevention: Parameterized queries (in service)
 */

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { glassService } from '../services/GlassService';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * GET /api/glasses - List User's Custom Glasses
 *
 * Returns all custom glasses created by authenticated user.
 *
 * Response (200 OK):
 * {
 *   "success": true,
 *   "data": [
 *     {
 *       "id": 1,
 *       "user_id": 1,
 *       "name": "Hurricane",
 *       "created_at": "2025-12-10T14:32:05.000Z"
 *     }
 *   ]
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

  const glasses = glassService.getAll(userId);

  res.json({
    success: true,
    data: glasses
  });
}));

/**
 * POST /api/glasses - Create New Custom Glass
 *
 * Request Body:
 * {
 *   "name": "Hurricane"  // REQUIRED
 * }
 *
 * Response (201 Created):
 * {
 *   "success": true,
 *   "data": {
 *     "id": 1,
 *     "user_id": 1,
 *     "name": "Hurricane",
 *     "created_at": "2025-12-10T14:32:05.000Z"
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

  const { name } = req.body;

  if (!name) {
    return res.status(400).json({
      success: false,
      error: 'Glass name is required'
    });
  }

  const result = glassService.create(userId, name);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      error: result.error
    });
  }

  res.status(201).json({
    success: true,
    data: result.glass
  });
}));

/**
 * DELETE /api/glasses/:id - Delete Custom Glass
 *
 * Response (200 OK):
 * {
 *   "success": true,
 *   "message": "Glass deleted successfully"
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

  const glassId = parseInt(req.params.id, 10);

  if (isNaN(glassId) || glassId <= 0) {
    return res.status(400).json({
      success: false,
      error: 'Invalid glass ID'
    });
  }

  const result = glassService.delete(userId, glassId);

  if (!result.success) {
    return res.status(404).json({
      success: false,
      error: result.error
    });
  }

  res.json({
    success: true,
    message: 'Glass deleted successfully'
  });
}));

export default router;
