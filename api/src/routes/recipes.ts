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
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import { db } from '../database/db';
import { authMiddleware } from '../middleware/auth';
import { userRateLimit } from '../middleware/userRateLimit';
import { sanitizeString, validateNumber } from '../utils/inputValidator';
import { Recipe } from '../types';
import { memoryService } from '../services/MemoryService';

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
 * All recipe routes require valid JWT token.
 * Ensures users can only access/modify their own recipes.
 */
router.use(authMiddleware);
// No rate limiting on recipes - users should be able to view their recipes freely

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
     * Step 3.5: Validate Collection (if provided)
     *
     * If collection_id is provided, ensure it exists and belongs to user.
     */
    const collectionId = recipe.collection_id || null;
    if (collectionId) {
      const collection = db.prepare(
        'SELECT id FROM collections WHERE id = ? AND user_id = ?'
      ).get(collectionId, userId);

      if (!collection) {
        return res.status(400).json({
          success: false,
          error: 'Collection not found or access denied'
        });
      }
    }

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
      const ingredientsArray = recipe.ingredients as any[];
      if (ingredientsArray.length > 100) {
        return res.status(400).json({
          success: false,
          error: 'Too many ingredients (maximum 100)'
        });
      }
      ingredientsStr = JSON.stringify(ingredientsArray);
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
        user_id, collection_id, name, ingredients, instructions, glass, category
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      collectionId,
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
     * Step 7.5: Store Recipe in MemMachine (Non-Blocking)
     *
     * Store recipe in user's MemMachine memory for AI semantic search.
     * Capture UUID and store in database for future deletion.
     * This is fire-and-forget - errors won't block the response.
     */
    memoryService.storeUserRecipe(userId, {
      name: sanitizedName,
      ingredients: parsedRecipe.ingredients,
      instructions: sanitizedInstructions || undefined,
      glass: sanitizedGlass || undefined,
      category: sanitizedCategory || undefined,
    }).then(uuid => {
      if (uuid) {
        // Store UUID in database for future deletion
        db.prepare('UPDATE recipes SET memmachine_uuid = ? WHERE id = ?').run(uuid, recipeId);
        console.log(`💾 Stored MemMachine UUID for recipe ${recipeId}: ${uuid}`);
      }
    }).catch(err => {
      console.error('Failed to store recipe in MemMachine (non-critical):', err);
    });

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
 * Helper function to validate and sanitize recipe data from CSV
 * Very flexible - handles any column names and missing fields
 */
function validateRecipeData(record: any): { isValid: boolean; errors: string[]; sanitized?: any } {
  const errors: string[] = [];

  // Try to find the name field with various possible column names
  const nameField = findField(record, [
    'name', 'Name', 'NAME',
    'Recipe Name', 'recipe name', 'Recipe', 'recipe',
    'Cocktail', 'cocktail', 'Cocktail Name', 'cocktail name',
    'Drink', 'drink', 'Drink Name', 'drink name'
  ]);

  // Only require that SOME name exists
  if (!nameField || (typeof nameField === 'string' && nameField.trim().length === 0)) {
    errors.push(`Missing name field. Available columns: ${Object.keys(record).join(', ')}`);
  }

  // If validation failed, return early
  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  // Helper to safely convert to string and trim
  const safeString = (val: any) => val ? String(val).trim() : null;

  // Get ingredients field and convert to array format
  const ingredientsField = findField(record, [
    'ingredients', 'Ingredients', 'INGREDIENTS',
    'Items', 'items', 'Recipe Items', 'recipe items',
    'Components', 'components'
  ]);

  let ingredientsArray: string[] = [];
  if (ingredientsField) {
    const ingredientsStr = String(ingredientsField).trim();
    if (ingredientsStr.length > 0) {
      // Support multiple delimiters: semicolon, pipe, or newline
      if (ingredientsStr.includes(';')) {
        ingredientsArray = ingredientsStr.split(';').map(i => i.trim()).filter(i => i.length > 0);
      } else if (ingredientsStr.includes('|')) {
        ingredientsArray = ingredientsStr.split('|').map(i => i.trim()).filter(i => i.length > 0);
      } else if (ingredientsStr.includes('\n')) {
        ingredientsArray = ingredientsStr.split('\n').map(i => i.trim()).filter(i => i.length > 0);
      } else {
        // Single ingredient or already comma-separated
        ingredientsArray = ingredientsStr.split(',').map(i => i.trim()).filter(i => i.length > 0);
      }
    }
  }

  // Sanitize the data - be very flexible with column names
  const sanitized = {
    name: safeString(nameField),
    ingredients: ingredientsArray,
    instructions: safeString(findField(record, [
      'instructions', 'Instructions', 'INSTRUCTIONS',
      'Method', 'method', 'Directions', 'directions',
      'Steps', 'steps', 'How to Make', 'how to make',
      'Preparation', 'preparation', 'Recipe', 'recipe'
    ])),
    glass: safeString(findField(record, [
      'glass', 'Glass', 'GLASS',
      'Glass Type', 'glass type', 'Glassware', 'glassware',
      'Serve In', 'serve in', 'Serving Glass', 'serving glass'
    ])),
    category: safeString(findField(record, [
      'category', 'Category', 'CATEGORY',
      'Type', 'type', 'Style', 'style',
      'Drink Type', 'drink type', 'Classification', 'classification'
    ])),
  };

  return { isValid: true, errors: [], sanitized };
}

