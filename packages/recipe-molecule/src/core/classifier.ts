/**
 * Ingredient Classifier
 *
 * Maps ingredient names to visual types (spirit, acid, sweet, etc.)
 * Uses keyword matching with fuzzy fallback
 */

import type {
  ParsedIngredient,
  ClassifiedIngredient,
  IngredientType,
} from './types';
import { TYPE_COLORS } from './types';

// ═══════════════════════════════════════════════════════════════
// CLASSIFICATION RULES (Keyword → Type)
// ═══════════════════════════════════════════════════════════════

const CLASSIFICATION_RULES: Record<IngredientType, string[]> = {
  spirit: [
    // Whiskey family
    'bourbon', 'whiskey', 'whisky', 'rye', 'scotch', 'irish whiskey',
    // Clear spirits
    'vodka', 'gin', 'tequila', 'mezcal', 'rum', 'white rum', 'dark rum',
    'aged rum', 'overproof', 'cachaca', 'pisco',
    // Brandy family
    'brandy', 'cognac', 'armagnac', 'calvados', 'applejack',
    // Other
    'absinthe', 'aquavit', 'baijiu', 'soju', 'sake',
  ],

  acid: [
    // Citrus juices
    'lime juice', 'lime', 'lemon juice', 'lemon', 'grapefruit juice',
    'grapefruit', 'orange juice', 'yuzu', 'citrus',
    // Other acids
    'vinegar', 'shrub', 'verjus', 'sour mix', 'lemon-lime',
    'passion fruit', 'pineapple juice', 'cranberry',
  ],

  sweet: [
    // Syrups
    'simple syrup', 'syrup', 'sugar syrup', 'rich syrup', 'demerara syrup',
    'honey syrup', 'honey', 'agave', 'agave syrup', 'maple syrup', 'maple',
    'grenadine', 'orgeat', 'falernum', 'gum syrup', 'gomme',
    // Sugar
    'sugar', 'sugar cube', 'brown sugar', 'demerara', 'turbinado',
    // Sweet liqueurs
    'triple sec', 'cointreau', 'grand marnier', 'curacao', 'blue curacao',
    'maraschino', 'luxardo', 'amaretto', 'frangelico', 'kahlua', 'kahlúa',
    'baileys', 'cream liqueur', 'licor 43', 'st germain', 'elderflower',
    'chambord', 'midori', 'creme de', 'crème de',
    // Vermouths (sweet)
    'sweet vermouth', 'vermouth rosso', 'carpano', 'antica formula',
  ],

  bitter: [
    // Bitters
    'bitters', 'angostura', 'peychauds', "peychaud's", 'orange bitters',
    'aromatic bitters', 'chocolate bitters', 'mole bitters',
    // Amari
    'campari', 'aperol', 'cynar', 'fernet', 'fernet-branca', 'averna',
    'montenegro', 'nonino', 'amaro', 'amaretto', 'ramazotti',
    // Dry/bitter vermouths
    'dry vermouth', 'blanc vermouth', 'lillet', 'cocchi',
    // Coffee/bitter flavors
    'espresso', 'coffee', 'cold brew',
  ],

  salt: [
    'salt', 'kosher salt', 'sea salt', 'fleur de sel', 'rim', 'salted rim',
    'tajin', 'chili salt', 'celery salt', 'smoked salt',
    // Spicy
    'pepper', 'black pepper', 'chili', 'jalapeño', 'habanero', 'hot sauce',
    'tabasco', 'sriracha', 'cayenne',
  ],

  dilution: [
    // Ice
    'ice', 'cubed ice', 'crushed ice', 'cracked ice', 'pebble ice',
    // Water/Soda
    'water', 'soda', 'soda water', 'club soda', 'sparkling water',
    'seltzer', 'sparkling', 'carbonated',
    // Tonic & Mixers
    'tonic', 'tonic water', 'ginger beer', 'ginger ale',
    'cola', 'coke', 'sprite', 'lemonade', '7up', 'seven up',
    // Juices used as mixers (not primary acid)
    'tomato juice', 'clamato',
  ],

  garnish: [
    // Citrus garnishes
    'peel', 'twist', 'zest', 'wheel', 'wedge', 'slice',
    'orange peel', 'lemon peel', 'lime wheel', 'grapefruit twist',
    // Fruit garnishes
    'cherry', 'maraschino cherry', 'luxardo cherry', 'brandied cherry',
    'olive', 'olives', 'cocktail onion', 'pickled onion',
    'pineapple', 'strawberry', 'raspberry', 'blackberry', 'blueberry',
    'apple slice', 'banana',
    // Herbs
    'mint', 'mint sprig', 'basil', 'rosemary', 'thyme', 'sage',
    'cilantro', 'dill',
    // Other
    'cucumber', 'celery', 'nutmeg', 'cinnamon', 'cinnamon stick',
    'star anise', 'coffee beans', 'cocoa', 'chocolate',
    'umbrella', 'flag', 'skewer',
  ],

  dairy: [
    'cream', 'heavy cream', 'whipping cream', 'half and half', 'half & half',
    'milk', 'whole milk', 'coconut milk', 'coconut cream', 'oat milk',
    'almond milk', 'butter', 'clarified butter',
  ],

  egg: [
    'egg', 'egg white', 'egg yolk', 'whole egg', 'aquafaba',
  ],
};

