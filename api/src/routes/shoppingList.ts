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
router.use(userRateLimit(500, 15)); // Increased for development

/**
 * Helper: Parse Ingredient Name from Full String
 *
 * Extracts the ingredient name from strings like:
 * - "2 oz Bourbon" → "bourbon"
 * - "1 sugar cube" → "sugar cube"
 * - "2 dashes Angostura Bitters" → "angostura bitters"
 *
 * Algorithm:
 * 1. Convert to lowercase for case-insensitive matching
 * 2. Remove leading numbers (e.g., "2", "1.5")
 * 3. Remove common units and measurements
 * 4. Trim whitespace
 * 5. Return normalized ingredient name
 *
 * @param ingredientStr - Raw ingredient string from recipe
 * @returns Normalized ingredient name
 */
function parseIngredientName(ingredientStr: string): string {
  if (!ingredientStr || typeof ingredientStr !== 'string') {
    return '';
  }

  // Convert to lowercase for case-insensitive matching
  let normalized = ingredientStr.toLowerCase().trim();

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
    // Small amounts
    'dash', 'dashes',
    'drop', 'drops',
    'splash', 'splashes',
    'pinch',
    // Proportions
    'part', 'parts',
    // Qualifiers (removed 'syrup' and 'cream' to preserve ingredient names like "Demerara Syrup")
    'fresh', 'freshly', 'squeezed', 'juice', 'juices'
  ];

  // Remove numbers and fractions at the beginning
  // Matches: "2", "1.5", "1/2", "2 1/2", "1 1/2"
  normalized = normalized.replace(/^[\d\s\/.]+/, '').trim();

  // Remove units (do this multiple times to handle compound measurements)
  for (let i = 0; i < 3; i++) {
    for (const unit of unitsToRemove) {
      // Remove unit with word boundaries to avoid partial matches
      const regex = new RegExp(`\\b${unit}\\b`, 'gi');
      normalized = normalized.replace(regex, '').trim();
    }
  }

  // Clean up extra whitespace
  normalized = normalized.replace(/\s+/g, ' ').trim();

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
 * Helper: Check if Inventory Contains Ingredient
 *
 * Performs fuzzy matching between inventory bottles and ingredient.
 * Uses bottle name, liquor type, and detailed classification for matching.
 *
 * Examples:
 * - Bottle: {name: "Maker's Mark", liquorType: "Whiskey", detailedClassification: "Bourbon"}
 *   matches ingredient: "bourbon" ✓
 * - Bottle: {name: "Hamilton Jamaican Pot Still Black", liquorType: "Rum", detailedClassification: "Dark Jamaican Rum"}
 *   matches ingredient: "dark jamaican rum" ✓
 * - Bottle: {name: "Pierre Ferrand Dry Curaçao", detailedClassification: "Orange Curaçao"}
 *   matches ingredient: "orange curacao" ✓
 *
 * Algorithm:
 * 1. Check direct matches against bottle name, liquor type, and detailed classification
 * 2. Token-based fuzzy matching across all fields
 * 3. Return true if sufficient match found
 *
 * @param bottles - Array of bottle data from user's bar
 * @param ingredientName - Parsed ingredient name from recipe
 * @returns true if ingredient is available in inventory
 */
function hasIngredient(bottles: BottleData[], ingredientName: string): boolean {
  if (!ingredientName || ingredientName.length === 0) {
    return false;
  }

  const normalizedIngredient = ingredientName.toLowerCase().trim();

  // Split ingredient into tokens (words)
  const ingredientTokens = normalizedIngredient
    .split(/[\s\/\-,]+/)
    .filter(t => t.length > 2); // Ignore very short words like "or", "de"

  return bottles.some(bottle => {
    const normalizedName = bottle.name.toLowerCase().trim();
    const normalizedLiquorType = bottle.liquorType?.toLowerCase().trim() || '';
    const normalizedClassification = bottle.detailedClassification?.toLowerCase().trim() || '';

    // Strategy 1: Direct substring match against all bottle fields
    const fields = [normalizedName, normalizedLiquorType, normalizedClassification];

    for (const field of fields) {
      if (field && (field.includes(normalizedIngredient) || normalizedIngredient.includes(field))) {
        return true;
      }
    }

    // Strategy 2: Token-based matching across all fields
    // Combine all bottle info into tokens
    const allBottleTokens = [normalizedName, normalizedLiquorType, normalizedClassification]
      .join(' ')
      .split(/[\s\/\-,]+/)
      .filter(t => t.length > 2);

    if (ingredientTokens.length > 0) {
      const matchingTokens = ingredientTokens.filter(ingToken =>
        allBottleTokens.some(bottleToken =>
          bottleToken.includes(ingToken) || ingToken.includes(bottleToken)
        )
      );

      // 35% threshold for partial matches
      const matchPercentage = matchingTokens.length / ingredientTokens.length;
      if (matchPercentage >= 0.35) {
        return true;
      }
    }

    return false;
  });
}

