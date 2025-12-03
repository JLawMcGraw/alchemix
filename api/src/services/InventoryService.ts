/**
 * Inventory Service
 *
 * Business logic for user's inventory items (spirits, mixers, garnishes, etc.).
 * Extracted from routes/inventoryItems.ts for testability and reusability.
 *
 * @version 1.0.0
 * @date December 2025
 */

import { db } from '../database/db';
import { InventoryItem } from '../types';

/**
 * Valid inventory categories
 */
export const VALID_CATEGORIES = ['spirit', 'liqueur', 'mixer', 'garnish', 'syrup', 'wine', 'beer', 'other'] as const;
export type InventoryCategory = typeof VALID_CATEGORIES[number];

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
 * Category counts
 */
export interface CategoryCounts {
  all: number;
  spirit: number;
  liqueur: number;
  mixer: number;
  syrup: number;
  garnish: number;
  wine: number;
  beer: number;
  other: number;
}

/**
 * Sanitized inventory item data
 */
export interface SanitizedInventoryItem {
  name: string;
  category: InventoryCategory;
  type: string | null;
  abv: string | null;
  stock_number: number | null;
  spirit_classification: string | null;
  distillation_method: string | null;
  distillery_location: string | null;
  age_statement: string | null;
  additional_notes: string | null;
  profile_nose: string | null;
  palate: string | null;
  finish: string | null;
}

/**
 * Validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitized?: SanitizedInventoryItem;
}

/**
 * CSV import result
 */
export interface ImportResult {
  imported: number;
  failed: number;
  errors: Array<{ row: number; error: string }>;
}

/**
 * Inventory Service
 *
 * Handles all inventory business logic independent of HTTP layer.
 */
export class InventoryService {
  /**
   * Get paginated inventory items with optional category filter
   */
  getAll(userId: number, options: PaginationOptions, category?: string): PaginatedResult<InventoryItem> {
    const { page, limit } = options;
    const offset = (page - 1) * limit;

    const whereClause = category
      ? 'WHERE user_id = ? AND category = ?'
      : 'WHERE user_id = ?';

    const queryParams = category ? [userId, category] : [userId];

    // Get total count
    const countResult = db.prepare(
      `SELECT COUNT(*) as total FROM inventory_items ${whereClause}`
    ).get(...queryParams) as { total: number };

    const total = countResult.total;

    // Get items
    const items = db.prepare(`
      SELECT * FROM inventory_items
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(...queryParams, limit, offset) as InventoryItem[];

    // Calculate pagination metadata
    const totalPages = Math.ceil(total / limit);

    return {
      items,
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
   * Get category counts for a user
   */
  getCategoryCounts(userId: number): CategoryCounts {
    // Get total count
    const totalResult = db.prepare(
      'SELECT COUNT(*) as total FROM inventory_items WHERE user_id = ?'
    ).get(userId) as { total: number };

    // Get category breakdown
    const categoryResults = db.prepare(`
      SELECT category, COUNT(*) as count
      FROM inventory_items
      WHERE user_id = ?
      GROUP BY category
    `).all(userId) as Array<{ category: string; count: number }>;

    // Build complete response with all categories
    const counts: CategoryCounts = {
      all: totalResult.total,
      spirit: 0,
      liqueur: 0,
      mixer: 0,
      syrup: 0,
      garnish: 0,
      wine: 0,
      beer: 0,
      other: 0
    };

    // Fill in actual counts
    categoryResults.forEach(({ category, count }) => {
      if (category in counts) {
        counts[category as keyof CategoryCounts] = count;
      }
    });

    return counts;
  }

  /**
   * Get a single item by ID (with ownership check)
   */
  getById(itemId: number, userId: number): InventoryItem | null {
    const item = db.prepare(
      'SELECT * FROM inventory_items WHERE id = ? AND user_id = ?'
    ).get(itemId, userId) as InventoryItem | undefined;

    return item || null;
  }

  /**
   * Check if an item exists and belongs to user
   */
  exists(itemId: number, userId: number): boolean {
    const result = db.prepare(
      'SELECT id FROM inventory_items WHERE id = ? AND user_id = ?'
    ).get(itemId, userId);

    return !!result;
  }

  /**
   * Create a new inventory item
   */
  create(userId: number, data: SanitizedInventoryItem): InventoryItem {
    // Normalize zero/negative stock to null
    const stockNumber = data.stock_number !== null && data.stock_number <= 0
      ? null
      : data.stock_number;

    const result = db.prepare(`
      INSERT INTO inventory_items (
        user_id, name, category, type, abv,
        stock_number, spirit_classification, distillation_method,
        distillery_location, age_statement, additional_notes,
        profile_nose, palate, finish
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      data.name,
      data.category,
      data.type || null,
      data.abv || null,
      stockNumber,
      data.spirit_classification || null,
      data.distillation_method || null,
      data.distillery_location || null,
      data.age_statement || null,
      data.additional_notes || null,
      data.profile_nose || null,
      data.palate || null,
      data.finish || null
    );

    return db.prepare(
      'SELECT * FROM inventory_items WHERE id = ?'
    ).get(result.lastInsertRowid) as InventoryItem;
  }

  /**
   * Update an existing inventory item
   *
   * Returns null if item doesn't exist or doesn't belong to user
   */
  update(itemId: number, userId: number, data: SanitizedInventoryItem): InventoryItem | null {
    if (!this.exists(itemId, userId)) {
      return null;
    }

    // Normalize zero/negative stock to null
    const stockNumber = data.stock_number !== null && data.stock_number <= 0
      ? null
      : data.stock_number;

    db.prepare(`
      UPDATE inventory_items SET
        name = ?,
        category = ?,
        type = ?,
        abv = ?,
        stock_number = ?,
        spirit_classification = ?,
        distillation_method = ?,
        distillery_location = ?,
        age_statement = ?,
        additional_notes = ?,
        profile_nose = ?,
        palate = ?,
        finish = ?
      WHERE id = ? AND user_id = ?
    `).run(
      data.name,
      data.category,
      data.type || null,
      data.abv || null,
      stockNumber,
      data.spirit_classification || null,
      data.distillation_method || null,
      data.distillery_location || null,
      data.age_statement || null,
      data.additional_notes || null,
      data.profile_nose || null,
      data.palate || null,
      data.finish || null,
      itemId,
      userId
    );

    return db.prepare(
      'SELECT * FROM inventory_items WHERE id = ?'
    ).get(itemId) as InventoryItem;
  }

  /**
   * Delete a single item
   *
   * Returns false if item doesn't exist or doesn't belong to user
   */
  delete(itemId: number, userId: number): boolean {
    if (!this.exists(itemId, userId)) {
      return false;
    }

    db.prepare('DELETE FROM inventory_items WHERE id = ? AND user_id = ?')
      .run(itemId, userId);

    return true;
  }

  /**
   * Bulk delete items
   *
   * Returns count of deleted items (only deletes items belonging to user)
   */
  bulkDelete(ids: number[], userId: number): number {
    const placeholders = ids.map(() => '?').join(',');

    const result = db.prepare(`
      DELETE FROM inventory_items
      WHERE id IN (${placeholders}) AND user_id = ?
    `).run(...ids, userId);

    return result.changes;
  }

  /**
   * Import items from parsed CSV records
   */
  importFromCSV(userId: number, records: Record<string, unknown>[]): ImportResult {
    let imported = 0;
    const errors: Array<{ row: number; error: string }> = [];

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const rowNumber = i + 2; // +2 because: 0-indexed + header row

      try {
        const validation = this.validateItemData(record);

        if (!validation.isValid) {
          errors.push({
            row: rowNumber,
            error: validation.errors.join(', ')
          });
          continue;
        }

        this.create(userId, validation.sanitized!);
        imported++;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to import row';
        errors.push({
          row: rowNumber,
          error: message
        });
      }
    }

    return {
      imported,
      failed: errors.length,
      errors
    };
  }

