/**
 * Recipes Routes
 *
 * Handles CRUD operations for user's cocktail recipe collection.
 *
 * Features:
 * - GET /api/recipes - List user's recipes with pagination
 * - POST /api/recipes - Add new recipe to collection
 * - POST /api/recipes/import - CSV import (future feature)
 *
 * Data Structure:
 * - Recipes store ingredients as JSON string in database
 * - Parsed to JavaScript array/object on retrieval
 * - Supports flexible ingredient formats (text or structured)
 *
 * Security:
 * - All routes require JWT authentication (authMiddleware)
 * - User isolation: Can only access their own recipes
 * - Input validation: Names and text fields sanitized
 * - SQL injection prevention: Parameterized queries
 * - Pagination: Prevents DoS via large result sets
 *
 * SECURITY FIX #12: Added pagination to prevent performance issues
 * - Default: 50 recipes per page
 * - Maximum: 100 recipes per page
 * - Prevents memory issues with large recipe libraries
 */

import { Router, Request, Response } from 'express';
import { db } from '../database/db';
import { authMiddleware } from '../middleware/auth';
import { sanitizeString, validateNumber } from '../utils/inputValidator';
import { Recipe } from '../types';

const router = Router();

/**
 * Authentication Requirement
 *
 * All recipe routes require valid JWT token.
 * Ensures users can only access/modify their own recipes.
 */
router.use(authMiddleware);

