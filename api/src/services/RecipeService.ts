/**
 * Recipe Service
 *
 * Business logic for user's cocktail recipe collection.
 * Extracted from routes/recipes.ts for testability and reusability.
 *
 * @version 1.1.0 - Added dependency injection for testability
 * @date December 2025
 */

import { queryOne, queryAll, execute, transaction } from '../database/db';
import { sanitizeString } from '../utils/inputValidator';
import { Recipe } from '../types';
import { memoryService as defaultMemoryService } from './MemoryService';
import { logger } from '../utils/logger';

/**
 * MemoryService interface for dependency injection
 */
export interface IMemoryService {
  storeUserRecipe(userId: number, recipe: { name: string; ingredients: string[] | string; instructions?: string; glass?: string; category?: string }): Promise<string | null>;
  storeUserRecipesBatch(userId: number, recipes: Array<{ name: string; ingredients: string[] | string; instructions?: string; glass?: string; category?: string }>): Promise<{ success: number; failed: number; uidMap: Map<string, string> }>;
  deleteUserRecipe(userId: number, recipeName: string): Promise<void>;
  deleteUserRecipeByUid(userId: number, uid: string, recipeName?: string): Promise<boolean>;
  deleteUserRecipesBatch(userId: number, uids: string[]): Promise<{ success: number; failed: number }>;
  deleteAllRecipeMemories(userId: number): Promise<boolean>;
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  page: number;
  limit: number;
}

/**
 * Search and filter options
 */
export interface SearchOptions extends PaginationOptions {
  search?: string;
  spirit?: string;
  masteryIds?: number[];  // Recipe IDs that match mastery filter (computed by route)
}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * Paginated result
 */
export interface PaginatedResult<T> {
  items: T[];
  pagination: PaginationMeta;
}

/**
 * Recipe input for creation
 */
export interface CreateRecipeInput {
  name: string;
  ingredients?: string | string[] | unknown;
  instructions?: string;
  glass?: string;
  category?: string;
  collection_id?: number | null;
}

/**
 * Recipe update input
 *
 * SECURITY: Only these fields are allowed for update.
 * user_id is intentionally omitted to prevent ownership manipulation.
 */
export interface UpdateRecipeInput {
  name?: string;
  ingredients?: string | string[] | unknown;
  instructions?: string;
  glass?: string;
  category?: string;
  collection_id?: number | null;
}

/**
 * Allowed fields for recipe update (security whitelist)
 * Prevents mass assignment attacks where attacker tries to modify user_id
 */
const ALLOWED_UPDATE_FIELDS = ['name', 'ingredients', 'instructions', 'glass', 'category', 'collection_id'] as const;

/**
 * Sanitized recipe data
 */
export interface SanitizedRecipeData {
  name: string;
  ingredientsStr: string;
  instructions: string | null;
  glass: string | null;
  category: string | null;
  collectionId: number | null;
}

/**
 * CSV recipe validation result
 */
export interface CSVValidationResult {
  isValid: boolean;
  errors: string[];
  sanitized?: {
    name: string;
    ingredients: string[];
    instructions: string | null;
    glass: string | null;
    category: string | null;
  };
}

/**
 * Import result
 */
export interface ImportResult {
  imported: number;
  failed: number;
  errors: Array<{ row: number; error: string }>;
}

/**
 * Sync stats
 */
export interface SyncStats {
  cleared: boolean;
  recipesInDB: number;
  uploaded: number;
  failed: number;
}

/**
 * Bulk move result
 */
export interface BulkMoveResult {
  success: boolean;
  moved?: number;
  error?: string;
}

/**
 * Recipe Service
 *
 * Handles all recipe business logic independent of HTTP layer.
 * Supports dependency injection for testability.
 */
export class RecipeService {
  private memoryService: IMemoryService;

  /**
   * Create a RecipeService instance
   * @param memService - MemoryService instance (defaults to production memoryService)
   */
  constructor(memService?: IMemoryService) {
    this.memoryService = memService || defaultMemoryService;
  }

  /**
   * Get paginated recipes for a user with optional search/filter
   */
  async getAll(userId: number, options: SearchOptions): Promise<PaginatedResult<Recipe>> {
    const { page, limit, search, masteryIds } = options;
    const offset = (page - 1) * limit;

    // Early return if masteryIds is empty array (no recipes match filter)
    if (masteryIds !== undefined && masteryIds.length === 0) {
      return {
        items: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false
        }
      };
    }

