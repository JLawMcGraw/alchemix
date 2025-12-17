/**
 * Inventory Items Routes
 *
 * Handles HTTP layer for user's inventory (spirits, mixers, garnishes, etc.).
 * Business logic delegated to InventoryService.
 *
 * Features:
 * - GET /api/inventory-items - List user's inventory items with pagination and filtering
 * - GET /api/inventory-items/category-counts - Get counts for all categories
 * - POST /api/inventory-items - Add new item to inventory
 * - PUT /api/inventory-items/:id - Update existing item
 * - DELETE /api/inventory-items/:id - Remove item from inventory
 * - DELETE /api/inventory-items/bulk - Bulk delete items
 * - POST /api/inventory-items/import - CSV import
 *
 * Security:
 * - All routes require JWT authentication (authMiddleware)
 * - User isolation: Can only access their own items
 * - Input validation: Sanitized via InventoryService
 * - SQL injection prevention: Parameterized queries (in service)
 * - Pagination: Prevents DoS via large result sets
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import { authMiddleware } from '../middleware/auth';
import { validateNumber } from '../utils/inputValidator';
import { asyncHandler } from '../utils/asyncHandler';
import { inventoryService, VALID_CATEGORIES } from '../services/InventoryService';
import { logger } from '../utils/logger';

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
 * GET /api/inventory-items - List User's Inventory Items with Pagination & Filtering
 *
 * Query Parameters:
 * - page: Page number (default: 1, min: 1)
 * - limit: Items per page (default: 50, max: 100, min: 1)
 * - category: Filter by category (optional)
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

  // Validate category parameter
  const categoryParam = req.query.category as string | undefined;

  if (categoryParam && !inventoryService.isValidCategory(categoryParam)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid category parameter',
      details: `Category must be one of: ${VALID_CATEGORIES.join(', ')}`
    });
  }

  const result = inventoryService.getAll(userId, { page, limit }, categoryParam);

  res.json({
    success: true,
    data: result.items,
    pagination: result.pagination
  });
}));

/**
 * GET /api/inventory-items/category-counts - Get Counts for All Categories
 */
router.get('/category-counts', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }

  const counts = inventoryService.getCategoryCounts(userId);

  logger.debug('Category counts calculated', { counts });

  res.json({
    success: true,
    data: counts
  });
}));

/**
 * POST /api/inventory-items - Add New Item to Inventory
 */
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }

  const validation = inventoryService.validateItemData(req.body);

  if (!validation.isValid) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: validation.errors
    });
  }

  const item = inventoryService.create(userId, validation.sanitized!);

  res.status(201).json({
    success: true,
    data: item
  });
}));

/**
 * PUT /api/inventory-items/:id - Update Existing Item
 */
router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  const itemId = parseInt(req.params.id);

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }

  if (isNaN(itemId) || itemId <= 0) {
    return res.status(400).json({
      success: false,
      error: 'Invalid item ID'
    });
  }

  const validation = inventoryService.validateItemData(req.body);

  if (!validation.isValid) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: validation.errors
    });
  }

  const updatedItem = inventoryService.update(itemId, userId, validation.sanitized!);

  if (!updatedItem) {
    return res.status(404).json({
      success: false,
      error: 'Item not found'
    });
  }

  res.json({
    success: true,
    data: updatedItem
  });
}));

/**
 * DELETE /api/inventory-items/bulk - Bulk Delete Inventory Items
 *
 * Request Body:
 * {
 *   "ids": [1, 2, 3, 4, 5]  // Array of item IDs to delete (max 500)
 * }
 */
router.delete('/bulk', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }

  const { ids } = req.body;

  if (!ids || !Array.isArray(ids)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid request: ids must be an array'
    });
  }

  if (ids.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'No items specified for deletion'
    });
  }

  if (ids.length > 500) {
    return res.status(400).json({
      success: false,
      error: 'Too many items (max 500 per request)'
    });
  }

  const validIds = ids.every((id: unknown) => typeof id === 'number' || (typeof id === 'string' && !isNaN(parseInt(id))));
  if (!validIds) {
    return res.status(400).json({
      success: false,
      error: 'All IDs must be valid numbers'
    });
  }

  const deleted = inventoryService.bulkDelete(ids, userId);

  res.json({
    success: true,
    deleted,
    message: `Successfully deleted ${deleted} item${deleted === 1 ? '' : 's'}`
  });
}));

/**
 * DELETE /api/inventory-items/:id - Delete Item
 */
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  const itemId = parseInt(req.params.id);

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }

  if (isNaN(itemId) || itemId <= 0) {
    return res.status(400).json({
      success: false,
      error: 'Invalid item ID'
    });
  }

  const deleted = inventoryService.delete(itemId, userId);

  if (!deleted) {
    return res.status(404).json({
      success: false,
      error: 'Item not found'
    });
  }

  res.json({
    success: true,
    message: 'Item deleted successfully'
  });
}));

/**
 * POST /api/inventory-items/backfill-periodic-tags - Backfill Periodic Tags
 *
 * Auto-classifies all inventory items missing periodic_group and periodic_period tags.
 * Uses the Periodic Table of Mixology V2 classification logic.
 */
router.post('/backfill-periodic-tags', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }

  const result = inventoryService.backfillPeriodicTags(userId);

  res.json({
    success: true,
    message: `Successfully classified ${result.updated} of ${result.total} items`,
    updated: result.updated,
    total: result.total
  });
}));

/**
 * POST /api/inventory-items/import - CSV Import
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

  // Limit to 1000 rows to prevent DoS
  if (records.length > 1000) {
    return res.status(400).json({
      success: false,
      error: 'Too many rows',
      details: 'Maximum 1000 inventory_items per import'
    });
  }

  if (records.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'CSV file is empty'
    });
  }

  const result = inventoryService.importFromCSV(userId, records);

  res.json({
    success: true,
    imported: result.imported,
    failed: result.failed,
    errors: result.errors.length > 0 ? result.errors : undefined
  });
}));

export default router;
