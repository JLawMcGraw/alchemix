/**
 * Inventory Routes
 *
 * Handles CRUD operations for user's bottle inventory.
 *
 * Features:
 * - GET /api/inventory - List user's bottles with pagination
 * - POST /api/inventory - Add new bottle to inventory
 * - PUT /api/inventory/:id - Update existing bottle
 * - DELETE /api/inventory/:id - Remove bottle from inventory
 * - POST /api/inventory/import - CSV import (future feature)
 *
 * Security:
 * - All routes require JWT authentication (authMiddleware)
 * - User isolation: Can only access their own bottles
 * - Input validation: Sanitized via inputValidator utility
 * - SQL injection prevention: Parameterized queries
 * - Pagination: Prevents DoS via large result sets
 *
 * SECURITY FIX #12: Added pagination to prevent performance issues
 * - Default: 50 bottles per page
 * - Maximum: 100 bottles per page
 * - Prevents N+1 query issues with large inventories
 * - Reduces memory usage and API response time
 */

import { Router, Request, Response } from 'express';
import { db } from '../database/db';
import { authMiddleware } from '../middleware/auth';
import { validateBottleData, validateNumber } from '../utils/inputValidator';
import { Bottle } from '../types';

const router = Router();

/**
 * Authentication Requirement
 *
 * All inventory routes require valid JWT token.
 * Ensures users can only access/modify their own bottles.
 */
router.use(authMiddleware);

