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
    'vodka', 'gin', 'tequila', 'mezcal', 'rum', 'rhum', 'rhum agricole',
    'white rum', 'dark rum', 'aged rum', 'overproof', 'cachaca', 'pisco',
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
    'passion fruit juice', 'pineapple juice', 'cranberry',
  ],

  sweet: [
    // Syrups
    'simple syrup', 'syrup', 'sugar syrup', 'rich syrup', 'demerara syrup',
    'honey syrup', 'honey', 'agave', 'agave syrup', 'maple syrup', 'maple',
    'grenadine', 'orgeat', 'falernum', 'gum syrup', 'gomme',
    'passion fruit syrup', 'passionfruit syrup', 'cinnamon syrup', 'vanilla syrup',
    // Sugar
    'sugar', 'sugar cube', 'brown sugar', 'demerara', 'turbinado',
    // Sweet liqueurs (must come before garnish fruits)
    'liqueur', 'triple sec', 'cointreau', 'grand marnier', 'curacao', 'curaçao',
    'blue curacao', 'dry curacao', 'pierre ferrand',
    'maraschino', 'luxardo', 'amaretto', 'frangelico', 'kahlua', 'kahlúa',
    'baileys', 'cream liqueur', 'licor 43', 'st germain', 'elderflower',
    'chambord', 'midori', 'creme de', 'crème de', 'cherry heering', 'heering',
    'allspice dram', 'st elizabeth', 'velvet falernum', 'pimento dram',
    // Fruit liqueurs
    'blackberry liqueur', 'raspberry liqueur', 'strawberry liqueur',
    'peach liqueur', 'apricot liqueur', 'banana liqueur', 'melon liqueur',
    'apple liqueur', 'pear liqueur', 'cherry liqueur', 'cassis',
  ],

  bitter: [
    // Bitters
    'bitters', 'angostura', 'peychauds', "peychaud's", 'orange bitters',
    'aromatic bitters', 'chocolate bitters', 'mole bitters',
    // Amari
    'campari', 'aperol', 'cynar', 'fernet', 'fernet-branca', 'averna',
    'montenegro', 'nonino', 'amaro', 'amaretto', 'ramazotti',
    // Vermouths (all types)
    'vermouth', 'dry vermouth', 'sweet vermouth', 'blanc vermouth',
    'vermouth rosso', 'carpano', 'antica formula', 'lillet', 'cocchi',
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
    // Garnish indicators
    'garnish', 'pinch',
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
    'umbrella', 'flag', 'skewer', 'napkin',
  ],

  dairy: [
    'cream', 'heavy cream', 'whipping cream', 'half and half', 'half & half',
    'milk', 'whole milk', 'coconut milk', 'coconut cream', 'oat milk',
    'almond milk', 'butter', 'clarified butter',
  ],

  egg: [
    'egg', 'egg white', 'egg yolk', 'whole egg', 'aquafaba',
  ],

  junction: [], // Internal type for layout - no keywords match
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
 * Check if a keyword matches as a word boundary (not as substring of another word)
 * e.g., "gin" should match "gin" but not "virgin"
 */
function matchesKeyword(text: string, keyword: string): boolean {
  // Escape special regex characters in keyword
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`\\b${escaped}\\b`, 'i');
  return regex.test(text);
}

/**
 * Priority order for type checking
 * More specific types checked first, garnish last (catch-all)
 */
const TYPE_CHECK_ORDER: IngredientType[] = [
  'spirit',    // Check spirits first (base ingredients)
  'sweet',     // Liqueurs before garnish (blackberry liqueur != blackberry garnish)
  'bitter',    // Bitters/amari
  'acid',      // Citrus/acids
  'salt',      // Salt/spicy
  'dairy',     // Dairy products
  'egg',       // Eggs
  'dilution',  // Mixers/sodas
  'garnish',   // Last resort - garnishes and unknown
];

/**
 * Determine ingredient type from name
 */
function determineType(name: string): IngredientType {
  const lower = name.toLowerCase();

  // Check types in priority order (most specific first)
  for (const type of TYPE_CHECK_ORDER) {
    const keywords = CLASSIFICATION_RULES[type];
    for (const keyword of keywords) {
      if (matchesKeyword(lower, keyword)) {
        return type;
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
 * Type abbreviation labels - periodic table style (second letter lowercase)
 * Used for non-spirit ingredients
 */
const TYPE_LABELS: Record<IngredientType, string> = {
  spirit: 'Sp',   // Fallback - spirits use actual spirit name
  acid: 'Ac',
  sweet: 'Sw',
  bitter: 'Bt',
  salt: 'Na',     // Sodium - actual salt element!
  dilution: 'Mx',
  garnish: 'Ga',
  dairy: 'Da',    // Dairy
  egg: 'Eg',
  junction: '',   // Invisible
};

/**
 * Spirit name mapping - extracts the spirit type from ingredient name
 * Returns uppercase spirit name for display (RUM, GIN, WHISKEY, etc.)
 */
const SPIRIT_KEYWORDS = [
  'bourbon', 'whiskey', 'whisky', 'rye', 'scotch',
  'vodka', 'gin', 'tequila', 'mezcal', 'rum', 'rhum',
  'brandy', 'cognac', 'armagnac', 'calvados',
  'absinthe', 'aquavit', 'cachaca', 'pisco', 'sake', 'soju'
];

function getSpiritName(name: string): string {
  const lower = name.toLowerCase();

  for (const keyword of SPIRIT_KEYWORDS) {
    if (matchesKeyword(lower, keyword)) {
      // Special cases for display
      if (keyword === 'whisky' || keyword === 'bourbon' || keyword === 'rye' || keyword === 'scotch') {
        return 'WHISKEY';
      }
      if (keyword === 'cognac' || keyword === 'armagnac' || keyword === 'calvados') {
        return 'BRANDY';
      }
      if (keyword === 'cachaca') {
        return 'CACHAÇA';
      }
      if (keyword === 'rhum') {
        return 'RUM';
      }
      return keyword.toUpperCase();
    }
  }

  // Fallback to generic
  return 'SPIRIT';
}

/**
 * Get display label based on ingredient type
 * Spirits: Full spirit name (RUM, GIN, WHISKEY, etc.)
 * Others: Abbreviated type (Ac, Sw, Bt, Ga, etc.)
 */
export function getDisplayLabel(name: string): { label: string; sublabel?: string } {
  const type = determineType(name);

  // Spirits get their full spirit name
  if (type === 'spirit') {
    return { label: getSpiritName(name) };
  }

  // Other ingredients get abbreviated type label
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
    junction: '', // Internal type - not displayed
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