/**
 * POST /api/recipes/import - CSV Import
 *
 * Bulk import recipes from CSV file.
 *
 * Request: multipart/form-data with 'file' field
 *
 * Supported CSV Formats:
 * ```
 * Name,Ingredients,Instructions,Glass,Category
 * "Old Fashioned","2 oz Bourbon; 1 sugar cube; 2 dashes bitters","Muddle sugar...","Rocks glass","Classic"
 * "Margarita","2 oz Tequila | 1 oz Lime juice | 1 oz Cointreau","Shake with ice...","Coupe","Sour"
 * ```
 *
 * Ingredient Delimiters Supported:
 * - Semicolon (;) - Most common
 * - Pipe (|) - Alternative
 * - Newline (\n) - Multi-line
 * - Comma (,) - If no other delimiter found
 *
 * Flexible Column Names:
 * - Name: "name", "Name", "Recipe Name", "Cocktail", "Drink", etc.
 * - Ingredients: "ingredients", "Items", "Components", etc.
 * - Instructions: "instructions", "Method", "Directions", "Steps", etc.
 * - Glass: "glass", "Glass Type", "Glassware", "Serve In", etc.
 * - Category: "category", "Type", "Style", "Drink Type", etc.
 *
 * Response (200 OK):
 * {
 *   "success": true,
 *   "imported": 25,
 *   "failed": 2,
 *   "errors": [
 *     { "row": 3, "error": "Missing required field: name" },
 *     { "row": 7, "error": "Failed to parse ingredients" }
 *   ]
 * }
 *
 * Security:
 * - File size limit: 5MB
 * - Row limit: 1,000 recipes max (prevent DoS)
 * - Same validation as individual recipe creation
 * - Partial success: Import what we can, report errors
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

    // Get optional collection_id from form data
    console.log('📦 Import request body:', req.body);
    console.log('📦 collection_id raw:', req.body.collection_id);

    const collectionId = req.body.collection_id
      ? parseInt(req.body.collection_id, 10)
      : null;

    console.log('📦 collection_id parsed:', collectionId);

    // Validate collection belongs to user if provided
    if (collectionId) {
      const collection = db.prepare(
        'SELECT id FROM collections WHERE id = ? AND user_id = ?'
      ).get(collectionId, userId);

      if (!collection) {
        return res.status(400).json({
          success: false,
          error: 'Collection not found or access denied'
        });
      }
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
        details: 'Maximum 1000 recipes per import'
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
    const recipesForMemMachine: any[] = []; // Collect recipes for batch upload

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const rowNumber = i + 2; // +2 because: 0-indexed + header row

      try {
        // Validate recipe data
        const validation = validateRecipeData(record);

        if (!validation.isValid) {
          errors.push({
            row: rowNumber,
            error: validation.errors.join(', ')
          });
          continue;
        }

        const recipe = validation.sanitized;

        // Convert ingredients array to JSON string for storage
        const ingredientsStr = JSON.stringify(recipe.ingredients);

        // Insert into database
        db.prepare(`
          INSERT INTO recipes (
            user_id, collection_id, name, ingredients, instructions, glass, category
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          userId,
          collectionId,
          recipe.name,
          ingredientsStr,
          recipe.instructions,
          recipe.glass,
          recipe.category
        );

        // Collect recipe for batch upload to MemMachine
        recipesForMemMachine.push({
          name: recipe.name,
          ingredients: recipe.ingredients,
          instructions: recipe.instructions,
          glass: recipe.glass,
          category: recipe.category,
        });

        imported++;
      } catch (error: any) {
        errors.push({
          row: rowNumber,
          error: error.message || 'Failed to import row'
        });
      }
    }

    // Batch upload all recipes to MemMachine (non-blocking)
    if (recipesForMemMachine.length > 0) {
      memoryService.storeUserRecipesBatch(userId, recipesForMemMachine).then(result => {
        // Store UUIDs in database for future deletion
        if (result.uuidMap.size > 0) {
          console.log(`💾 Storing ${result.uuidMap.size} MemMachine UUIDs in database...`);

          // Build batch UPDATE query for efficiency
          const updateStmt = db.prepare('UPDATE recipes SET memmachine_uuid = ? WHERE user_id = ? AND name = ?');
          const updateMany = db.transaction((entries: Array<[string, string]>) => {
            for (const [recipeName, uuid] of entries) {
              updateStmt.run(uuid, userId, recipeName);
            }
          });

          try {
            updateMany(Array.from(result.uuidMap.entries()));
            console.log(`✅ Stored all MemMachine UUIDs in database`);
          } catch (err) {
            console.error('Failed to store MemMachine UUIDs in database:', err);
          }
        }
      }).catch(err => {
        console.error('Failed to batch upload recipes to MemMachine:', err);
      });
    }

    // Return summary
    res.json({
      success: true,
      imported,
      failed: errors.length,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error: any) {
    console.error('Recipe CSV import error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to import CSV',
      details: error.message
    });
  }
});

/**
 * PUT /api/recipes/:id - Update Existing Recipe
 *
 * Updates an existing cocktail recipe in user's collection.
 *
 * URL Parameters:
 * - id: Recipe ID (number)
 *
 * Request Body (all fields optional, only send what needs updating):
 * {
 *   "name": "Old Fashioned (Updated)",
 *   "ingredients": ["2.5 oz Bourbon", "1 sugar cube", "3 dashes bitters"],
 *   "instructions": "Updated instructions...",
 *   "glass": "Rocks glass",
 *   "category": "Classic"
 * }
 *
 * Response (200 OK):
 * {
 *   "success": true,
 *   "data": {
 *     "id": 123,
 *     "user_id": 1,
 *     "name": "Old Fashioned (Updated)",
 *     "ingredients": ["2.5 oz Bourbon", ...],
 *     "instructions": "Updated instructions...",
 *     "glass": "Rocks glass",
 *     "category": "Classic",
 *     "created_at": "2025-11-10T14:32:05.123Z"
 *   }
 * }
 *
 * Error Responses:
 * - 400: Invalid recipe ID, validation failed
 * - 401: Unauthorized (no valid JWT)
 * - 403: Forbidden (recipe belongs to another user)
 * - 404: Recipe not found
 * - 500: Database error
 *
 * Security:
 * - User ownership check: Ensures user can only update their own recipes
 * - Input validation: Same as POST /api/recipes
 * - SQL injection: Parameterized queries only
 */
