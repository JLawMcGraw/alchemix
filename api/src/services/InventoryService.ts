/**
 * Inventory Service
 *
 * Business logic for user's inventory items (spirits, mixers, garnishes, etc.).
 * Extracted from routes/inventoryItems.ts for testability and reusability.
 *
 * @version 1.1.0 - Added dependency injection for testability
 * @date December 2025
 */

import { queryOne, queryAll, execute, transaction } from '../database/db';
import { InventoryItem, PeriodicGroup, PeriodicPeriod } from '../types';

/**
 * Valid inventory categories
 */
export const VALID_CATEGORIES = ['spirit', 'liqueur', 'mixer', 'garnish', 'syrup', 'wine', 'beer', 'other'] as const;
export type InventoryCategory = typeof VALID_CATEGORIES[number];

/**
 * Valid periodic table groups (columns) - What the ingredient DOES
 */
export const VALID_GROUPS = ['Base', 'Bridge', 'Modifier', 'Sweetener', 'Reagent', 'Catalyst'] as const;

/**
 * Valid periodic table periods (rows) - Where the ingredient COMES FROM
 */
export const VALID_PERIODS = ['Agave', 'Cane', 'Grain', 'Grape', 'Fruit', 'Botanic'] as const;

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
  tasting_notes: string | null;
  periodic_group: PeriodicGroup | null;
  periodic_period: PeriodicPeriod | null;
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
  async getAll(userId: number, options: PaginationOptions, category?: string): Promise<PaginatedResult<InventoryItem>> {
    const { page, limit } = options;
    const offset = (page - 1) * limit;

    let total: number;
    let items: InventoryItem[];

    if (category) {
      // Get total count with category filter
      const countResult = await queryOne<{ total: string }>(
        'SELECT COUNT(*) as total FROM inventory_items WHERE user_id = $1 AND category = $2',
        [userId, category]
      );
      total = parseInt(countResult?.total ?? '0', 10);

      // Get items with category filter
      items = await queryAll<InventoryItem>(`
        SELECT * FROM inventory_items
        WHERE user_id = $1 AND category = $2
        ORDER BY created_at DESC
        LIMIT $3 OFFSET $4
      `, [userId, category, limit, offset]);
    } else {
      // Get total count without filter
      const countResult = await queryOne<{ total: string }>(
        'SELECT COUNT(*) as total FROM inventory_items WHERE user_id = $1',
        [userId]
      );
      total = parseInt(countResult?.total ?? '0', 10);

      // Get items without filter
      items = await queryAll<InventoryItem>(`
        SELECT * FROM inventory_items
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
      `, [userId, limit, offset]);
    }

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
  async getCategoryCounts(userId: number): Promise<CategoryCounts> {
    // Get total count
    const totalResult = await queryOne<{ total: string }>(
      'SELECT COUNT(*) as total FROM inventory_items WHERE user_id = $1',
      [userId]
    );

    // Get category breakdown
    const categoryResults = await queryAll<{ category: string; count: string }>(`
      SELECT category, COUNT(*) as count
      FROM inventory_items
      WHERE user_id = $1
      GROUP BY category
    `, [userId]);

    // Build complete response with all categories
    const counts: CategoryCounts = {
      all: parseInt(totalResult?.total ?? '0', 10),
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
        counts[category as keyof CategoryCounts] = parseInt(count, 10);
      }
    });

    return counts;
  }

  /**
   * Get a single item by ID (with ownership check)
   */
  async getById(itemId: number, userId: number): Promise<InventoryItem | null> {
    return queryOne<InventoryItem>(
      'SELECT * FROM inventory_items WHERE id = $1 AND user_id = $2',
      [itemId, userId]
    );
  }

  /**
   * Check if an item exists and belongs to user
   */
  async exists(itemId: number, userId: number): Promise<boolean> {
    const result = await queryOne<{ id: number }>(
      'SELECT id FROM inventory_items WHERE id = $1 AND user_id = $2',
      [itemId, userId]
    );

    return !!result;
  }

  /**
   * Create a new inventory item
   */
  async create(userId: number, data: SanitizedInventoryItem): Promise<InventoryItem> {
    // Normalize zero/negative stock to null
    const stockNumber = data.stock_number !== null && data.stock_number <= 0
      ? null
      : data.stock_number;

    // Auto-classify periodic tags if not provided
    let periodicGroup = data.periodic_group;
    let periodicPeriod = data.periodic_period;

    if (!periodicGroup || !periodicPeriod) {
      // Create a temporary item-like object for classification
      const tempItem = {
        name: data.name,
        type: data.type,
        spirit_classification: data.spirit_classification,
        category: data.category,
      } as InventoryItem;

      const autoTags = this.autoClassifyPeriodicTags(tempItem);
      periodicGroup = periodicGroup || autoTags.group;
      periodicPeriod = periodicPeriod || autoTags.period;
    }

    const result = await execute(`
      INSERT INTO inventory_items (
        user_id, name, category, type, abv,
        stock_number, spirit_classification, distillation_method,
        distillery_location, age_statement, additional_notes,
        profile_nose, palate, finish, tasting_notes,
        periodic_group, periodic_period
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *
    `, [
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
      data.finish || null,
      data.tasting_notes || null,
      periodicGroup,
      periodicPeriod
    ]);

    return result.rows[0] as InventoryItem;
  }

  /**
   * Update an existing inventory item
   *
   * Returns null if item doesn't exist or doesn't belong to user
   */
  async update(itemId: number, userId: number, data: SanitizedInventoryItem): Promise<InventoryItem | null> {
    if (!await this.exists(itemId, userId)) {
      return null;
    }

    // Normalize zero/negative stock to null
    const stockNumber = data.stock_number !== null && data.stock_number <= 0
      ? null
      : data.stock_number;

    const result = await execute(`
      UPDATE inventory_items SET
        name = $1,
        category = $2,
        type = $3,
        abv = $4,
        stock_number = $5,
        spirit_classification = $6,
        distillation_method = $7,
        distillery_location = $8,
        age_statement = $9,
        additional_notes = $10,
        profile_nose = $11,
        palate = $12,
        finish = $13,
        tasting_notes = $14,
        periodic_group = $15,
        periodic_period = $16
      WHERE id = $17 AND user_id = $18
      RETURNING *
    `, [
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
      data.tasting_notes || null,
      data.periodic_group || null,
      data.periodic_period || null,
      itemId,
      userId
    ]);

    return result.rows[0] as InventoryItem;
  }

  /**
   * Delete a single item
   *
   * Returns false if item doesn't exist or doesn't belong to user
   */
  async delete(itemId: number, userId: number): Promise<boolean> {
    if (!await this.exists(itemId, userId)) {
      return false;
    }

    await execute(
      'DELETE FROM inventory_items WHERE id = $1 AND user_id = $2',
      [itemId, userId]
    );

    return true;
  }

  /**
   * Bulk delete items
   *
   * Returns count of deleted items (only deletes items belonging to user)
   */
  async bulkDelete(ids: number[], userId: number): Promise<number> {
    const placeholders = ids.map((_, i) => `$${i + 2}`).join(',');

    const result = await execute(`
      DELETE FROM inventory_items
      WHERE id IN (${placeholders}) AND user_id = $1
    `, [userId, ...ids]);

    return result.rowCount ?? 0;
  }

  /**
   * Import items from parsed CSV records
   */
  async importFromCSV(userId: number, records: Record<string, unknown>[]): Promise<ImportResult> {
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

        await this.create(userId, validation.sanitized!);
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

    // Parse periodic group and period fields (use unique names to avoid conflicts with other fields)
    const periodicGroupRaw = safeString(this.findField(record, ['periodic_group', 'periodicGroup', 'Periodic Group', 'periodic group']));
    const periodicPeriodRaw = safeString(this.findField(record, ['periodic_period', 'periodicPeriod', 'Periodic Period', 'periodic period']));

    // Validate periodic group if provided
    let periodicGroup: PeriodicGroup | null = null;
    if (periodicGroupRaw) {
      // Try to match case-insensitively
      const matched = VALID_GROUPS.find(g => g.toLowerCase() === periodicGroupRaw.toLowerCase());
      if (matched) {
        periodicGroup = matched;
      } else {
        errors.push(`Invalid periodic_group: "${periodicGroupRaw}". Must be one of: ${VALID_GROUPS.join(', ')}`);
        return { isValid: false, errors };
      }
    }

    // Validate periodic period if provided
    let periodicPeriod: PeriodicPeriod | null = null;
    if (periodicPeriodRaw) {
      // Try to match case-insensitively
      const matched = VALID_PERIODS.find(p => p.toLowerCase() === periodicPeriodRaw.toLowerCase());
      if (matched) {
        periodicPeriod = matched;
      } else {
        errors.push(`Invalid periodic_period: "${periodicPeriodRaw}". Must be one of: ${VALID_PERIODS.join(', ')}`);
        return { isValid: false, errors };
      }
    }

    // Extract individual tasting profile fields
    const profileNose = safeString(this.findField(record, ['profile_nose', 'Profile (Nose)', 'Nose', 'nose', 'Aroma', 'aroma', 'Smell', 'smell']));
    const palate = safeString(this.findField(record, ['palate', 'Palate', 'Taste', 'taste', 'Flavor', 'flavor']));
    const finish = safeString(this.findField(record, ['finish', 'Finish', 'Aftertaste', 'aftertaste']));
    let tastingNotes = safeString(this.findField(record, ['tasting_notes', 'Tasting Notes', 'tasting notes', 'Tasting', 'Profile', 'profile']));

    // Combine individual fields into tasting_notes if not already set
    // This ensures BottleCard can display the profile without requiring edit+save
    if (!tastingNotes && (profileNose || palate || finish)) {
      const parts: string[] = [];
      if (profileNose) parts.push(`Nose: ${profileNose}`);
      if (palate) parts.push(`Palate: ${palate}`);
      if (finish) parts.push(`Finish: ${finish}`);
      tastingNotes = parts.join('\n');
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
      profile_nose: profileNose,
      palate: palate,
      finish: finish,
      tasting_notes: tastingNotes,
      periodic_group: periodicGroup,
      periodic_period: periodicPeriod,
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

    // Check beer (exclude ginger beer/ale and root beer which are mixers)
    const beerKeywords = ['beer', 'ale', 'lager', 'stout', 'ipa'];
    const notBeerKeywords = ['ginger beer', 'ginger ale', 'root beer'];

    const isNotBeer = notBeerKeywords.some(kw => combined.includes(kw));
    if (!isNotBeer) {
      for (const keyword of beerKeywords) {
        if (combined.includes(keyword)) return 'beer';
      }
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

  /**
   * Auto-classify an item into periodic group and period
   * Based on the Periodic Table of Mixology V2 classification logic
   */
  autoClassifyPeriodicTags(item: InventoryItem): { group: PeriodicGroup; period: PeriodicPeriod } {
    const combined = `${item.name || ''} ${item.type || ''} ${item.spirit_classification || ''}`.toLowerCase();

    // Check the classification map for matches
    const classification = this.getClassificationFromKeywords(combined);
    if (classification) {
      return classification;
    }

    // Fallback based on category
    return this.getCategoryFallback(item.category);
  }

  /**
   * Get classification from keyword matching
   * Uses the same logic as periodicTableV2.ts CLASSIFICATION_MAP
   */
  private getClassificationFromKeywords(text: string): { group: PeriodicGroup; period: PeriodicPeriod } | null {
    // Check flavored spirits FIRST (before base spirits) - these are Modifiers
    // Flavored rums go to Modifier/Cane (sweetened, flavored)
    if (/\b(mango rum|banana rum|coconut rum|pineapple rum|passion fruit rum|spiced rum|flavored rum)\b/.test(text)) {
      return { group: 'Modifier', period: 'Cane' };
    }

    // Group 1: Base spirits (high-proof backbone)
    // Period 1: Agave
    if (/\b(tequila|mezcal|raicilla|sotol|bacanora)\b/.test(text)) {
      return { group: 'Base', period: 'Agave' };
    }
    // Period 2: Cane (including overproof indicators like "151")
    if (/\b(rum|cachaca|cachaça|rhum agricole|agricole|clairin|151|overproof)\b/.test(text)) {
      return { group: 'Base', period: 'Cane' };
    }
    // Period 3: Grain
    if (/\b(whiskey|whisky|bourbon|rye|scotch|vodka|genever|soju|sake|baijiu|shochu)\b/.test(text)) {
      return { group: 'Base', period: 'Grain' };
    }
    // Period 4: Grape
    if (/\b(brandy|cognac|armagnac|pisco|grappa)\b/.test(text)) {
      return { group: 'Base', period: 'Grape' };
    }
    // Period 5: Fruit
    if (/\b(applejack|calvados|eau de vie|kirsch|pommeau|umeshu)\b/.test(text)) {
      return { group: 'Base', period: 'Fruit' };
    }
    // Period 6: Botanic (neutral base, botanical defines character)
    if (/\b(gin|absinthe|aquavit|akvavit)\b/.test(text)) {
      return { group: 'Base', period: 'Botanic' };
    }

    // Group 2: Bridge (fortified/aromatized wines)
    if (/\b(vermouth|sherry|port|madeira|marsala|dubonnet)\b/.test(text)) {
      return { group: 'Bridge', period: 'Grape' };
    }
    if (/\b(amaro|aperol|campari|cynar|fernet|lillet|cocchi americano)\b/.test(text)) {
      return { group: 'Bridge', period: 'Botanic' };
    }
    if (/\b(irish cream|baileys|drambuie)\b/.test(text)) {
      return { group: 'Bridge', period: 'Grain' };
    }

    // Group 3: Modifier (sweetened liqueurs)
    if (/\b(agavero|damiana)\b/.test(text)) {
      return { group: 'Modifier', period: 'Agave' };
    }
    if (/\b(falernum|malibu|pimento dram|allspice dram)\b/.test(text)) {
      return { group: 'Modifier', period: 'Cane' };
    }
    if (/\b(kahlua|kahlúa|coffee liqueur|mr black|tia maria|amaretto|frangelico)\b/.test(text)) {
      return { group: 'Modifier', period: 'Grain' };
    }
    if (/\b(grand marnier|chambord|maraschino|luxardo|cherry heering|cassis)\b/.test(text)) {
      return { group: 'Modifier', period: 'Grape' };
    }
    if (/\b(triple sec|cointreau|curacao|curaçao|orange liqueur|banana liqueur|midori|limoncello)\b/.test(text)) {
      return { group: 'Modifier', period: 'Fruit' };
    }
    if (/\b(st-germain|st germain|elderflower|chartreuse|benedictine|galliano|pernod|pastis|ouzo|sambuca)\b/.test(text)) {
      return { group: 'Modifier', period: 'Botanic' };
    }
    // Generic liqueur check
    if (/\b(liqueur)\b/.test(text)) {
      return { group: 'Modifier', period: 'Botanic' };
    }

    // Group 4: Sweetener (0% ABV, primarily sugar)
    if (/\b(agave nectar|agave syrup)\b/.test(text)) {
      return { group: 'Sweetener', period: 'Agave' };
    }
    if (/\b(demerara|molasses|panela|piloncillo|cane syrup)\b/.test(text)) {
      return { group: 'Sweetener', period: 'Cane' };
    }
    if (/\b(simple syrup|sugar syrup|orgeat|almond syrup|rice syrup)\b/.test(text)) {
      return { group: 'Sweetener', period: 'Grain' };
    }
    if (/\b(honey|honey syrup|balsamic)\b/.test(text)) {
      return { group: 'Sweetener', period: 'Grape' };
    }
    if (/\b(grenadine|passion fruit syrup|raspberry syrup|strawberry syrup)\b/.test(text)) {
      return { group: 'Sweetener', period: 'Fruit' };
    }
    if (/\b(ginger syrup|cinnamon syrup|vanilla syrup|lavender syrup)\b/.test(text)) {
      return { group: 'Sweetener', period: 'Botanic' };
    }
    // Generic syrup check
    if (/\b(syrup)\b/.test(text)) {
      return { group: 'Sweetener', period: 'Grain' };
    }

    // Group 5: Reagent (acids/juices)
    if (/\b(lime|lime juice)\b/.test(text)) {
      return { group: 'Reagent', period: 'Agave' };
    }
    if (/\b(grapefruit|grapefruit juice)\b/.test(text)) {
      return { group: 'Reagent', period: 'Cane' };
    }
    if (/\b(lemon|lemon juice|verjus|citric acid)\b/.test(text)) {
      return { group: 'Reagent', period: 'Grape' };
    }
    if (/\b(orange juice|pineapple|passion fruit|mango|cranberry|yuzu)\b/.test(text)) {
      return { group: 'Reagent', period: 'Fruit' };
    }
    if (/\b(ginger juice|cucumber|tomato juice|celery juice)\b/.test(text)) {
      return { group: 'Reagent', period: 'Botanic' };
    }
    // Generic juice check
    if (/\b(juice)\b/.test(text)) {
      return { group: 'Reagent', period: 'Fruit' };
    }

    // Group 6: Catalyst (bitters/extracts)
    if (/\b(mole bitters|habanero bitters|hellfire)\b/.test(text)) {
      return { group: 'Catalyst', period: 'Agave' };
    }
    if (/\b(tiki bitters)\b/.test(text)) {
      return { group: 'Catalyst', period: 'Cane' };
    }
    if (/\b(angostura|aromatic bitters|walnut bitters|chocolate bitters)\b/.test(text)) {
      return { group: 'Catalyst', period: 'Grain' };
    }
    if (/\b(peychaud|creole bitters)\b/.test(text)) {
      return { group: 'Catalyst', period: 'Grape' };
    }
    if (/\b(orange bitters|grapefruit bitters|cherry bitters|rhubarb bitters)\b/.test(text)) {
      return { group: 'Catalyst', period: 'Fruit' };
    }
    if (/\b(celery bitters|lavender bitters|cardamom)\b/.test(text)) {
      return { group: 'Catalyst', period: 'Botanic' };
    }
    // Generic bitters check
    if (/\b(bitters)\b/.test(text)) {
      return { group: 'Catalyst', period: 'Botanic' };
    }

    return null;
  }

  /**
   * Get fallback classification based on inventory category
   */
  private getCategoryFallback(category: InventoryCategory): { group: PeriodicGroup; period: PeriodicPeriod } {
    switch (category) {
      case 'spirit':
        return { group: 'Base', period: 'Grain' };
      case 'liqueur':
        return { group: 'Modifier', period: 'Botanic' };
      case 'mixer':
        return { group: 'Reagent', period: 'Fruit' };
      case 'syrup':
        return { group: 'Sweetener', period: 'Grain' };
      case 'garnish':
        return { group: 'Catalyst', period: 'Botanic' };
      case 'wine':
        return { group: 'Bridge', period: 'Grape' };
      case 'beer':
        return { group: 'Base', period: 'Grain' };
      default:
        return { group: 'Modifier', period: 'Botanic' };
    }
  }

  /**
   * Backfill periodic tags for all items missing them
   * Returns count of items updated
   * Uses bulk UPDATE with CASE statements to avoid N+1 queries
   */
  async backfillPeriodicTags(userId: number): Promise<{ updated: number; total: number }> {
    // Get all items without periodic tags for this user
    const items = await queryAll<InventoryItem>(`
      SELECT * FROM inventory_items
      WHERE user_id = $1
      AND (periodic_group IS NULL OR periodic_period IS NULL)
    `, [userId]);

    const total = items.length;
    if (total === 0) {
      return { updated: 0, total: 0 };
    }

    // Build bulk update with CASE statements
    const updates: { id: number; group: string; period: string }[] = [];
    for (const item of items) {
      const tags = this.autoClassifyPeriodicTags(item);
      updates.push({ id: item.id, group: tags.group, period: tags.period });
    }

    // Build parameterized bulk UPDATE query
    const ids = updates.map(u => u.id);
    const groupCases = updates.map((u, i) => `WHEN $${i * 3 + 2} THEN $${i * 3 + 3}`).join(' ');
    const periodCases = updates.map((u, i) => `WHEN $${i * 3 + 2} THEN $${i * 3 + 4}`).join(' ');

    // Flatten params: [userId, id1, group1, period1, id2, group2, period2, ...]
    const params: (number | string)[] = [userId];
    for (const u of updates) {
      params.push(u.id, u.group, u.period);
    }

    // Create placeholders for IN clause
    const idPlaceholders = updates.map((_, i) => `$${i * 3 + 2}`).join(', ');

    await execute(`
      UPDATE inventory_items
      SET
        periodic_group = CASE id ${groupCases} END,
        periodic_period = CASE id ${periodCases} END
      WHERE user_id = $1 AND id IN (${idPlaceholders})
    `, params);

    return { updated: total, total };
  }
}

// Export singleton instance
export const inventoryService = new InventoryService();
