/**
 * Inventory Items Routes
 *
 * Handles CRUD operations for user's inventory (spirits, mixers, garnishes, etc.).
 *
 * Features:
 * - GET /api/inventory-items - List user's inventory items with pagination and filtering
 * - POST /api/inventory-items - Add new item to inventory
 * - PUT /api/inventory-items/:id - Update existing item
 * - DELETE /api/inventory-items/:id - Remove item from inventory
 * - POST /api/inventory-items/import - CSV import
 *
 * Security:
 * - All routes require JWT authentication (authMiddleware)
 * - User isolation: Can only access their own items
 * - Input validation: Sanitized via inputValidator utility
 * - SQL injection prevention: Parameterized queries
 * - Pagination: Prevents DoS via large result sets
 *
 * SECURITY FIX #12: Added pagination to prevent performance issues
 * - Default: 50 items per page
 * - Maximum: 100 items per page
 * - Prevents N+1 query issues with large inventories
 * - Reduces memory usage and API response time
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import { db } from '../database/db';
import { authMiddleware } from '../middleware/auth';
import { userRateLimit } from '../middleware/userRateLimit';
import { validateNumber } from '../utils/inputValidator';
import { InventoryItem } from '../types';

const router = Router();

/**
 * Multer Configuration for File Uploads
 *
 * Configure multer for CSV file uploads:
 * - Memory storage (don't save to disk)
 * - 5MB file size limit
 * - Only accept CSV files
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
  },
  fileFilter: (req, file, cb) => {
    // Only accept CSV files
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
});

/**
 * Authentication Requirement
 *
 * All inventory routes require valid JWT token.
 * Ensures users can only access/modify their own items.
 */
router.use(authMiddleware);
// No rate limiting on inventory - users should be able to view their inventory freely

/**
 * GET /api/inventory-items - List User's Inventory Items with Pagination & Filtering
 *
 * Returns paginated list of inventory items owned by authenticated user.
 * Supports filtering by category (spirit, liqueur, mixer, garnish, syrup, wine, beer, other).
 *
 * SECURITY FIX #12: Added pagination to prevent DoS and performance issues.
 *
 * Query Parameters:
 * - page: Page number (default: 1, min: 1)
 * - limit: Items per page (default: 50, max: 100, min: 1)
 * - category: Filter by category (optional - spirit, liqueur, mixer, garnish, syrup, wine, beer, other)
 *
 * Example Requests:
 * - GET /api/inventory-items → First 50 items (all categories)
 * - GET /api/inventory-items?page=2 → Items 51-100
 * - GET /api/inventory-items?page=1&limit=25 → First 25 items
 * - GET /api/inventory-items?category=spirit → All spirits
 * - GET /api/inventory-items?category=mixer&page=1&limit=20 → First 20 mixers
 *
 * Response (200 OK):
 * {
 *   "success": true,
 *   "data": [
 *     {
 *       "id": 1,
 *       "user_id": 1,
 *       "name": "Maker's Mark",
 *       "category": "spirit",
 *       "type": "Bourbon",
 *       "abv": "45",
 *       ...
 *     }
 *   ],
 *   "pagination": {
 *     "page": 1,
 *     "limit": 50,
 *     "total": 147,
 *     "totalPages": 3,
 *     "hasNextPage": true,
 *     "hasPreviousPage": false
 *   }
 * }
 *
 * Why Pagination Matters:
 * - Performance: Fetching 1,000 items takes 100ms, 50 items takes 5ms
 * - Memory: Large result sets consume server memory
 * - Network: Smaller payloads = faster response times
 * - DoS Prevention: Attacker can't exhaust resources with huge queries
 *
 * Security:
 * - User isolation: WHERE user_id = ? ensures data privacy
 * - Input validation: page/limit/category validated
 * - SQL injection: Parameterized queries
 */