router.put('/:id', (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    // Validate recipe ID
    const recipeId = parseInt(req.params.id, 10);
    if (isNaN(recipeId) || recipeId <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid recipe ID'
      });
    }

    // Check if recipe exists and belongs to user
    const existingRecipe = db.prepare(
      'SELECT * FROM recipes WHERE id = ? AND user_id = ?'
    ).get(recipeId, userId) as Recipe | undefined;

    if (!existingRecipe) {
      return res.status(404).json({
        success: false,
        error: 'Recipe not found or access denied'
      });
    }

    const updates: any = req.body;

    // Build dynamic UPDATE query based on provided fields
    const fieldsToUpdate: string[] = [];
    const values: any[] = [];

    // Name
    if (updates.name !== undefined) {
      if (typeof updates.name !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Name must be a string'
        });
      }

      const sanitizedName = sanitizeString(updates.name, 255, true);
      if (sanitizedName.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Name cannot be empty after sanitization'
        });
      }

      fieldsToUpdate.push('name = ?');
      values.push(sanitizedName);
    }

    // Ingredients
    if (updates.ingredients !== undefined) {
      let ingredientsStr: string;

      if (updates.ingredients === null) {
        ingredientsStr = '[]';
      } else if (typeof updates.ingredients === 'string') {
        try {
          JSON.parse(updates.ingredients);
          ingredientsStr = updates.ingredients;
        } catch (error) {
          return res.status(400).json({
            success: false,
            error: 'Ingredients string is not valid JSON'
          });
        }
      } else if (Array.isArray(updates.ingredients)) {
        const ingredientsArray = updates.ingredients as any[];
        if (ingredientsArray.length > 100) {
          return res.status(400).json({
            success: false,
            error: 'Too many ingredients (maximum 100)'
          });
        }
        ingredientsStr = JSON.stringify(ingredientsArray);
      } else {
        ingredientsStr = JSON.stringify(updates.ingredients);
      }

      fieldsToUpdate.push('ingredients = ?');
      values.push(ingredientsStr);
    }

    // Instructions
    if (updates.instructions !== undefined) {
      const sanitizedInstructions = updates.instructions
        ? sanitizeString(updates.instructions, 2000, true)
        : null;
      fieldsToUpdate.push('instructions = ?');
      values.push(sanitizedInstructions);
    }

    // Glass
    if (updates.glass !== undefined) {
      const sanitizedGlass = updates.glass
        ? sanitizeString(updates.glass, 100, true)
        : null;
      fieldsToUpdate.push('glass = ?');
      values.push(sanitizedGlass);
    }

    // Category
    if (updates.category !== undefined) {
      const sanitizedCategory = updates.category
        ? sanitizeString(updates.category, 100, true)
        : null;
      fieldsToUpdate.push('category = ?');
      values.push(sanitizedCategory);
    }

    // Collection ID
    if (updates.collection_id !== undefined) {
      const collectionId = updates.collection_id;
      if (collectionId === null || collectionId === undefined || collectionId === '') {
        // Allow setting collection to null
        fieldsToUpdate.push('collection_id = ?');
        values.push(null);
      } else {
        // Validate collection belongs to user
        const validCollectionId = parseInt(collectionId, 10);
        if (isNaN(validCollectionId) || validCollectionId <= 0) {
          return res.status(400).json({
            success: false,
            error: 'Invalid collection ID'
          });
        }

        const collection = db.prepare(
          'SELECT id FROM collections WHERE id = ? AND user_id = ?'
        ).get(validCollectionId, userId);

        if (!collection) {
          return res.status(400).json({
            success: false,
            error: 'Collection not found or access denied'
          });
        }

        fieldsToUpdate.push('collection_id = ?');
        values.push(validCollectionId);
      }
    }

    // If no fields to update, return current recipe
    if (fieldsToUpdate.length === 0) {
      const parsedRecipe = {
        ...existingRecipe,
        ingredients: JSON.parse(existingRecipe.ingredients as string)
      };
      return res.json({
        success: true,
        data: parsedRecipe
      });
    }

    // Add recipe ID to end of values array
    values.push(recipeId);

    // Execute UPDATE query
    const updateQuery = `UPDATE recipes SET ${fieldsToUpdate.join(', ')} WHERE id = ?`;
    db.prepare(updateQuery).run(...values);

    // Fetch updated recipe
    const updatedRecipe = db.prepare(
      'SELECT * FROM recipes WHERE id = ?'
    ).get(recipeId) as Recipe;

    // Parse ingredients for response
    const parsedRecipe = {
      ...updatedRecipe,
      ingredients: JSON.parse(updatedRecipe.ingredients as string)
    };

    res.json({
      success: true,
      data: parsedRecipe
    });
  } catch (error) {
    console.error('Update recipe error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update recipe'
    });
  }
});

