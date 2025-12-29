/**
 * Ingredient Classifier
 *
 * Maps ingredient names to visual types (spirit, acid, sweet, etc.)
 * Uses weighted keyword matching with compound-aware scoring.
 *
 * ## Classification Algorithm
 *
 * 1. Score each keyword match by specificity (longer matches score higher)
 * 2. Compound keywords like "maraschino cherry" beat single-word "maraschino"
 * 3. Type with highest score wins
 * 4. Fallback to fuzzy matching for edge cases
 * 5. Default to garnish for unknown ingredients
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
    'white rum', 'dark rum', 'aged rum', 'overproof', 'cachaca', 'cachaça', 'pisco',
    // Brandy family
    'brandy', 'cognac', 'armagnac', 'calvados', 'applejack', 'grappa',
    // Other
    'absinthe', 'aquavit', 'baijiu', 'soju', 'sake', 'shochu', 'genever',
  ],

  acid: [
    // Citrus juices (compound first for priority)
    'lime juice', 'lemon juice', 'grapefruit juice', 'orange juice',
    'blood orange juice', 'yuzu juice', 'calamansi juice',
    // Single citrus (lower priority than compounds)
    'lime', 'lemon', 'grapefruit', 'yuzu', 'citrus', 'blood orange',
    // Tropical/fruit juices
    'passion fruit juice', 'passionfruit juice', 'pineapple juice',
    'cranberry juice', 'pomegranate juice', 'guava juice', 'mango juice',
    'papaya juice', 'tamarind juice',
    // Other acids
    'vinegar', 'shrub', 'verjus', 'sour mix', 'lemon-lime',
    'tamarind', 'sumac', 'hibiscus tea',
    // Cranberry (often used as juice)
    'cranberry',
  ],

  sweet: [
    // Nectars and purees (high priority - these are sweet, not garnish)
    'nectar', 'puree', 'purée',
    'guava nectar', 'mango nectar', 'passion fruit nectar', 'apricot nectar',
    'peach nectar', 'pear nectar', 'papaya nectar',
    'mango puree', 'raspberry puree', 'strawberry puree', 'passion fruit puree',
    'banana puree', 'guava puree', 'lychee puree',
    // Syrups
    'simple syrup', 'syrup', 'sugar syrup', 'rich syrup', 'demerara syrup',
    'honey syrup', 'honey', 'agave', 'agave syrup', 'maple syrup', 'maple',
    'grenadine', 'orgeat', 'falernum', 'gum syrup', 'gomme',
    'passion fruit syrup', 'passionfruit syrup', 'cinnamon syrup', 'vanilla syrup',
    'ginger syrup', 'lavender syrup', 'rose syrup', 'hibiscus syrup',
    'raspberry syrup', 'strawberry syrup', 'blueberry syrup',
    'caramel syrup', 'caramel', 'chocolate syrup', 'mocha syrup',
    'pumpkin spice syrup', 'cardamom syrup', 'thai basil syrup',
    // Sugar
    'sugar', 'sugar cube', 'brown sugar', 'demerara', 'turbinado',
    // Cream of coconut (sweetened coconut product, NOT dairy)
    'cream of coconut', 'coco lopez', 'coco real',
    // Sweet liqueurs (must come before garnish fruits)
    'liqueur', 'triple sec', 'cointreau', 'grand marnier', 'curacao', 'curaçao',
    'blue curacao', 'dry curacao', 'pierre ferrand',
    'maraschino', 'luxardo maraschino', 'amaretto', 'disaronno',
    'frangelico', 'kahlua', 'kahlúa', 'mr black', 'tia maria',
    'baileys', 'cream liqueur', 'licor 43', 'st germain', 'elderflower',
    'chambord', 'midori', 'creme de', 'crème de', 'cherry heering', 'heering',
    'allspice dram', 'st elizabeth', 'velvet falernum', 'pimento dram',
    // Herbal/spiced liqueurs (sweeter ones)
    'drambuie', 'benedictine', 'bénédictine', 'dom', 'b&b',
    'galliano', 'strega', 'tuaca',
    'sambuca', 'anisette', 'pastis', 'pernod', 'ricard',
    'domaine de canton', 'ginger liqueur',
    // Fruit liqueurs
    'blackberry liqueur', 'raspberry liqueur', 'strawberry liqueur',
    'peach liqueur', 'peach schnapps', 'apricot liqueur', 'apricot brandy',
    'banana liqueur', 'melon liqueur',
    'apple liqueur', 'pear liqueur', 'cherry liqueur', 'cassis',
    'limoncello', 'pama', 'pomegranate liqueur',
    'lychee liqueur', 'soho', 'mango liqueur', 'guava liqueur',
    'coconut liqueur', 'malibu',
    'creme de violette', 'crème de violette', 'creme de cassis',
    'creme de mure', 'creme de peche', 'creme de framboise',
    // Sweet fortified wines
    'port', 'ruby port', 'tawny port', 'vintage port',
    'pedro ximenez', 'px', 'cream sherry', 'moscatel',
  ],

  bitter: [
    // Bitters (aromatic)
    'bitters', 'angostura', 'peychauds', "peychaud's", 'orange bitters',
    'aromatic bitters', 'chocolate bitters', 'mole bitters', 'celery bitters',
    'grapefruit bitters', 'lavender bitters', 'coffee bitters',
    // Amari & Italian bitters
    'campari', 'aperol', 'cynar', 'fernet', 'fernet-branca', 'averna',
    'montenegro', 'nonino', 'amaro', 'ramazotti', 'meletti',
    'lucano', 'braulio', 'sfumato', 'nardini',
    'cappelletti', 'contratto', 'gran classico', 'luxardo bitter',
    // French aperitifs
    'amer picon', 'amer', 'suze', 'salers', 'gentiane',
    // Vermouths (all types)
    'vermouth', 'dry vermouth', 'sweet vermouth', 'blanc vermouth',
    'vermouth rosso', 'carpano', 'antica formula', 'punt e mes',
    'lillet', 'lillet blanc', 'lillet rouge', 'cocchi americano', 'cocchi',
    // Dry sherries (bitter/dry profile)
    'sherry', 'fino sherry', 'manzanilla', 'amontillado', 'oloroso', 'palo cortado',
    // Madeira
    'madeira', 'sercial', 'verdelho', 'bual', 'malmsey',
    // Herbal/bitter liqueurs
    'chartreuse', 'green chartreuse', 'yellow chartreuse',
    'genepy', 'génépy', 'becherovka', 'jagermeister', 'jägermeister',
    'underberg', 'unicum', 'zwack',
    // Coffee/bitter flavors
    'espresso', 'coffee', 'cold brew',
  ],

  salt: [
    'salt', 'kosher salt', 'sea salt', 'fleur de sel', 'rim', 'salted rim',
    'tajin', 'chili salt', 'celery salt', 'smoked salt',
    // Spicy
    'pepper', 'black pepper', 'chili', 'jalapeño', 'habanero', 'hot sauce',
    'tabasco', 'sriracha', 'cayenne', 'serrano', 'ghost pepper',
    'chipotle', 'ancho', 'guajillo',
  ],

  dilution: [
    // Ice
    'ice', 'cubed ice', 'crushed ice', 'cracked ice', 'pebble ice',
    // Water/Soda
    'water', 'soda', 'soda water', 'club soda', 'sparkling water',
    'seltzer', 'sparkling', 'carbonated',
    // Flavored sodas (before generic soda matches)
    'guava soda', 'pineapple soda', 'tamarind soda', 'hibiscus soda',
    'mexican coke', 'jarritos', 'bundaberg',
    // Tonic & Mixers
    'tonic', 'tonic water', 'fever tree', 'ginger beer', 'ginger ale',
    'cola', 'coke', 'pepsi', 'sprite', 'lemonade', '7up', 'seven up',
    'root beer', 'cream soda', 'dr pepper',
    // Sparkling wine (used to top drinks)
    'champagne', 'prosecco', 'cava', 'sparkling wine', 'cremant', 'sekt',
    // Still wines (used in punches, sangrias)
    'wine', 'red wine', 'white wine', 'rosé', 'rose wine',
    // Beer (for beer cocktails)
    'beer', 'lager', 'pilsner', 'ipa', 'ale', 'stout', 'porter', 'hefeweizen',
    // Tea & other
    'tea', 'iced tea', 'green tea', 'black tea', 'earl grey', 'chai',
    'kombucha', 'coconut water',
    // Juices used as mixers (not primary acid)
    'tomato juice', 'clamato', 'v8',
  ],

  garnish: [
    // Garnish indicators
    'garnish', 'for garnish', 'to garnish', 'pinch',
    // Citrus garnishes (compound for specificity)
    'orange peel', 'lemon peel', 'lime peel', 'grapefruit peel',
    'orange twist', 'lemon twist', 'lime twist', 'grapefruit twist',
    'orange wheel', 'lemon wheel', 'lime wheel',
    'orange wedge', 'lemon wedge', 'lime wedge',
    'orange slice', 'lemon slice', 'lime slice',
    // Generic citrus garnish words
    'peel', 'twist', 'zest', 'wheel', 'wedge', 'expressed',
    // Fruit garnishes
    'cherry', 'maraschino cherry', 'luxardo cherry', 'brandied cherry',
    'olive', 'olives', 'cocktail onion', 'pickled onion', 'pearl onion',
    'pineapple wedge', 'pineapple chunk', 'pineapple leaf',
    'strawberry', 'raspberry', 'blackberry', 'blueberry',
    'apple slice', 'apple fan', 'banana',
    'grape', 'grapes', 'melon ball',
    // Herbs
    'mint', 'mint sprig', 'mint leaf', 'mint leaves',
    'basil', 'basil leaf', 'thai basil',
    'rosemary', 'rosemary sprig', 'thyme', 'thyme sprig',
    'sage', 'sage leaf', 'cilantro', 'dill', 'tarragon',
    'lavender sprig', 'edible flower', 'orchid', 'nasturtium',
    // Vegetables
    'cucumber', 'cucumber slice', 'cucumber ribbon',
    'celery', 'celery stalk',
    // Spices/aromatics (as garnish)
    'nutmeg', 'grated nutmeg', 'cinnamon', 'cinnamon stick',
    'star anise', 'clove', 'cardamom pod',
    'coffee beans', 'espresso beans',
    'cocoa powder', 'chocolate shavings',
    // Bar tools/decorations
    'umbrella', 'flag', 'skewer', 'pick', 'straw',
    // Dehydrated
    'dehydrated', 'dried', 'candied',
  ],

  dairy: [
    'cream', 'heavy cream', 'whipping cream', 'half and half', 'half & half',
    'light cream', 'single cream', 'double cream',
    'milk', 'whole milk', 'skim milk', 'oat milk', 'almond milk', 'soy milk',
    'coconut milk', 'coconut cream', // Note: NOT cream of coconut (that's sweet)
    'butter', 'clarified butter', 'brown butter',
    'yogurt', 'kefir', 'buttermilk',
  ],

  egg: [
    'egg', 'egg white', 'egg yolk', 'whole egg', 'aquafaba',
    'meringue', 'pasteurized egg',
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
 * Type priority for tie-breaking when word counts are equal.
 * Lower number = higher priority.
 */
