/**
 * Shopping List Service
 *
 * Provides intelligent shopping recommendations based on recipe analysis.
 * Extracted from shoppingList.ts routes for better separation of concerns.
 *
 * Core Algorithm:
 * 1. Parse ingredient names from recipe strings
 * 2. Match ingredients against user's inventory (with synonyms)
 * 3. Identify craftable vs. near-miss recipes
 * 4. Recommend ingredients that unlock the most new recipes
 *
 * Features:
 * - Multi-tier ingredient matching (exact, substring, token-based)
 * - Synonym support for spirit variants
 * - Boolean operator handling ("bourbon or rye")
 * - Common pantry items auto-available
 */

import { db } from '../database/db';
import { Recipe } from '../types';
import { logger } from '../utils/logger';

/**
 * Bottle Data Interface
 *
 * Extended bottle information including spirit classifications from database.
 */
export interface BottleData {
  name: string;
  liquorType: string | null;
  detailedClassification: string | null;
}

/**
 * Shopping List Item Interface
 */
export interface ShoppingListItem {
  id: number;
  user_id: number;
  name: string;
  checked: number;
  created_at: string;
}

/**
 * Recommendation Interface
 */
export interface ShoppingRecommendation {
  ingredient: string;
  unlocks: number;
}

/**
 * Recipe with parsed ingredients
 */
export interface ParsedRecipe {
  id: number;
  name: string;
  ingredients: string[];
}

/**
 * Recipe with missing ingredients
 */
export interface RecipeWithMissing extends ParsedRecipe {
  missingIngredients: string[];
}

/**
 * Shopping list statistics
 */
export interface ShoppingStats {
  totalRecipes: number;
  craftable: number;
  nearMisses: number;
  inventoryItems: number;
  missing2to3: number;
  missing4plus: number;
}

/**
 * Smart shopping list response
 */
export interface SmartShoppingResult {
  recommendations: ShoppingRecommendation[];
  stats: ShoppingStats;
  craftableRecipes: ParsedRecipe[];
  nearMissRecipes: (ParsedRecipe & { missingIngredient: string })[];
  needFewRecipes: (ParsedRecipe & { missingCount: number })[];
  majorGapsRecipes: (ParsedRecipe & { missingCount: number })[];
}

/**
 * Synonym Map
 *
 * Maps ingredient names to their equivalents to improve matching accuracy.
 */