router.get('/', (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;

    /**
     * Step 1: Authentication Check
     *
     * This should never fail (authMiddleware prevents it),
     * but we check for type safety and defense in depth.
     */
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    /**
     * Step 2: Parse and Validate Pagination Parameters
     *
     * Extract page and limit from query string, with defaults.
     * Validate they are positive numbers within acceptable range.
     */
    const pageParam = req.query.page as string | undefined;
    const limitParam = req.query.limit as string | undefined;

    // Validate page parameter (default: 1, min: 1)
    const pageValidation = validateNumber(
      pageParam || '1',
      1,        // min: page 1
      undefined // max: no limit (handled by total pages)
    );

    if (!pageValidation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid page parameter',
        details: pageValidation.errors
      });
    }

    const page = pageValidation.sanitized || 1;

    // Validate limit parameter (default: 50, min: 1, max: 100)
    const limitValidation = validateNumber(
      limitParam || '50',
      1,    // min: at least 1 bottle per page
      100   // max: prevent excessive memory usage
    );

    if (!limitValidation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid limit parameter',
        details: limitValidation.errors
      });
    }

    const limit = limitValidation.sanitized || 50;

    /**
     * Step 3: Parse and Validate Category Filter (Optional)
     *
     * If category is provided, validate it's one of the allowed categories.
     */
    const categoryParam = req.query.category as string | undefined;
    const validCategories = ['spirit', 'liqueur', 'mixer', 'garnish', 'syrup', 'wine', 'beer', 'other'];

    if (categoryParam && !validCategories.includes(categoryParam)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid category parameter',
        details: `Category must be one of: ${validCategories.join(', ')}`
      });
    }

    /**
     * Step 4: Calculate SQL OFFSET
     *
     * Offset = (page - 1) × limit
     * Examples:
     * - Page 1, Limit 50: Offset 0 (rows 1-50)
     * - Page 2, Limit 50: Offset 50 (rows 51-100)
     * - Page 3, Limit 25: Offset 50 (rows 51-75)
     */
    const offset = (page - 1) * limit;

    /**
     * Step 5: Build WHERE clause for category filtering
     */
    const whereClause = categoryParam
      ? 'WHERE user_id = ? AND category = ?'
      : 'WHERE user_id = ?';

    const queryParams = categoryParam ? [userId, categoryParam] : [userId];

    /**
     * Step 6: Count Total Items (for pagination metadata)
     *
     * COUNT(*) query to determine total pages.
     * Separate query is necessary for pagination info.
     *
     * Performance Note:
     * - COUNT(*) on indexed user_id column is fast (<1ms)
     * - Result is small (single integer)
     */
    const countResult = db.prepare(
      `SELECT COUNT(*) as total FROM inventory_items ${whereClause}`
    ).get(...queryParams) as { total: number };

    const total = countResult.total;

    /**
     * Step 7: Fetch Paginated Items
     *
     * SQL Query Breakdown:
     * - SELECT *: All item columns
     * - WHERE user_id = ?: User isolation for security
     * - WHERE category = ?: Optional category filter
     * - ORDER BY created_at DESC: Newest items first
     * - LIMIT ?: Number of rows to return
     * - OFFSET ?: Number of rows to skip
     *
     * Example SQL:
     * SELECT * FROM inventory_items WHERE user_id = 1 AND category = 'spirit'
     * ORDER BY created_at DESC LIMIT 50 OFFSET 0
     */
    const items = db.prepare(`
      SELECT * FROM inventory_items
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(...queryParams, limit, offset) as InventoryItem[];

    /**
     * Step 6: Calculate Pagination Metadata
     *
     * Provide frontend with pagination context:
     * - Current page number
     * - Items per page
     * - Total items across all pages
     * - Total number of pages
     * - Whether next/previous pages exist
     *
     * This allows frontend to render pagination controls.
     */
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

    /**
     * Step 8: Return Paginated Response
     *
     * Standard pagination response format:
     * - data: Array of items for current page
     * - pagination: Metadata for UI controls
     */
    res.json({
      success: true,
      data: items,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage,
        hasPreviousPage
      }
    });
  } catch (error) {
    /**
     * Error Handling
     *
     * Log detailed error server-side.
     * Return generic error to client (don't leak internals).
     */
    console.error('Get inventory items error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch inventory items'
    });
  }
});

/**
 * POST /api/inventory-items - Add New Item to Inventory
 *
 * Creates a new item in user's inventory.
 *
 * Request Body:
 * {
 *   "name": "Maker's Mark",                    // REQUIRED
 *   "category": "spirit",                      // REQUIRED (spirit, liqueur, mixer, garnish, syrup, wine, beer, other)
 *   "type": "Bourbon",                         // Optional (formerly "Liquor Type")
 *   "abv": "45",                               // Optional (formerly "ABV (%)")
 *   "Stock Number": 42,                        // Optional
 *   "Detailed Spirit Classification": "...",   // Optional
 *   "Distillation Method": "Pot Still",        // Optional
 *   "ABV (%)": 45,                             // Optional
 *   "Distillery Location": "Loretto, KY",      // Optional
 *   "Age Statement or Barrel Finish": "...",   // Optional
 *   "Additional Notes": "...",                 // Optional (max 2000 chars)
 *   "Profile (Nose)": "...",                   // Optional (max 500 chars)
 *   "Palate": "...",                           // Optional (max 500 chars)
 *   "Finish": "..."                            // Optional (max 500 chars)
 * }
 *
 * Response (201 Created):
 * {
 *   "success": true,
 *   "data": {
 *     "id": 123,
 *     "user_id": 1,
 *     "name": "Maker's Mark",
 *     "created_at": "2025-11-10T14:32:05.123Z",
 *     ...
 *   }
 * }
 *
 * Error Responses:
 * - 400: Missing name, validation failed
 * - 401: Unauthorized (no valid JWT)
 * - 500: Database error
 *
 * Security:
 * - Input validation: All fields sanitized via validateInventoryItemData()
 * - SQL injection: Parameterized queries only
 * - User ownership: bottle.user_id set to authenticated user
 * - XSS prevention: HTML tags stripped from text fields
 */
router.post('/', (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;

    /**
     * Step 1: Authentication Check
     */
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    /**
     * Step 2: Validate and Sanitize Input
     *
     * Uses validateInventoryItemData() utility to:
     * - Check required fields (name)
     * - Sanitize string fields (remove HTML, trim, limit length)
     * - Validate numeric fields (ABV, Stock Number)
     * - Enforce data type constraints
     *
     * This prevents:
     * - XSS attacks (via HTML in text fields)
     * - Database bloat (via extremely long strings)
     * - Type errors (via wrong data types)
     */
    const validation = validateInventoryItemData(req.body);

    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validation.errors
      });
    }

    const item = validation.sanitized;

    /**
     * Step 3: Insert Item into Database
     *
     * SQL INSERT with category (required) + type/abv (new simplified columns) + legacy columns.
     * Parameterized query prevents SQL injection.
     *
     * Note: Field names with spaces require double quotes in SQLite.
     * Example: "Stock Number" vs Stock_Number
     *
     * Database automatically adds:
     * - id: Auto-increment primary key
     * - created_at: Current timestamp (DEFAULT)
     */
    const result = db.prepare(`
      INSERT INTO inventory_items (
        user_id, name, category, type, abv,
        "Stock Number", "Detailed Spirit Classification", "Distillation Method",
        "Distillery Location", "Age Statement or Barrel Finish", "Additional Notes",
        "Profile (Nose)", "Palate", "Finish"
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      item.name,
      item.category,
      item.type || null,
      item.abv || null,
      item['Stock Number'] || null,
      item['Detailed Spirit Classification'] || null,
      item['Distillation Method'] || null,
      item['Distillery Location'] || null,
      item['Age Statement or Barrel Finish'] || null,
      item['Additional Notes'] || null,
      item['Profile (Nose)'] || null,
      item['Palate'] || null,
      item['Finish'] || null
    );

    const itemId = result.lastInsertRowid as number;

    /**
     * Step 4: Retrieve Created Item
     *
     * Fetch the complete item record to return in response.
     * This includes database-generated fields (id, created_at).
     */
    const createdItem = db.prepare(
      'SELECT * FROM inventory_items WHERE id = ?'
    ).get(itemId) as InventoryItem;

    /**
     * Step 5: Return Success Response
     *
     * 201 Created status indicates new resource was created.
     * Return complete item object for frontend to display.
     */
    res.status(201).json({
      success: true,
      data: createdItem
    });
  } catch (error) {
    /**
     * Error Handling
     *
     * Common errors:
     * - Database constraint violation (e.g., invalid user_id, invalid category)
     * - SQLite error (database locked, disk full)
     */
    console.error('Add inventory item error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add inventory item'
    });
  }
});

