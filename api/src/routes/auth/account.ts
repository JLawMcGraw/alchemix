/**
 * Account Routes
 *
 * GET /auth/me - Get current user info
 * DELETE /auth/account - Delete user account
 * GET /auth/export - Export all user data
 * POST /auth/import - Import user data
 */

import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { db } from '../../database/db';
import { authMiddleware } from '../../middleware/auth';
import { UserRow } from '../../types';
import { asyncHandler } from '../../utils/asyncHandler';
import { getClearCookieOptions } from './utils';
import { logger } from '../../utils/logger';

const router = Router();

/**
 * GET /auth/me - Get Current User Info
 *
 * Returns information about the currently authenticated user.
 * Requires valid JWT token.
 *
 * Response (200 OK):
 * {
 *   "success": true,
 *   "data": {
 *     "id": 1,
 *     "email": "user@example.com",
 *     "created_at": "2025-11-10T14:32:05.123Z",
 *     "is_verified": true
 *   }
 * }
 */
router.get('/me', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized'
    });
  }

  // Fetch user from database
  const user = db.prepare(
    'SELECT id, email, created_at, is_verified FROM users WHERE id = ?'
  ).get(userId) as UserRow | undefined;

  if (!user) {
    return res.status(404).json({
      success: false,
      error: 'User not found'
    });
  }

  res.json({
    success: true,
    data: {
      ...user,
      is_verified: Boolean(user.is_verified)
    }
  });
}));

/**
 * DELETE /auth/account - Delete User Account
 *
 * Permanently deletes the user's account and all associated data.
 * Requires password confirmation for security.
 *
 * Request Body:
 * {
 *   "password": "CurrentPassword123!"
 * }
 *
 * Security:
 * - Requires authentication
 * - Requires password confirmation
 * - Deletes all user data (inventory, recipes, favorites, collections)
 * - Uses database transactions for data integrity
 */
router.delete('/account', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  const { password } = req.body;

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized'
    });
  }

  if (!password) {
    return res.status(400).json({
      success: false,
      error: 'Password is required to delete account'
    });
  }

  // Get user with password hash
  const user = db.prepare(
    'SELECT id, email, password_hash FROM users WHERE id = ?'
  ).get(userId) as UserRow | undefined;

  if (!user) {
    return res.status(404).json({
      success: false,
      error: 'User not found'
    });
  }

  // Verify password
  const isValidPassword = await bcrypt.compare(password, user.password_hash!);
  if (!isValidPassword) {
    return res.status(401).json({
      success: false,
      error: 'Password is incorrect'
    });
  }

  // Atomic transaction: Delete all user data
  const deleteAccountTransaction = db.transaction(() => {
    db.prepare('DELETE FROM favorites WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM recipes WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM collections WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM inventory_items WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);

    logger.info('Account deleted', { userId, email: user.email, action: 'account_delete' });
  });

  deleteAccountTransaction();

  // Clear cookies
  res.clearCookie('auth_token', getClearCookieOptions());
  res.clearCookie('csrf_token', {
    ...getClearCookieOptions(),
    httpOnly: false,
  });

  res.json({
    success: true,
    message: 'Account deleted successfully'
  });
}));

/**
 * GET /auth/export - Export All User Data
 *
 * Downloads all user data as JSON.
 *
 * Security:
 * - Requires authentication
 * - Only exports data belonging to the authenticated user
 */
router.get('/export', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized'
    });
  }

  // Get user info (without sensitive fields)
  const user = db.prepare(
    'SELECT id, email, created_at, is_verified FROM users WHERE id = ?'
  ).get(userId) as UserRow | undefined;

  if (!user) {
    return res.status(404).json({
      success: false,
      error: 'User not found'
    });
  }

  // Get all user data
  const inventory = db.prepare('SELECT * FROM inventory_items WHERE user_id = ?').all(userId);
  const recipes = db.prepare('SELECT * FROM recipes WHERE user_id = ?').all(userId);
  const favorites = db.prepare('SELECT * FROM favorites WHERE user_id = ?').all(userId);
  const collections = db.prepare('SELECT * FROM collections WHERE user_id = ?').all(userId);

  const exportData = {
    user: {
      id: user.id,
      email: user.email,
      created_at: user.created_at,
      is_verified: Boolean(user.is_verified)
    },
    inventory,
    recipes,
    favorites,
    collections,
    exportedAt: new Date().toISOString()
  };

  res.json({
    success: true,
    data: exportData
  });
}));

