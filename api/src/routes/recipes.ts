/**
 * Recipes Routes
 *
 * Handles HTTP layer for user's cocktail recipe collection.
 * Business logic delegated to RecipeService.
 *
 * Features:
 * - GET /api/recipes/classics - Get classic cocktail data (PUBLIC - no auth)
 * - GET /api/recipes - List user's recipes with pagination
 * - POST /api/recipes - Add new recipe
 * - POST /api/recipes/import - CSV import
 * - PUT /api/recipes/:id - Update recipe
 * - DELETE /api/recipes/:id - Delete recipe
 * - DELETE /api/recipes/all - Delete all recipes
 * - DELETE /api/recipes/bulk - Bulk delete recipes
 * - POST /api/recipes/bulk-move - Bulk move recipes to collection
 * - POST /api/recipes/memmachine/sync - Sync MemMachine
 * - DELETE /api/recipes/memmachine/clear - Clear MemMachine
 *
 * Security:
 * - Most routes require JWT authentication (authMiddleware)
 * - /classics endpoint is public (used for onboarding preview)
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
import { logger } from '../utils/logger';
import { queryOne } from '../database/db';

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

// ============ Public Routes (No Auth Required) ============

/**
 * GET /api/recipes/classics - Get Classic Cocktail Data (Public)
 *
 * Returns the classic cocktail data with pre-computed requires array.
 * No authentication required - used for onboarding preview.
 *
 * Response: Array of classic recipes with:
 * - name: string
 * - ingredients: string[]
 * - instructions: string
 * - glass: string
 * - spirit_type: string
 * - requires: string[] (element symbols for ingredient matching)
 */
router.get('/classics', asyncHandler(async (req: Request, res: Response) => {
  try {
    // Dynamic import for JSON data
    const recipesModule = await import('../data/classicRecipes.json');
    const classicRecipes = recipesModule.default || recipesModule;

    res.json({
      success: true,
      data: classicRecipes
    });
  } catch (err) {
    logger.error('Failed to load classic recipes', {
      error: err instanceof Error ? err.message : 'Unknown error'
    });
    res.status(500).json({
      success: false,
      error: 'Failed to load classic recipes'
    });
  }
}));

// ============ Protected Routes (Auth Required) ============
router.use(authMiddleware);

/**
 * GET /api/recipes - List User's Recipes with Pagination and Search
 *
 * Query Parameters:
 * - page: Page number (default: 1, min: 1)
 * - limit: Items per page (default: 50, max: 100, min: 1)
 * - search: Search term for name/ingredients (optional, max 100 chars)
 * - spirit: Spirit category filter (optional) - filtered client-side
 * - mastery: Mastery filter (craftable|almost|need-few|major-gaps) - requires masteryIds
 * - masteryIds: Comma-separated recipe IDs matching mastery filter
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
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

  // Validate search parameter
  const searchParam = req.query.search as string | undefined;
  let search: string | undefined;
  if (searchParam) {
    if (searchParam.length > 100) {
      return res.status(400).json({
        success: false,
        error: 'Search query too long (max 100 chars)'
      });
    }
    search = searchParam.trim();
  }

  // Parse masteryIds (comma-separated list of recipe IDs)
  const masteryIdsParam = req.query.masteryIds as string | undefined;
  let masteryIds: number[] | undefined;
  if (masteryIdsParam) {
    masteryIds = masteryIdsParam
      .split(',')
      .map(id => parseInt(id.trim(), 10))
      .filter(id => !isNaN(id) && id > 0);
  }

  const result = await recipeService.getAll(userId, { page, limit, search, masteryIds });

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
      error: 'Authentication required'
    });
  }

  const sanitizeResult = await recipeService.sanitizeCreateInput(req.body, userId);

  if (!sanitizeResult.valid) {
    return res.status(400).json({
      success: false,
      error: sanitizeResult.error
    });
  }

  const recipe = await recipeService.create(userId, sanitizeResult.data!);

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
      error: 'Authentication required'
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
  if (collectionId && !await recipeService.validateCollection(collectionId, userId)) {
    return res.status(400).json({
      success: false,
      error: 'Collection not found or access denied'
    });
  }

  // Parse CSV with encoding detection
  // Handle UTF-8 BOM and fallback for Windows-1252/Latin-1 encoded files
  let csvContent: string;
  const buffer = req.file.buffer;

  // Check for UTF-8 BOM (EF BB BF) and strip it
  if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
    csvContent = buffer.slice(3).toString('utf-8');
  } else {
    // Try UTF-8 first
    csvContent = buffer.toString('utf-8');

    // Check for replacement characters (indicates encoding issue)
    // The � character (U+FFFD) appears when UTF-8 decoding fails
    if (csvContent.includes('\uFFFD')) {
      // Fallback to Latin-1 (Windows-1252 compatible) for legacy CSV files
      csvContent = buffer.toString('latin1');
    }
  }

  let records: Record<string, string>[];

  try {
    records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
  } catch (parseError) {
    const message = parseError instanceof Error ? parseError.message : 'Unknown parse error';
    return res.status(400).json({
      success: false,
      error: 'Failed to parse CSV file',
      details: message
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

  const result = await recipeService.importFromCSV(userId, records, collectionId);

  res.json({
    success: true,
    imported: result.imported,
    failed: result.failed,
    errors: result.errors.length > 0 ? result.errors : undefined
  });
}));

/**
 * POST /api/recipes/seed-classics - Seed Classic Cocktail Recipes
 * 
 * Seeds 20 classic cocktail recipes for first-time users.
 * Can only be called once per user (idempotent).
 * 
 * Response:
 * - seeded: boolean - Whether recipes were seeded (false if already done)
 * - count: number - Number of recipes seeded
 */