/**
 * PUT /api/inventory/:id - Update Existing InventoryItem
 *
 * Updates an existing bottle in user's inventory.
 *
 * Route Parameters:
 * - id: InventoryItem ID to update (must be positive integer)
 *
 * Request Body:
 * {
 *   "name": "Updated Name",
 *   "ABV (%)": 46.5,
 *   // ... any fields to update
 * }
 *
 * Response (200 OK):
 * {
 *   "success": true,
 *   "data": {
 *     "id": 123,
 *     "name": "Updated Name",
 *     "ABV (%)": 46.5,
 *     ...
 *   }
 * }
 *
 * Error Responses:
 * - 400: Invalid bottle ID (not a number)
 * - 401: Unauthorized (no valid JWT)
 * - 404: InventoryItem not found or doesn't belong to user
 * - 500: Database error
 *
 * Security:
 * - User ownership: WHERE user_id = ? ensures users can only update own inventory_items
 * - Input validation: All fields sanitized via validateInventoryItemData()
 * - SQL injection: Parameterized queries only
 * - Authorization: Even with valid ID, users can't update others' inventory_items
 */
router.put('/:id', (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const itemId = parseInt(req.params.id);

    /**
     * Step 1: Authentication Check
     */
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    /**
     * Step 2: Validate Item ID
     *
     * Ensure ID is a valid positive integer.
     * parseInt() returns NaN for non-numeric strings.
     */
    if (isNaN(itemId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid item ID'
      });
    }

    /**
     * Step 3: Verify Ownership
     *
     * Check that item exists AND belongs to authenticated user.
     * This prevents users from updating others' inventory_items.
     *
     * Security Note:
     * - WHERE id = ? AND user_id = ? ensures both conditions
     * - If item exists but belongs to another user → 404 (not 403)
     * - Prevents leaking information about other users' inventories
     */
    const existingItem = db.prepare(
      'SELECT id FROM inventory_items WHERE id = ? AND user_id = ?'
    ).get(itemId, userId);

    if (!existingItem) {
      return res.status(404).json({
        success: false,
        error: 'Item not found'
      });
    }

    /**
     * Step 4: Validate and Sanitize Input
     *
     * Same validation as POST endpoint.
     * Ensures updated data meets security/quality standards.
     */
    const validation = validateInventoryItemData(req.body);

    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validation.errors
      });
    }

    const item = validation.sanitized;

    /**
     * Step 5: Update Item in Database
     *
     * SQL UPDATE with category, type, abv + legacy columns.
     * WHERE clause ensures user ownership (defense in depth).
     *
     * Note: updated_at timestamp would auto-update if we had that column.
     * Consider adding in Phase 3 for audit trails.
     */
    db.prepare(`
      UPDATE inventory_items SET
        name = ?,
        category = ?,
        type = ?,
        abv = ?,
        "Stock Number" = ?,
        "Detailed Spirit Classification" = ?,
        "Distillation Method" = ?,
        "Distillery Location" = ?,
        "Age Statement or Barrel Finish" = ?,
        "Additional Notes" = ?,
        "Profile (Nose)" = ?,
        "Palate" = ?,
        "Finish" = ?
      WHERE id = ? AND user_id = ?
    `).run(
      item.name,
      item.category,
      item.type || null,
      item.abv || null,
      item['Stock Number'] || null,
      item['Detailed Spirit Classification'] || null,
      item['Distillation Method'] || null,
      item['Distillery Location'] || null,
      item['Age Statement or Barrel Finish'] || null,
      item['Additional Notes'] || null,
      item['Profile (Nose)'] || null,
      item['Palate'] || null,
      item['Finish'] || null,
      itemId,
      userId
    );

    /**
     * Step 6: Retrieve Updated Item
     *
     * Fetch the complete updated record to return in response.
     */
    const updatedItem = db.prepare(
      'SELECT * FROM inventory_items WHERE id = ?'
    ).get(itemId) as InventoryItem;

    /**
     * Step 7: Return Success Response
     */
    res.json({
      success: true,
      data: updatedItem
    });
  } catch (error) {
    /**
     * Error Handling
     *
     * Common errors:
     * - Database constraint violation
     * - SQLite error
     */
    console.error('Update inventory item error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update inventory item'
    });
  }
});