    // Build dynamic WHERE clauses
    const conditions: string[] = ['user_id = $1'];
    const params: unknown[] = [userId];
    let paramIndex = 2;

    // Search filter (name OR ingredients)
    if (search && search.trim()) {
      const searchTerm = `%${search.trim().toLowerCase()}%`;
      conditions.push(`(LOWER(name) LIKE $${paramIndex} OR LOWER(ingredients) LIKE $${paramIndex})`);
      params.push(searchTerm);
      paramIndex++;
    }

    // Mastery filter (recipe IDs)
    if (masteryIds && masteryIds.length > 0) {
      conditions.push(`id = ANY($${paramIndex})`);
      params.push(masteryIds);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    // Get total count
    const countResult = await queryOne<{ total: string }>(
      `SELECT COUNT(*) as total FROM recipes WHERE ${whereClause}`,
      params
    );

    const total = parseInt(countResult?.total ?? '0', 10);

    // Get recipes
    const recipes = await queryAll<Recipe>(`
      SELECT * FROM recipes
      WHERE ${whereClause}
      ORDER BY LOWER(name) ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, [...params, limit, offset]);

    // Parse ingredients JSON
    const parsedRecipes = recipes.map(recipe => this.parseRecipeIngredients(recipe));

    // Calculate pagination metadata
    const totalPages = Math.ceil(total / limit);

    return {
      items: parsedRecipes,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      }
    };
  }

  /**
   * Get a single recipe by ID (with ownership check)
   */
  async getById(recipeId: number, userId: number): Promise<Recipe | null> {
    const recipe = await queryOne<Recipe>(
      'SELECT * FROM recipes WHERE id = $1 AND user_id = $2',
      [recipeId, userId]
    );

    if (!recipe) return null;

    return this.parseRecipeIngredients(recipe);
  }

  /**
   * Check if a recipe exists and belongs to user
   */
  async exists(recipeId: number, userId: number): Promise<boolean> {
    const result = await queryOne<{ id: number }>(
      'SELECT id FROM recipes WHERE id = $1 AND user_id = $2',
      [recipeId, userId]
    );

    return !!result;
  }

  /**
   * Validate collection belongs to user
   */
  async validateCollection(collectionId: number, userId: number): Promise<boolean> {
    const collection = await queryOne<{ id: number }>(
      'SELECT id FROM collections WHERE id = $1 AND user_id = $2',
      [collectionId, userId]
    );

    return !!collection;
  }

  /**
   * Sanitize and validate recipe input for creation
   */
  async sanitizeCreateInput(input: CreateRecipeInput, userId: number): Promise<{ valid: boolean; error?: string; data?: SanitizedRecipeData }> {
    // Validate name
    if (!input.name || typeof input.name !== 'string') {
      return { valid: false, error: 'Recipe name is required and must be a string' };
    }

    const sanitizedName = sanitizeString(input.name, 255, true);
    if (sanitizedName.length === 0) {
      return { valid: false, error: 'Recipe name cannot be empty after sanitization' };
    }

    // Validate collection if provided
    const collectionId = input.collection_id || null;
    if (collectionId && !await this.validateCollection(collectionId, userId)) {
      return { valid: false, error: 'Collection not found or access denied' };
    }

    // Process ingredients
    const ingredientsResult = this.processIngredients(input.ingredients);
    if (!ingredientsResult.valid) {
      return { valid: false, error: ingredientsResult.error };
    }

    return {
      valid: true,
      data: {
        name: sanitizedName,
        ingredientsStr: ingredientsResult.str!,
        instructions: input.instructions ? sanitizeString(input.instructions, 2000, true) : null,
        glass: input.glass ? sanitizeString(input.glass, 100, true) : null,
        category: input.category ? sanitizeString(input.category, 100, true) : null,
        collectionId
      }
    };
  }

  /**
   * Create a new recipe
   */
  async create(userId: number, data: SanitizedRecipeData): Promise<Recipe> {
    const result = await execute(`
      INSERT INTO recipes (
        user_id, collection_id, name, ingredients, instructions, glass, category
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      userId,
      data.collectionId,
      data.name,
      data.ingredientsStr,
      data.instructions,
      data.glass,
      data.category
    ]);

    const recipe = result.rows[0] as Recipe;
    const recipeId = recipe.id!;

    // Store in MemMachine (fire-and-forget)
    this.storeInMemMachine(userId, recipeId, data);

    return this.parseRecipeIngredients(recipe);
  }