const SYNONYMS: Record<string, string[]> = {
  // Light rum variants
  'light rum': ['white rum', 'silver rum', 'light puerto rican rum', 'puerto rican rum', 'light virgin islands rum', 'virgin islands rum'],
  'white rum': ['light rum', 'silver rum', 'light puerto rican rum', 'puerto rican rum', 'light virgin islands rum', 'virgin islands rum'],
  'silver rum': ['white rum', 'light rum', 'light puerto rican rum', 'puerto rican rum', 'light virgin islands rum', 'virgin islands rum'],
  'light puerto rican rum': ['light rum', 'white rum', 'silver rum', 'puerto rican rum'],
  'puerto rican rum': ['light rum', 'white rum', 'silver rum', 'light puerto rican rum'],
  'light virgin islands rum': ['light rum', 'white rum', 'silver rum', 'virgin islands rum'],
  'virgin islands rum': ['light rum', 'white rum', 'silver rum', 'light virgin islands rum'],

  // Dark/Gold/Aged rum variants
  'gold rum': ['amber rum', 'aged rum', 'dark rum', 'gold puerto rican rum', 'gold jamaican rum'],
  'amber rum': ['gold rum', 'aged rum', 'dark rum'],
  'aged rum': ['gold rum', 'amber rum', 'dark rum'],
  'dark rum': ['gold rum', 'amber rum', 'aged rum', 'gold puerto rican rum', 'gold jamaican rum', 'jamaican rum', 'black rum', 'black blended rum'],
  'black rum': ['dark rum', 'black blended rum', 'goslings black seal'],
  'black blended rum': ['dark rum', 'black rum', 'goslings black seal'],
  'gold puerto rican rum': ['gold rum', 'dark rum', 'aged rum', 'amber rum'],
  'gold jamaican rum': ['gold rum', 'dark rum', 'aged rum', 'amber rum', 'jamaican rum'],
  'jamaican rum': ['dark rum', 'gold rum', 'gold jamaican rum'],

  // High-proof rum variants
  '151 rum': ['151-proof rum', 'overproof rum'],
  '151-proof rum': ['151 rum', 'overproof rum'],
  'overproof rum': ['151 rum', '151-proof rum'],

  // Demerara rum variants
  'demerara 151': ['demerara overproof', 'demerara 151-proof rum', '151-proof demerara rum', 'demerara overproof rum', 'overproof demerara rum'],
  'demerara overproof': ['demerara 151', 'demerara 151-proof rum', '151-proof demerara rum', 'demerara overproof rum', 'overproof demerara rum'],
  'demerara 151-proof rum': ['demerara 151', 'demerara overproof', '151-proof demerara rum', 'demerara overproof rum', 'overproof demerara rum'],
  '151-proof demerara rum': ['demerara 151', 'demerara overproof', 'demerara 151-proof rum', 'demerara overproof rum', 'overproof demerara rum'],
  'demerara overproof rum': ['demerara 151', 'demerara overproof', 'demerara 151-proof rum', '151-proof demerara rum', 'overproof demerara rum'],
  'overproof demerara rum': ['demerara 151', 'demerara overproof', 'demerara 151-proof rum', '151-proof demerara rum', 'demerara overproof rum'],

  // Regional rum variants
  'martinique rum': ['rhum agricole', 'agricole', 'amber martinique rum', 'martinique rhum agricole'],
  'amber martinique rum': ['rhum agricole', 'agricole', 'martinique rum', 'martinique rhum agricole'],
  'rhum agricole': ['martinique rum', 'agricole', 'amber martinique rum', 'martinique rhum agricole'],
  'agricole': ['martinique rum', 'rhum agricole', 'amber martinique rum', 'martinique rhum agricole'],
  'martinique rhum agricole': ['rhum agricole', 'martinique rum', 'agricole'],

  // Tequila variants
  'silver tequila': ['blanco tequila', 'white tequila', 'plata tequila'],
  'blanco tequila': ['silver tequila', 'white tequila', 'plata tequila'],
  'white tequila': ['silver tequila', 'blanco tequila', 'plata tequila'],

  // Whiskey/Bourbon/Rye
  'bourbon': ['bourbon whiskey'],
  'bourbon whiskey': ['bourbon'],
  'rye': ['rye whiskey'],
  'rye whiskey': ['rye'],
  'scotch': ['scotch whisky', 'blended scotch'],
  'scotch whisky': ['scotch', 'blended scotch'],

  // Brandy variants
  'cognac': ['brandy'],
  'armagnac': ['brandy'],
  'brandy': ['cognac', 'armagnac'],

  // Syrup equivalencies
  'grenadine': ['pomegranate syrup'],
  'pomegranate syrup': ['grenadine'],
  'simple syrup': ['sugar syrup', 'white sugar syrup'],
  'sugar syrup': ['simple syrup', 'white sugar syrup'],

  // Liqueur equivalencies
  'chambord': ['black raspberry liqueur', 'raspberry liqueur'],
  'black raspberry liqueur': ['chambord', 'raspberry liqueur'],
  'raspberry liqueur': ['chambord', 'black raspberry liqueur'],

  // Curacao variants
  'curacao': ['orange curacao', 'dry curacao'],
  'orange curacao': ['curacao', 'dry curacao'],
  'dry curacao': ['curacao', 'orange curacao'],

  // Triple sec / Cointreau
  'triple sec': ['cointreau'],
  'cointreau': ['triple sec'],

  // Anise spirits
  'pernod': ['pastis', 'absinthe'],
  'pastis': ['pernod', 'absinthe'],
  'absinthe': ['pernod', 'pastis'],

  // Carbonated water variants
  'seltzer': ['sparkling water', 'club soda', 'carbonated water', 'soda water'],
  'sparkling water': ['seltzer', 'club soda', 'carbonated water', 'soda water'],
  'club soda': ['seltzer', 'sparkling water', 'carbonated water', 'soda water'],
  'carbonated water': ['seltzer', 'sparkling water', 'club soda', 'soda water'],
  'soda water': ['seltzer', 'sparkling water', 'club soda', 'carbonated water'],

  // Vermouth variants
  'sweet vermouth': ['red vermouth', 'rosso vermouth', 'italian vermouth'],
  'red vermouth': ['sweet vermouth', 'rosso vermouth', 'italian vermouth'],
  'rosso vermouth': ['sweet vermouth', 'red vermouth', 'italian vermouth'],
  'italian vermouth': ['sweet vermouth', 'red vermouth', 'rosso vermouth'],
  'dry vermouth': ['white vermouth', 'french vermouth', 'extra dry vermouth'],
  'white vermouth': ['dry vermouth', 'french vermouth', 'extra dry vermouth'],
  'french vermouth': ['dry vermouth', 'white vermouth', 'extra dry vermouth'],
  'extra dry vermouth': ['dry vermouth', 'white vermouth', 'french vermouth'],

  // Citrus juice shortcuts
  'lime juice': ['lime', 'fresh lime juice', 'fresh lime'],
  'lime': ['lime juice', 'fresh lime juice', 'fresh lime'],
  'fresh lime juice': ['lime juice', 'lime', 'fresh lime'],
  'fresh lime': ['lime juice', 'lime', 'fresh lime juice'],
  'lemon juice': ['lemon', 'fresh lemon juice', 'fresh lemon'],
  'lemon': ['lemon juice', 'fresh lemon juice', 'fresh lemon'],
  'fresh lemon juice': ['lemon juice', 'lemon', 'fresh lemon'],
  'fresh lemon': ['lemon juice', 'lemon', 'fresh lemon juice'],
  'orange juice': ['orange', 'fresh orange juice', 'fresh orange'],
  'orange': ['orange juice', 'fresh orange juice', 'fresh orange'],
  'fresh orange juice': ['orange juice', 'orange', 'fresh orange'],
  'fresh orange': ['orange juice', 'orange', 'fresh orange juice'],
  'grapefruit juice': ['grapefruit', 'fresh grapefruit juice', 'fresh grapefruit'],
  'grapefruit': ['grapefruit juice', 'fresh grapefruit juice', 'fresh grapefruit'],
  'fresh grapefruit juice': ['grapefruit juice', 'grapefruit', 'fresh grapefruit'],
  'fresh grapefruit': ['grapefruit juice', 'grapefruit', 'fresh grapefruit juice']
};