/**
 * Helper: Check if Recipe is Craftable
 *
 * Determines if all recipe ingredients are available in inventory.
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
    // Skip empty ingredient names (parsing failures or bad data)
    if (!ingredientName || ingredientName.trim() === '') {
      return true; // Don't let empty ingredients block craftability
    }
    return hasIngredient(bottles, ingredientName);
  });
}

/**
 * Helper: Find Missing Ingredients
 *
 * Identifies which ingredients are missing from inventory.
 *
 * @param ingredients - Array of ingredient strings from recipe
 * @param bottles - Array of bottle data from user's bar
 * @returns Array of missing ingredient names (parsed)
 */
function findMissingIngredients(ingredients: string[], bottles: BottleData[]): string[] {
  if (!ingredients || ingredients.length === 0) {
    return [];
  }

  const missing: string[] = [];

  for (const ingredient of ingredients) {
    const ingredientName = parseIngredientName(ingredient);
    // Skip empty ingredient names (parsing failures or bad data)
    if (!ingredientName || ingredientName.trim() === '') {
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
        "Detailed Spirit Classification" as detailedClassification
      FROM inventory_items
      WHERE user_id = ?
    `).all(userId) as Array<{
      name: string;
      liquorType: string | null;
      detailedClassification: string | null;
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

    // DEBUG: Log craftable recipes
    console.log('🔍 [Shopping List Debug]');
    console.log('  Inventory items:', bottles.map(b => b.name));
    console.log('  Total recipes:', parsedRecipes.length);
    console.log('  Craftable recipes:', craftableRecipes.length);
    if (craftableRecipes.length > 0) {
      console.log('  Craftable recipe names:', craftableRecipes.map(r => r.name).slice(0, 5));
    }

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

    // DEBUG: Log missing ingredient counts
    const missingCounts = new Map<number, number>();
    allNonCraftable.forEach(recipe => {
      const count = recipe.missingIngredients.length;
      missingCounts.set(count, (missingCounts.get(count) || 0) + 1);
    });
    console.log('  Non-craftable recipes by missing count:');
    Array.from(missingCounts.entries())
      .sort((a, b) => a[0] - b[0])
      .forEach(([missing, count]) => {
        console.log(`    Missing ${missing} ingredient(s): ${count} recipes`);
      });

    // Show example of a recipe missing multiple ingredients
    const exampleMultiMissing = allNonCraftable.find(r => r.missingIngredients.length > 1);
    if (exampleMultiMissing) {
      console.log('  Example recipe missing multiple:');
      console.log(`    "${exampleMultiMissing.name}"`);
      console.log('    Raw ingredients:', exampleMultiMissing.ingredients.slice(0, 5));
      console.log('    Parsed ingredients:', exampleMultiMissing.ingredients.slice(0, 5).map(parseIngredientName));
      console.log('    Missing:', exampleMultiMissing.missingIngredients.slice(0, 5));
    }

    const nearMissRecipes = allNonCraftable.filter(recipe => recipe.missingIngredients.length === 1);
    console.log('  Near-miss recipes (missing exactly 1):', nearMissRecipes.length);

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
    const stats = {
      totalRecipes: parsedRecipes.length,
      craftable: craftableRecipes.length,
      nearMisses: nearMissRecipes.length,
      inventoryItems: bottles.length
    };

    /**
     * Step 10: Return Response
     *
     * Success response with recommendations, statistics, and recipe lists.
     */
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