/**
 * POST /api/recipes/memmachine/sync - Sync MemMachine with AlcheMix Database
 *
 * Performs a complete synchronization of MemMachine with the current recipe database:
 * 1. Clears all recipe memories from MemMachine
 * 2. Fetches all current recipes from AlcheMix database
 * 3. Re-uploads all recipes in batches (with timeout prevention)
 * 4. Returns sync statistics
 *
 * Use Cases:
 * - After bulk deletions (clean up orphaned memories)
 * - Monthly maintenance (keep MemMachine clean)
 * - Before major imports (start fresh)
 * - Recover from sync issues
 *
 * IMPORTANT: This route must come BEFORE other routes to avoid conflicts.
 *
 * Response (200 OK):
 * {
 *   "success": true,
 *   "message": "MemMachine synced successfully",
 *   "stats": {
 *     "cleared": true,
 *     "recipesInDB": 150,
 *     "uploaded": 150,
 *     "failed": 0
 *   }
 * }
 */
router.post('/memmachine/sync', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    console.log(`🔄 User ${userId} requested MemMachine sync - starting cleanup...`);

    // Step 1: Clear all existing recipe memories from MemMachine
    const cleared = await memoryService.deleteAllRecipeMemories(userId);

    if (!cleared) {
      return res.status(500).json({
        success: false,
        error: 'Failed to clear MemMachine memories'
      });
    }

    console.log(`✅ Step 1/3: Cleared MemMachine for user ${userId}`);

    // Step 2: Fetch all current recipes from AlcheMix database
    const recipes = db.prepare(`
      SELECT name, ingredients, instructions, glass, category
      FROM recipes
      WHERE user_id = ?
      ORDER BY created_at DESC
    `).all(userId) as Array<{
      name: string;
      ingredients: string;
      instructions: string | null;
      glass: string | null;
      category: string | null;
    }>;

    console.log(`✅ Step 2/3: Fetched ${recipes.length} recipes from database`);

    if (recipes.length === 0) {
      return res.json({
        success: true,
        message: 'MemMachine synced (no recipes to upload)',
        stats: {
          cleared: true,
          recipesInDB: 0,
          uploaded: 0,
          failed: 0
        }
      });
    }

    // Step 3: Re-upload all recipes to MemMachine in batches
    const recipesForUpload = recipes.map(recipe => {
      // Parse ingredients from JSON string
      let ingredientsParsed;
      try {
        ingredientsParsed = JSON.parse(recipe.ingredients);
      } catch {
        ingredientsParsed = recipe.ingredients;
      }

      return {
        name: recipe.name,
        ingredients: ingredientsParsed,
        instructions: recipe.instructions || undefined,
        glass: recipe.glass || undefined,
        category: recipe.category || undefined,
      };
    });

    console.log(`🔄 Step 3/3: Uploading ${recipesForUpload.length} recipes to MemMachine...`);

    const uploadResult = await memoryService.storeUserRecipesBatch(userId, recipesForUpload);

    console.log(`✅ MemMachine sync complete for user ${userId}: ${uploadResult.success} succeeded, ${uploadResult.failed} failed`);

    res.json({
      success: true,
      message: `MemMachine synced successfully - ${uploadResult.success} recipes uploaded`,
      stats: {
        cleared: true,
        recipesInDB: recipes.length,
        uploaded: uploadResult.success,
        failed: uploadResult.failed
      }
    });

  } catch (error) {
    console.error('MemMachine sync error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sync MemMachine'
    });
  }
});