/**
 * POST /auth/import - Import User Data
 *
 * Imports user data from a previously exported JSON file.
 *
 * Request Body:
 * {
 *   "data": {
 *     "inventory": [...],
 *     "recipes": [...],
 *     "favorites": [...],
 *     "collections": [...]
 *   },
 *   "options": {
 *     "overwrite": false  // If true, clears existing data before import
 *   }
 * }
 *
 * Security:
 * - Requires authentication
 * - Only imports data for the authenticated user
 * - Validates data structure before import
 */
router.post('/import', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  const { data, options } = req.body;

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized'
    });
  }

  if (!data) {
    return res.status(400).json({
      success: false,
      error: 'No data provided for import'
    });
  }

  const overwrite = options?.overwrite === true;
  const imported = {
    inventory: 0,
    recipes: 0,
    favorites: 0,
    collections: 0
  };

  // Use transaction for atomicity
  const importTransaction = db.transaction(() => {
    // If overwrite, clear existing data first
    if (overwrite) {
      db.prepare('DELETE FROM favorites WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM recipes WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM collections WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM inventory_items WHERE user_id = ?').run(userId);
    }

    // Import collections first (recipes may reference them)
    if (Array.isArray(data.collections)) {
      const insertCollection = db.prepare(
        'INSERT INTO collections (user_id, name, description) VALUES (?, ?, ?)'
      );
      for (const collection of data.collections) {
        if (collection.name) {
          insertCollection.run(userId, collection.name, collection.description || null);
          imported.collections++;
        }
      }
    }

    // Import inventory items
    if (Array.isArray(data.inventory)) {
      const insertInventory = db.prepare(`
        INSERT INTO inventory_items (
          user_id, name, category, type, abv, stock_number,
          spirit_classification, distillation_method, distillery_location,
          age_statement, additional_notes, profile_nose, palate, finish
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const item of data.inventory) {
        if (item.name && item.category) {
          insertInventory.run(
            userId,
            item.name,
            item.category,
            item.type || null,
            item.abv || null,
            item.stock_number || null,
            item.spirit_classification || null,
            item.distillation_method || null,
            item.distillery_location || null,
            item.age_statement || null,
            item.additional_notes || null,
            item.profile_nose || null,
            item.palate || null,
            item.finish || null
          );
          imported.inventory++;
        }
      }
    }

    // Import recipes
    if (Array.isArray(data.recipes)) {
      const insertRecipe = db.prepare(`
        INSERT INTO recipes (user_id, name, ingredients, instructions, glass, category)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (const recipe of data.recipes) {
        if (recipe.name && recipe.ingredients) {
          const ingredients = typeof recipe.ingredients === 'string'
            ? recipe.ingredients
            : JSON.stringify(recipe.ingredients);
          insertRecipe.run(
            userId,
            recipe.name,
            ingredients,
            recipe.instructions || null,
            recipe.glass || null,
            recipe.category || null
          );
          imported.recipes++;
        }
      }
    }

    // Import favorites
    if (Array.isArray(data.favorites)) {
      const insertFavorite = db.prepare(
        'INSERT INTO favorites (user_id, recipe_name) VALUES (?, ?)'
      );
      for (const favorite of data.favorites) {
        const recipeName = favorite.recipe_name || favorite.name;
        if (recipeName) {
          insertFavorite.run(userId, recipeName);
          imported.favorites++;
        }
      }
    }
  });

  try {
    importTransaction();
    logger.info('Data imported', { userId, imported, action: 'data_import' });

    res.json({
      success: true,
      message: 'Data imported successfully',
      imported
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Import failed', { userId, error: errorMessage, action: 'data_import' });
    res.status(500).json({
      success: false,
      error: 'Failed to import data'
    });
  }
}));

export default router;