/**
 * GET /api/recipes - List User's Recipes with Pagination
 *
 * Returns paginated list of cocktail recipes owned by authenticated user.
 *
 * SECURITY FIX #12: Added pagination to prevent DoS and performance issues.
 *
 * Query Parameters:
 * - page: Page number (default: 1, min: 1)
 * - limit: Items per page (default: 50, max: 100, min: 1)
 *
 * Example Requests:
 * - GET /api/recipes → First 50 recipes
 * - GET /api/recipes?page=2 → Recipes 51-100
 * - GET /api/recipes?page=1&limit=25 → First 25 recipes
 *
 * Response (200 OK):
 * {
 *   "success": true,
 *   "data": [
 *     {
 *       "id": 1,
 *       "user_id": 1,
 *       "name": "Old Fashioned",
 *       "ingredients": ["2 oz Bourbon", "1 sugar cube", "2 dashes bitters"],
 *       "instructions": "Muddle sugar with bitters...",
 *       "glass": "Rocks glass",
 *       "category": "Classic",
 *       "created_at": "2025-11-10T14:32:05.123Z"
 *     }
 *   ],
 *   "pagination": {
 *     "page": 1,
 *     "limit": 50,
 *     "total": 247,
 *     "totalPages": 5,
 *     "hasNextPage": true,
 *     "hasPreviousPage": false
 *   }
 * }
 *
 * Why Pagination Matters:
 * - Performance: Fetching 1,000 recipes takes longer than 50
 * - Memory: Large result sets consume server memory
 * - Network: Smaller payloads = faster response times
 * - DoS Prevention: Attacker can't exhaust resources
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
      1,    // min: at least 1 recipe per page
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
     * Step 4: Count Total Recipes (for pagination metadata)
     *
     * COUNT(*) query to determine total pages.
     * Separate query is necessary for pagination info.
     *
     * Performance Note:
     * - COUNT(*) on indexed user_id column is fast (<1ms)
     * - Result is small (single integer)
     */
    const countResult = db.prepare(
      'SELECT COUNT(*) as total FROM recipes WHERE user_id = ?'
    ).get(userId) as { total: number };

    const total = countResult.total;

    /**
     * Step 5: Fetch Paginated Recipes
     *
     * SQL Query Breakdown:
     * - SELECT *: All recipe columns (id, user_id, name, ingredients, etc.)
     * - WHERE user_id = ?: User isolation for security
     * - ORDER BY created_at DESC: Newest recipes first
     * - LIMIT ?: Number of rows to return
     * - OFFSET ?: Number of rows to skip
     *
     * Example SQL:
     * SELECT * FROM recipes WHERE user_id = 1
     * ORDER BY created_at DESC LIMIT 50 OFFSET 0
     */
    const recipes = db.prepare(`
      SELECT * FROM recipes
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(userId, limit, offset) as Recipe[];

    /**
     * Step 6: Parse Ingredients JSON
     *
     * Ingredients are stored as JSON string in database.
     * Parse them back to JavaScript array/object for frontend.
     *
     * Why store as JSON string?
     * - SQLite has limited JSON support (no native JSON type until v3.38)
     * - Flexibility: Can store array of strings OR structured objects
     * - Simplicity: No separate ingredients table needed
     *
     * Example formats:
     * - Simple: ["2 oz Bourbon", "1 sugar cube", "2 dashes bitters"]
     * - Structured: [{"name": "Bourbon", "amount": 2, "unit": "oz"}, ...]
     *
     * Error Handling:
     * - If JSON.parse() fails, keep as string (graceful degradation)
     * - Prevents entire request from failing due to malformed JSON
     */
    const parsedRecipes = recipes.map(recipe => {
      try {
        return {
          ...recipe,
          ingredients: typeof recipe.ingredients === 'string'
            ? JSON.parse(recipe.ingredients)
            : recipe.ingredients
        };
      } catch (error) {
        // If JSON parsing fails, keep as string
        console.warn(`Failed to parse ingredients for recipe ${recipe.id}`);
        return recipe;
      }
    });

    /**
     * Step 7: Calculate Pagination Metadata
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
     * - data: Array of recipes for current page
     * - pagination: Metadata for UI controls
     */
    res.json({
      success: true,
      data: parsedRecipes,
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
    console.error('Get recipes error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recipes'
    });
  }
});

/**
 * POST /api/recipes - Add New Recipe
 *
 * Creates a new cocktail recipe in user's collection.
 *
 * Request Body:
 * {
 *   "name": "Old Fashioned",                     // REQUIRED
 *   "ingredients": [                             // Optional (can be string or array)
 *     "2 oz Bourbon",
 *     "1 sugar cube",
 *     "2 dashes Angostura bitters",
 *     "Orange peel"
 *   ],
 *   "instructions": "Muddle sugar...",           // Optional (max 2000 chars)
 *   "glass": "Rocks glass",                      // Optional (max 100 chars)
 *   "category": "Classic"                        // Optional (max 100 chars)
 * }
 *
 * Alternative ingredients format (structured):
 * {
 *   "ingredients": [
 *     {"name": "Bourbon", "amount": 2, "unit": "oz"},
 *     {"name": "Sugar cube", "amount": 1},
 *     {"name": "Angostura bitters", "amount": 2, "unit": "dashes"}
 *   ]
 * }
 *
 * Response (201 Created):
 * {
 *   "success": true,
 *   "data": {
 *     "id": 123,
 *     "user_id": 1,
 *     "name": "Old Fashioned",
 *     "ingredients": ["2 oz Bourbon", ...],
 *     "instructions": "Muddle sugar...",
 *     "glass": "Rocks glass",
 *     "category": "Classic",
 *     "created_at": "2025-11-10T14:32:05.123Z"
 *   }
 * }
 *
 * Error Responses:
 * - 400: Missing name, validation failed
 * - 401: Unauthorized (no valid JWT)
 * - 500: Database error, JSON stringify error
 *
 * Security:
 * - Input validation: Name and text fields sanitized
 * - SQL injection: Parameterized queries only
 * - User ownership: recipe.user_id set to authenticated user
 * - XSS prevention: HTML tags stripped from text fields
 * - Length limits: Prevent database bloat
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

    const recipe: Recipe = req.body;

    /**
     * Step 2: Validate Required Fields
     *
     * Recipe name is required for identification.
     * Other fields are optional.
     */
    if (!recipe.name || typeof recipe.name !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Recipe name is required and must be a string'
      });
    }

    /**
     * Step 3: Sanitize Text Fields
     *
     * Remove HTML tags, trim whitespace, limit length.
     * Prevents XSS attacks and database bloat.
     *
     * Sanitization rules:
     * - name: Max 255 chars, strip HTML
     * - instructions: Max 2000 chars, strip HTML
     * - glass: Max 100 chars, strip HTML
     * - category: Max 100 chars, strip HTML
     */
    const sanitizedName = sanitizeString(recipe.name, 255, true);

    if (sanitizedName.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Recipe name cannot be empty after sanitization'
      });
    }

    const sanitizedInstructions = recipe.instructions
      ? sanitizeString(recipe.instructions, 2000, true)
      : null;

    const sanitizedGlass = recipe.glass
      ? sanitizeString(recipe.glass, 100, true)
      : null;

    const sanitizedCategory = recipe.category
      ? sanitizeString(recipe.category, 100, true)
      : null;

    /**
     * Step 4: Process Ingredients
     *
     * Ingredients can be:
     * - String: Already in JSON format
     * - Array: Need to stringify
     * - Object: Need to stringify
     * - Null/undefined: Store as empty array
     *
     * Validation:
     * - If array, ensure it's not too large (max 100 ingredients)
     * - If string, ensure it's valid JSON (optional check)
     *
     * Storage Format:
     * - Always stored as JSON string in database
     * - Parsed back to original format on retrieval
     */
    let ingredientsStr: string;

    if (!recipe.ingredients) {
      // No ingredients provided, store empty array
      ingredientsStr = '[]';
    } else if (typeof recipe.ingredients === 'string') {
      // Already a string, validate it's valid JSON
      try {
        JSON.parse(recipe.ingredients); // Test parse
        ingredientsStr = recipe.ingredients;
      } catch (error) {
        return res.status(400).json({
          success: false,
          error: 'Ingredients string is not valid JSON'
        });
      }
    } else if (Array.isArray(recipe.ingredients)) {
      // Array of ingredients, validate length
      if (recipe.ingredients.length > 100) {
        return res.status(400).json({
          success: false,
          error: 'Too many ingredients (maximum 100)'
        });
      }
      ingredientsStr = JSON.stringify(recipe.ingredients);
    } else {
      // Object format, stringify
      ingredientsStr = JSON.stringify(recipe.ingredients);
    }

    /**
     * Step 5: Insert Recipe into Database
     *
     * SQL INSERT with 6 parameters (user_id + 5 recipe fields).
     * Parameterized query prevents SQL injection.
     *
     * Database automatically adds:
     * - id: Auto-increment primary key
     * - created_at: Current timestamp (DEFAULT)
     */
    const result = db.prepare(`
      INSERT INTO recipes (
        user_id, name, ingredients, instructions, glass, category
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      sanitizedName,
      ingredientsStr,
      sanitizedInstructions,
      sanitizedGlass,
      sanitizedCategory
    );

    const recipeId = result.lastInsertRowid as number;

    /**
     * Step 6: Retrieve Created Recipe
     *
     * Fetch the complete recipe record to return in response.
     * This includes database-generated fields (id, created_at).
     */
    const createdRecipe = db.prepare(
      'SELECT * FROM recipes WHERE id = ?'
    ).get(recipeId) as Recipe;

    /**
     * Step 7: Parse Ingredients for Response
     *
     * Convert JSON string back to original format for frontend.
     * This provides a consistent API experience.
     */
    const parsedRecipe = {
      ...createdRecipe,
      ingredients: JSON.parse(createdRecipe.ingredients as string)
    };

    /**
     * Step 8: Return Success Response
     *
     * 201 Created status indicates new resource was created.
     * Return complete recipe object for frontend to display.
     */
    res.status(201).json({
      success: true,
      data: parsedRecipe
    });
  } catch (error) {
    /**
     * Error Handling
     *
     * Common errors:
     * - Database constraint violation (e.g., invalid user_id)
     * - JSON.stringify() error (circular reference, too large)
     * - JSON.parse() error (malformed JSON)
     * - SQLite error (database locked, disk full)
     */
    console.error('Add recipe error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add recipe'
    });
  }
});