/**
 * DELETE /api/recipes/memmachine/clear - Clear All MemMachine Recipe Memories
 *
 * Deletes ALL recipe memories from MemMachine for the authenticated user.
 * This does NOT delete recipes from AlcheMix database - only MemMachine.
 *
 * Use Case: Clean slate before re-uploading with UUID tracking
 *
 * IMPORTANT: This route must come BEFORE other routes to avoid conflicts.
 *
 * Response (200 OK):
 * {
 *   "success": true,
 *   "message": "Cleared all recipe memories from MemMachine"
 * }
 */
router.delete('/memmachine/clear', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    console.log(`🧹 User ${userId} requested MemMachine recipe memory cleanup`);

    // Delete all recipe memories from MemMachine
    const success = await memoryService.deleteAllRecipeMemories(userId);

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
  } catch (error) {
    console.error('Clear MemMachine memories error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear MemMachine memories'
    });
  }
});

/**
 * Helper: Auto-Sync MemMachine (Background)
 *
 * Triggers a background sync of MemMachine when significant changes occur.
 * Fire-and-forget pattern - doesn't block the response.
 *
 * Triggers:
 * - After bulk deletions (10+ recipes)
 * - After "delete all" operation
 * - After large CSV imports (100+ recipes)
 */
async function autoSyncMemMachine(userId: number, reason: string) {
  console.log(`🔄 Auto-triggering MemMachine sync for user ${userId} (reason: ${reason})`);

  try {
    // Step 1: Clear MemMachine
    const cleared = await memoryService.deleteAllRecipeMemories(userId);
    if (!cleared) {
      console.error(`❌ Auto-sync failed: Could not clear MemMachine for user ${userId}`);
      return;
    }

    // Step 2: Fetch current recipes
    const recipes = db.prepare(`
      SELECT name, ingredients, instructions, glass, category
      FROM recipes
      WHERE user_id = ?
      ORDER BY created_at DESC
    `).all(userId) as Array<{
      name: string;
      ingredients: string;
      instructions: string | null;
      glass: string | null;
      category: string | null;
    }>;

    if (recipes.length === 0) {
      console.log(`✅ Auto-sync complete: No recipes to upload for user ${userId}`);
      return;
    }

    // Step 3: Re-upload in batches
    const recipesForUpload = recipes.map(recipe => {
      let ingredientsParsed;
      try {
        ingredientsParsed = JSON.parse(recipe.ingredients);
      } catch {
        ingredientsParsed = recipe.ingredients;
      }

      return {
        name: recipe.name,
        ingredients: ingredientsParsed,
        instructions: recipe.instructions || undefined,
        glass: recipe.glass || undefined,
        category: recipe.category || undefined,
      };
    });

    const uploadResult = await memoryService.storeUserRecipesBatch(userId, recipesForUpload);

    console.log(`✅ Auto-sync complete for user ${userId}: ${uploadResult.success} recipes uploaded, ${uploadResult.failed} failed`);
  } catch (error) {
    console.error(`❌ Auto-sync error for user ${userId}:`, error);
  }
}