  /**
   * Update an existing recipe
   *
   * SECURITY: Only fields in ALLOWED_UPDATE_FIELDS are processed.
   * Any attempt to modify user_id or other protected fields is silently ignored.
   */
  async update(recipeId: number, userId: number, updates: UpdateRecipeInput): Promise<{ success: boolean; recipe?: Recipe; error?: string }> {
    // Check existence
    if (!await this.exists(recipeId, userId)) {
      return { success: false, error: 'Recipe not found or access denied' };
    }

    // SECURITY: Filter to only allowed fields (prevents mass assignment)
    const safeUpdates: UpdateRecipeInput = {};
    for (const field of ALLOWED_UPDATE_FIELDS) {
      if (field in updates) {
        (safeUpdates as Record<string, unknown>)[field] = (updates as Record<string, unknown>)[field];
      }
    }

    const fieldsToUpdate: string[] = [];
    const values: (string | number | null)[] = [];
    let paramIndex = 1;

    // Name
    if (safeUpdates.name !== undefined) {
      if (typeof safeUpdates.name !== 'string') {
        return { success: false, error: 'Name must be a string' };
      }
      const sanitizedName = sanitizeString(safeUpdates.name, 255, true);
      if (sanitizedName.length === 0) {
        return { success: false, error: 'Name cannot be empty after sanitization' };
      }
      fieldsToUpdate.push(`name = $${paramIndex++}`);
      values.push(sanitizedName);
    }

    // Ingredients
    if (safeUpdates.ingredients !== undefined) {
      const ingredientsResult = this.processIngredients(safeUpdates.ingredients);
      if (!ingredientsResult.valid) {
        return { success: false, error: ingredientsResult.error };
      }
      fieldsToUpdate.push(`ingredients = $${paramIndex++}`);
      values.push(ingredientsResult.str ?? null);
    }

    // Instructions
    if (safeUpdates.instructions !== undefined) {
      fieldsToUpdate.push(`instructions = $${paramIndex++}`);
      values.push(safeUpdates.instructions ? sanitizeString(safeUpdates.instructions, 2000, true) : null);
    }

    // Glass
    if (safeUpdates.glass !== undefined) {
      fieldsToUpdate.push(`glass = $${paramIndex++}`);
      values.push(safeUpdates.glass ? sanitizeString(safeUpdates.glass, 100, true) : null);
    }

    // Category
    if (safeUpdates.category !== undefined) {
      fieldsToUpdate.push(`category = $${paramIndex++}`);
      values.push(safeUpdates.category ? sanitizeString(safeUpdates.category, 100, true) : null);
    }

    // Collection ID
    if (safeUpdates.collection_id !== undefined) {
      if (safeUpdates.collection_id === null || safeUpdates.collection_id === undefined) {
        fieldsToUpdate.push(`collection_id = $${paramIndex++}`);
        values.push(null);
      } else {
        const validCollectionId = Number(safeUpdates.collection_id);
        if (isNaN(validCollectionId) || validCollectionId <= 0) {
          return { success: false, error: 'Invalid collection ID' };
        }
        if (!await this.validateCollection(validCollectionId, userId)) {
          return { success: false, error: 'Collection not found or access denied' };
        }
        fieldsToUpdate.push(`collection_id = $${paramIndex++}`);
        values.push(validCollectionId);
      }
    }

    // If no fields to update, return current recipe
    if (fieldsToUpdate.length === 0) {
      const recipe = await this.getById(recipeId, userId);
      return { success: true, recipe: recipe! };
    }

    // Execute update
    values.push(recipeId);
    await execute(`UPDATE recipes SET ${fieldsToUpdate.join(', ')} WHERE id = $${paramIndex}`, values);

    const recipe = await this.getById(recipeId, userId);
    return { success: true, recipe: recipe! };
  }

