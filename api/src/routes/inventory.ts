import { Router, Request, Response } from 'express';
import { db } from '../database/db';
import { authMiddleware } from '../middleware/auth';
import { Bottle } from '../types';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// GET /api/inventory - Get all bottles for user
router.get('/', (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    const bottles = db.prepare(
      'SELECT * FROM bottles WHERE user_id = ? ORDER BY created_at DESC'
    ).all(userId) as Bottle[];

    res.json({
      success: true,
      data: bottles
    });
  } catch (error) {
    console.error('Get bottles error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch bottles'
    });
  }
});

// POST /api/inventory - Add new bottle
router.post('/', (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    const bottle: Bottle = req.body;

    // Validation
    if (!bottle.name) {
      return res.status(400).json({
        success: false,
        error: 'Bottle name is required'
      });
    }

    // Insert bottle
    const result = db.prepare(`
      INSERT INTO bottles (
        user_id, name, "Stock Number", "Liquor Type",
        "Detailed Spirit Classification", "Distillation Method",
        "ABV (%)", "Distillery Location",
        "Age Statement or Barrel Finish", "Additional Notes",
        "Profile (Nose)", "Palate", "Finish"
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      bottle.name,
      bottle['Stock Number'] || null,
      bottle['Liquor Type'] || null,
      bottle['Detailed Spirit Classification'] || null,
      bottle['Distillation Method'] || null,
      bottle['ABV (%)'] || null,
      bottle['Distillery Location'] || null,
      bottle['Age Statement or Barrel Finish'] || null,
      bottle['Additional Notes'] || null,
      bottle['Profile (Nose)'] || null,
      bottle['Palate'] || null,
      bottle['Finish'] || null
    );

    const bottleId = result.lastInsertRowid as number;

    // Get created bottle
    const createdBottle = db.prepare(
      'SELECT * FROM bottles WHERE id = ?'
    ).get(bottleId) as Bottle;

    res.status(201).json({
      success: true,
      data: createdBottle
    });
  } catch (error) {
    console.error('Add bottle error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add bottle'
    });
  }
});

// PUT /api/inventory/:id - Update bottle
router.put('/:id', (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const bottleId = parseInt(req.params.id);

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    if (isNaN(bottleId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid bottle ID'
      });
    }

    // Check if bottle belongs to user
    const existingBottle = db.prepare(
      'SELECT id FROM bottles WHERE id = ? AND user_id = ?'
    ).get(bottleId, userId);

    if (!existingBottle) {
      return res.status(404).json({
        success: false,
        error: 'Bottle not found'
      });
    }

    const bottle: Bottle = req.body;

    // Update bottle
    db.prepare(`
      UPDATE bottles SET
        name = ?,
        "Stock Number" = ?,
        "Liquor Type" = ?,
        "Detailed Spirit Classification" = ?,
        "Distillation Method" = ?,
        "ABV (%)" = ?,
        "Distillery Location" = ?,
        "Age Statement or Barrel Finish" = ?,
        "Additional Notes" = ?,
        "Profile (Nose)" = ?,
        "Palate" = ?,
        "Finish" = ?
      WHERE id = ? AND user_id = ?
    `).run(
      bottle.name,
      bottle['Stock Number'] || null,
      bottle['Liquor Type'] || null,
      bottle['Detailed Spirit Classification'] || null,
      bottle['Distillation Method'] || null,
      bottle['ABV (%)'] || null,
      bottle['Distillery Location'] || null,
      bottle['Age Statement or Barrel Finish'] || null,
      bottle['Additional Notes'] || null,
      bottle['Profile (Nose)'] || null,
      bottle['Palate'] || null,
      bottle['Finish'] || null,
      bottleId,
      userId
    );

    // Get updated bottle
    const updatedBottle = db.prepare(
      'SELECT * FROM bottles WHERE id = ?'
    ).get(bottleId) as Bottle;

    res.json({
      success: true,
      data: updatedBottle
    });
  } catch (error) {
    console.error('Update bottle error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update bottle'
    });
  }
});

// DELETE /api/inventory/:id - Delete bottle
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const bottleId = parseInt(req.params.id);

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    if (isNaN(bottleId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid bottle ID'
      });
    }

    // Check if bottle belongs to user
    const existingBottle = db.prepare(
      'SELECT id FROM bottles WHERE id = ? AND user_id = ?'
    ).get(bottleId, userId);

    if (!existingBottle) {
      return res.status(404).json({
        success: false,
        error: 'Bottle not found'
      });
    }

    // Delete bottle
    db.prepare('DELETE FROM bottles WHERE id = ? AND user_id = ?')
      .run(bottleId, userId);

    res.json({
      success: true,
      message: 'Bottle deleted successfully'
    });
  } catch (error) {
    console.error('Delete bottle error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete bottle'
    });
  }
});

// POST /api/inventory/import - CSV import (placeholder)
router.post('/import', (req: Request, res: Response) => {
  // TODO: Implement CSV import
  res.status(501).json({
    success: false,
    error: 'CSV import not yet implemented'
  });
});

export default router;