const TYPE_PRIORITY: Record<IngredientType, number> = {
  spirit: 1,
  acid: 2,
  sweet: 3,
  bitter: 4,
  salt: 5,
  dairy: 6,
  egg: 7,
  dilution: 8,
  garnish: 9,
  junction: 10,
};

interface MatchResult {
  type: IngredientType;
  keyword: string;
  wordCount: number;
  isExact: boolean;
}

/**
 * Find all matching keywords for a given ingredient name.
 */
function findAllMatches(text: string): MatchResult[] {
  const matches: MatchResult[] = [];

  for (const type of Object.keys(CLASSIFICATION_RULES) as IngredientType[]) {
    if (type === 'junction') continue;

    const keywords = CLASSIFICATION_RULES[type];
    for (const keyword of keywords) {
      if (matchesKeyword(text, keyword)) {
        matches.push({
          type,
          keyword,
          wordCount: keyword.split(/\s+/).length,
          isExact: text.trim().toLowerCase() === keyword.toLowerCase(),
        });
      }
    }
  }

  return matches;
}

/**
 * Determine ingredient type from name using compound-aware matching.
 *
 * Priority order:
 * 1. Exact matches (ingredient name equals keyword)
 * 2. Compound matches (multi-word keywords beat single-word)
 * 3. Type priority (spirits > acids > sweets > etc.)
 * 4. Keyword length (as final tie-breaker)
 *
 * Examples:
 * - "maraschino cherry" → garnish (compound "maraschino cherry" beats single "maraschino")
 * - "demerara rum" → spirit ("rum" and "demerara" both 1-word, spirit has higher priority)
 * - "lime juice" → acid (compound "lime juice" beats single "lime")
 *
 * @param name - Normalized ingredient name
 * @returns The most likely ingredient type
 */