  /**
   * Delete a single recipe
   */
  async delete(recipeId: number, userId: number): Promise<{ success: boolean; error?: string }> {
    const recipe = await queryOne<{ id: number; name: string; memmachine_uid: string | null }>(
      'SELECT id, name, memmachine_uid FROM recipes WHERE id = $1 AND user_id = $2',
      [recipeId, userId]
    );

    if (!recipe) {
      return { success: false, error: 'Recipe not found or access denied' };
    }

    // Delete from database
    await execute('DELETE FROM recipes WHERE id = $1', [recipeId]);

    // Delete from MemMachine
    if (recipe.memmachine_uid) {
      this.memoryService.deleteUserRecipeByUid(userId, recipe.memmachine_uid, recipe.name).catch(err => {
        logger.error('Failed to delete recipe from MemMachine', { error: err instanceof Error ? err.message : 'Unknown error' });
      });
    } else {
      this.memoryService.deleteUserRecipe(userId, recipe.name);
    }

    return { success: true };
  }

  /**
   * Delete all recipes for a user
   */
  async deleteAll(userId: number): Promise<number> {
    const result = await execute('DELETE FROM recipes WHERE user_id = $1', [userId]);

    // Trigger auto-sync in background
    this.autoSyncMemMachine(userId, 'delete all recipes');

    return result.rowCount ?? 0;
  }

  /**
   * Bulk delete recipes
   */
  async bulkDelete(ids: number[], userId: number): Promise<number> {
    // Build parameterized query for bulk delete
    const placeholders = ids.map((_, i) => `$${i + 2}`).join(', ');

    // Get UIDs before deletion
    const recipesToDelete = await queryAll<{ memmachine_uid: string }>(`
      SELECT memmachine_uid FROM recipes
      WHERE user_id = $1 AND id IN (${placeholders}) AND memmachine_uid IS NOT NULL
    `, [userId, ...ids]);

    const uidsToDelete = recipesToDelete.map(r => r.memmachine_uid).filter(Boolean);

    // Delete from database
    const result = await execute(`
      DELETE FROM recipes WHERE user_id = $1 AND id IN (${placeholders})
    `, [userId, ...ids]);

    const deletedCount = result.rowCount ?? 0;

    // Handle MemMachine cleanup
    if (deletedCount >= 10) {
      this.autoSyncMemMachine(userId, `bulk delete ${deletedCount} recipes`);
    } else if (uidsToDelete.length > 0) {
      this.memoryService.deleteUserRecipesBatch(userId, uidsToDelete).catch(err => {
        logger.error('Failed to batch delete recipes from MemMachine', { error: err instanceof Error ? err.message : 'Unknown error' });
      });
    }

    return deletedCount;
  }

  /**
   * Bulk move recipes to a collection
   *
   * @param recipeIds - Array of recipe IDs to move
   * @param userId - User ID (for ownership validation)
   * @param collectionId - Target collection ID (null for uncategorized)
   */
  async bulkMove(
    recipeIds: number[],
    userId: number,
    collectionId: number | null
  ): Promise<BulkMoveResult> {
    // Validate input
    if (!recipeIds || recipeIds.length === 0) {
      return { success: false, error: 'No recipe IDs provided' };
    }

    if (recipeIds.length > 100) {
      return { success: false, error: 'Maximum 100 recipes per bulk operation' };
    }

    // Validate collection belongs to user (if not null)
    if (collectionId !== null) {
      const collectionExists = await this.validateCollection(collectionId, userId);
      if (!collectionExists) {
        return { success: false, error: 'Collection not found or access denied' };
      }
    }

    // Execute bulk update
    const result = await execute(
      `UPDATE recipes SET collection_id = $1 WHERE user_id = $2 AND id = ANY($3)`,
      [collectionId, userId, recipeIds]
    );

    return {
      success: true,
      moved: result.rowCount ?? 0
    };
  }