/**
 * POST /api/recipes/import - CSV Import
 *
 * Bulk import recipes from CSV file.
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
 * Name,Ingredients,Instructions,Glass,Category
 * "Old Fashioned","2 oz Bourbon; 1 sugar cube; 2 dashes bitters","Muddle sugar...","Rocks glass","Classic"
 * "Margarita","2 oz Tequila; 1 oz Lime juice; 1 oz Cointreau","Shake with ice...","Coupe","Sour"
 * ```
 *
 * Ingredient Handling:
 * - Semicolon-separated in CSV (easier than nested JSON)
 * - Converted to array during import
 * - Example: "2 oz Bourbon; 1 sugar cube" → ["2 oz Bourbon", "1 sugar cube"]
 *
 * Security Considerations:
 * - File size limit: 10MB (already enforced by server.ts)
 * - Row limit: 1,000 rows max (prevent DoS)
 * - Same validation as individual recipe creation
 * - Transaction: All-or-nothing OR partial with error report
 * - Rate limiting: 1 import per 5 minutes per user
 *
 * Implementation Priority: Low (Phase 3+)
 * - Core features complete
 * - Manual entry works fine for personal collections
 * - CSV is nice-to-have for batch imports
 */
router.post('/import', (req: Request, res: Response) => {
  // Placeholder response until implementation
  res.status(501).json({
    success: false,
    error: 'CSV import not yet implemented',
    details: 'This feature is planned for Phase 3. Use POST /api/recipes to add recipes individually.'
  });
});

/**
 * Export Recipes Router
 *
 * Mounted at /api/recipes in server.ts:
 * - GET  /api/recipes          - List recipes (paginated)
 * - POST /api/recipes          - Add recipe
 * - POST /api/recipes/import   - CSV import (future)
 *
 * All routes require authentication (authMiddleware applied to router).
 *
 * Future Enhancements (Phase 3+):
 * - PUT /api/recipes/:id       - Update existing recipe
 * - DELETE /api/recipes/:id    - Delete recipe
 * - GET /api/recipes/search    - Search recipes by name/ingredient
 * - GET /api/recipes/:id       - Get single recipe details
 */
export default router;