/**
 * DELETE /api/recipes/all - Delete All User Recipes
 *
 * Deletes all recipes for the authenticated user.
 * Useful for clearing duplicates before re-importing CSV.
 *
 * AUTO-SYNC: Triggers background MemMachine sync after deletion.
 *
 * IMPORTANT: This route must come BEFORE /:id route to avoid
 * Express matching "all" as an ID parameter.
 *
 * Response (200 OK):
 * {
 *   "success": true,
 *   "deleted": 150,
 *   "message": "Deleted 150 recipes"
 * }
 */
router.delete('/all', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    // Delete all recipes for this user (CASCADE will handle favorites)
    const result = db.prepare('DELETE FROM recipes WHERE user_id = ?').run(userId);

    // Auto-sync MemMachine in background (fire-and-forget)
    autoSyncMemMachine(userId, 'delete all recipes').catch(err => {
      console.error('Auto-sync error (non-critical):', err);
    });

    res.json({
      success: true,
      deleted: result.changes,
      message: `Deleted ${result.changes} ${result.changes === 1 ? 'recipe' : 'recipes'}`
    });
  } catch (error) {
    console.error('Delete all recipes error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete recipes'
    });
  }
});

/**
 * DELETE /api/recipes/bulk - Delete Multiple Recipes
 *
 * Accepts an array of recipe IDs and deletes them in a single request.
 * Helps users clean up large imports without hitting user-level rate limits.
 */
router.delete('/bulk', (req: Request, res: Response) => {
  try {
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

    // Get MemMachine UUIDs for recipes before deletion
    const placeholders = sanitizedIds.map(() => '?').join(', ');
    const selectStatement = db.prepare(`
      SELECT memmachine_uuid FROM recipes
      WHERE user_id = ?
      AND id IN (${placeholders})
      AND memmachine_uuid IS NOT NULL
    `);

    const recipesToDelete = selectStatement.all(userId, ...sanitizedIds) as Array<{ memmachine_uuid: string }>;
    const uuidsToDelete = recipesToDelete.map(r => r.memmachine_uuid).filter(Boolean);

    console.log(`🗑️ Bulk delete: Deleting ${sanitizedIds.length} recipes (${uuidsToDelete.length} have MemMachine UUIDs)`);

    // Delete from database
    const deleteStatement = db.prepare(`
      DELETE FROM recipes
      WHERE user_id = ?
      AND id IN (${placeholders})
    `);

    const result = deleteStatement.run(userId, ...sanitizedIds);
    console.log(`✅ Deleted ${result.changes} recipes from database`);

    // Auto-sync MemMachine if bulk deletion (10+ recipes)
    if (result.changes >= 10) {
      console.log(`📊 Bulk deletion detected (${result.changes} recipes) - triggering auto-sync...`);
      autoSyncMemMachine(userId, `bulk delete ${result.changes} recipes`).catch(err => {
        console.error('Auto-sync error (non-critical):', err);
      });
    } else if (uuidsToDelete.length > 0) {
      // For smaller deletions, just try to delete from MemMachine (though UUIDs are always null)
      console.log(`🔄 Starting MemMachine batch deletion for ${uuidsToDelete.length} UUIDs...`);
      memoryService.deleteUserRecipesBatch(userId, uuidsToDelete).catch(err => {
        console.error('Failed to batch delete recipes from MemMachine:', err);
      });
    } else {
      console.log(`ℹ️ No MemMachine UUIDs found - recipes were created before UUID tracking`);
    }

    res.json({
      success: true,
      deleted: result.changes,
    });
  } catch (error) {
    console.error('Bulk delete recipes error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete recipes'
    });
  }
});