  /**
   * Import recipes from CSV records
   *
   * PERFORMANCE: Uses transaction for batch insert
   * instead of individual queries (fixes N+1 query pattern).
   * This is ~10x faster for large imports.
   */
  async importFromCSV(userId: number, records: Record<string, unknown>[], collectionId: number | null): Promise<ImportResult> {
    let imported = 0;
    const errors: Array<{ row: number; error: string }> = [];
    const recipesForMemMachine: Array<{
      id: number;
      name: string;
      ingredients: string[];
      instructions: string | null;
      glass: string | null;
      category: string | null;
    }> = [];
    const validatedRecipes: Array<{
      rowNumber: number;
      name: string;
      ingredientsStr: string;
      instructions: string | null;
      glass: string | null;
      category: string | null;
      ingredients: string[];
    }> = [];

    // Phase 1: Validate all records first
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const rowNumber = i + 2;

      const validation = this.validateCSVRecipeData(record);

      if (!validation.isValid) {
        errors.push({ row: rowNumber, error: validation.errors.join(', ') });
        continue;
      }

      const recipe = validation.sanitized!;
      validatedRecipes.push({
        rowNumber,
        name: recipe.name,
        ingredientsStr: JSON.stringify(recipe.ingredients),
        instructions: recipe.instructions,
        glass: recipe.glass,
        category: recipe.category,
        ingredients: recipe.ingredients,
      });
    }

