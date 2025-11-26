/**
 * Shopping List Routes
 *
 * Provides intelligent shopping recommendations based on recipe analysis.
 *
 * Features:
 * - GET /api/shopping-list/smart - Analyze inventory and recommend ingredients
 *
 * Core Algorithm:
 * 1. Fetch user's current bar inventory (bottle names)
 * 2. Fetch all user's recipes with their ingredient lists
 * 3. Identify "craftable" recipes (all ingredients in inventory)
 * 4. Find "near miss" recipes (missing exactly 1 ingredient)
 * 5. Count how many new recipes each missing ingredient would unlock
 * 6. Return sorted list of recommendations
 *
 * Security:
 * - All routes require JWT authentication (authMiddleware)
 * - User isolation: Only analyzes user's own data
 * - No external API calls or file operations
 * - Read-only operations (no database modifications)
 *
 * Performance:
 * - Optimized for recipe collections up to 1,000 recipes
 * - In-memory processing (no complex joins)
 * - O(n*m) complexity where n=recipes, m=ingredients per recipe
 */

import { Router, Request, Response } from 'express';
import { db } from '../database/db';
import { authMiddleware } from '../middleware/auth';
import { userRateLimit } from '../middleware/userRateLimit';
import { Recipe } from '../types';

const router = Router();

/**
 * Authentication Requirement
 *
 * All shopping list routes require valid JWT token.
 * Ensures users only get recommendations based on their own data.
 */
router.use(authMiddleware);
// No rate limiting on shopping list - users should be able to view their shopping list freely

/**
 * Synonym Map
 *
 * Maps ingredient names to their equivalents to improve matching accuracy.
 * This handles common variations in spirit naming conventions.
 */
const SYNONYMS: Record<string, string[]> = {
  // Light rum variants - expanded coverage
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
  'dark rum': ['gold rum', 'amber rum', 'aged rum', 'gold puerto rican rum', 'gold jamaican rum', 'jamaican rum'],
  'gold puerto rican rum': ['gold rum', 'dark rum', 'aged rum', 'amber rum'],
  'gold jamaican rum': ['gold rum', 'dark rum', 'aged rum', 'amber rum', 'jamaican rum'],
  'jamaican rum': ['dark rum', 'gold rum', 'gold jamaican rum'],

  // High-proof rum variants
  '151 rum': ['151-proof rum', 'overproof rum'],
  '151-proof rum': ['151 rum', 'overproof rum'],
  'overproof rum': ['151 rum', '151-proof rum'],

  // Demerara rum variants - specific high-proof type
  'demerara 151': ['demerara overproof', 'demerara 151-proof rum', '151-proof demerara rum', 'demerara overproof rum', 'overproof demerara rum'],
  'demerara overproof': ['demerara 151', 'demerara 151-proof rum', '151-proof demerara rum', 'demerara overproof rum', 'overproof demerara rum'],
  'demerara 151-proof rum': ['demerara 151', 'demerara overproof', '151-proof demerara rum', 'demerara overproof rum', 'overproof demerara rum'],
  '151-proof demerara rum': ['demerara 151', 'demerara overproof', 'demerara 151-proof rum', 'demerara overproof rum', 'overproof demerara rum'],
  'demerara overproof rum': ['demerara 151', 'demerara overproof', 'demerara 151-proof rum', '151-proof demerara rum', 'overproof demerara rum'],
  'overproof demerara rum': ['demerara 151', 'demerara overproof', 'demerara 151-proof rum', '151-proof demerara rum', 'demerara overproof rum'],

  // Regional rum variants
  'martinique rum': ['rhum agricole', 'agricole', 'amber martinique rum'],
  'amber martinique rum': ['rhum agricole', 'agricole', 'martinique rum'],
  'rhum agricole': ['martinique rum', 'agricole', 'amber martinique rum'],
  'agricole': ['martinique rum', 'rhum agricole', 'amber martinique rum'],

  // Tequila variants
  'silver tequila': ['blanco tequila', 'white tequila', 'plata tequila'],
  'blanco tequila': ['silver tequila', 'white tequila', 'plata tequila'],
  'white tequila': ['silver tequila', 'blanco tequila', 'plata tequila'],

  // Whiskey/Bourbon/Rye - now handles "bourbon or rye" properly
  'bourbon': ['bourbon whiskey'],
  'bourbon whiskey': ['bourbon'],

  'rye': ['rye whiskey'],
  'rye whiskey': ['rye'],

  'scotch': ['scotch whisky', 'blended scotch'],
  'scotch whisky': ['scotch', 'blended scotch'],

  // Brandy variants
  'cognac': ['brandy'], // Cognac is a specific brandy
  'armagnac': ['brandy'],
  'brandy': ['cognac', 'armagnac'], // Brandy can match specific types

  // Syrup equivalencies - CRITICAL for matching
  'grenadine': ['pomegranate syrup'],
  'pomegranate syrup': ['grenadine'],

  'simple syrup': ['sugar syrup', 'white sugar syrup'],
  'sugar syrup': ['simple syrup', 'white sugar syrup'],

  // Liqueur equivalencies
  'chambord': ['black raspberry liqueur', 'raspberry liqueur'],
  'black raspberry liqueur': ['chambord', 'raspberry liqueur'],
  'raspberry liqueur': ['chambord', 'black raspberry liqueur'],

  // Anise spirits - Pernod/Pastis/Absinthe
  'pernod': ['pastis', 'absinthe'],
  'pastis': ['pernod', 'absinthe'],
  'absinthe': ['pernod', 'pastis']
};

