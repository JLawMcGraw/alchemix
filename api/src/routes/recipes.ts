/**
 * Recipes Routes
 *
 * Handles HTTP layer for user's cocktail recipe collection.
 * Business logic delegated to RecipeService.
 *
 * Features:
 * - GET /api/recipes - List user's recipes with pagination
 * - POST /api/recipes - Add new recipe
 * - POST /api/recipes/import - CSV import
 * - PUT /api/recipes/:id - Update recipe
 * - DELETE /api/recipes/:id - Delete recipe
 * - DELETE /api/recipes/all - Delete all recipes
 * - DELETE /api/recipes/bulk - Bulk delete recipes
 * - POST /api/recipes/memmachine/sync - Sync MemMachine
 * - DELETE /api/recipes/memmachine/clear - Clear MemMachine
 *
 * Security:
 * - All routes require JWT authentication (authMiddleware)
 * - User isolation: Can only access their own recipes
 * - Input validation: Sanitized via RecipeService
 * - SQL injection prevention: Parameterized queries (in service)
 * - Pagination: Prevents DoS via large result sets
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import { authMiddleware } from '../middleware/auth';
import { validateNumber } from '../utils/inputValidator';
import { asyncHandler } from '../utils/asyncHandler';
import { recipeService } from '../services/RecipeService';

const router = Router();

/**
 * Multer Configuration for File Uploads
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
});

// All routes require authentication
router.use(authMiddleware);

/**
 * GET /api/recipes - List User's Recipes with Pagination
 *
 * Query Parameters:
 * - page: Page number (default: 1, min: 1)
 * - limit: Items per page (default: 50, max: 100, min: 1)
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized'
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

  const result = recipeService.getAll(userId, { page, limit });

  res.json({
    success: true,
    data: result.items,
    pagination: result.pagination
  });
}));

/**
 * POST /api/recipes - Add New Recipe
 */
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized'
    });
  }

  const sanitizeResult = recipeService.sanitizeCreateInput(req.body, userId);

  if (!sanitizeResult.valid) {
    return res.status(400).json({
      success: false,
      error: sanitizeResult.error
    });
  }

  const recipe = recipeService.create(userId, sanitizeResult.data!);

  res.status(201).json({
    success: true,
    data: recipe
  });
}));

/**
 * POST /api/recipes/import - CSV Import
 */
router.post('/import', upload.single('file'), asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized'
    });
  }

  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: 'No file uploaded'
    });
  }

  // Get optional collection_id
  const collectionId = req.body.collection_id
    ? parseInt(req.body.collection_id, 10)
    : null;

  // Validate collection belongs to user if provided
  if (collectionId && !recipeService.validateCollection(collectionId, userId)) {
    return res.status(400).json({
      success: false,
      error: 'Collection not found or access denied'
    });
  }

  // Parse CSV
  const csvContent = req.file.buffer.toString('utf-8');
  let records: any[];

  try {
    records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
  } catch (parseError: any) {
    return res.status(400).json({
      success: false,
      error: 'Failed to parse CSV file',
      details: parseError.message
    });
  }

  if (records.length > 1000) {
    return res.status(400).json({
      success: false,
      error: 'Too many rows',
      details: 'Maximum 1000 recipes per import'
    });
  }

  if (records.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'CSV file is empty'
    });
  }

  const result = recipeService.importFromCSV(userId, records, collectionId);

  res.json({
    success: true,
    imported: result.imported,
    failed: result.failed,
    errors: result.errors.length > 0 ? result.errors : undefined
  });
}));

/**
 * PUT /api/recipes/:id - Update Recipe
 */
router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized'
    });
  }

  const recipeId = parseInt(req.params.id, 10);
  if (isNaN(recipeId) || recipeId <= 0) {
    return res.status(400).json({
      success: false,
      error: 'Invalid recipe ID'
    });
  }

  const result = recipeService.update(recipeId, userId, req.body);

  if (!result.success) {
    const status = result.error === 'Recipe not found or access denied' ? 404 : 400;
    return res.status(status).json({
      success: false,
      error: result.error
    });
  }

  res.json({
    success: true,
    data: result.recipe
  });
}));

/**
 * POST /api/recipes/memmachine/sync - Sync MemMachine
 */
router.post('/memmachine/sync', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized'
    });
  }

  console.log(`🔄 User ${userId} requested MemMachine sync - starting cleanup...`);

  try {
    const stats = await recipeService.syncMemMachine(userId);

    console.log(`✅ MemMachine sync complete for user ${userId}`);

    res.json({
      success: true,
      message: `MemMachine synced successfully - ${stats.uploaded} recipes uploaded`,
      stats
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to sync MemMachine'
    });
  }
}));

/**
 * DELETE /api/recipes/memmachine/clear - Clear MemMachine
 */
router.delete('/memmachine/clear', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized'
    });
  }

  console.log(`🧹 User ${userId} requested MemMachine recipe memory cleanup`);

  const success = await recipeService.clearMemMachine(userId);

  if (success) {
    res.json({
      success: true,
      message: 'Cleared all recipe memories from MemMachine'
    });
  } else {
    res.status(500).json({
      success: false,
      error: 'Failed to clear MemMachine memories'
    });
  }
}));

/**
 * DELETE /api/recipes/all - Delete All Recipes
 */
router.delete('/all', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized'
    });
  }

  const deleted = recipeService.deleteAll(userId);

  res.json({
    success: true,
    deleted,
    message: `Deleted ${deleted} ${deleted === 1 ? 'recipe' : 'recipes'}`
  });
}));

/**
 * DELETE /api/recipes/bulk - Bulk Delete Recipes
 */
router.delete('/bulk', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized'
    });
  }

  const rawIds = req.body?.ids;

  if (!Array.isArray(rawIds) || rawIds.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'ids array is required'
    });
  }

  if (rawIds.length > 500) {
    return res.status(400).json({
      success: false,
      error: 'Too many IDs - maximum 500 per request'
    });
  }

  // Sanitize and deduplicate IDs
  const sanitizedIds = Array.from(new Set(
    rawIds
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0)
  ));

  if (sanitizedIds.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'No valid recipe IDs provided'
    });
  }

  const deleted = recipeService.bulkDelete(sanitizedIds, userId);

  res.json({
    success: true,
    deleted
  });
}));

/**
 * DELETE /api/recipes/:id - Delete Recipe
 */
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized'
    });
  }

  const recipeId = parseInt(req.params.id, 10);
  if (isNaN(recipeId) || recipeId <= 0) {
    return res.status(400).json({
      success: false,
      error: 'Invalid recipe ID'
    });
  }

  const result = recipeService.delete(recipeId, userId);

  if (!result.success) {
    return res.status(404).json({
      success: false,
      error: result.error
    });
  }

  res.json({
    success: true,
    message: 'Recipe deleted successfully'
  });
}));

export default router;