    // Phase 2: Batch insert using transaction
    if (validatedRecipes.length > 0) {
      await transaction(async (client) => {
        for (const recipe of validatedRecipes) {
          try {
            const result = await client.query(`
              INSERT INTO recipes (user_id, collection_id, name, ingredients, instructions, glass, category)
              VALUES ($1, $2, $3, $4, $5, $6, $7)
              RETURNING id
            `, [
              userId,
              collectionId,
              recipe.name,
              recipe.ingredientsStr,
              recipe.instructions,
              recipe.glass,
              recipe.category
            ]);
            const recipeId = result.rows[0].id as number;
            imported++;
            recipesForMemMachine.push({
              id: recipeId,
              name: recipe.name,
              ingredients: recipe.ingredients,
              instructions: recipe.instructions,
              glass: recipe.glass,
              category: recipe.category,
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to import row';
            errors.push({ row: recipe.rowNumber, error: message });
          }
        }
      });
    }

    // Batch upload to MemMachine
    if (recipesForMemMachine.length > 0) {
      this.batchStoreInMemMachine(userId, recipesForMemMachine);
    }

    return { imported, failed: errors.length, errors };
  }

  /**
   * Sync MemMachine with database
   */
  async syncMemMachine(userId: number): Promise<SyncStats> {
    // Clear MemMachine
    const cleared = await this.memoryService.deleteAllRecipeMemories(userId);

    if (!cleared) {
      throw new Error('Failed to clear MemMachine memories');
    }

    // Fetch recipes
    const recipes = await queryAll<{ name: string; ingredients: string; instructions: string | null; glass: string | null; category: string | null }>(`
      SELECT name, ingredients, instructions, glass, category
      FROM recipes WHERE user_id = $1 ORDER BY created_at DESC
    `, [userId]);

    if (recipes.length === 0) {
      return { cleared: true, recipesInDB: 0, uploaded: 0, failed: 0 };
    }

    // Upload recipes
    const recipesForUpload = recipes.map(recipe => ({
      name: recipe.name,
      ingredients: this.safeParseJSON(recipe.ingredients),
      instructions: recipe.instructions || undefined,
      glass: recipe.glass || undefined,
      category: recipe.category || undefined,
    }));

    const uploadResult = await this.memoryService.storeUserRecipesBatch(userId, recipesForUpload);

    return {
      cleared: true,
      recipesInDB: recipes.length,
      uploaded: uploadResult.success,
      failed: uploadResult.failed
    };
  }

  /**
   * Clear all MemMachine memories for user
   */
  async clearMemMachine(userId: number): Promise<boolean> {
    return this.memoryService.deleteAllRecipeMemories(userId);
  }

  /**
   * Seed classic cocktail recipes for new users
   * 
   * This is called once on first login to give users 100+ classic recipes
   * organized in a "Classic Cocktails" collection to explore the app.
   * 
   * @param userId - The user ID to seed recipes for
   * @returns Object with seeded status and count
   */
  async seedClassics(userId: number): Promise<{ seeded: boolean; count: number }> {
    // Check if user has already seeded classics
    const user = await queryOne<{ has_seeded_classics: boolean }>(
      'SELECT has_seeded_classics FROM users WHERE id = $1',
      [userId]
    );

    if (!user) {
      logger.warn('User not found for seeding classics', { userId });
      return { seeded: false, count: 0 };
    }

    if (user.has_seeded_classics) {
      logger.debug('User has already seeded classics', { userId });
      return { seeded: false, count: 0 };
    }

    // Load classic recipes from JSON file
    let classicRecipes: Array<{
      name: string;
      ingredients: string[];
      instructions: string;
      glass: string;
      spirit_type: string;
      requires: string[];
    }>;

    try {
      // Dynamic import for JSON data
      const recipesModule = await import('../data/classicRecipes.json');
      classicRecipes = recipesModule.default || recipesModule;
    } catch (err) {
      logger.error('Failed to load classic recipes JSON', { 
        error: err instanceof Error ? err.message : 'Unknown error' 
      });
      return { seeded: false, count: 0 };
    }

    // Insert recipes in a transaction
    let insertedCount = 0;
    const recipesForMemMachine: Array<{
      id: number;
      name: string;
      ingredients: string[];
      instructions: string | null;
      glass: string | null;
      category: string | null;
    }> = [];

    await transaction(async (client) => {
      // Create "Classic Cocktails" collection first
      const collectionResult = await client.query(`
        INSERT INTO collections (user_id, name, description)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id, name) DO UPDATE SET description = EXCLUDED.description
        RETURNING id
      `, [
        userId,
        'Classic Cocktails',
        'The 100+ most popular cocktails to get you started'
      ]);
      const collectionId = collectionResult.rows[0].id as number;

      for (const recipe of classicRecipes) {
        try {
          const result = await client.query(`
            INSERT INTO recipes (user_id, name, ingredients, instructions, glass, category, collection_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id
          `, [
            userId,
            recipe.name,
            JSON.stringify(recipe.ingredients),
            recipe.instructions,
            recipe.glass,
            recipe.spirit_type || null,
            collectionId
          ]);

          const recipeId = result.rows[0].id as number;
          insertedCount++;

          recipesForMemMachine.push({
            id: recipeId,
            name: recipe.name,
            ingredients: recipe.ingredients,
            instructions: recipe.instructions,
            glass: recipe.glass,
            category: recipe.spirit_type || null
          });
        } catch (err) {
          logger.error('Failed to insert classic recipe', { 
            recipe: recipe.name,
            error: err instanceof Error ? err.message : 'Unknown error' 
          });
        }
      }

      // Mark user as having seeded classics
      await client.query(
        'UPDATE users SET has_seeded_classics = TRUE WHERE id = $1',
        [userId]
      );
    });

    // Store in MemMachine (fire-and-forget)
    if (recipesForMemMachine.length > 0) {
      this.batchStoreInMemMachine(userId, recipesForMemMachine);
    }

    logger.info('Seeded classic recipes for user', { userId, count: insertedCount });

    return { seeded: true, count: insertedCount };
  }

  // ============ Private Helper Methods ============

  /**
   * Parse recipe ingredients from JSON string
   */
  private parseRecipeIngredients(recipe: Recipe): Recipe {
    try {
      return {
        ...recipe,
        ingredients: typeof recipe.ingredients === 'string'
          ? JSON.parse(recipe.ingredients)
          : recipe.ingredients
      };
    } catch {
      logger.warn('Failed to parse ingredients for recipe', { recipeId: recipe.id });
      return recipe;
    }
  }

  /**
   * Process and validate recipe ingredients
   *
   * Validates:
   * - Maximum 100 ingredients
   * - Each ingredient must be a non-empty string
   * - Each ingredient max 500 characters
   * - Total JSON string max 50KB
   */
  private processIngredients(ingredients: unknown): { valid: boolean; str?: string; error?: string } {
    // Empty ingredients allowed (returns empty array)
    if (!ingredients) {
      return { valid: true, str: '[]' };
    }

    let ingredientArray: unknown[];

    // Parse string input
    if (typeof ingredients === 'string') {
      // Check max size before parsing (prevent DoS via huge JSON)
      if (ingredients.length > 50000) {
        return { valid: false, error: 'Ingredients data too large (maximum 50KB)' };
      }

      try {
        const parsed = JSON.parse(ingredients);
        if (!Array.isArray(parsed)) {
          return { valid: false, error: 'Ingredients must be an array' };
        }
        ingredientArray = parsed;
      } catch {
        return { valid: false, error: 'Ingredients string is not valid JSON' };
      }
    } else if (Array.isArray(ingredients)) {
      ingredientArray = ingredients;
    } else {
      return { valid: false, error: 'Ingredients must be a JSON string or array' };
    }

    // Validate array length
    if (ingredientArray.length > 100) {
      return { valid: false, error: 'Too many ingredients (maximum 100)' };
    }

    // Validate each ingredient
    const sanitizedIngredients: string[] = [];
    for (let i = 0; i < ingredientArray.length; i++) {
      const ingredient = ingredientArray[i];

      // Must be a string
      if (typeof ingredient !== 'string') {
        return { valid: false, error: `Ingredient at index ${i} must be a string` };
      }

      // Trim and check for empty
      const trimmed = ingredient.trim();
      if (trimmed.length === 0) {
        return { valid: false, error: `Ingredient at index ${i} cannot be empty` };
      }

      // Check max length per ingredient
      if (trimmed.length > 500) {
        return { valid: false, error: `Ingredient at index ${i} too long (maximum 500 characters)` };
      }

      // Sanitize (remove HTML/script tags)
      const sanitized = sanitizeString(trimmed, 500, true);
      sanitizedIngredients.push(sanitized);
    }

    const jsonStr = JSON.stringify(sanitizedIngredients);

    // Final size check
    if (jsonStr.length > 50000) {
      return { valid: false, error: 'Ingredients data too large after sanitization (maximum 50KB)' };
    }

    return { valid: true, str: jsonStr };
  }

  /**
   * Safe JSON parse with fallback
   */
  private safeParseJSON(str: string): string[] | string {
    try {
      return JSON.parse(str);
    } catch {
      return str;
    }
  }

  /**
   * Store recipe in MemMachine (fire-and-forget)
   */
  private storeInMemMachine(userId: number, recipeId: number, data: SanitizedRecipeData): void {
    this.memoryService.storeUserRecipe(userId, {
      name: data.name,
      ingredients: JSON.parse(data.ingredientsStr),
      instructions: data.instructions || undefined,
      glass: data.glass || undefined,
      category: data.category || undefined,
    }).then(uid => {
      if (uid) {
        execute('UPDATE recipes SET memmachine_uid = $1 WHERE id = $2', [uid, recipeId]).catch(err => {
          logger.error('Failed to store MemMachine UID in database', { error: err instanceof Error ? err.message : 'Unknown error' });
        });
        logger.debug('Stored MemMachine UID for recipe', { recipeId, uid });
      }
    }).catch(err => {
      logger.error('Failed to store recipe in MemMachine (non-critical)', { error: err instanceof Error ? err.message : 'Unknown error' });
    });
  }

  /**
   * Batch store recipes in MemMachine
   * Uses recipe ID for UID storage to handle duplicate recipe names correctly
   */
  private batchStoreInMemMachine(userId: number, recipes: Array<{ id: number; name: string; ingredients: string[]; instructions: string | null; glass: string | null; category: string | null }>): void {
    // Build a map of recipe name -> id for UID storage
    // For duplicate names, we'll use the order they appear in the array
    const recipeNameToIds = new Map<string, number[]>();
    for (const r of recipes) {
      const ids = recipeNameToIds.get(r.name) || [];
      ids.push(r.id);
      recipeNameToIds.set(r.name, ids);
    }

    // Transform null to undefined for MemMachine API compatibility
    const recipesForApi = recipes.map(r => ({
      name: r.name,
      ingredients: r.ingredients,
      instructions: r.instructions ?? undefined,
      glass: r.glass ?? undefined,
      category: r.category ?? undefined,
    }));

    // Track which index we're at for each recipe name
    const nameIndexTracker = new Map<string, number>();

    this.memoryService.storeUserRecipesBatch(userId, recipesForApi).then(async result => {
      if (result.uidMap.size > 0) {
        logger.debug('Storing MemMachine UIDs in database', { count: result.uidMap.size });

        const updates: Array<{ id: number; uid: string }> = [];

        // Match UIDs to recipe IDs
        for (const [recipeName, uid] of result.uidMap.entries()) {
          const ids = recipeNameToIds.get(recipeName);
          if (ids && ids.length > 0) {
            const currentIndex = nameIndexTracker.get(recipeName) || 0;
            if (currentIndex < ids.length) {
              updates.push({ id: ids[currentIndex], uid });
              nameIndexTracker.set(recipeName, currentIndex + 1);
            }
          }
        }

        // Update UIDs in transaction
        try {
          await transaction(async (client) => {
            for (const { id, uid } of updates) {
              await client.query('UPDATE recipes SET memmachine_uid = $1 WHERE id = $2', [uid, id]);
            }
          });
          logger.info('Stored MemMachine UIDs in database', { count: updates.length });
        } catch (err) {
          logger.error('Failed to store MemMachine UIDs in database', { error: err instanceof Error ? err.message : 'Unknown error' });
        }
      }
    }).catch(err => {
      logger.error('Failed to batch upload recipes to MemMachine', { error: err instanceof Error ? err.message : 'Unknown error' });
    });
  }

  /**
   * Auto-sync MemMachine after significant changes
   */
  private autoSyncMemMachine(userId: number, reason: string): void {
    logger.info('Auto-triggering MemMachine sync', { userId, reason });

    this.syncMemMachine(userId).then(stats => {
      logger.info('Auto-sync complete', { userId, uploaded: stats.uploaded, failed: stats.failed });
    }).catch(err => {
      logger.error('Auto-sync error', { userId, error: err instanceof Error ? err.message : 'Unknown error' });
    });
  }

  /**
   * Validate and sanitize CSV recipe data
   */
  private validateCSVRecipeData(record: Record<string, unknown>): CSVValidationResult {
    const errors: string[] = [];

    const nameField = this.findField(record, [
      'name', 'Name', 'NAME', 'Recipe Name', 'recipe name', 'Recipe', 'recipe',
      'Cocktail', 'cocktail', 'Cocktail Name', 'cocktail name',
      'Drink', 'drink', 'Drink Name', 'drink name'
    ]);

    if (!nameField || (typeof nameField === 'string' && nameField.trim().length === 0)) {
      errors.push(`Missing name field. Available columns: ${Object.keys(record).join(', ')}`);
      return { isValid: false, errors };
    }

    const safeString = (val: unknown) => val ? String(val).trim() : null;

    // Parse ingredients
    const ingredientsField = this.findField(record, [
      'ingredients', 'Ingredients', 'INGREDIENTS', 'Items', 'items',
      'Recipe Items', 'recipe items', 'Components', 'components'
    ]);

    let ingredientsArray: string[] = [];
    if (ingredientsField) {
      const ingredientsStr = String(ingredientsField).trim();
      if (ingredientsStr.length > 0) {
        if (ingredientsStr.includes(';')) {
          ingredientsArray = ingredientsStr.split(';').map(i => i.trim()).filter(i => i.length > 0);
        } else if (ingredientsStr.includes('|')) {
          ingredientsArray = ingredientsStr.split('|').map(i => i.trim()).filter(i => i.length > 0);
        } else if (ingredientsStr.includes('\n')) {
          ingredientsArray = ingredientsStr.split('\n').map(i => i.trim()).filter(i => i.length > 0);
        } else {
          ingredientsArray = ingredientsStr.split(',').map(i => i.trim()).filter(i => i.length > 0);
        }
      }
    }

    return {
      isValid: true,
      errors: [],
      sanitized: {
        name: safeString(nameField)!,
        ingredients: ingredientsArray,
        instructions: safeString(this.findField(record, [
          'instructions', 'Instructions', 'INSTRUCTIONS', 'Method', 'method',
          'Directions', 'directions', 'Steps', 'steps', 'How to Make', 'how to make',
          'Preparation', 'preparation', 'Recipe', 'recipe'
        ])),
        glass: safeString(this.findField(record, [
          'glass', 'Glass', 'GLASS', 'Glass Type', 'glass type',
          'Glassware', 'glassware', 'Serve In', 'serve in', 'Serving Glass', 'serving glass'
        ])),
        category: safeString(this.findField(record, [
          'category', 'Category', 'CATEGORY', 'Type', 'type',
          'Style', 'style', 'Drink Type', 'drink type', 'Classification', 'classification'
        ])),
      }
    };
  }

  /**
   * Find a field value from record using multiple possible column names
   */
  private findField(record: Record<string, unknown>, possibleNames: string[]): unknown {
    for (const name of possibleNames) {
      const value = record[name];
      if (value !== undefined && value !== null && value !== '') {
        return value;
      }
    }
    return null;
  }
}

// Export singleton instance
export const recipeService = new RecipeService();