/**
 * Helper: Parse Ingredient Name from Full String
 *
 * Extracts the ingredient name from strings like:
 * - "2 oz Bourbon" → "bourbon"
 * - "1 sugar cube" → "sugar cube"
 * - "2 dashes Angostura Bitters" → "angostura bitters"
 * - "Light Puerto Rican Rum (see page 230)" → "light puerto rican rum"
 * - "Bourbon or Rye" → returns array ["bourbon", "rye"]
 *
 * Algorithm:
 * 1. Convert to lowercase for case-insensitive matching
 * 2. Strip parenthetical references like (see page 230)
 * 3. Remove leading numbers (e.g., "2", "1.5")
 * 4. Remove common units and measurements
 * 5. Trim whitespace
 * 6. Return normalized ingredient name
 *
 * @param ingredientStr - Raw ingredient string from recipe
 * @returns Normalized ingredient name or array of alternatives
 */
function parseIngredientName(ingredientStr: string): string | string[] {
  if (!ingredientStr || typeof ingredientStr !== 'string') {
    return '';
  }

  // Convert to lowercase for case-insensitive matching
  let normalized = ingredientStr.toLowerCase().trim();

  // Step 0a: Strip parenthetical references FIRST (e.g., "(see page 230)")
  // This handles patterns like "Light Rum (see page 230)" → "Light Rum"
  normalized = normalized.replace(/\s*\([^)]*\)\s*/g, ' ').trim();

  // Step 0b: Normalize Unicode to decompose fractions (e.g., ½ -> 1⁄2)
  // and replace fraction slash with standard slash
  normalized = normalized.normalize('NFKD').replace(/\u2044/g, '/');

  // Step 1: Remove leading numbers, fractions, and measurements
  // Handles: "2 oz", "1.5 oz", "1/2 oz", "3/4oz", "2 1/2 oz", "½", "¾", "1½", "8 ounces (1 cup)"

  // IMPORTANT: Order matters! Match fractions BEFORE simple numbers

  // Remove mixed fractions: "2 1/2 oz" → remove entire pattern
  normalized = normalized.replace(/^\d+\s+\d+\s*\/\s*\d+\s*(ounces?|oz|ml|cl|l|tsp|tbsp|cups?)?/i, '').trim();

  // Then remove simple ASCII fractions: "1/2 oz", "3/4 ounce"
  normalized = normalized.replace(/^\d+\s*\/\s*\d+\s*(ounces?|oz|ml|cl|l|tsp|tbsp|cups?)?/i, '').trim();

  // Remove complex patterns: "8 ounces (1 cup)" → remove everything up to and including ")"
  normalized = normalized.replace(/^\d+\s*(ounces?|oz|ml|cl|l|tsp|tbsp|cups?)\s*\([^)]+\)\s*/i, '').trim();

  // Remove number ranges: "4 to 6 mint leaves" -> "mint leaves"
  // IMPORTANT: Must come BEFORE decimal number removal
  normalized = normalized.replace(/^\d+\s+to\s+\d+\s*/i, '').trim();

  // Remove decimal numbers with optional units: "1.5 oz", "1 ounces", "2 ounces", "2 dashes"
  // IMPORTANT: Put "dashes" before "dash" so it matches the longer form first
  // IMPORTANT: Use word boundary \b after unit to prevent "2 l" from matching "2 lime"
  normalized = normalized.replace(/^\d+\.?\d*\s*(ounces?|oz|ml|cl|liters?|l|tsp|tbsp|cups?|dashes|dash)\b/i, '').trim();

  // Remove any remaining leading numbers and spaces
  normalized = normalized.replace(/^[\d\s]+/, '').trim();

  // List of common units and measurements to remove
  const unitsToRemove = [
    // Volume
    'ounce', 'ounces', 'oz',
    'milliliter', 'milliliters', 'ml',
    'centiliter', 'centiliters', 'cl',
    'liter', 'liters', 'l',
    // Spoons
    'teaspoon', 'teaspoons', 'tsp',
    'tablespoon', 'tablespoons', 'tbsp',
    'barspoon', 'barspoons',
    // Containers
    'cup', 'cups',
    'pint', 'pints',
    'quart', 'quarts',
    'gallon', 'gallons',
    'handful', 'handfuls',
    // Small amounts
    'dash', 'dashes',
    'drop', 'drops',
    'splash', 'splashes',
    'pinch',
    // Proportions
    'part', 'parts',
    // Qualifiers
    'fresh', 'freshly', 'squeezed', 'crushed',
    // Proof indicators (remove the word, number stays)
    'proof', '-proof'
    // IMPORTANT: Do NOT remove 'juice', 'syrup', 'cream' - these are part of ingredient names
  ];

  // Step 2: Remove units (do this multiple times to handle compound measurements)
  for (let i = 0; i < 3; i++) {
    for (const unit of unitsToRemove) {
      // Remove unit with word boundaries to avoid partial matches
      // DOUBLE BACKSLASHED for safety in string constructor logic, though here it's fine
      const regex = new RegExp(`\b${unit}\b`, 'gi');
      normalized = normalized.replace(regex, '').trim();
    }
  }

  // Step 3: Remove common prefixes and brand names
  const prefixesToRemove = [
    'sc', 'house', 'homemade',
    // Common spirit brands that appear in recipes
    'pierre ferrand', 'ferrand', 'cointreau', 'grand marnier',
    'john d taylor', "john d. taylor's", 'taylors',
    'trader joe', 'trader joes',
    'angostura', 'peychaud', 'peychauds',
    'luxardo', 'st germain', 'st-germain', 'st. germain',
    // Rum brands
    'lemon hart', 'hamilton', 'cruzan', 'appleton', 'plantation',
    'wray & nephew', 'wray and nephew', 'myers', "myers's",
    'bacardi', 'havana club', 'captain morgan'
  ];
  for (const prefix of prefixesToRemove) {
    const regex = new RegExp(`^${prefix}\b\s*`, 'i');
    normalized = normalized.replace(regex, '').trim();
  }

  // Step 4: Normalize syrup variants to base forms
  if (normalized.includes('syrup')) {
    // First, remove recipe-specific qualifiers
    const recipeQualifiers = ['mai tai', 'mojito', 'daiquiri', 'margarita', 'zombie'];
    for (const qualifier of recipeQualifiers) {
      const regex = new RegExp(`\b${qualifier}\b\s*`, 'gi');
      normalized = normalized.replace(regex, '').trim();
    }

    // Then remove syrup style modifiers
    const syrupModifiers = ['rich', 'light', '1:1', '2:1', 'heavy', 'thin', 'sugar'];
    for (const modifier of syrupModifiers) {
      const regex = new RegExp(`\b${modifier}\b\s*`, 'gi');
      normalized = normalized.replace(regex, '').trim();
    }

    // Clean up resulting patterns
    normalized = normalized.replace(/\s+/g, ' ').trim();
  }

  // Step 5: Clean up extra whitespace and dangling punctuation
  normalized = normalized.replace(/\s+/g, ' ').trim();

  // Remove dangling hyphens (e.g., "151- rum" -> "151 rum")
  normalized = normalized.replace(/(\d+)-\s+/g, '$1 ').trim();

  // Remove leading articles and prepositions (loop to handle multiple)
  // e.g., "a of ice" -> "of ice" -> "ice"
  let prevNormalized;
  do {
    prevNormalized = normalized;
    normalized = normalized.replace(/^(a|an|the|of)\s+/gi, '').trim();
  } while (normalized !== prevNormalized && normalized.length > 0);

  // Special handling: Detect aged rum indicators after brand removal
  // "Bacardi 8" -> "8 rum" should become "dark rum"
  // "Havana Club 7" -> "7" should become "dark rum"
  // Pattern: standalone number or Spanish age terms, optionally followed by "rum"
  if (/^(añejo|anejo|reserva|\d+)(\s+rum)?$/.test(normalized)) {
    normalized = 'dark rum';
  }

  // Step 6: Handle boolean operators (e.g., "bourbon or rye")
  // If ingredient contains " or ", split into alternatives and return array
  // This allows recipes to match if user has ANY of the alternatives
  if (normalized.includes(' or ')) {
    const alternatives = normalized
      .split(/\s+or\s+/)
      .map(alt => alt.trim())
      .filter(alt => alt.length > 0);

    // Return array of alternatives if we found multiple valid options
    if (alternatives.length > 1) {
      return alternatives;
    }
  }

  return normalized;
}