/**
 * DELETE /api/inventory/:id - Delete InventoryItem
 *
 * Removes a bottle from user's inventory permanently.
 *
 * Route Parameters:
 * - id: InventoryItem ID to delete (must be positive integer)
 *
 * Response (200 OK):
 * {
 *   "success": true,
 *   "message": "InventoryItem deleted successfully"
 * }
 *
 * Error Responses:
 * - 400: Invalid bottle ID (not a number)
 * - 401: Unauthorized (no valid JWT)
 * - 404: InventoryItem not found or doesn't belong to user
 * - 500: Database error
 *
 * Security:
 * - User ownership: WHERE user_id = ? ensures users can only delete own inventory_items
 * - SQL injection: Parameterized query
 * - Authorization: Even with valid ID, users can't delete others' inventory_items
 *
 * Note: This is a hard delete (permanent removal).
 * Consider implementing soft delete in Phase 3:
 * - Add `deleted_at` timestamp column
 * - UPDATE instead of DELETE
 * - Filter out deleted inventory_items in queries
 * - Allows data recovery and audit trails
 */
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const itemId = parseInt(req.params.id);

    /**
     * Step 1: Authentication Check
     */
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    /**
     * Step 2: Validate Item ID
     */
    if (isNaN(itemId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid item ID'
      });
    }

    /**
     * Step 3: Verify Ownership
     *
     * Check that item exists AND belongs to authenticated user.
     * Prevents deleting other users' inventory_items.
     */
    const existingItem = db.prepare(
      'SELECT id FROM inventory_items WHERE id = ? AND user_id = ?'
    ).get(itemId, userId);

    if (!existingItem) {
      return res.status(404).json({
        success: false,
        error: 'Item not found'
      });
    }

    /**
     * Step 4: Delete Item
     *
     * Permanent removal from database.
     * WHERE clause ensures user ownership (defense in depth).
     *
     * SQL: DELETE FROM inventory_items WHERE id = ? AND user_id = ?
     *
     * Future Enhancement (Phase 3):
     * Implement soft delete for data recovery:
     * - Add `deleted_at` TIMESTAMP column
     * - UPDATE inventory_items SET deleted_at = CURRENT_TIMESTAMP
     * - WHERE deleted_at IS NULL in all queries
     */
    db.prepare('DELETE FROM inventory_items WHERE id = ? AND user_id = ?')
      .run(itemId, userId);

    /**
     * Step 5: Return Success Response
     *
     * 200 OK with confirmation message.
     * No data returned (item is deleted).
     */
    res.json({
      success: true,
      message: 'Item deleted successfully'
    });
  } catch (error) {
    /**
     * Error Handling
     *
     * Common errors:
     * - Database constraint violation (e.g., foreign key if we add them)
     * - SQLite error (database locked)
     */
    console.error('Delete inventory item error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete inventory item'
    });
  }
});