  /**
   * Validate and sanitize inventory item data
   * Handles both API requests and CSV imports with flexible column names
   */
  validateItemData(record: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];

    // Try to find the name field with various possible column names
    const nameField = this.findField(record, [
      'name', 'Name', 'NAME',
      'Spirit Name', 'spirit name', 'Spirit', 'spirit',
      'Bottle Name', 'bottle name', 'Bottle', 'bottle',
      'Product Name', 'product name', 'Product', 'product',
      'Brand', 'brand'
    ]);

    // Require name field
    if (!nameField || (typeof nameField === 'string' && nameField.trim().length === 0)) {
      errors.push(`Missing name field. Available columns: ${Object.keys(record).join(', ')}`);
      return { isValid: false, errors };
    }

    // Helper functions
    const safeString = (val: unknown) => val ? String(val).trim() : null;
    const safeNumber = (val: unknown) => {
      const num = parseInt(String(val));
      return isNaN(num) ? null : num;
    };

    // Extract type and classification fields for auto-categorization
    const type = safeString(this.findField(record, ['type', 'Type', 'TYPE', 'Liquor Type', 'liquor type']));
    const classification = safeString(this.findField(record, ['spirit_classification', 'Detailed Spirit Classification', 'Classification', 'classification', 'Spirit Type', 'spirit type']));
    const name = safeString(nameField);

    // Try to find explicit category, otherwise auto-categorize
    const explicitCategory = this.findField(record, ['category', 'Category', 'CATEGORY']);
    const category = explicitCategory
      ? String(explicitCategory).trim().toLowerCase()
      : this.autoCategorize(type, classification, name);

    // Validate category
    if (!VALID_CATEGORIES.includes(category as InventoryCategory)) {
      errors.push(`Invalid category: "${category}". Must be one of: ${VALID_CATEGORIES.join(', ')}`);
      return { isValid: false, errors };
    }