/**
 * Bottle Data Interface
 *
 * Extended bottle information including spirit classifications from database.
 * Uses actual "Liquor Type" and "Detailed Spirit Classification" fields
 * instead of hardcoded brand mappings.
 */
interface BottleData {
  name: string;
  liquorType: string | null;
  detailedClassification: string | null;
}

/**
 * Helper: Normalize String for Matching
 *
 * Normalizes strings by:
 * 1. Converting to lowercase
 * 2. Removing accents/diacritics (ç → c, é → e, etc.)
 * 3. Trimming whitespace
 *
 * Examples:
 * - "Curaçao" → "curacao"
 * - "Crème de Menthe" → "creme de menthe"
 * - "Angostura" → "angostura" (unchanged)
 *
 * @param str - String to normalize
 * @returns Normalized string for matching
 */
function normalizeForMatching(str: string): string {
  if (!str) return '';

  return str
    .toLowerCase()
    .normalize('NFD') // Decompose accented characters (ç → c + ̧)
    .replace(/[̀-ͯ]/g, '') // Remove diacritical marks
    .trim();
}

/**
 * Common Pantry Items
 *
 * Ingredients that are always assumed to be available in any home bar/kitchen.
 * These items are automatically considered "in stock" without needing explicit inventory.
 */
const ALWAYS_AVAILABLE_INGREDIENTS = new Set([
  'water', 'ice', 'sugar', 'salt',
  'crushed ice', // Ice variants
  'coffee', 'espresso', 'milk', 'cream', 'half and half',
  'egg white', 'egg whites', 'egg', 'eggs',
  'mint', 'mint leaves', 'fresh mint', // Mint variants
  'cinnamon', 'cinnamon stick', 'cinnamon sticks' // Cinnamon variants
]);