router.post('/seed-classics', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }

  const result = await recipeService.seedClassics(userId);

  res.json({
    success: true,
    seeded: result.seeded,
    count: result.count,
    message: result.seeded 
      ? `Added ${result.count} classic cocktail recipes to get you started!`
      : 'Classic recipes already added'
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
      error: 'Authentication required'
    });
  }

  const recipeId = parseInt(req.params.id, 10);
  if (isNaN(recipeId) || recipeId <= 0) {
    return res.status(400).json({
      success: false,
      error: 'Invalid recipe ID'
    });
  }

  const result = await recipeService.update(recipeId, userId, req.body);

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
      error: 'Authentication required'
    });
  }

  logger.info('MemMachine sync requested', { userId });

  try {
    const stats = await recipeService.syncMemMachine(userId);

    logger.info('MemMachine sync complete', { userId });

    res.json({
      success: true,
      message: `MemMachine synced successfully - ${stats.uploaded} recipes uploaded`,
      stats
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to sync MemMachine';
    res.status(500).json({
      success: false,
      error: message
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
      error: 'Authentication required'
    });
  }

  logger.info('MemMachine recipe memory cleanup requested', { userId });

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
      error: 'Authentication required'
    });
  }

  const deleted = await recipeService.deleteAll(userId);

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
      error: 'Authentication required'
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

  const deleted = await recipeService.bulkDelete(sanitizedIds, userId);

  res.json({
    success: true,
    deleted
  });
}));

/**
 * POST /api/recipes/bulk-move - Bulk Move Recipes to Collection
 *
 * Body:
 * - recipeIds: number[] - Recipe IDs to move (required, max 100)
 * - collectionId: number | null - Target collection (null = uncategorized)
 */
router.post('/bulk-move', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }

  const { recipeIds, collectionId } = req.body;

  // Validate recipeIds
  if (!Array.isArray(recipeIds)) {
    return res.status(400).json({
      success: false,
      error: 'recipeIds must be an array'
    });
  }

  // Sanitize and validate IDs
  const sanitizedIds = recipeIds
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0);

  if (sanitizedIds.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'No valid recipe IDs provided'
    });
  }

  if (sanitizedIds.length > 100) {
    return res.status(400).json({
      success: false,
      error: 'Maximum 100 recipes per bulk operation'
    });
  }

  // Validate collectionId (must be null, undefined, or positive integer)
  let targetCollectionId: number | null = null;
  if (collectionId !== null && collectionId !== undefined) {
    const parsedCollectionId = Number(collectionId);
    if (!Number.isInteger(parsedCollectionId) || parsedCollectionId <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid collection ID'
      });
    }
    targetCollectionId = parsedCollectionId;
  }

  const result = await recipeService.bulkMove(sanitizedIds, userId, targetCollectionId);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      error: result.error
    });
  }

  // Get collection name for response message
  let collectionName = 'Uncategorized';
  if (targetCollectionId) {
    const collection = await queryOne<{ name: string }>(
      'SELECT name FROM collections WHERE id = $1 AND user_id = $2',
      [targetCollectionId, userId]
    );
    if (collection) {
      collectionName = collection.name;
    }
  }

  res.json({
    success: true,
    moved: result.moved,
    message: `Moved ${result.moved} recipe(s) to ${collectionName}`
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
      error: 'Authentication required'
    });
  }

  const recipeId = parseInt(req.params.id, 10);
  if (isNaN(recipeId) || recipeId <= 0) {
    return res.status(400).json({
      success: false,
      error: 'Invalid recipe ID'
    });
  }

  const result = await recipeService.delete(recipeId, userId);

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