/**
 * Common Pantry Items - always assumed available
 */
const ALWAYS_AVAILABLE_INGREDIENTS = new Set([
  'water', 'ice', 'sugar', 'salt',
  'crushed ice',
  'coffee', 'espresso', 'milk', 'cream', 'half and half',
  'egg white', 'egg whites', 'egg', 'eggs',
  'mint', 'mint leaves', 'fresh mint',
  'cinnamon', 'cinnamon stick', 'cinnamon sticks'
]);

/**
 * Generic Tokens - too common for substring matching
 */
const GENERIC_TOKENS = new Set([
  'fruit', 'juice', 'liquor', 'liqueur', 'soda', 'syrup', 'bitters', 'cream', 'water', 'sugar', 'milk', 'wine', 'beer'
]);

/**
 * Modifiers to remove from ingredient names
 */
const MODIFIERS_TO_REMOVE = [
  'blended', 'pot still', 'column still', 'unaged', 'lightly aged', 'aged', 'vieux', 'aoc', 'cane', 'overproof'
];

/**
 * Non-ingredient phrases to filter
 */
const NON_INGREDIENT_PHRASES = [
  'garnish', 'secret ingredients', 'secret ingredient', 'see resources', 'note following'
];

/**
 * Units to remove from ingredient strings
 */