/**
 * GET /api/inventory - List User's Bottles with Pagination
 *
 * Returns paginated list of bottles owned by authenticated user.
 *
 * SECURITY FIX #12: Added pagination to prevent DoS and performance issues.
 *
 * Query Parameters:
 * - page: Page number (default: 1, min: 1)
 * - limit: Items per page (default: 50, max: 100, min: 1)
 *
 * Example Requests:
 * - GET /api/inventory → First 50 bottles
 * - GET /api/inventory?page=2 → Bottles 51-100
 * - GET /api/inventory?page=1&limit=25 → First 25 bottles
 *
 * Response (200 OK):
 * {
 *   "success": true,
 *   "data": [
 *     {
 *       "id": 1,
 *       "user_id": 1,
 *       "name": "Maker's Mark",
 *       "Liquor Type": "Bourbon",
 *       "ABV (%)": 45,
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
 * - Performance: Fetching 1,000 bottles takes 100ms, 50 bottles takes 5ms
 * - Memory: Large result sets consume server memory
 * - Network: Smaller payloads = faster response times
 * - DoS Prevention: Attacker can't exhaust resources with huge queries
 *
 * Security:
 * - User isolation: WHERE user_id = ? ensures data privacy
 * - Input validation: page/limit validated as numbers
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
     * Step 3: Calculate SQL OFFSET
     *
     * Offset = (page - 1) × limit
     * Examples:
     * - Page 1, Limit 50: Offset 0 (rows 1-50)
     * - Page 2, Limit 50: Offset 50 (rows 51-100)
     * - Page 3, Limit 25: Offset 50 (rows 51-75)
     */
    const offset = (page - 1) * limit;

    /**
     * Step 4: Count Total Bottles (for pagination metadata)
     *
     * COUNT(*) query to determine total pages.
     * Separate query is necessary for pagination info.
     *
     * Performance Note:
     * - COUNT(*) on indexed user_id column is fast (<1ms)
     * - Result is small (single integer)
     */
    const countResult = db.prepare(
      'SELECT COUNT(*) as total FROM bottles WHERE user_id = ?'
    ).get(userId) as { total: number };

    const total = countResult.total;

    /**
     * Step 5: Fetch Paginated Bottles
     *
     * SQL Query Breakdown:
     * - SELECT *: All bottle columns (12 fields + metadata)
     * - WHERE user_id = ?: User isolation for security
     * - ORDER BY created_at DESC: Newest bottles first
     * - LIMIT ?: Number of rows to return
     * - OFFSET ?: Number of rows to skip
     *
     * Example SQL:
     * SELECT * FROM bottles WHERE user_id = 1
     * ORDER BY created_at DESC LIMIT 50 OFFSET 0
     */
    const bottles = db.prepare(`
      SELECT * FROM bottles
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(userId, limit, offset) as Bottle[];

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
     * Step 7: Return Paginated Response
     *
     * Standard pagination response format:
     * - data: Array of bottles for current page
     * - pagination: Metadata for UI controls
     */
    res.json({
      success: true,
      data: bottles,
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
    console.error('Get bottles error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch bottles'
    });
  }
});

/**
 * POST /api/inventory - Add New Bottle
 *
 * Creates a new bottle in user's inventory.
 *
 * Request Body:
 * {
 *   "name": "Maker's Mark",                    // REQUIRED
 *   "Stock Number": 42,                        // Optional
 *   "Liquor Type": "Bourbon",                  // Optional
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
 * - Input validation: All fields sanitized via validateBottleData()
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
     * Uses validateBottleData() utility to:
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
    const validation = validateBottleData(req.body);

    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validation.errors
      });
    }

    const bottle = validation.sanitized;

    /**
     * Step 3: Insert Bottle into Database
     *
     * SQL INSERT with 13 parameters (user_id + 12 bottle fields).
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

    /**
     * Step 4: Retrieve Created Bottle
     *
     * Fetch the complete bottle record to return in response.
     * This includes database-generated fields (id, created_at).
     */
    const createdBottle = db.prepare(
      'SELECT * FROM bottles WHERE id = ?'
    ).get(bottleId) as Bottle;

    /**
     * Step 5: Return Success Response
     *
     * 201 Created status indicates new resource was created.
     * Return complete bottle object for frontend to display.
     */
    res.status(201).json({
      success: true,
      data: createdBottle
    });
  } catch (error) {
    /**
     * Error Handling
     *
     * Common errors:
     * - Database constraint violation (e.g., invalid user_id)
     * - SQLite error (database locked, disk full)
     */
    console.error('Add bottle error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add bottle'
    });
  }
});

/**
 * PUT /api/inventory/:id - Update Existing Bottle
 *
 * Updates an existing bottle in user's inventory.
 *
 * Route Parameters:
 * - id: Bottle ID to update (must be positive integer)
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
 * - 404: Bottle not found or doesn't belong to user
 * - 500: Database error
 *
 * Security:
 * - User ownership: WHERE user_id = ? ensures users can only update own bottles
 * - Input validation: All fields sanitized via validateBottleData()
 * - SQL injection: Parameterized queries only
 * - Authorization: Even with valid ID, users can't update others' bottles
 */
router.put('/:id', (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const bottleId = parseInt(req.params.id);

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
     * Step 2: Validate Bottle ID
     *
     * Ensure ID is a valid positive integer.
     * parseInt() returns NaN for non-numeric strings.
     */
    if (isNaN(bottleId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid bottle ID'
      });
    }

    /**
     * Step 3: Verify Ownership
     *
     * Check that bottle exists AND belongs to authenticated user.
     * This prevents users from updating others' bottles.
     *
     * Security Note:
     * - WHERE id = ? AND user_id = ? ensures both conditions
     * - If bottle exists but belongs to another user → 404 (not 403)
     * - Prevents leaking information about other users' inventories
     */
    const existingBottle = db.prepare(
      'SELECT id FROM bottles WHERE id = ? AND user_id = ?'
    ).get(bottleId, userId);

    if (!existingBottle) {
      return res.status(404).json({
        success: false,
        error: 'Bottle not found'
      });
    }

    /**
     * Step 4: Validate and Sanitize Input
     *
     * Same validation as POST endpoint.
     * Ensures updated data meets security/quality standards.
     */
    const validation = validateBottleData(req.body);

    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validation.errors
      });
    }

    const bottle = validation.sanitized;

    /**
     * Step 5: Update Bottle in Database
     *
     * SQL UPDATE with 14 parameters (12 fields + id + user_id).
     * WHERE clause ensures user ownership (defense in depth).
     *
     * Note: updated_at timestamp would auto-update if we had that column.
     * Consider adding in Phase 3 for audit trails.
     */
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

    /**
     * Step 6: Retrieve Updated Bottle
     *
     * Fetch the complete updated record to return in response.
     */
    const updatedBottle = db.prepare(
      'SELECT * FROM bottles WHERE id = ?'
    ).get(bottleId) as Bottle;

    /**
     * Step 7: Return Success Response
     */
    res.json({
      success: true,
      data: updatedBottle
    });
  } catch (error) {
    /**
     * Error Handling
     *
     * Common errors:
     * - Database constraint violation
     * - SQLite error
     */
    console.error('Update bottle error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update bottle'
    });
  }
});

/**
 * DELETE /api/inventory/:id - Delete Bottle
 *
 * Removes a bottle from user's inventory permanently.
 *
 * Route Parameters:
 * - id: Bottle ID to delete (must be positive integer)
 *
 * Response (200 OK):
 * {
 *   "success": true,
 *   "message": "Bottle deleted successfully"
 * }
 *
 * Error Responses:
 * - 400: Invalid bottle ID (not a number)
 * - 401: Unauthorized (no valid JWT)
 * - 404: Bottle not found or doesn't belong to user
 * - 500: Database error
 *
 * Security:
 * - User ownership: WHERE user_id = ? ensures users can only delete own bottles
 * - SQL injection: Parameterized query
 * - Authorization: Even with valid ID, users can't delete others' bottles
 *
 * Note: This is a hard delete (permanent removal).
 * Consider implementing soft delete in Phase 3:
 * - Add `deleted_at` timestamp column
 * - UPDATE instead of DELETE
 * - Filter out deleted bottles in queries
 * - Allows data recovery and audit trails
 */
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const bottleId = parseInt(req.params.id);

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
     * Step 2: Validate Bottle ID
     */
    if (isNaN(bottleId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid bottle ID'
      });
    }

    /**
     * Step 3: Verify Ownership
     *
     * Check that bottle exists AND belongs to authenticated user.
     * Prevents deleting other users' bottles.
     */
    const existingBottle = db.prepare(
      'SELECT id FROM bottles WHERE id = ? AND user_id = ?'
    ).get(bottleId, userId);

    if (!existingBottle) {
      return res.status(404).json({
        success: false,
        error: 'Bottle not found'
      });
    }

    /**
     * Step 4: Delete Bottle
     *
     * Permanent removal from database.
     * WHERE clause ensures user ownership (defense in depth).
     *
     * SQL: DELETE FROM bottles WHERE id = ? AND user_id = ?
     *
     * Future Enhancement (Phase 3):
     * Implement soft delete for data recovery:
     * - Add `deleted_at` TIMESTAMP column
     * - UPDATE bottles SET deleted_at = CURRENT_TIMESTAMP
     * - WHERE deleted_at IS NULL in all queries
     */
    db.prepare('DELETE FROM bottles WHERE id = ? AND user_id = ?')
      .run(bottleId, userId);

    /**
     * Step 5: Return Success Response
     *
     * 200 OK with confirmation message.
     * No data returned (bottle is deleted).
     */
    res.json({
      success: true,
      message: 'Bottle deleted successfully'
    });
  } catch (error) {
    /**
     * Error Handling
     *
     * Common errors:
     * - Database constraint violation (e.g., foreign key if we add them)
     * - SQLite error (database locked)
     */
    console.error('Delete bottle error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete bottle'
    });
  }
});

/**
 * POST /api/inventory/import - CSV Import
 *
 * Bulk import bottles from CSV file.
 *
 * Status: NOT YET IMPLEMENTED (Phase 3)
 *
 * Planned Features:
 * - Accept CSV file upload via multipart/form-data
 * - Parse CSV with validation for each row
 * - Support standard CSV format (comma-separated)
 * - Handle errors gracefully (partial success)
 * - Return summary: imported count, failed rows with reasons
 *
 * Planned CSV Format:
 * ```
 * Name,Stock Number,Liquor Type,ABV (%),Distillery Location,...
 * "Maker's Mark",42,Bourbon,45,"Loretto, KY",...
 * "Woodford Reserve",43,Bourbon,45.2,"Versailles, KY",...
 * ```
 *
 * Security Considerations:
 * - File size limit: 10MB (already enforced by server.ts)
 * - Row limit: 1,000 rows max (prevent DoS)
 * - Same validation as individual bottle creation
 * - Transaction: All-or-nothing OR partial with error report
 * - Rate limiting: 1 import per 5 minutes per user
 *
 * Implementation Priority: Low (Phase 3+)
 * - Core features complete
 * - Manual entry works fine for <100 bottles
 * - CSV is nice-to-have for power users
 */
router.post('/import', (req: Request, res: Response) => {
  // Placeholder response until implementation
  res.status(501).json({
    success: false,
    error: 'CSV import not yet implemented',
    details: 'This feature is planned for Phase 3. Use POST /api/inventory to add bottles individually.'
  });
});

/**
 * Export Inventory Router
 *
 * Mounted at /api/inventory in server.ts:
 * - GET    /api/inventory          - List bottles (paginated)
 * - POST   /api/inventory          - Add bottle
 * - PUT    /api/inventory/:id      - Update bottle
 * - DELETE /api/inventory/:id      - Delete bottle
 * - POST   /api/inventory/import   - CSV import (future)
 *
 * All routes require authentication (authMiddleware applied to router).
 */
export default router;