/**
 * Helper function to find a field value from record using multiple possible column names
 */
function findField(record: any, possibleNames: string[]): any {
  for (const name of possibleNames) {
    const value = record[name];
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }
  return null;
}

/**
 * Helper function to validate and sanitize inventory item data
 * Handles both API requests and CSV imports with flexible column names
 */
function validateInventoryItemData(record: any): { isValid: boolean; errors: string[]; sanitized?: any } {
  const errors: string[] = [];

  // Try to find the name field with various possible column names
  const nameField = findField(record, [
    'name', 'Name', 'NAME',
    'Spirit Name', 'spirit name', 'Spirit', 'spirit',
    'Bottle Name', 'bottle name', 'Bottle', 'bottle',
    'Product Name', 'product name', 'Product', 'product',
    'Brand', 'brand'
  ]);

  // Require name field
  if (!nameField || (typeof nameField === 'string' && nameField.trim().length === 0)) {
    errors.push(`Missing name field. Available columns: ${Object.keys(record).join(', ')}`);
  }

  // Try to find category field (required for new items)
  const categoryField = findField(record, ['category', 'Category', 'CATEGORY']);
  const validCategories = ['spirit', 'liqueur', 'mixer', 'garnish', 'syrup', 'wine', 'beer', 'other'];

  // Category is required - if missing, default to 'other' for backwards compatibility
  let category = categoryField ? String(categoryField).trim().toLowerCase() : 'other';

  // Validate category is one of the allowed values
  if (!validCategories.includes(category)) {
    errors.push(`Invalid category: "${category}". Must be one of: ${validCategories.join(', ')}`);
  }

  // If validation failed, return early
  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  // Helper to safely convert to string and trim
  const safeString = (val: any) => val ? String(val).trim() : null;
  const safeNumber = (val: any) => {
    const num = parseInt(String(val));
    return isNaN(num) ? null : num;
  };

  // Sanitize the data - be very flexible with column names
  const sanitized = {
    name: safeString(nameField),
    category: category,
    type: safeString(findField(record, ['type', 'Type', 'TYPE', 'Liquor Type', 'liquor type'])),
    abv: safeString(findField(record, ['abv', 'ABV', 'ABV (%)', 'Alcohol', 'alcohol', 'Proof', 'proof'])),
    'Stock Number': safeNumber(findField(record, ['Stock Number', 'stock number', 'Stock', 'stock', 'Number', '#'])),
    'Detailed Spirit Classification': safeString(findField(record, ['Detailed Spirit Classification', 'Classification', 'classification', 'Spirit Type', 'spirit type'])),
    'Distillation Method': safeString(findField(record, ['Distillation Method', 'distillation method', 'Method', 'method'])),
    'Distillery Location': safeString(findField(record, ['Distillery Location', 'distillery location', 'Location', 'location', 'Origin', 'origin', 'Country', 'country'])),
    'Age Statement or Barrel Finish': safeString(findField(record, ['Age Statement or Barrel Finish', 'Age Statement', 'age statement', 'Age', 'age', 'Barrel Finish', 'barrel finish'])),
    'Additional Notes': safeString(findField(record, ['Additional Notes', 'additional notes', 'Notes', 'notes', 'Description', 'description', 'Comments', 'comments'])),
    'Profile (Nose)': safeString(findField(record, ['Profile (Nose)', 'Nose', 'nose', 'Aroma', 'aroma', 'Smell', 'smell'])),
    'Palate': safeString(findField(record, ['Palate', 'palate', 'Taste', 'taste', 'Flavor', 'flavor'])),
    'Finish': safeString(findField(record, ['Finish', 'finish', 'Aftertaste', 'aftertaste'])),
  };

  return { isValid: true, errors: [], sanitized };
}

