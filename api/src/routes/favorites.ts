import { Router, Request, Response } from 'express';
import { db } from '../database/db';
import { authMiddleware } from '../middleware/auth';
import { Favorite } from '../types';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// GET /api/favorites - Get all favorites for user
router.get('/', (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    const favorites = db.prepare(
      'SELECT * FROM favorites WHERE user_id = ? ORDER BY created_at DESC'
    ).all(userId) as Favorite[];

    res.json({
      success: true,
      data: favorites
    });
  } catch (error) {
    console.error('Get favorites error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch favorites'
    });
  }
});

// POST /api/favorites - Add new favorite
router.post('/', (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    const { recipe_name, recipe_id } = req.body;

    // Validation
    if (!recipe_name) {
      return res.status(400).json({
        success: false,
        error: 'Recipe name is required'
      });
    }

    // Insert favorite
    const result = db.prepare(`
      INSERT INTO favorites (user_id, recipe_name, recipe_id)
      VALUES (?, ?, ?)
    `).run(userId, recipe_name, recipe_id || null);

    const favoriteId = result.lastInsertRowid as number;

    // Get created favorite
    const createdFavorite = db.prepare(
      'SELECT * FROM favorites WHERE id = ?'
    ).get(favoriteId) as Favorite;

    res.status(201).json({
      success: true,
      data: createdFavorite
    });
  } catch (error) {
    console.error('Add favorite error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add favorite'
    });
  }
});

// DELETE /api/favorites/:id - Remove favorite
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const favoriteId = parseInt(req.params.id);

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    if (isNaN(favoriteId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid favorite ID'
      });
    }

    // Check if favorite belongs to user
    const existingFavorite = db.prepare(
      'SELECT id FROM favorites WHERE id = ? AND user_id = ?'
    ).get(favoriteId, userId);

    if (!existingFavorite) {
      return res.status(404).json({
        success: false,
        error: 'Favorite not found'
      });
    }

    // Delete favorite
    db.prepare('DELETE FROM favorites WHERE id = ? AND user_id = ?')
      .run(favoriteId, userId);

    res.json({
      success: true,
      message: 'Favorite removed successfully'
    });
  } catch (error) {
    console.error('Delete favorite error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove favorite'
    });
  }
});

export default router;