    // Build sanitized data
    const sanitized: SanitizedInventoryItem = {
      name: name!,
      category: category as InventoryCategory,
      type,
      abv: safeString(this.findField(record, ['abv', 'ABV', 'ABV (%)', 'Alcohol', 'alcohol', 'Proof', 'proof'])),
      stock_number: safeNumber(this.findField(record, ['stock_number', 'Stock Number', 'stock number', 'Stock', 'stock', 'Number', '#'])),
      spirit_classification: classification,
      distillation_method: safeString(this.findField(record, ['distillation_method', 'Distillation Method', 'distillation method', 'Method', 'method'])),
      distillery_location: safeString(this.findField(record, ['distillery_location', 'Distillery Location', 'distillery location', 'Location', 'location', 'Origin', 'origin', 'Country', 'country'])),
      age_statement: safeString(this.findField(record, ['age_statement', 'Age Statement or Barrel Finish', 'Age Statement', 'age statement', 'Age', 'age', 'Barrel Finish', 'barrel finish'])),
      additional_notes: safeString(this.findField(record, ['additional_notes', 'Additional Notes', 'additional notes', 'Notes', 'notes', 'Description', 'description', 'Comments', 'comments'])),
      profile_nose: safeString(this.findField(record, ['profile_nose', 'Profile (Nose)', 'Nose', 'nose', 'Aroma', 'aroma', 'Smell', 'smell'])),
      palate: safeString(this.findField(record, ['palate', 'Palate', 'Taste', 'taste', 'Flavor', 'flavor'])),
      finish: safeString(this.findField(record, ['finish', 'Finish', 'Aftertaste', 'aftertaste'])),
    };

    return { isValid: true, errors: [], sanitized };
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

  /**
   * Auto-categorize items based on liquor type, classification, or name
   */
  private autoCategorize(type: string | null, classification: string | null, name: string | null = null): string {
    const combined = `${name || ''} ${type || ''} ${classification || ''}`.toLowerCase();

    // Check liqueurs FIRST (before spirits)
    const liqueurKeywords = [
      'liqueur', 'amaro', 'amaretto', 'aperitif', 'aperitivo',
      'creme de', 'crème de', 'curacao', 'curaçao',
      'triple sec', 'cointreau', 'grand marnier',
      'chambord', 'chartreuse', 'drambuie', 'frangelico',
      'kahlua', 'baileys', 'irish cream',
      'limoncello', 'sambuca', 'schnapps',
      'st germain', 'st-germain', 'elderflower',
      'campari', 'aperol', 'cynar', 'fernet',
      'allspice dram', 'dram', 'falernum liqueur'
    ];

    for (const keyword of liqueurKeywords) {
      if (combined.includes(keyword)) return 'liqueur';
    }

    // Check spirits
    const spiritKeywords = [
      'whiskey', 'whisky', 'bourbon', 'rye', 'scotch', 'irish whiskey',
      'rum', 'rhum', 'rhum agricole', 'agricole', 'cachaca', 'cachaça',
      'vodka', 'gin', 'tequila', 'mezcal',
      'brandy', 'cognac', 'armagnac', 'pisco',
      'absinthe', 'aquavit', 'jenever',
      'baijiu', 'shochu', 'soju'
    ];

    for (const keyword of spiritKeywords) {
      if (combined.includes(keyword)) return 'spirit';
    }

    // Check wine
    const wineKeywords = [
      'wine', 'vermouth', 'sherry', 'port', 'madeira',
      'marsala', 'champagne', 'prosecco', 'sparkling wine'
    ];

    for (const keyword of wineKeywords) {
      if (combined.includes(keyword)) return 'wine';
    }

    // Check beer
    const beerKeywords = ['beer', 'ale', 'lager', 'stout', 'ipa'];

    for (const keyword of beerKeywords) {
      if (combined.includes(keyword)) return 'beer';
    }

    // Check syrups
    if (!combined.includes('liqueur') && combined.includes('falernum')) {
      return 'syrup';
    }

    const syrupKeywords = [
      'syrup', 'grenadine', 'orgeat',
      'honey', 'agave', 'simple syrup', 'rich syrup'
    ];

    for (const keyword of syrupKeywords) {
      if (combined.includes(keyword)) return 'syrup';
    }

    // Check mixers
    const mixerKeywords = [
      'juice', 'lemon juice', 'lime juice', 'orange juice', 'grapefruit juice',
      'pineapple juice', 'cranberry juice', 'tomato juice',
      'lemon', 'lime', 'orange', 'grapefruit',
      'tonic', 'tonic water', 'soda', 'cola', 'ginger beer', 'ginger ale',
      'club soda', 'seltzer', 'sparkling water', 'soda water',
      'bitter', 'bitters', 'angostura', 'peychaud',
      'cream', 'milk', 'coconut cream', 'coconut milk'
    ];

    for (const keyword of mixerKeywords) {
      if (combined.includes(keyword)) return 'mixer';
    }

    // Check garnishes
    const garnishKeywords = [
      'garnish', 'cherry', 'olive', 'onion',
      'salt', 'sugar', 'rim', 'mint', 'herb'
    ];

    for (const keyword of garnishKeywords) {
      if (combined.includes(keyword)) return 'garnish';
    }

    return 'other';
  }

  /**
   * Validate category is valid
   */
  isValidCategory(category: string): category is InventoryCategory {
    return VALID_CATEGORIES.includes(category as InventoryCategory);
  }
}

// Export singleton instance
export const inventoryService = new InventoryService();