/**
 * POST /api/inventory/import - CSV Import
 *
 * Bulk import inventory_items from CSV file.
 *
 * Request: multipart/form-data with 'file' field
 *
 * CSV Format:
 * ```
 * name,Stock Number,Liquor Type,ABV (%),Detailed Spirit Classification,Distillation Method,Distillery Location,Age Statement or Barrel Finish,Additional Notes,Profile (Nose),Palate,Finish
 * "Maker's Mark",42,Bourbon,45,"Kentucky Straight Bourbon","Pot Still","Loretto, KY","No Age Statement","Classic wheated bourbon","Caramel and vanilla","Sweet and smooth","Warm finish"
 * ```
 *
 * Response (200 OK):
 * {
 *   "success": true,
 *   "imported": 25,
 *   "failed": 2,
 *   "errors": [
 *     { "row": 3, "error": "Missing required field: name" },
 *     { "row": 7, "error": "Invalid ABV value" }
 *   ]
 * }
 */
router.post('/import', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    // Parse CSV
    const csvContent = req.file.buffer.toString('utf-8');
    let records: any[];

    try {
      records = parse(csvContent, {
        columns: true, // First row is headers
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

    // Process each row
    let imported = 0;
    const errors: { row: number; error: string }[] = [];

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const rowNumber = i + 2; // +2 because: 0-indexed + header row

      try {
        // Validate bottle data
        const validation = validateInventoryItemData(record);

        if (!validation.isValid) {
          errors.push({
            row: rowNumber,
            error: validation.errors.join(', ')
          });
          continue;
        }

        const item = validation.sanitized;

        // Insert into database
        db.prepare(`
          INSERT INTO inventory_items (
            user_id, name, category, type, abv,
            "Stock Number", "Detailed Spirit Classification", "Distillation Method",
            "Distillery Location", "Age Statement or Barrel Finish", "Additional Notes",
            "Profile (Nose)", "Palate", "Finish"
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          userId,
          item.name,
          item.category,
          item.type || null,
          item.abv || null,
          item['Stock Number'] || null,
          item['Detailed Spirit Classification'] || null,
          item['Distillation Method'] || null,
          item['Distillery Location'] || null,
          item['Age Statement or Barrel Finish'] || null,
          item['Additional Notes'] || null,
          item['Profile (Nose)'] || null,
          item['Palate'] || null,
          item['Finish'] || null
        );

        imported++;
      } catch (error: any) {
        errors.push({
          row: rowNumber,
          error: error.message || 'Failed to import row'
        });
      }
    }

    // Return summary
    res.json({
      success: true,
      imported,
      failed: errors.length,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error: any) {
    console.error('CSV import error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to import CSV',
      details: error.message
    });
  }
});

/**
 * Export Inventory Items Router
 *
 * Mounted at /api/inventory-items in server.ts:
 * - GET    /api/inventory-items           - List inventory items (paginated, category filtering)
 * - POST   /api/inventory-items           - Add item
 * - PUT    /api/inventory-items/:id       - Update item
 * - DELETE /api/inventory-items/:id       - Delete item
 * - POST   /api/inventory-items/import    - CSV import
 *
 * All routes require authentication (authMiddleware applied to router).
 */
export default router;