// ═══════════════════════════════════════════════════════════════
// CLASSIFIER
// ═══════════════════════════════════════════════════════════════

/**
 * Classify a single ingredient
 */
export function classifyIngredient(parsed: ParsedIngredient): ClassifiedIngredient {
  const type = determineType(parsed.name);
  const color = TYPE_COLORS[type].fill;

  return {
    ...parsed,
    type,
    color,
  };
}

/**
 * Classify multiple ingredients
 */
export function classifyIngredients(
  parsed: ParsedIngredient[]
): ClassifiedIngredient[] {
  return parsed.map(classifyIngredient);
}

/**
 * Determine ingredient type from name
 */
function determineType(name: string): IngredientType {
  const lower = name.toLowerCase();

  // Check each type's keywords
  for (const [type, keywords] of Object.entries(CLASSIFICATION_RULES)) {
    for (const keyword of keywords) {
      if (lower.includes(keyword)) {
        return type as IngredientType;
      }
    }
  }

  // Fuzzy fallback: check for partial matches
  const fuzzyType = fuzzyMatch(lower);
  if (fuzzyType) return fuzzyType;

  // Default to garnish for unknown ingredients (safest assumption)
  return 'garnish';
}

/**
 * Fuzzy matching for edge cases
 */
function fuzzyMatch(name: string): IngredientType | null {
  // Check for spirit indicators
  if (name.match(/\b(proof|aged|barrel|cask|distilled)\b/i)) {
    return 'spirit';
  }

  // Check for juice (acid)
  if (name.includes('juice')) {
    return 'acid';
  }

  // Check for syrup (sweet)
  if (name.includes('syrup') || name.includes('liqueur')) {
    return 'sweet';
  }

  // Check for garnish indicators
  if (name.match(/\b(sprig|leaf|wheel|wedge|twist|peel|slice|garnish)\b/i)) {
    return 'garnish';
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════

/**
 * Type abbreviation labels - short labels for visual cleanliness
 */
const TYPE_LABELS: Record<IngredientType, string> = {
  spirit: 'SP',
  acid: 'AC',
  sweet: 'SW',
  bitter: 'BT',
  salt: 'SA',
  dilution: 'LQ',  // Liqueur
  garnish: 'GA',
  dairy: 'DA',
  egg: 'EG',
};

/**
 * Get display label based on ingredient type (abbreviated)
 * Returns type abbreviation for clean visual display
 */
export function getDisplayLabel(name: string): { label: string; sublabel?: string } {
  // Determine type from name
  const type = determineType(name);

  // Return abbreviated type label
  return { label: TYPE_LABELS[type] };
}

/**
 * Get full type name for legends/tooltips
 */
export function getTypeName(type: IngredientType): string {
  const names: Record<IngredientType, string> = {
    spirit: 'Spirit',
    acid: 'Acid',
    sweet: 'Sweet',
    bitter: 'Bitter',
    salt: 'Salt',
    dilution: 'Liqueur',
    garnish: 'Garnish',
    dairy: 'Dairy',
    egg: 'Egg',
  };
  return names[type];
}

/**
 * Calculate chaos level based on ingredient commonness
 * More unusual ingredients = higher chaos = more organic layout
 */
export function calculateChaos(ingredients: ClassifiedIngredient[]): number {
  const commonIngredients = [
    'vodka', 'gin', 'bourbon', 'tequila', 'rum', 'whiskey',
    'lime', 'lemon', 'simple syrup', 'bitters', 'vermouth',
    'triple sec', 'cointreau', 'campari', 'sugar',
  ];

  const commonCount = ingredients.filter(i =>
    commonIngredients.some(c => i.name.toLowerCase().includes(c))
  ).length;

  const ratio = commonCount / Math.max(ingredients.length, 1);

  // Invert: more common = less chaos
  // Clamp between 0.2 and 0.8 for reasonable layouts
  return Math.max(0.2, Math.min(0.8, 1 - ratio));
}