function determineType(name: string): IngredientType {
  const lower = name.toLowerCase();

  // Find all matching keywords
  const matches = findAllMatches(lower);

  if (matches.length === 0) {
    // Fuzzy fallback: check for partial matches
    const fuzzyType = fuzzyMatch(lower);
    if (fuzzyType) return fuzzyType;

    // Default to garnish for unknown ingredients
    return 'garnish';
  }

  // Sort matches by priority:
  // 1. Exact matches first
  // 2. More words (compound) > fewer words
  // 3. Higher type priority (lower number)
  // 4. Longer keyword length
  matches.sort((a, b) => {
    // Exact match wins
    if (a.isExact !== b.isExact) {
      return a.isExact ? -1 : 1;
    }

    // More words wins (compound matches beat single-word)
    if (a.wordCount !== b.wordCount) {
      return b.wordCount - a.wordCount;
    }

    // Higher type priority wins (lower number = higher priority)
    if (TYPE_PRIORITY[a.type] !== TYPE_PRIORITY[b.type]) {
      return TYPE_PRIORITY[a.type] - TYPE_PRIORITY[b.type];
    }

    // Longer keyword wins (tie-breaker)
    return b.keyword.length - a.keyword.length;
  });

  return matches[0].type;
}

/**
 * Fuzzy matching for edge cases
 */