/**
 * Helper: Check if Inventory Contains Ingredient
 *
 * Performs multi-tier matching between inventory bottles and ingredient.
 * Uses bottle name, liquor type, and detailed classification for matching.
 * Supports synonyms and relaxed matching for better accuracy.
 *
 * @param bottles - Array of bottle data from user's bar
 * @param ingredientName - Parsed ingredient name from recipe
 * @returns true if ingredient is available in inventory
 */
function hasIngredient(bottles: BottleData[], ingredientName: string): boolean {
  if (!ingredientName || ingredientName.length === 0) {
    return false;
  }

  const normalizedIngredient = normalizeForMatching(ingredientName);

  // Check if this is a common pantry item that's always available
  if (ALWAYS_AVAILABLE_INGREDIENTS.has(normalizedIngredient)) {
    return true;
  }

  // Build list of candidate ingredient names (original + synonyms)
  const candidates = [normalizedIngredient];
  if (SYNONYMS[normalizedIngredient]) {
    candidates.push(...SYNONYMS[normalizedIngredient]);
  }

  return candidates.some(candidate => {
    // Split ingredient into tokens (words)
    const ingredientTokens = candidate
      .split(/[\s\/\-,]+/)
      .filter(t => t.length > 2); // Ignore very short words

    return bottles.some(bottle => {
      const normalizedName = normalizeForMatching(bottle.name);
      const normalizedLiquorType = normalizeForMatching(bottle.liquorType || '');
      const normalizedClassification = normalizeForMatching(bottle.detailedClassification || '');

      const fields = [normalizedName, normalizedLiquorType, normalizedClassification];

      // Tier 1: Exact match (case-insensitive)
      // Check if any candidate exactly matches a bottle field
      for (const field of fields) {
        if (field === candidate) {
          return true;
        }
      }

      // Tier 2: Substring match for multi-word ingredient phrases
      // Ingredient appears as complete phrase within bottle field
      const hasSpaces = candidate.includes(' ');
      if (hasSpaces) {
        for (const field of fields) {
          if (field && field.includes(candidate)) {
            return true;
          }
        }
      }

      // Tier 3: Token-based matching
      if (ingredientTokens.length === 0) {
        return false;
      }

      // Combine all bottle info into tokens
      const allBottleTokens = [normalizedName, normalizedLiquorType, normalizedClassification]
        .join(' ')
        .split(/[\s\/\-,]+/)
        .filter(t => t.length > 2);

      const matchingTokens = ingredientTokens.filter(ingToken =>
        allBottleTokens.some(bottleToken =>
          bottleToken.includes(ingToken) || ingToken.includes(bottleToken)
        )
      );

      // Tier 3a: Single-token ingredients
      if (ingredientTokens.length === 1) {
        const singleToken = ingredientTokens[0];
        // RELAXED: Check if the token appears in any bottle field (substring check)
        // This allows "Rye" to match "Rye Whiskey" or "Bourbon" to match "Bourbon Whiskey"
        return fields.some(field => field && field.includes(singleToken));
      }

      // Tier 3b: Two-token ingredients
      if (ingredientTokens.length === 2) {
        // Require both tokens to be present
        return matchingTokens.length === ingredientTokens.length;
      }

      // Tier 3c: Complex ingredients (3+ tokens)
      const matchPercentage = matchingTokens.length / ingredientTokens.length;
      if (matchPercentage > 0.5 && matchingTokens.length >= 2) {
        return true;
      }

      return false;
    });
  });
}