/**
 * DELETE /api/recipes/:id - Delete Recipe
 *
 * Deletes a cocktail recipe from user's collection.
 *
 * URL Parameters:
 * - id: Recipe ID (number)
 *
 * Response (200 OK):
 * {
 *   "success": true,
 *   "message": "Recipe deleted successfully"
 * }
 *
 * Error Responses:
 * - 400: Invalid recipe ID
 * - 401: Unauthorized (no valid JWT)
 * - 403: Forbidden (recipe belongs to another user)
 * - 404: Recipe not found
 * - 500: Database error
 *
 * Security:
 * - User ownership check: Ensures user can only delete their own recipes
 * - Cascade delete: Foreign key constraints handle favorites cleanup
 */
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    // Validate recipe ID
    const recipeId = parseInt(req.params.id, 10);
    if (isNaN(recipeId) || recipeId <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid recipe ID'
      });
    }

    // Check if recipe exists and belongs to user (get name and UUID for MemMachine deletion)
    const existingRecipe = db.prepare(
      'SELECT id, name, memmachine_uuid FROM recipes WHERE id = ? AND user_id = ?'
    ).get(recipeId, userId) as { id: number; name: string; memmachine_uuid: string | null } | undefined;

    if (!existingRecipe) {
      return res.status(404).json({
        success: false,
        error: 'Recipe not found or access denied'
      });
    }

    console.log(`🗑️ Deleting recipe "${existingRecipe.name}" (UUID: ${existingRecipe.memmachine_uuid || 'none'})`);

    // Delete recipe (CASCADE will handle favorites)
    db.prepare('DELETE FROM recipes WHERE id = ?').run(recipeId);
    console.log(`✅ Deleted recipe from database`);

    // Delete from MemMachine using UUID (if available)
    if (existingRecipe.memmachine_uuid) {
      console.log(`🔄 Deleting recipe from MemMachine with UUID: ${existingRecipe.memmachine_uuid}`);
      memoryService.deleteUserRecipeByUuid(userId, existingRecipe.memmachine_uuid, existingRecipe.name).catch(err => {
        console.error('Failed to delete recipe from MemMachine:', err);
      });
    } else {
      // Legacy recipe without UUID
      console.log(`ℹ️ Recipe has no UUID - created before UUID tracking (data remains in MemMachine)`);
      memoryService.deleteUserRecipe(userId, existingRecipe.name);
    }

    res.json({
      success: true,
      message: 'Recipe deleted successfully'
    });
  } catch (error) {
    console.error('Delete recipe error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete recipe'
    });
  }
});

/**
 * Export Recipes Router
 *
 * Mounted at /api/recipes in server.ts:
 * - GET    /api/recipes          - List recipes (paginated)
 * - POST   /api/recipes          - Add recipe
 * - PUT    /api/recipes/:id      - Update recipe
 * - DELETE /api/recipes/:id      - Delete recipe
 * - DELETE /api/recipes/all      - Delete all recipes
 * - POST   /api/recipes/import   - CSV import
 *
 * All routes require authentication (authMiddleware applied to router).
 *
 * Future Enhancements (Phase 3+):
 * - GET /api/recipes/search    - Search recipes by name/ingredient
 * - GET /api/recipes/:id       - Get single recipe details
 */
export default router;