function fuzzyMatch(name: string): IngredientType | null {
  // Check for spirit indicators
  if (name.match(/\b(proof|aged|barrel|cask|distilled|reserve|vintage)\b/i)) {
    return 'spirit';
  }

  // Check for sweet indicators (before acid - nectar/puree are sweet)
  if (name.includes('nectar') || name.includes('puree') || name.includes('purée')) {
    return 'sweet';
  }

  // Check for juice (acid)
  if (name.includes('juice')) {
    return 'acid';
  }

  // Check for syrup/liqueur (sweet)
  if (name.includes('syrup') || name.includes('liqueur') || name.includes('schnapps')) {
    return 'sweet';
  }

  // Check for bitters
  if (name.includes('bitter') || name.includes('amaro')) {
    return 'bitter';
  }

  // Check for soda/mixer indicators
  if (name.includes('soda') || name.includes('tonic') || name.includes('beer')) {
    return 'dilution';
  }

  // Check for garnish indicators
  if (name.match(/\b(sprig|leaf|leaves|wheel|wedge|twist|peel|slice|garnish|for garnish)\b/i)) {
    return 'garnish';
  }

  // Check for cream/dairy
  if (name.includes('cream') || name.includes('milk')) {
    // But not "cream of coconut" which is sweet
    if (name.includes('cream of coconut') || name.includes('coco lopez')) {
      return 'sweet';
    }
    return 'dairy';
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
  'bourbon', 'whiskey', 'whisky', 'rye', 'scotch', 'irish whiskey',
  'vodka', 'gin', 'tequila', 'mezcal', 'rum', 'rhum', 'rhum agricole',
  'brandy', 'cognac', 'armagnac', 'calvados', 'applejack', 'grappa',
  'absinthe', 'aquavit', 'cachaca', 'cachaça', 'pisco', 'sake', 'soju', 'shochu', 'genever', 'baijiu'
];

function getSpiritName(name: string): string {
  const lower = name.toLowerCase();

  for (const keyword of SPIRIT_KEYWORDS) {
    if (matchesKeyword(lower, keyword)) {
      // Special cases for display - group similar spirits
      if (keyword === 'whisky' || keyword === 'bourbon' || keyword === 'rye' || keyword === 'scotch' || keyword === 'irish whiskey') {
        return 'WHISKEY';
      }
      if (keyword === 'cognac' || keyword === 'armagnac' || keyword === 'calvados' || keyword === 'applejack' || keyword === 'grappa') {
        return 'BRANDY';
      }
      if (keyword === 'cachaca' || keyword === 'cachaça') {
        return 'CACHAÇA';
      }
      if (keyword === 'rhum' || keyword === 'rhum agricole') {
        return 'RUM';
      }
      if (keyword === 'shochu') {
        return 'SHOCHU';
      }
      if (keyword === 'baijiu') {
        return 'BAIJIU';
      }
      if (keyword === 'genever') {
        return 'GENEVER';
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