/**
 * Helper: Check if Recipe is Craftable
 *
 * Determines if all recipe ingredients are available in inventory.
 * Handles boolean operators (e.g., "bourbon or rye") - passes if user has ANY alternative.
 *
 * @param ingredients - Array of ingredient strings from recipe
 * @param bottles - Array of bottle data from user's bar
 * @returns true if all ingredients are available
 */
function isCraftable(ingredients: string[], bottles: BottleData[]): boolean {
  if (!ingredients || ingredients.length === 0) {
    return false; // Recipe with no ingredients is not craftable
  }

  return ingredients.every(ingredient => {
    const ingredientName = parseIngredientName(ingredient);

    // Handle empty ingredient names (parsing failures or bad data)
    if (!ingredientName) {
      return true; // Don't let empty ingredients block craftability
    }

    // Handle string arrays (e.g., "bourbon or rye" → ["bourbon", "rye"])
    if (Array.isArray(ingredientName)) {
      // User has ingredient if they have ANY of the alternatives
      return ingredientName.some(alt => hasIngredient(bottles, alt));
    }

    // Handle single string
    if (typeof ingredientName === 'string' && ingredientName.trim() === '') {
      return true; // Don't let empty ingredients block craftability
    }

    return hasIngredient(bottles, ingredientName);
  });
}

/**
 * Helper: Find Missing Ingredients
 *
 * Identifies which ingredients are missing from inventory.
 * For boolean operators (e.g., "bourbon or rye"), only counts as missing if user has NONE of the alternatives.
 *
 * @param ingredients - Array of ingredient strings from recipe
 * @param bottles - Array of bottle data from user's bar
 * @returns Array of missing ingredient names (parsed, includes readable form for "or" ingredients)
 */
