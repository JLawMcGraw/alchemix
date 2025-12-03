/**
 * Recipe Service
 *
 * Business logic for user's cocktail recipe collection.
 * Extracted from routes/recipes.ts for testability and reusability.
 *
 * @version 1.0.0
 * @date December 2025
 */

import { db } from '../database/db';
import { sanitizeString } from '../utils/inputValidator';
import { Recipe } from '../types';
import { memoryService } from './MemoryService';

/**
 * Pagination options
 */
export interface PaginationOptions {
  page: number;
  limit: number;
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
  ingredients?: string | string[] | any;
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
  ingredients?: string | string[] | any;
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
 * Recipe Service
 *
 * Handles all recipe business logic independent of HTTP layer.
 */
export class RecipeService {
  /**
   * Get paginated recipes for a user
   */
  getAll(userId: number, options: PaginationOptions): PaginatedResult<Recipe> {
    const { page, limit } = options;
    const offset = (page - 1) * limit;

    // Get total count
    const countResult = db.prepare(
      'SELECT COUNT(*) as total FROM recipes WHERE user_id = ?'
    ).get(userId) as { total: number };

    const total = countResult.total;

    // Get recipes
    const recipes = db.prepare(`
      SELECT * FROM recipes
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(userId, limit, offset) as Recipe[];

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
  getById(recipeId: number, userId: number): Recipe | null {
    const recipe = db.prepare(
      'SELECT * FROM recipes WHERE id = ? AND user_id = ?'
    ).get(recipeId, userId) as Recipe | undefined;

    if (!recipe) return null;

    return this.parseRecipeIngredients(recipe);
  }

  /**
   * Check if a recipe exists and belongs to user
   */
  exists(recipeId: number, userId: number): boolean {
    const result = db.prepare(
      'SELECT id FROM recipes WHERE id = ? AND user_id = ?'
    ).get(recipeId, userId);

    return !!result;
  }

  /**
   * Validate collection belongs to user
   */
  validateCollection(collectionId: number, userId: number): boolean {
    const collection = db.prepare(
      'SELECT id FROM collections WHERE id = ? AND user_id = ?'
    ).get(collectionId, userId);

    return !!collection;
  }

  /**
   * Sanitize and validate recipe input for creation
   */
  sanitizeCreateInput(input: CreateRecipeInput, userId: number): { valid: boolean; error?: string; data?: SanitizedRecipeData } {
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
    if (collectionId && !this.validateCollection(collectionId, userId)) {
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
  create(userId: number, data: SanitizedRecipeData): Recipe {
    const result = db.prepare(`
      INSERT INTO recipes (
        user_id, collection_id, name, ingredients, instructions, glass, category
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      data.collectionId,
      data.name,
      data.ingredientsStr,
      data.instructions,
      data.glass,
      data.category
    );

    const recipeId = result.lastInsertRowid as number;

    // Store in MemMachine (fire-and-forget)
    this.storeInMemMachine(userId, recipeId, data);

    const recipe = db.prepare(
      'SELECT * FROM recipes WHERE id = ?'
    ).get(recipeId) as Recipe;

    return this.parseRecipeIngredients(recipe);
  }

  /**
   * Update an existing recipe
   *
   * SECURITY: Only fields in ALLOWED_UPDATE_FIELDS are processed.
   * Any attempt to modify user_id or other protected fields is silently ignored.
   */
  update(recipeId: number, userId: number, updates: UpdateRecipeInput): { success: boolean; recipe?: Recipe; error?: string } {
    // Check existence
    if (!this.exists(recipeId, userId)) {
      return { success: false, error: 'Recipe not found or access denied' };
    }

    // SECURITY: Filter to only allowed fields (prevents mass assignment)
    const safeUpdates: UpdateRecipeInput = {};
    for (const field of ALLOWED_UPDATE_FIELDS) {
      if (field in updates) {
        (safeUpdates as any)[field] = (updates as any)[field];
      }
    }

    const fieldsToUpdate: string[] = [];
    const values: any[] = [];

    // Name
    if (safeUpdates.name !== undefined) {
      if (typeof safeUpdates.name !== 'string') {
        return { success: false, error: 'Name must be a string' };
      }
      const sanitizedName = sanitizeString(safeUpdates.name, 255, true);
      if (sanitizedName.length === 0) {
        return { success: false, error: 'Name cannot be empty after sanitization' };
      }
      fieldsToUpdate.push('name = ?');
      values.push(sanitizedName);
    }

    // Ingredients
    if (safeUpdates.ingredients !== undefined) {
      const ingredientsResult = this.processIngredients(safeUpdates.ingredients);
      if (!ingredientsResult.valid) {
        return { success: false, error: ingredientsResult.error };
      }
      fieldsToUpdate.push('ingredients = ?');
      values.push(ingredientsResult.str);
    }

    // Instructions
    if (safeUpdates.instructions !== undefined) {
      fieldsToUpdate.push('instructions = ?');
      values.push(safeUpdates.instructions ? sanitizeString(safeUpdates.instructions, 2000, true) : null);
    }

    // Glass
    if (safeUpdates.glass !== undefined) {
      fieldsToUpdate.push('glass = ?');
      values.push(safeUpdates.glass ? sanitizeString(safeUpdates.glass, 100, true) : null);
    }

    // Category
    if (safeUpdates.category !== undefined) {
      fieldsToUpdate.push('category = ?');
      values.push(safeUpdates.category ? sanitizeString(safeUpdates.category, 100, true) : null);
    }

    // Collection ID
    if (safeUpdates.collection_id !== undefined) {
      if (safeUpdates.collection_id === null || safeUpdates.collection_id === undefined) {
        fieldsToUpdate.push('collection_id = ?');
        values.push(null);
      } else {
        const validCollectionId = Number(safeUpdates.collection_id);
        if (isNaN(validCollectionId) || validCollectionId <= 0) {
          return { success: false, error: 'Invalid collection ID' };
        }
        if (!this.validateCollection(validCollectionId, userId)) {
          return { success: false, error: 'Collection not found or access denied' };
        }
        fieldsToUpdate.push('collection_id = ?');
        values.push(validCollectionId);
      }
    }

    // If no fields to update, return current recipe
    if (fieldsToUpdate.length === 0) {
      const recipe = this.getById(recipeId, userId);
      return { success: true, recipe: recipe! };
    }

    // Execute update
    values.push(recipeId);
    db.prepare(`UPDATE recipes SET ${fieldsToUpdate.join(', ')} WHERE id = ?`).run(...values);

    const recipe = this.getById(recipeId, userId);
    return { success: true, recipe: recipe! };
  }

  /**
   * Delete a single recipe
   */
  delete(recipeId: number, userId: number): { success: boolean; error?: string } {
    const recipe = db.prepare(
      'SELECT id, name, memmachine_uuid FROM recipes WHERE id = ? AND user_id = ?'
    ).get(recipeId, userId) as { id: number; name: string; memmachine_uuid: string | null } | undefined;

    if (!recipe) {
      return { success: false, error: 'Recipe not found or access denied' };
    }

    // Delete from database
    db.prepare('DELETE FROM recipes WHERE id = ?').run(recipeId);

    // Delete from MemMachine
    if (recipe.memmachine_uuid) {
      memoryService.deleteUserRecipeByUuid(userId, recipe.memmachine_uuid, recipe.name).catch(err => {
        console.error('Failed to delete recipe from MemMachine:', err);
      });
    } else {
      memoryService.deleteUserRecipe(userId, recipe.name);
    }

    return { success: true };
  }

  /**
   * Delete all recipes for a user
   */
  deleteAll(userId: number): number {
    const result = db.prepare('DELETE FROM recipes WHERE user_id = ?').run(userId);

    // Trigger auto-sync in background
    this.autoSyncMemMachine(userId, 'delete all recipes');

    return result.changes;
  }

  /**
   * Bulk delete recipes
   */
  bulkDelete(ids: number[], userId: number): number {
    const placeholders = ids.map(() => '?').join(', ');

    // Get UUIDs before deletion
    const recipesToDelete = db.prepare(`
      SELECT memmachine_uuid FROM recipes
      WHERE user_id = ? AND id IN (${placeholders}) AND memmachine_uuid IS NOT NULL
    `).all(userId, ...ids) as Array<{ memmachine_uuid: string }>;

    const uuidsToDelete = recipesToDelete.map(r => r.memmachine_uuid).filter(Boolean);

    // Delete from database
    const result = db.prepare(`
      DELETE FROM recipes WHERE user_id = ? AND id IN (${placeholders})
    `).run(userId, ...ids);

    // Handle MemMachine cleanup
    if (result.changes >= 10) {
      this.autoSyncMemMachine(userId, `bulk delete ${result.changes} recipes`);
    } else if (uuidsToDelete.length > 0) {
      memoryService.deleteUserRecipesBatch(userId, uuidsToDelete).catch(err => {
        console.error('Failed to batch delete recipes from MemMachine:', err);
      });
    }

    return result.changes;
  }

  /**
   * Import recipes from CSV records
   *
   * PERFORMANCE: Uses transaction + prepared statement for batch insert
   * instead of individual queries (fixes N+1 query pattern).
   * This is ~10x faster for large imports.
   */
  importFromCSV(userId: number, records: any[], collectionId: number | null): ImportResult {
    let imported = 0;
    const errors: Array<{ row: number; error: string }> = [];
    const recipesForMemMachine: any[] = [];
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

    // Phase 2: Batch insert using transaction (single query instead of N queries)
    if (validatedRecipes.length > 0) {
      const insertStmt = db.prepare(`
        INSERT INTO recipes (user_id, collection_id, name, ingredients, instructions, glass, category)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      const insertMany = db.transaction((recipes: typeof validatedRecipes) => {
        for (const recipe of recipes) {
          try {
            insertStmt.run(
              userId,
              collectionId,
              recipe.name,
              recipe.ingredientsStr,
              recipe.instructions,
              recipe.glass,
              recipe.category
            );
            imported++;
            recipesForMemMachine.push({
              name: recipe.name,
              ingredients: recipe.ingredients,
              instructions: recipe.instructions,
              glass: recipe.glass,
              category: recipe.category,
            });
          } catch (error: any) {
            errors.push({ row: recipe.rowNumber, error: error.message || 'Failed to import row' });
          }
        }
      });

      insertMany(validatedRecipes);
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
    const cleared = await memoryService.deleteAllRecipeMemories(userId);

    if (!cleared) {
      throw new Error('Failed to clear MemMachine memories');
    }

    // Fetch recipes
    const recipes = db.prepare(`
      SELECT name, ingredients, instructions, glass, category
      FROM recipes WHERE user_id = ? ORDER BY created_at DESC
    `).all(userId) as Array<{ name: string; ingredients: string; instructions: string | null; glass: string | null; category: string | null }>;

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

    const uploadResult = await memoryService.storeUserRecipesBatch(userId, recipesForUpload);

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
    return memoryService.deleteAllRecipeMemories(userId);
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
      console.warn(`Failed to parse ingredients for recipe ${recipe.id}`);
      return recipe;
    }
  }

  /**
   * Process ingredients input to JSON string
   */
  private processIngredients(ingredients: any): { valid: boolean; str?: string; error?: string } {
    if (!ingredients) {
      return { valid: true, str: '[]' };
    }

    if (typeof ingredients === 'string') {
      try {
        JSON.parse(ingredients);
        return { valid: true, str: ingredients };
      } catch {
        return { valid: false, error: 'Ingredients string is not valid JSON' };
      }
    }

    if (Array.isArray(ingredients)) {
      if (ingredients.length > 100) {
        return { valid: false, error: 'Too many ingredients (maximum 100)' };
      }
      return { valid: true, str: JSON.stringify(ingredients) };
    }

    return { valid: true, str: JSON.stringify(ingredients) };
  }

  /**
   * Safe JSON parse with fallback
   */
  private safeParseJSON(str: string): any {
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
    memoryService.storeUserRecipe(userId, {
      name: data.name,
      ingredients: JSON.parse(data.ingredientsStr),
      instructions: data.instructions || undefined,
      glass: data.glass || undefined,
      category: data.category || undefined,
    }).then(uuid => {
      if (uuid) {
        db.prepare('UPDATE recipes SET memmachine_uuid = ? WHERE id = ?').run(uuid, recipeId);
        console.log(`💾 Stored MemMachine UUID for recipe ${recipeId}: ${uuid}`);
      }
    }).catch(err => {
      console.error('Failed to store recipe in MemMachine (non-critical):', err);
    });
  }

  /**
   * Batch store recipes in MemMachine
   */
  private batchStoreInMemMachine(userId: number, recipes: any[]): void {
    memoryService.storeUserRecipesBatch(userId, recipes).then(result => {
      if (result.uuidMap.size > 0) {
        console.log(`💾 Storing ${result.uuidMap.size} MemMachine UUIDs in database...`);

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

  /**
   * Auto-sync MemMachine after significant changes
   */
  private autoSyncMemMachine(userId: number, reason: string): void {
    console.log(`🔄 Auto-triggering MemMachine sync for user ${userId} (reason: ${reason})`);

    this.syncMemMachine(userId).then(stats => {
      console.log(`✅ Auto-sync complete for user ${userId}: ${stats.uploaded} recipes uploaded, ${stats.failed} failed`);
    }).catch(err => {
      console.error(`❌ Auto-sync error for user ${userId}:`, err);
    });
  }

  /**
   * Validate and sanitize CSV recipe data
   */
  private validateCSVRecipeData(record: any): CSVValidationResult {
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

    const safeString = (val: any) => val ? String(val).trim() : null;

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
  private findField(record: any, possibleNames: string[]): any {
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