const UNITS_TO_REMOVE = [
  'ounce', 'ounces', 'oz',
  'milliliter', 'milliliters', 'ml',
  'centiliter', 'centiliters', 'cl',
  'liter', 'liters', 'l',
  'teaspoon', 'teaspoons', 'tsp',
  'tablespoon', 'tablespoons', 'tbsp',
  'barspoon', 'barspoons',
  'cup', 'cups',
  'pint', 'pints',
  'quart', 'quarts',
  'gallon', 'gallons',
  'handful', 'handfuls',
  'dash', 'dashes',
  'drop', 'drops',
  'splash', 'splashes',
  'pinch',
  'part', 'parts',
  'fresh', 'freshly', 'squeezed', 'crushed', 'blended',
  'proof', '-proof'
];

/**
 * Prefixes to remove (brands, qualifiers)
 */
const PREFIXES_TO_REMOVE = [
  'sc', 'house', 'homemade',
  'pierre ferrand', 'ferrand', 'cointreau', 'grand marnier',
  'john d taylor', "john d. taylor['']s?", 'taylors',
  'trader joe', 'trader joes',
  'angostura', 'peychaud', 'peychauds',
  'luxardo', 'st germain', 'st-germain', 'st. germain',
  'lemon hart', 'hamilton', 'cruzan', 'appleton', 'plantation',
  'wray & nephew', 'wray and nephew', 'myers', "myers['']s",
  'bacardi', 'havana club', 'captain morgan'
];

class ShoppingListService {
  /**
   * Parse ingredient name from full string
   *
   * Extracts the ingredient name from strings like:
   * - "2 oz Bourbon" -> "bourbon"
   * - "2 dashes Angostura Bitters" -> "angostura bitters"
   * - "Bourbon or Rye" -> ["bourbon", "rye"]
   */
  parseIngredientName(ingredientStr: string): string | string[] {
    logger.debug('[TRACE-v2] parseIngredientName ENTER', { ingredientStr });
    if (!ingredientStr || typeof ingredientStr !== 'string') {
      return '';
    }

    let normalized = ingredientStr.toLowerCase().trim();

    // Strip parenthetical references
    normalized = normalized.replace(/\s*\([^)]*(\)|$)\s*/g, ' ').trim();

    // Normalize Unicode
    normalized = normalized.normalize('NFKD').replace(/\u2044/g, '/');