function findMissingIngredients(ingredients: string[], bottles: BottleData[]): string[] {
  if (!ingredients || ingredients.length === 0) {
    return [];
  }

  const missing: string[] = [];

  for (const ingredient of ingredients) {
    const ingredientName = parseIngredientName(ingredient);

    // Skip empty ingredient names (parsing failures or bad data)
    if (!ingredientName) {
      continue;
    }

    // Handle string arrays (e.g., "bourbon or rye" → ["bourbon", "rye"])
    if (Array.isArray(ingredientName)) {
      // Only mark as missing if user has NONE of the alternatives
      const hasAny = ingredientName.some(alt => hasIngredient(bottles, alt));
      if (!hasAny) {
        // Return readable form: "bourbon or rye"
        missing.push(ingredientName.join(' or '));
      }
      continue;
    }

    // Handle single string
    if (typeof ingredientName === 'string' && ingredientName.trim() === '') {
      continue;
    }

    if (!hasIngredient(bottles, ingredientName)) {
      missing.push(ingredientName);
    }
  }

  return missing;
}

/**
 * GET /api/shopping-list/smart - Smart Shopping List Recommendations
 *
 * Analyzes user's inventory against their recipe collection to identify
 * which single ingredient purchase will unlock the most new cocktails.
 *
 * Algorithm:
 * 1. Fetch user's inventory (bottle names)
 * 2. Fetch all user's recipes (name + ingredients)
 * 3. Filter out already craftable recipes
 * 4. Find "near miss" recipes (missing exactly 1 ingredient)
 * 5. Count how many recipes each missing ingredient would unlock
 * 6. Sort by unlock count (descending)
 * 7. Return top recommendations
 *
 * Example Response (200 OK):
 * {
 *   "success": true,
 *   "data": [
 *     { "ingredient": "angostura bitters", "unlocks": 25 },
 *     { "ingredient": "simple syrup", "unlocks": 18 },
 *     { "ingredient": "lime juice", "unlocks": 12 },
 *     { "ingredient": "triple sec", "unlocks": 8 }
 *   ],
 *   "stats": {
 *     "totalRecipes": 150,
 *     "craftable": 42,
 *     "nearMisses": 63,
 *     "inventoryItems": 15
 *   }
 * }
 *
 * Use Cases:
 * - New user wants to know what to buy first
 * - Experienced user wants to expand their cocktail options efficiently
 * - User planning a shopping trip and wants to maximize value
 *
 * Performance:
 * - Typically completes in <100ms for 200 recipes
 * - Scales linearly with recipe count
 * - All processing done in-memory (no complex joins)
 *
 * Security:
 * - User isolation: Only analyzes authenticated user's data
 * - Read-only: No database modifications
 * - No external API calls
 */
