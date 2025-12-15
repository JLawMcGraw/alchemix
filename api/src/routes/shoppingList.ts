/**
 * Shopping List Routes
 *
 * Provides intelligent shopping recommendations based on recipe analysis.
 * HTTP layer only - delegates logic to ShoppingListService.
 *
 * Routes:
 * - GET /api/shopping-list/smart - Analyze inventory and recommend ingredients
 * - GET /api/shopping-list/items - Get user's shopping list items
 * - POST /api/shopping-list/items - Add item to shopping list
 * - PUT /api/shopping-list/items/:id - Update item
 * - DELETE /api/shopping-list/items/:id - Remove item
 * - DELETE /api/shopping-list/items/checked - Clear completed items
 *
 * Security:
 * - All routes require JWT authentication (authMiddleware)
 * - User isolation: Only analyzes user's own data
 * - Read-only operations for smart recommendations
 */

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { shoppingListService } from '../services/ShoppingListService';

const router = Router();

/**
 * Authentication Requirement
 *
 * All shopping list routes require valid JWT token.
 * Ensures users only get recommendations based on their own data.
 */
router.use(authMiddleware);

/**
 * GET /api/shopping-list/smart - Smart Shopping List Recommendations
 *
 * Analyzes user's inventory against their recipe collection to identify
 * which single ingredient purchase will unlock the most new cocktails.
 */
router.get('/smart', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized'
    });
  }

  const result = shoppingListService.getSmartRecommendations(userId);

  res.json({
    success: true,
    data: result.recommendations,
    stats: result.stats,
    craftableRecipes: result.craftableRecipes,
    nearMissRecipes: result.nearMissRecipes,
    needFewRecipes: result.needFewRecipes,
    majorGapsRecipes: result.majorGapsRecipes
  });
}));

/**
 * GET /api/shopping-list/items
 * Get all shopping list items for the authenticated user
 */
router.get('/items', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  const items = shoppingListService.getItems(userId);
  res.json({ success: true, data: items });
}));

/**
 * POST /api/shopping-list/items
 * Add a new item to the shopping list
 */
router.post('/items', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  const { name } = req.body;

  if (!userId) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ success: false, error: 'Item name is required' });
  }

  const newItem = shoppingListService.addItem(userId, name);

  if (!newItem) {
    return res.status(409).json({ success: false, error: 'Item already in list' });
  }

  res.status(201).json({ success: true, data: newItem });
}));

/**
 * PUT /api/shopping-list/items/:id
 * Update an item (toggle checked status or rename)
 */
router.put('/items/:id', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  const itemId = parseInt(req.params.id, 10);
  const { checked, name } = req.body;

  if (!userId) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  if (isNaN(itemId)) {
    return res.status(400).json({ success: false, error: 'Invalid item ID' });
  }

  const updates: { checked?: boolean; name?: string } = {};
  if (typeof checked === 'boolean') {
    updates.checked = checked;
  }
  if (typeof name === 'string' && name.trim().length > 0) {
    updates.name = name;
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ success: false, error: 'No valid fields to update' });
  }

  const updated = shoppingListService.updateItem(userId, itemId, updates);

  if (!updated) {
    return res.status(404).json({ success: false, error: 'Item not found' });
  }

  res.json({ success: true, data: updated });
}));

/**
 * DELETE /api/shopping-list/items/checked
 * Remove all checked items (clear completed)
 * Note: This must come before /:id route
 */
router.delete('/items/checked', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  const deleted = shoppingListService.deleteCheckedItems(userId);
  res.json({ success: true, deleted });
}));

/**
 * DELETE /api/shopping-list/items/:id
 * Remove a single item from the shopping list
 */
router.delete('/items/:id', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  const itemId = parseInt(req.params.id, 10);

  if (!userId) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  if (isNaN(itemId)) {
    return res.status(400).json({ success: false, error: 'Invalid item ID' });
  }

  const deleted = shoppingListService.deleteItem(userId, itemId);

  if (!deleted) {
    return res.status(404).json({ success: false, error: 'Item not found' });
  }

  res.json({ success: true });
}));

/**
 * Export Shopping List Router
 *
 * Mounted at /api/shopping-list in server.ts
 */
export default router;