    // Remove measurements and numbers
    normalized = normalized.replace(/^\d+\s+\d+\s*\/\s*\d+\s*(ounces?|oz|ml|cl|l|tsp|tbsp|cups?)?/i, '').trim();
    normalized = normalized.replace(/^\d+\s*\/\s*\d+\s*(ounces?|oz|ml|cl|l|tsp|tbsp|cups?)?/i, '').trim();
    normalized = normalized.replace(/^\d+\s*(ounces?|oz|ml|cl|l|tsp|tbsp|cups?)\s*\([^)]+\)\s*/i, '').trim();
    normalized = normalized.replace(/^\d+\s+(to|or|-)\s+\d+\s*/i, '').trim();
    normalized = normalized.replace(/^\d+\.?\d*\s*(ounces?|oz|ml|cl|liters?|l|tsp|tbsp|cups?|dashes|dash)\b/i, '').trim();
    normalized = normalized.replace(/^[\d\s]+/, '').trim();

    // Remove units (multiple passes)
    for (let i = 0; i < 3; i++) {
      for (const unit of UNITS_TO_REMOVE) {
        const regex = new RegExp(`\\b${unit}\\b`, 'gi');
        normalized = normalized.replace(regex, '').trim();
      }
    }

    // Remove modifiers
    for (let i = 0; i < 3; i++) {
      for (const modifier of MODIFIERS_TO_REMOVE) {
        const regex = new RegExp(`\\b${modifier}\\b`, 'gi');
        normalized = normalized.replace(regex, '').trim();
      }
    }

    // Remove prefixes/brands
    for (const prefix of PREFIXES_TO_REMOVE) {
      const regex = new RegExp(`^${prefix}\\b\\s*`, 'i');
      normalized = normalized.replace(regex, '').trim();
    }

    // Normalize syrups
    if (normalized.includes('syrup')) {
      const recipeQualifiers = ['mai tai', 'mojito', 'daiquiri', 'margarita', 'zombie'];
      for (const qualifier of recipeQualifiers) {
        const regex = new RegExp(`\\b${qualifier}\\b\\s*`, 'gi');
        normalized = normalized.replace(regex, '').trim();
      }
      const syrupModifiers = ['rich', 'light', '1:1', '2:1', 'heavy', 'thin', 'sugar'];
      for (const modifier of syrupModifiers) {
        const regex = new RegExp(`\\b${modifier}\\b\\s*`, 'gi');
        normalized = normalized.replace(regex, '').trim();
      }
      normalized = normalized.replace(/\s+/g, ' ').trim();
    }

    // Clean up whitespace and punctuation
    normalized = normalized.replace(/\s+/g, ' ').trim();
    normalized = normalized.replace(/(\d+)-\s+/g, '$1 ').trim();

    // Remove leading articles
    let prevNormalized;
    do {
      prevNormalized = normalized;
      normalized = normalized.replace(/^(a|an|the|of)\s+/gi, '').trim();
    } while (normalized !== prevNormalized && normalized.length > 0);

    // Handle aged rum indicators
    if (/^(añejo|anejo|reserva|\d+)(\s+rum)?$/.test(normalized)) {
      normalized = 'dark rum';
    }

    // Handle boolean operators (e.g., "bourbon or rye")
    if (normalized.includes(' or ')) {
      const alternatives = normalized
        .split(/\s+or\s+/)
        .map(alt => alt.trim())
        .filter(alt => alt.length > 0);
      if (alternatives.length > 1) {
        logger.debug('[TRACE-v2] parseIngredientName EXIT array', { alternatives });
        return alternatives;
      }
    }

    // Filter non-ingredient phrases
    if (NON_INGREDIENT_PHRASES.some(phrase => normalized.includes(phrase))) {
      logger.debug('[TRACE-v2] parseIngredientName EXIT (filtered phrase)');
      return '';
    }

    logger.debug('[TRACE-v2] parseIngredientName EXIT', { normalized });
    return normalized;
  }

  /**
   * Normalize string for matching
   */
  private normalizeForMatching(str: string): string {
    if (!str) return '';
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  /**
   * Check if inventory contains ingredient
   */
  hasIngredient(bottles: BottleData[], ingredientName: string): boolean {
    if (!ingredientName || ingredientName.length === 0) {
      return false;
    }

    const normalizedIngredient = this.normalizeForMatching(ingredientName);

    // Check pantry items
    if (ALWAYS_AVAILABLE_INGREDIENTS.has(normalizedIngredient)) {
      return true;
    }

    // Build candidates with synonyms
    const candidates = [normalizedIngredient];
    if (SYNONYMS[normalizedIngredient]) {
      candidates.push(...SYNONYMS[normalizedIngredient]);
    }

    return candidates.some(candidate => {
      const ingredientTokens = candidate
        .split(/[\s\/\-,]+/)
        .filter(t => t.length > 2);

      return bottles.some(bottle => {
        const normalizedName = this.normalizeForMatching(bottle.name);
        const normalizedLiquorType = this.normalizeForMatching(bottle.liquorType || '');
        const normalizedClassification = this.normalizeForMatching(bottle.detailedClassification || '');
        const fields = [normalizedName, normalizedLiquorType, normalizedClassification];

        // Tier 1: Exact match
        for (const field of fields) {
          if (field === candidate) {
            logger.debug('[MATCH-TRACE] SUCCESS (Exact)', { candidate, bottleName: bottle.name });
            return true;
          }
        }

        // Tier 2: Substring match for multi-word phrases
        if (candidate.includes(' ')) {
          for (const field of fields) {
            if (field && field.includes(candidate)) {
              logger.debug('[MATCH-TRACE] SUCCESS (Substring)', { candidate, bottleName: bottle.name });
              return true;
            }
          }
        }

        // Tier 3: Token-based matching
        if (ingredientTokens.length === 0) {
          return false;
        }

        const allBottleTokens = [normalizedName, normalizedLiquorType, normalizedClassification]
          .join(' ')
          .split(/[\s\/\-,]+/)
          .filter(t => t.length > 2);

        const matchingTokens = ingredientTokens.filter(ingToken =>
          allBottleTokens.some(bottleToken => {
            const isGeneric = GENERIC_TOKENS.has(ingToken) || GENERIC_TOKENS.has(bottleToken);
            if (isGeneric) {
              return bottleToken === ingToken;
            }
            return bottleToken.includes(ingToken) || ingToken.includes(bottleToken);
          })
        );

        // Single-token ingredients
        if (ingredientTokens.length === 1) {
          const singleToken = ingredientTokens[0];
          const match = fields.some(field => field && field.includes(singleToken));
          if (match) {
            logger.debug('[MATCH-TRACE] SUCCESS (Token-1)', { candidate, bottleName: bottle.name });
          }
          return match;
        }

        // Two-token ingredients
        if (ingredientTokens.length === 2) {
          const match = matchingTokens.length === ingredientTokens.length;
          if (match) {
            logger.debug('[MATCH-TRACE] SUCCESS (Token-2)', { candidate, bottleName: bottle.name });
          }
          return match;
        }

        // Complex ingredients (3+ tokens)
        const matchPercentage = matchingTokens.length / ingredientTokens.length;
        if (matchPercentage > 0.5 && matchingTokens.length >= 2) {
          logger.debug('[MATCH-TRACE] SUCCESS (Token-3+)', { candidate, bottleName: bottle.name });
          return true;
        }

        return false;
      });
    });
  }

  /**
   * Check if recipe is craftable (all ingredients available)
   */
  isCraftable(ingredients: string[], bottles: BottleData[]): boolean {
    if (!ingredients || ingredients.length === 0) {
      return false;
    }

    return ingredients.every(ingredient => {
      const ingredientName = this.parseIngredientName(ingredient);

      if (!ingredientName) {
        return true; // Empty ingredients don't block craftability
      }

      if (Array.isArray(ingredientName)) {
        return ingredientName.some(alt => this.hasIngredient(bottles, alt));
      }

      if (typeof ingredientName === 'string' && ingredientName.trim() === '') {
        return true;
      }

      return this.hasIngredient(bottles, ingredientName);
    });
  }

  /**
   * Find missing ingredients for a recipe
   */
  findMissingIngredients(ingredients: string[], bottles: BottleData[]): string[] {
    if (!ingredients || ingredients.length === 0) {
      return [];
    }

    const missing: string[] = [];

    for (const ingredient of ingredients) {
      const ingredientName = this.parseIngredientName(ingredient);

      if (!ingredientName) {
        continue;
      }

      if (Array.isArray(ingredientName)) {
        const hasAny = ingredientName.some(alt => this.hasIngredient(bottles, alt));
        if (!hasAny) {
          missing.push(ingredientName.join(' or '));
        }
        continue;
      }

      if (typeof ingredientName === 'string' && ingredientName.trim() === '') {
        continue;
      }

      if (!this.hasIngredient(bottles, ingredientName)) {
        missing.push(ingredientName);
      }
    }

    return missing;
  }

  /**
   * Get user's inventory as BottleData array
   */
  getUserBottles(userId: number): BottleData[] {
    const bottlesRaw = db.prepare(`
      SELECT
        name,
        type as liquorType,
        spirit_classification as detailedClassification,
        stock_number as stockNumber
      FROM inventory_items
      WHERE user_id = ?
        AND (stock_number IS NOT NULL AND stock_number > 0)
    `).all(userId) as Array<{
      name: string;
      liquorType: string | null;
      detailedClassification: string | null;
      stockNumber: number | null;
    }>;

    return bottlesRaw.map(b => ({
      name: b.name,
      liquorType: b.liquorType,
      detailedClassification: b.detailedClassification
    }));
  }

  /**
   * Get user's recipes with parsed ingredients
   */
  getUserRecipes(userId: number): ParsedRecipe[] {
    const recipes = db.prepare(`
      SELECT id, name, ingredients FROM recipes WHERE user_id = ?
    `).all(userId) as Recipe[];

    return recipes
      .filter((recipe): recipe is Recipe & { id: number } => recipe.id !== undefined)
      .map(recipe => {
        let ingredients: string[] = [];

        try {
          const parsed = typeof recipe.ingredients === 'string'
            ? JSON.parse(recipe.ingredients)
            : recipe.ingredients;

          if (Array.isArray(parsed)) {
            ingredients = parsed.filter(i => typeof i === 'string');
          }
        } catch (error) {
          logger.warn('Failed to parse ingredients for recipe', { recipeId: recipe.id, error: error instanceof Error ? error.message : 'Unknown error' });
        }

        return {
          id: recipe.id,
          name: recipe.name,
          ingredients
        };
      });
  }

  /**
   * Get smart shopping recommendations
   */
  getSmartRecommendations(userId: number): SmartShoppingResult {
    logger.debug('[DEBUG-VERIFY-v2] Smart Shopping List Request Received');

    const bottles = this.getUserBottles(userId);
    const parsedRecipes = this.getUserRecipes(userId);

    // Find craftable recipes
    const craftableRecipes = parsedRecipes.filter(recipe =>
      this.isCraftable(recipe.ingredients, bottles)
    );

    // Find non-craftable recipes with missing ingredients
    const allNonCraftable = parsedRecipes
      .filter(recipe => !this.isCraftable(recipe.ingredients, bottles))
      .map(recipe => ({
        ...recipe,
        missingIngredients: this.findMissingIngredients(recipe.ingredients, bottles)
      }));

    // Near-miss recipes (missing exactly 1 ingredient)
    const nearMissRecipes = allNonCraftable.filter(recipe => recipe.missingIngredients.length === 1);

    // Count how many recipes each ingredient would unlock
    const ingredientUnlockCount = new Map<string, number>();
    for (const recipe of nearMissRecipes) {
      const missingIngredient = recipe.missingIngredients[0];
      const count = ingredientUnlockCount.get(missingIngredient) || 0;
      ingredientUnlockCount.set(missingIngredient, count + 1);
    }

    // Sort recommendations by unlock count
    const recommendations = Array.from(ingredientUnlockCount.entries())
      .map(([ingredient, unlocks]) => ({ ingredient, unlocks }))
      .sort((a, b) => b.unlocks - a.unlocks);

    // Calculate breakdown by missing ingredient count
    const missingBreakdown = new Map<number, number>();
    allNonCraftable.forEach(recipe => {
      const count = recipe.missingIngredients.length;
      missingBreakdown.set(count, (missingBreakdown.get(count) || 0) + 1);
    });

    const stats: ShoppingStats = {
      totalRecipes: parsedRecipes.length,
      craftable: craftableRecipes.length,
      nearMisses: nearMissRecipes.length,
      inventoryItems: bottles.length,
      missing2to3: (missingBreakdown.get(2) || 0) + (missingBreakdown.get(3) || 0),
      missing4plus: Array.from(missingBreakdown.entries())
        .filter(([count]) => count >= 4)
        .reduce((sum, [, recipeCount]) => sum + recipeCount, 0)
    };

    // Categorize recipes
    const needFewRecipes = allNonCraftable.filter(r =>
      r.missingIngredients.length >= 2 && r.missingIngredients.length <= 3
    );
    const majorGapsRecipes = allNonCraftable.filter(r =>
      r.missingIngredients.length >= 4
    );

    return {
      recommendations,
      stats,
      craftableRecipes: craftableRecipes.map(r => ({
        id: r.id,
        name: r.name,
        ingredients: r.ingredients
      })),
      nearMissRecipes: nearMissRecipes.map(r => ({
        id: r.id,
        name: r.name,
        ingredients: r.ingredients,
        missingIngredient: r.missingIngredients[0]
      })),
      needFewRecipes: needFewRecipes.map(r => ({
        id: r.id,
        name: r.name,
        ingredients: r.ingredients,
        missingCount: r.missingIngredients.length
      })),
      majorGapsRecipes: majorGapsRecipes.map(r => ({
        id: r.id,
        name: r.name,
        ingredients: r.ingredients,
        missingCount: r.missingIngredients.length
      }))
    };
  }

  // =========================================================================
  // Shopping List Items CRUD
  // =========================================================================

  /**
   * Get all shopping list items for a user
   */
  getItems(userId: number): { id: number; name: string; checked: boolean; createdAt: string }[] {
    const items = db.prepare(`
      SELECT id, name, checked, created_at
      FROM shopping_list_items
      WHERE user_id = ?
      ORDER BY created_at DESC
    `).all(userId) as ShoppingListItem[];

    return items.map(item => ({
      id: item.id,
      name: item.name,
      checked: item.checked === 1,
      createdAt: item.created_at
    }));
  }

  /**
   * Add item to shopping list
   */
  addItem(userId: number, name: string): { id: number; name: string; checked: boolean; createdAt: string } | null {
    const trimmedName = name.trim();

    // Check for duplicate
    const existing = db.prepare(`
      SELECT id FROM shopping_list_items
      WHERE user_id = ? AND LOWER(name) = LOWER(?)
    `).get(userId, trimmedName) as ShoppingListItem | undefined;

    if (existing) {
      return null; // Duplicate
    }

    const result = db.prepare(`
      INSERT INTO shopping_list_items (user_id, name, checked)
      VALUES (?, ?, 0)
    `).run(userId, trimmedName);

    const newItem = db.prepare(`
      SELECT id, name, checked, created_at
      FROM shopping_list_items
      WHERE id = ?
    `).get(result.lastInsertRowid) as ShoppingListItem;

    return {
      id: newItem.id,
      name: newItem.name,
      checked: newItem.checked === 1,
      createdAt: newItem.created_at
    };
  }

  /**
   * Update item in shopping list
   */
  updateItem(userId: number, itemId: number, updates: { checked?: boolean; name?: string }): { id: number; name: string; checked: boolean; createdAt: string } | null {
    // Verify ownership
    const existing = db.prepare(`
      SELECT id FROM shopping_list_items
      WHERE id = ? AND user_id = ?
    `).get(itemId, userId) as ShoppingListItem | undefined;

    if (!existing) {
      return null;
    }

    // Build update query
    const updateParts: string[] = [];
    const params: (string | number)[] = [];

    if (typeof updates.checked === 'boolean') {
      updateParts.push('checked = ?');
      params.push(updates.checked ? 1 : 0);
    }

    if (typeof updates.name === 'string' && updates.name.trim().length > 0) {
      updateParts.push('name = ?');
      params.push(updates.name.trim());
    }

    if (updateParts.length === 0) {
      return null;
    }

    params.push(itemId, userId);

    db.prepare(`
      UPDATE shopping_list_items
      SET ${updateParts.join(', ')}
      WHERE id = ? AND user_id = ?
    `).run(...params);

    const updated = db.prepare(`
      SELECT id, name, checked, created_at
      FROM shopping_list_items
      WHERE id = ?
    `).get(itemId) as ShoppingListItem;

    return {
      id: updated.id,
      name: updated.name,
      checked: updated.checked === 1,
      createdAt: updated.created_at
    };
  }

  /**
   * Delete item from shopping list
   */
  deleteItem(userId: number, itemId: number): boolean {
    const result = db.prepare(`
      DELETE FROM shopping_list_items
      WHERE id = ? AND user_id = ?
    `).run(itemId, userId);

    return result.changes > 0;
  }

  /**
   * Delete all checked items
   */
  deleteCheckedItems(userId: number): number {
    const result = db.prepare(`
      DELETE FROM shopping_list_items
      WHERE user_id = ? AND checked = 1
    `).run(userId);

    return result.changes;
  }
}

export const shoppingListService = new ShoppingListService();
