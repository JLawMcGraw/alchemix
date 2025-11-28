/**
 * Collections Routes
 *
 * Handles CRUD operations for recipe collections (books/groups).
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
 * - Input validation: Names and text fields sanitized
 * - SQL injection prevention: Parameterized queries
 */

import { Router, Request, Response } from 'express';
import { db } from '../database/db';
import { authMiddleware } from '../middleware/auth';
import { userRateLimit } from '../middleware/userRateLimit';
import { sanitizeString } from '../utils/inputValidator';
import { memoryService } from '../services/MemoryService';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// All routes require authentication
router.use(authMiddleware);
// No rate limiting on collections - users should be able to view their collections freely

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

    // Get all collections with recipe count
    const collections = db.prepare(`
      SELECT
        c.*,
        COUNT(r.id) as recipe_count
      FROM collections c
      LEFT JOIN recipes r ON r.collection_id = c.id
      WHERE c.user_id = ?
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `).all(userId);

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

    // Sanitize inputs
    const sanitizedName = sanitizeString(name, 100);
    const sanitizedDescription = description
      ? sanitizeString(description, 500)
      : null;

    // Insert collection
    const result = db.prepare(`
      INSERT INTO collections (user_id, name, description)
      VALUES (?, ?, ?)
    `).run(userId, sanitizedName, sanitizedDescription);

    // Fetch created collection
    const collection = db.prepare(
      'SELECT * FROM collections WHERE id = ?'
    ).get(result.lastInsertRowid);

    // Store collection in MemMachine (fire-and-forget)
    memoryService.storeUserCollection(userId, {
      name: sanitizedName,
      description: sanitizedDescription || undefined,
    }).catch(err => {
      console.error('Failed to store collection in MemMachine (non-critical):', err);
    });

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

    // Check if collection exists and belongs to user
    const existingCollection = db.prepare(
      'SELECT id FROM collections WHERE id = ? AND user_id = ?'
    ).get(collectionId, userId);

    if (!existingCollection) {
      return res.status(404).json({
        success: false,
        error: 'Collection not found or access denied'
      });
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];

    if (name !== undefined) {
      const sanitizedName = sanitizeString(name, 100);
      if (sanitizedName) {
        updates.push('name = ?');
        values.push(sanitizedName);
      }
    }

    if (description !== undefined) {
      const sanitizedDescription = description
        ? sanitizeString(description, 500)
        : null;
      updates.push('description = ?');
      values.push(sanitizedDescription);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid fields to update'
      });
    }

    values.push(collectionId);

    db.prepare(`
      UPDATE collections
      SET ${updates.join(', ')}
      WHERE id = ?
    `).run(...values);

    // Fetch updated collection
    const updatedCollection = db.prepare(
      'SELECT * FROM collections WHERE id = ?'
    ).get(collectionId);

  res.json({
    success: true,
    data: updatedCollection
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

    // Check if collection exists and belongs to user
    const existingCollection = db.prepare(
      'SELECT id FROM collections WHERE id = ? AND user_id = ?'
    ).get(collectionId, userId);

    if (!existingCollection) {
      return res.status(404).json({
        success: false,
        error: 'Collection not found or access denied'
      });
    }

    // Delete collection (CASCADE will set recipes.collection_id to NULL)
    db.prepare('DELETE FROM collections WHERE id = ?').run(collectionId);

  res.json({
    success: true,
    message: 'Collection deleted successfully'
  });
}));

export default router;