router.get('/smart', (req: Request, res: Response) => {
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
     * Step 2: Fetch User's Inventory with Classifications
     *
     * Get full bottle data including spirit type classifications.
     * This allows matching by name, liquor type, AND detailed classification.
     *
     * Example:
     * - name: "Maker's Mark"
     * - type: "Whiskey"
     * - "Detailed Spirit Classification": "Bourbon"
     * → Matches ingredient "bourbon" via classification field
     */
    const bottlesRaw = db.prepare(`
      SELECT
        name,
        type as liquorType,
        "Detailed Spirit Classification" as detailedClassification,
        "Stock Number" as stockNumber
      FROM inventory_items
      WHERE user_id = ?
        AND ("Stock Number" IS NOT NULL AND "Stock Number" > 0)
    `).all(userId) as Array<{
      name: string;
      liquorType: string | null;
      detailedClassification: string | null;
      stockNumber: number | null;
    }>;


    const bottles: BottleData[] = bottlesRaw.map(b => ({
      name: b.name,
      liquorType: b.liquorType,
      detailedClassification: b.detailedClassification
    }));


    /**
     * Step 3: Fetch User's Recipes
     *
     * Get all recipes with their ingredients.
     * Ingredients are stored as JSON strings, need to parse them.
     */
    const recipes = db.prepare(`
      SELECT id, name, ingredients FROM recipes WHERE user_id = ?
    `).all(userId) as Recipe[];

    /**
     * Step 4: Parse Recipe Ingredients
     *
     * Convert JSON strings to arrays.
     * Handle parsing errors gracefully.
     */
    const parsedRecipes = recipes.map(recipe => {
      let ingredients: string[] = [];

      try {
        const parsed = typeof recipe.ingredients === 'string'
          ? JSON.parse(recipe.ingredients)
          : recipe.ingredients;

        // Ensure it's an array of strings
        if (Array.isArray(parsed)) {
          ingredients = parsed.filter(i => typeof i === 'string');
        }
      } catch (error) {
        console.warn(`Failed to parse ingredients for recipe ${recipe.id}:`, error);
      }

      return {
        id: recipe.id,
        name: recipe.name,
        ingredients
      };
    });

    /**
     * Step 5: Identify Craftable Recipes
     *
     * Recipes where all ingredients are in inventory.
     */
    const craftableRecipes = parsedRecipes.filter(recipe =>
      isCraftable(recipe.ingredients, bottles)
    );


    /**
     * Step 6: Find "Near Miss" Recipes
     *
     * Recipes missing exactly 1 ingredient.
     * These are the recipes we can unlock with a single purchase.
     */
    const allNonCraftable = parsedRecipes
      .filter(recipe => !isCraftable(recipe.ingredients, bottles))
      .map(recipe => ({
        ...recipe,
        missingIngredients: findMissingIngredients(recipe.ingredients, bottles)
      }));

    const nearMissRecipes = allNonCraftable.filter(recipe => recipe.missingIngredients.length === 1);

    /**
     * Step 7: Count Ingredient Frequency
     *
     * Count how many recipes each missing ingredient would unlock.
     * Create a map: ingredient name → count
     */
    const ingredientUnlockCount = new Map<string, number>();

    for (const recipe of nearMissRecipes) {
      const missingIngredient = recipe.missingIngredients[0];

      // Normalize ingredient name for counting
      // (already normalized by parseIngredientName)
      const count = ingredientUnlockCount.get(missingIngredient) || 0;
      ingredientUnlockCount.set(missingIngredient, count + 1);
    }

    /**
     * Step 8: Sort by Unlock Count
     *
     * Convert map to array and sort descending by unlock count.
     * Return ingredients that unlock the most recipes first.
     */
    const recommendations = Array.from(ingredientUnlockCount.entries())
      .map(([ingredient, unlocks]) => ({
        ingredient,
        unlocks
      }))
      .sort((a, b) => b.unlocks - a.unlocks);

    /**
     * Step 9: Calculate Statistics
     *
     * Provide context about the analysis.
     */

    // Calculate breakdown by missing ingredient count
    const missingBreakdown = new Map<number, number>();
    allNonCraftable.forEach(recipe => {
      const count = recipe.missingIngredients.length;
      missingBreakdown.set(count, (missingBreakdown.get(count) || 0) + 1);
    });

    const stats = {
      totalRecipes: parsedRecipes.length,
      craftable: craftableRecipes.length,
      nearMisses: nearMissRecipes.length,
      inventoryItems: bottles.length,
      missing2to3: (missingBreakdown.get(2) || 0) + (missingBreakdown.get(3) || 0),
      missing4plus: Array.from(missingBreakdown.entries())
        .filter(([count]) => count >= 4)
        .reduce((sum, [, recipeCount]) => sum + recipeCount, 0)
    };

    /**
     * Step 10: Return Response
     *
     * Success response with recommendations, statistics, and recipe lists.
     */
    // Categorize recipes by missing ingredient count
    const needFewRecipes = allNonCraftable.filter(r =>
      r.missingIngredients.length >= 2 && r.missingIngredients.length <= 3
    );
    const majorGapsRecipes = allNonCraftable.filter(r =>
      r.missingIngredients.length >= 4
    );

    res.json({
      success: true,
      data: recommendations,
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
        missingIngredient: r.missingIngredients[0] // Only 1 missing for near-miss
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
    });
  } catch (error) {
    /**
     * Error Handling
     *
     * Log detailed error server-side.
     * Return generic error to client.
     */
    console.error('Smart shopping list error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate shopping list recommendations'
    });
  }
});

/**
 * Export Shopping List Router
 *
 * Mounted at /api/shopping-list in server.ts:
 * - GET /api/shopping-list/smart - Get smart recommendations
 *
 * Future Enhancements:
 * - POST /api/shopping-list/custom - Custom ingredient analysis
 * - GET /api/shopping-list/popular - Popular ingredients from community
 * - GET /api/shopping-list/categories - Recommendations by category
 */
export default router;