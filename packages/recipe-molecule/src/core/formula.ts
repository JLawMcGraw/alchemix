/**
 * Chemical Formula Generator v2
 *
 * Generates chemistry-accurate formulas for cocktail recipes using:
 * - Coefficients: Count of different ingredients of a type (3Rm = 3 rums)
 * - Subscripts: Whole-number ratio amounts (Rm₄ = ratio of 4)
 * - Smart grouping: Single ingredients get specific symbols, multiple get grouped
 * - Signature ingredients: Always specific, never grouped
 *
 * See FORMULA_NOTATION.md for full specification.
 */

import { parseIngredient, toOunces } from './parser';

// ═══════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════

const RATIO_CAP = 8;          // Maximum ratio number before scaling
const MAX_ELEMENTS = 5;       // Maximum elements in formula
const QUARTER_OZ = 0.25;      // Base unit for ratio calculation

// ═══════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════

type IngredientCategory = 'spirit' | 'signature' | 'acid' | 'sweet' | 'bitter' | 'dairy' | 'other';

interface ElementMapping {
  symbol: string;
  keywords: string[];
  category: IngredientCategory;
  isSignature?: boolean;
}

interface ParsedFormulaIngredient {
  symbol: string;
  category: IngredientCategory;
  quarterOz: number;
  isSignature: boolean;
  isTrace: boolean;
}

interface FormulaElement {
  symbol: string;
  category: IngredientCategory;
  count: number;        // How many ingredients combined (coefficient)
  ratio: number;        // Combined ratio amount (subscript)
  isSignature: boolean;
}

// ═══════════════════════════════════════════════════════════════
// ELEMENT MAPPINGS
// ═══════════════════════════════════════════════════════════════

/**
 * All elements with their symbols, keywords, and categories.
 * Signature ingredients are marked and will never be grouped.
 */
const ELEMENTS: ElementMapping[] = [
  // ─── SPIRITS ───
  // Note: More specific types must come BEFORE generic ones to match correctly
  // (e.g., 'rye whiskey' should match Ry, not Wh)
  { symbol: 'Rm', keywords: ['rum', 'white rum', 'dark rum', 'gold rum', 'spiced rum', 'aged rum', 'overproof', 'jamaican rum', 'puerto rican rum', 'demerara rum', 'black rum', 'blended rum'], category: 'spirit' },
  { symbol: 'Ra', keywords: ['rhum agricole', 'agricole', 'martinique', 'rhum'], category: 'spirit' },
  { symbol: 'Cc', keywords: ['cachaca', 'cachaça'], category: 'spirit' },
  { symbol: 'Vd', keywords: ['vodka'], category: 'spirit' },
  { symbol: 'Gn', keywords: ['gin', 'london dry', 'old tom', 'navy strength', 'plymouth'], category: 'spirit' },
  // Specific whiskeys before generic whiskey
  { symbol: 'Bb', keywords: ['bourbon'], category: 'spirit' },
  { symbol: 'Ry', keywords: ['rye whiskey', 'rye'], category: 'spirit' },
  { symbol: 'Sc', keywords: ['scotch', 'single malt', 'blended scotch', 'islay'], category: 'spirit' },
  { symbol: 'Wh', keywords: ['whiskey', 'whisky', 'irish whiskey'], category: 'spirit' },
  { symbol: 'Tq', keywords: ['tequila', 'blanco', 'reposado', 'añejo', 'anejo'], category: 'spirit' },
  { symbol: 'Mz', keywords: ['mezcal', 'mescal'], category: 'spirit' },
  { symbol: 'Br', keywords: ['brandy', 'apple brandy', 'pear brandy', 'calvados'], category: 'spirit' },
  { symbol: 'Cg', keywords: ['cognac', 'vs', 'vsop', 'xo cognac'], category: 'spirit' },
  { symbol: 'Ps', keywords: ['pisco'], category: 'spirit' },

  // ─── SIGNATURE LIQUEURS (never grouped) ───
  // Orange/Citrus liqueurs (blue curacao BEFORE generic curacao for priority matching)
  { symbol: 'Bc', keywords: ['blue curacao', 'blue curaçao'], category: 'signature', isSignature: true },
  { symbol: 'Ol', keywords: ['orange liqueur', 'triple sec', 'cointreau', 'grand marnier', 'curacao', 'curaçao', 'dry curacao'], category: 'signature', isSignature: true },
  { symbol: 'Lm', keywords: ['limoncello', 'lemoncello', 'lemon liqueur'], category: 'signature', isSignature: true },

  // Fruit liqueurs, purees, and nectars (symbols match periodicTable.ts)
  { symbol: 'Pe', keywords: ['peach liqueur', 'peach schnapps', 'peach puree', 'peach purée', 'white peach puree', 'white peach purée', 'peach nectar', 'creme de peche', 'crème de pêche', 'mathilde peche', 'giffard peche', 'combier peche'], category: 'signature', isSignature: true },
  { symbol: 'Cm', keywords: ['raspberry liqueur', 'raspberry puree', 'raspberry purée', 'chambord', 'creme de framboise', 'framboise'], category: 'signature', isSignature: true },
  { symbol: 'Sf', keywords: ['strawberry liqueur', 'strawberry puree', 'strawberry purée', 'creme de fraise', 'fraise', 'fragola'], category: 'signature', isSignature: true },
  { symbol: 'At', keywords: ['apricot liqueur', 'apricot puree', 'apricot purée', 'apricot nectar', 'apricot brandy', 'creme d\'abricot', 'rothman apricot'], category: 'signature', isSignature: true },
  { symbol: 'Mu', keywords: ['blackberry liqueur', 'blackberry puree', 'blackberry purée', 'creme de mure', 'crème de mûre', 'mure', 'mûre'], category: 'signature', isSignature: true },
  { symbol: 'Pw', keywords: ['pear liqueur', 'pear puree', 'pear purée', 'pear nectar', 'poire william', 'belle de brillet', 'pear brandy'], category: 'signature', isSignature: true },
  { symbol: 'Mi', keywords: ['melon liqueur', 'melon puree', 'melon purée', 'midori'], category: 'signature', isSignature: true },
  { symbol: 'Ly', keywords: ['lychee liqueur', 'lychee puree', 'lychee purée', 'lychee', 'litchi'], category: 'signature', isSignature: true },
  { symbol: 'Mg', keywords: ['mango liqueur', 'mango puree', 'mango purée', 'mango nectar', 'mango'], category: 'signature', isSignature: true },
  { symbol: 'Gu', keywords: ['guava', 'guava puree', 'guava purée', 'guava soda', 'guava juice', 'guava nectar'], category: 'signature', isSignature: true },
  { symbol: 'Pp', keywords: ['papaya', 'papaya puree', 'papaya purée', 'papaya juice', 'papaya nectar'], category: 'signature', isSignature: true },
  { symbol: 'Kq', keywords: ['kumquat', 'kumquat liqueur', 'kumquat puree', 'kumquat purée'], category: 'signature', isSignature: true },
  { symbol: 'Yu', keywords: ['yuzu', 'yuzu juice', 'yuzu puree', 'yuzu purée'], category: 'signature', isSignature: true },
  { symbol: 'Td', keywords: ['tamarind', 'tamarind syrup', 'tamarind puree', 'tamarind purée'], category: 'signature', isSignature: true },
  { symbol: 'Bn', keywords: ['banana liqueur', 'banana puree', 'banana purée', 'creme de banane', 'banana'], category: 'signature', isSignature: true },

  // Herbal/Botanical liqueurs (symbols match periodicTable.ts)
  { symbol: 'Ct', keywords: ['chartreuse', 'green chartreuse', 'yellow chartreuse'], category: 'signature', isSignature: true },
  { symbol: 'Ms', keywords: ['maraschino', 'luxardo maraschino'], category: 'signature', isSignature: true },
  { symbol: 'El', keywords: ['elderflower', 'st germain', 'st. germain', 'elderflower liqueur'], category: 'signature', isSignature: true },
  { symbol: 'Fa', keywords: ['falernum', 'velvet falernum', 'john d. taylor'], category: 'signature', isSignature: true },
  { symbol: 'Dr', keywords: ['drambuie'], category: 'signature', isSignature: true },
  { symbol: 'Be', keywords: ['benedictine', 'bénédictine', 'b&b', 'dom benedictine'], category: 'signature', isSignature: true },
  { symbol: 'Gl', keywords: ['galliano', 'galliano l\'autentico'], category: 'signature', isSignature: true },
  { symbol: 'Sg', keywords: ['sloe gin', 'sloe berry'], category: 'signature', isSignature: true },
  { symbol: 'Gq', keywords: ['ginger liqueur', 'domaine de canton', 'canton'], category: 'signature', isSignature: true },
  { symbol: 'Ch', keywords: ['cherry heering', 'cherry liqueur', 'heering'], category: 'signature', isSignature: true },

  // Nut/Coffee/Cream liqueurs (symbols match periodicTable.ts)
  { symbol: 'Cf', keywords: ['coffee liqueur', 'kahlua', 'kahlúa', 'mr black', 'espresso liqueur', 'tia maria'], category: 'signature', isSignature: true },
  { symbol: 'Am', keywords: ['amaretto', 'almond liqueur', 'disaronno', 'lazzaroni'], category: 'signature', isSignature: true },
  { symbol: 'Fq', keywords: ['hazelnut liqueur', 'frangelico', 'nocello', 'nocino'], category: 'signature', isSignature: true },
  { symbol: 'Nc', keywords: ['coconut liqueur', 'malibu', 'coconut rum', 'coconut cream', 'cream of coconut', 'coco lopez'], category: 'signature', isSignature: true },
  { symbol: 'Ic', keywords: ['irish cream', 'baileys', 'bailey\'s'], category: 'signature', isSignature: true },

  // Berry/Floral liqueurs
  { symbol: 'Cs', keywords: ['cassis', 'creme de cassis', 'crème de cassis', 'blackcurrant liqueur'], category: 'signature', isSignature: true },
  { symbol: 'Co', keywords: ['cacao', 'creme de cacao', 'crème de cacao', 'chocolate liqueur', 'godiva'], category: 'signature', isSignature: true },
  { symbol: 'Cv', keywords: ['violette', 'creme de violette', 'crème de violette', 'violet liqueur'], category: 'signature', isSignature: true },
  { symbol: 'Mn', keywords: ['menthe', 'creme de menthe', 'crème de menthe', 'mint liqueur', 'peppermint schnapps'], category: 'signature', isSignature: true },
  { symbol: 'Rs', keywords: ['rose liqueur', 'creme de rose', 'rose water liqueur'], category: 'signature', isSignature: true },
  { symbol: 'Hb', keywords: ['hibiscus liqueur', 'hibiscus'], category: 'signature', isSignature: true },

  // Other specialty liqueurs (symbols match periodicTable.ts)
  { symbol: 'Ad', keywords: ['allspice dram', 'pimento dram', 'st. elizabeth'], category: 'signature', isSignature: true },
  { symbol: 'Vo', keywords: ['advocaat', 'eggnog liqueur'], category: 'signature', isSignature: true },
  { symbol: 'L4', keywords: ['licor 43', 'cuarenta y tres', 'licor cuarenta'], category: 'signature', isSignature: true },
  { symbol: 'Tu', keywords: ['tuaca', 'vanilla liqueur'], category: 'signature', isSignature: true },
  { symbol: 'Sm', keywords: ['sambuca', 'anise liqueur'], category: 'signature', isSignature: true },
  { symbol: 'St', keywords: ['strega'], category: 'signature', isSignature: true },
  { symbol: 'Gp', keywords: ['grappa'], category: 'signature', isSignature: true },

  // ─── SPARKLING WINES (Sp matches periodicTable.ts) ───
  { symbol: 'Sp', keywords: ['prosecco', 'champagne', 'cava', 'sparkling wine', 'cremant', 'crémant', 'sekt', 'brut', 'italian sparkling', 'french sparkling', 'spanish sparkling'], category: 'signature', isSignature: true },

  // ─── SAVORY/BRUNCH COCKTAIL SIGNATURES ───
  { symbol: 'Tj', keywords: ['tomato juice', 'tomato', 'clamato', 'v8'], category: 'signature', isSignature: true },
  { symbol: 'Wo', keywords: ['worcestershire', 'worcestershire sauce', 'lea & perrins', 'lea and perrins'], category: 'signature', isSignature: true },

  // ─── CARBONATED SIGNATURES (key flavor mixers) ───
  { symbol: 'Gb', keywords: ['ginger beer'], category: 'signature', isSignature: true },

  // ─── SIGNATURE AMARI & APERITIVI (symbols match periodicTable.ts) ───
  { symbol: 'Cp', keywords: ['campari'], category: 'signature', isSignature: true },
  { symbol: 'Ap', keywords: ['aperol'], category: 'signature', isSignature: true },
  { symbol: 'Fe', keywords: ['fernet', 'fernet branca', 'fernet-branca'], category: 'signature', isSignature: true },
  { symbol: 'Ab', keywords: ['absinthe', 'pastis', 'pernod', 'herbsaint'], category: 'signature', isSignature: true },
  { symbol: 'Sv', keywords: ['sweet vermouth', 'vermouth rosso', 'carpano', 'antica formula', 'cocchi vermouth'], category: 'signature', isSignature: true },
  { symbol: 'Dv', keywords: ['dry vermouth', 'vermouth dry', 'dolin dry', 'noilly prat'], category: 'signature', isSignature: true },
  { symbol: 'Lt', keywords: ['lillet', 'lillet blanc', 'lillet rose', 'lillet rouge'], category: 'signature', isSignature: true },
  { symbol: 'Sh', keywords: ['sherry', 'fino sherry', 'amontillado', 'oloroso', 'pedro ximenez', 'px'], category: 'signature', isSignature: true },
  { symbol: 'Pu', keywords: ['punt e mes'], category: 'signature', isSignature: true },
  { symbol: 'Ca', keywords: ['cocchi americano'], category: 'signature', isSignature: true },
  { symbol: 'Yr', keywords: ['cynar', 'artichoke liqueur'], category: 'signature', isSignature: true },
  { symbol: 'Mo', keywords: ['amaro montenegro', 'montenegro'], category: 'signature', isSignature: true },
  { symbol: 'Ae', keywords: ['amaro averna', 'averna'], category: 'signature', isSignature: true },
  { symbol: 'Nn', keywords: ['amaro nonino', 'nonino'], category: 'signature', isSignature: true },
  { symbol: 'Ao', keywords: ['amaro'], category: 'signature', isSignature: true },
  { symbol: 'Sz', keywords: ['suze', 'gentian liqueur'], category: 'signature', isSignature: true },

  // ─── SIGNATURE SYRUPS (symbols match periodicTable.ts) ───
  { symbol: 'Og', keywords: ['orgeat', 'almond syrup'], category: 'signature', isSignature: true },
  { symbol: 'Gr', keywords: ['grenadine', 'pomegranate syrup'], category: 'signature', isSignature: true },
  { symbol: 'Pf', keywords: ['passion fruit syrup', 'passionfruit syrup', 'passion fruit', 'passionfruit', 'lilikoi'], category: 'signature', isSignature: true },
  { symbol: 'Gs', keywords: ['ginger syrup'], category: 'signature', isSignature: true },
  { symbol: 'Ci', keywords: ['cinnamon syrup'], category: 'signature', isSignature: true },
  { symbol: 'Va', keywords: ['vanilla syrup'], category: 'signature', isSignature: true },
  { symbol: 'Lv', keywords: ['lavender syrup'], category: 'signature', isSignature: true },
  { symbol: 'Rb', keywords: ['raspberry syrup'], category: 'signature', isSignature: true },

  // ─── ACIDS (can be grouped as Ac) ───
  { symbol: 'Li', keywords: ['lime', 'lime juice', 'fresh lime'], category: 'acid' },
  { symbol: 'Le', keywords: ['lemon', 'lemon juice', 'fresh lemon'], category: 'acid' },
  { symbol: 'Gf', keywords: ['grapefruit', 'grapefruit juice'], category: 'acid' },
  { symbol: 'Or', keywords: ['orange juice', 'oj', 'fresh orange juice'], category: 'acid' },
  { symbol: 'Pi', keywords: ['pineapple', 'pineapple juice'], category: 'acid' },
  { symbol: 'Cb', keywords: ['cranberry', 'cranberry juice'], category: 'acid' },

  // ─── SWEETS (can be grouped as Sw) ───
  { symbol: 'Ss', keywords: ['simple syrup', 'sugar syrup', '1:1 syrup', 'simple'], category: 'sweet' },
  { symbol: 'Rx', keywords: ['rich syrup', '2:1 syrup', 'rich simple', 'rich demerara'], category: 'sweet' },
  { symbol: 'Hn', keywords: ['honey', 'honey syrup'], category: 'sweet' },
  { symbol: 'Av', keywords: ['agave', 'agave nectar', 'agave syrup'], category: 'sweet' },
  { symbol: 'Dm', keywords: ['demerara', 'demerara syrup', 'brown sugar syrup'], category: 'sweet' },
  { symbol: 'Ma', keywords: ['maple', 'maple syrup'], category: 'sweet' },
  { symbol: 'Su', keywords: ['sugar', 'sugar cube', 'white sugar', 'superfine sugar'], category: 'sweet' },

  // ─── BITTERS (can be grouped as Bt) ───
  { symbol: 'An', keywords: ['angostura', 'angostura bitters', 'aromatic bitters', 'ango'], category: 'bitter' },
  { symbol: 'Ob', keywords: ['orange bitters', 'regans orange', "regan's"], category: 'bitter' },
  { symbol: 'Py', keywords: ['peychauds', "peychaud's", 'peychaud'], category: 'bitter' },
  { symbol: 'Xb', keywords: ['chocolate bitters', 'mole bitters', 'aztec bitters'], category: 'bitter' },

  // ─── DAIRY (can be grouped as Dy) ───
  { symbol: 'Cr', keywords: ['heavy cream', 'cream', 'whipping cream'], category: 'dairy' },
  { symbol: 'Ew', keywords: ['egg white', 'aquafaba'], category: 'dairy' },
  { symbol: 'Ey', keywords: ['egg yolk', 'yolk'], category: 'dairy' },
  { symbol: 'Ml', keywords: ['milk', 'whole milk', 'half and half', 'half & half'], category: 'dairy' },
];

// Group symbols for when multiple ingredients of same type are combined
const GROUP_SYMBOLS: Record<IngredientCategory, string> = {
  spirit: 'Sp',
  signature: '', // Signatures are never grouped
  acid: 'Ac',
  sweet: 'Sw',
  bitter: 'Bt',
  dairy: 'Dy',
  other: '',
};

// Category priority for sorting (lower = higher priority)
const CATEGORY_PRIORITY: Record<IngredientCategory, number> = {
  spirit: 1,
  signature: 2,
  acid: 3,
  sweet: 4,
  bitter: 5,
  dairy: 6,
  other: 7,
};

// Keywords for ingredients to omit from formula (garnishes, mixers, dilution)
const OMIT_KEYWORDS = [
  // ─── CARBONATED MIXERS ───
  'soda', 'soda water', 'club soda', 'sparkling water', 'seltzer',
  'tonic', 'tonic water', 'indian tonic',
  'ginger ale',
  'cola', 'coke', 'coca-cola', 'pepsi',
  'champagne', 'prosecco', 'cava', 'sparkling wine',

  // ─── WATER & ICE ───
  'water', 'ice', 'crushed ice', 'ice cubes', 'pebble ice',

  // ─── GARNISH INDICATORS ───
  'garnish', 'for garnish', 'to garnish',
  'twist', 'wheel', 'wedge', 'peel', 'zest', 'expressed',
  'slice', 'slices', 'chunk', 'chunks', 'piece', 'pieces', 'cube', 'cubes',
  'sprig', 'sprigs', 'leaf', 'leaves', 'branch', 'stem',
  'grated', 'dusted', 'sprinkle', 'float', 'flamed',

  // ─── HERB GARNISHES ───
  'mint leaves', 'mint sprig', 'mint leaf',
  'basil', 'basil leaf', 'basil leaves',
  'rosemary', 'rosemary sprig',
  'thyme', 'thyme sprig',
  'sage', 'sage leaf',
  'cilantro', 'dill',

  // ─── FRUIT/VEGETABLE GARNISHES ───
  'cherry', 'maraschino cherry', 'brandied cherry', 'luxardo cherry',
  'olive', 'olives',
  'onion', 'cocktail onion', 'pearl onion',
  'cucumber', 'cucumber slice', 'cucumber ribbon',
  'celery', 'celery stalk',
  'pickled', 'candied',

  // ─── DECORATIVE ───
  'umbrella', 'straw', 'pick', 'skewer', 'flag',
  'edible flower', 'orchid', 'nasturtium',
  'nutmeg', 'cinnamon stick', 'star anise', // when used as garnish
];

// Modifiers that indicate an ingredient is for muddling/garnish, not liquid
// These override element matching - "chunks pineapple" should NOT match as acid
const GARNISH_MODIFIERS = [
  'chunk', 'chunks', 'piece', 'pieces', 'cube', 'cubes',
  'slice', 'slices', 'wedge', 'wedges', 'wheel', 'wheels',
  'leaf', 'leaves', 'sprig', 'sprigs', 'branch', 'stem',
  'whole', 'muddled',
  'expressed', 'flamed', 'grated', 'dusted',
  'for muddling', 'to muddle',
];

// Subscript character mapping
const SUBSCRIPT_MAP: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
  '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
};

// ═══════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Convert a number to subscript string
 */
function toSubscript(num: number): string {
  if (num <= 1) return '';
  return String(Math.round(num))
    .split('')
    .map(char => SUBSCRIPT_MAP[char] || char)
    .join('');
}

/**
 * Calculate Greatest Common Divisor of two numbers
 */
function gcd(a: number, b: number): number {
  a = Math.abs(Math.round(a));
  b = Math.abs(Math.round(b));
  while (b > 0) {
    const temp = b;
    b = a % b;
    a = temp;
  }
  return a;
}

/**
 * Calculate GCD of an array of numbers
 */
function gcdArray(nums: number[]): number {
  const validNums = nums.filter(n => n > 0).map(n => Math.round(n));
  if (validNums.length === 0) return 1;
  return validNums.reduce((acc, n) => gcd(acc, n), validNums[0]);
}

/**
 * Check if ingredient matches any keywords
 */
function matchesKeywords(ingredientText: string, keywords: string[]): boolean {
  const lower = ingredientText.toLowerCase();
  return keywords.some(kw => lower.includes(kw));
}

/**
 * Check if ingredient should be omitted (garnishes, mixers, etc.)
 */
function shouldOmit(ingredientText: string): boolean {
  const lower = ingredientText.toLowerCase();

  // Sugar cube is a valid ingredient, not a garnish
  if (lower.includes('sugar cube')) return false;

  return OMIT_KEYWORDS.some(kw => {
    const regex = new RegExp(`\\b${kw}\\b`, 'i');
    return regex.test(lower);
  });
}

/**
 * Check if ingredient has garnish modifiers that indicate it's not a liquid
 * e.g., "chunks pineapple" should NOT match as pineapple juice
 *
 * Exception: If the ingredient explicitly contains "juice", it's a liquid
 */
function hasGarnishModifier(ingredientText: string): boolean {
  const lower = ingredientText.toLowerCase();

  // If it explicitly says "juice", it's definitely a liquid - not a garnish
  if (lower.includes('juice')) return false;

  // If it explicitly says "syrup", it's a liquid
  if (lower.includes('syrup')) return false;

  // If it explicitly says "liqueur" or "liquor", it's a liquid
  if (lower.includes('liqueur') || lower.includes('liquor')) return false;

  // Sugar cube is a valid ingredient, not a garnish
  if (lower.includes('sugar cube')) return false;

  // Check for garnish modifiers
  return GARNISH_MODIFIERS.some(mod => {
    const regex = new RegExp(`\\b${mod}\\b`, 'i');
    return regex.test(lower);
  });
}

/**
 * Convert volume to quarter-ounces (base unit for ratio calculation)
 */
function toQuarterOunces(amount: number | null, unit: string | null): number {
  if (!amount) return 0;
  const oz = toOunces(amount, unit);
  return Math.round(oz / QUARTER_OZ);
}

/**
 * Check if this is a trace amount (dashes, drops, rinses)
 */
function isTraceAmount(unit: string | null, quarterOz: number): boolean {
  const traceUnits = ['dash', 'dashes', 'drop', 'drops', 'barspoon', 'rinse', 'spray', 'mist'];
  if (unit && traceUnits.includes(unit.toLowerCase())) return true;
  return quarterOz === 0;
}

// ═══════════════════════════════════════════════════════════════
// MAIN FORMULA GENERATION
// ═══════════════════════════════════════════════════════════════

/**
 * Parse an ingredient string and classify it
 */
function classifyIngredient(ingredient: string): ParsedFormulaIngredient | null {
  const parsed = parseIngredient(ingredient);
  const ingredientText = `${parsed.name} ${ingredient}`.toLowerCase();
  const quarterOz = toQuarterOunces(parsed.amount, parsed.unit);
  const isTrace = isTraceAmount(parsed.unit, quarterOz);

  // Step 1: Check for SIGNATURE ingredients FIRST (before omit check)
  // This allows "guava soda" to match as guava even though "soda" would normally be omitted
  for (const elem of ELEMENTS) {
    if (elem.isSignature && matchesKeywords(ingredientText, elem.keywords)) {
      return {
        symbol: elem.symbol,
        category: elem.category,
        quarterOz: isTrace ? 1 : quarterOz,
        isSignature: true,
        isTrace,
      };
    }
  }

  // Step 2: Check if it should be completely omitted (garnishes, plain mixers)
  if (shouldOmit(ingredient)) return null;

  // Step 3: Check if it has garnish modifiers (chunks, slices, leaves, etc.)
  // This catches things like "5 chunks pineapple" which shouldn't match as acid
  if (hasGarnishModifier(ingredient)) return null;

  // Step 4: Find matching non-signature element
  for (const elem of ELEMENTS) {
    if (matchesKeywords(ingredientText, elem.keywords)) {
      return {
        symbol: elem.symbol,
        category: elem.category,
        quarterOz: isTrace ? 1 : quarterOz,
        isSignature: elem.isSignature || false,
        isTrace,
      };
    }
  }

  return null; // Unknown ingredient - omit from formula
}

/**
 * Group ingredients and determine symbols
 *
 * Grouping rules:
 * - Signatures: Never grouped, always keep their specific symbol
 * - Spirits: Group by specific type (Rm, Gn, etc.), only use Sp for 4+ different types
 * - Acids/Sweets/Bitters/Dairy: Group by category if multiple, use specific if single
 */
function groupIngredients(ingredients: ParsedFormulaIngredient[]): FormulaElement[] {
  // First pass: group by symbol for spirits, category for others
  const groups = new Map<string, ParsedFormulaIngredient[]>();

  for (const ing of ingredients) {
    // Signatures and spirits group by symbol, others by category
    const key = ing.isSignature || ing.category === 'spirit' ? ing.symbol : ing.category;
    const existing = groups.get(key) || [];
    existing.push(ing);
    groups.set(key, existing);
  }

  let elements: FormulaElement[] = [];

  for (const [key, items] of groups) {
    const first = items[0];
    const count = items.length;
    const totalQuarterOz = items.reduce((sum, i) => sum + i.quarterOz, 0);

    // Determine symbol
    let symbol: string;
    if (first.isSignature || first.category === 'spirit') {
      // Signatures and individual spirit types keep their specific symbol
      symbol = first.symbol;
    } else if (count === 1) {
      // Single ingredient of a type uses specific symbol
      symbol = first.symbol;
    } else {
      // Multiple ingredients of same category use group symbol
      symbol = GROUP_SYMBOLS[first.category] || first.symbol;
    }

    // Skip if no valid symbol
    if (!symbol) continue;

    elements.push({
      symbol,
      category: first.category,
      count: first.isSignature ? 1 : count, // Signatures don't show coefficient
      ratio: totalQuarterOz,
      isSignature: first.isSignature,
    });
  }

  // Second pass: Check if 4+ different spirit types should be combined to Sp
  const spiritElements = elements.filter(e => e.category === 'spirit');
  if (spiritElements.length >= 4) {
    // Combine all spirits into Sp
    const totalSpiritCount = spiritElements.reduce((sum, e) => sum + e.count, 0);
    const totalSpiritRatio = spiritElements.reduce((sum, e) => sum + e.ratio, 0);

    // Remove individual spirits and add combined Sp
    elements = elements.filter(e => e.category !== 'spirit');
    elements.unshift({
      symbol: 'Sp',
      category: 'spirit',
      count: totalSpiritCount,
      ratio: totalSpiritRatio,
      isSignature: false,
    });
  }

  return elements;
}

/**
 * Apply ratio cap and simplify
 */
function normalizeRatios(elements: FormulaElement[]): FormulaElement[] {
  if (elements.length === 0) return elements;

  // Get all ratios
  const ratios = elements.map(e => e.ratio).filter(r => r > 0);
  if (ratios.length === 0) return elements;

  // Find GCD
  const divisor = gcdArray(ratios);

  // Simplify by GCD
  let simplified = elements.map(e => ({
    ...e,
    ratio: e.ratio > 0 ? Math.round(e.ratio / divisor) : 1,
  }));

  // Check if any exceed cap
  const maxRatio = Math.max(...simplified.map(e => e.ratio));
  if (maxRatio > RATIO_CAP) {
    const scale = RATIO_CAP / maxRatio;
    simplified = simplified.map(e => ({
      ...e,
      ratio: Math.max(1, Math.round(e.ratio * scale)),
    }));
  }

  return simplified;
}

/**
 * Sort by priority and limit to max elements
 */
function prioritizeElements(elements: FormulaElement[]): FormulaElement[] {
  // Sort by category priority, then by ratio (descending)
  const sorted = [...elements].sort((a, b) => {
    const priorityDiff = CATEGORY_PRIORITY[a.category] - CATEGORY_PRIORITY[b.category];
    if (priorityDiff !== 0) return priorityDiff;
    return b.ratio - a.ratio;
  });

  return sorted.slice(0, MAX_ELEMENTS);
}

/**
 * Format elements into final formula string
 */
function formatFormula(elements: FormulaElement[]): string {
  const parts = elements.map(elem => {
    const coefficient = elem.count > 1 ? String(elem.count) : '';
    const subscript = toSubscript(elem.ratio);
    return `${coefficient}${elem.symbol}${subscript}`;
  });

  return parts.join(' · ');
}

/**
 * Generate a chemical formula from recipe ingredients
 *
 * @param ingredients Array of ingredient strings (e.g., ["2 oz Tequila", "1 oz Lime juice"])
 * @returns Formatted formula string (e.g., "Tq₈Li₄Ss₃")
 */
export function generateFormula(ingredients: string[]): string {
  // Step 1: Parse and classify all ingredients
  const classified: ParsedFormulaIngredient[] = [];
  for (const ing of ingredients) {
    const result = classifyIngredient(ing);
    if (result) classified.push(result);
  }

  if (classified.length === 0) return '';

  // Step 2: Group ingredients and determine symbols
  const grouped = groupIngredients(classified);

  // Step 3: Normalize ratios (GCD + cap)
  const normalized = normalizeRatios(grouped);

  // Step 4: Prioritize and limit to max elements
  const prioritized = prioritizeElements(normalized);

  // Step 5: Format final string
  return formatFormula(prioritized);
}

/**
 * Generate formula with optional max elements override
 */
export function generateCompactFormula(
  ingredients: string[],
  maxElements: number = MAX_ELEMENTS
): string {
  // Use same logic but with custom max
  const classified: ParsedFormulaIngredient[] = [];
  for (const ing of ingredients) {
    const result = classifyIngredient(ing);
    if (result) classified.push(result);
  }

  if (classified.length === 0) return '';

  const grouped = groupIngredients(classified);
  const normalized = normalizeRatios(grouped);

  // Custom max elements
  const sorted = [...normalized].sort((a, b) => {
    const priorityDiff = CATEGORY_PRIORITY[a.category] - CATEGORY_PRIORITY[b.category];
    if (priorityDiff !== 0) return priorityDiff;
    return b.ratio - a.ratio;
  });

  const limited = sorted.slice(0, maxElements);
  return formatFormula(limited);
}

// ═══════════════════════════════════════════════════════════════
// SYMBOL LOOKUP (for tooltips)
// ═══════════════════════════════════════════════════════════════

/**
 * Human-readable names for each symbol
 */
const SYMBOL_NAMES: Record<string, string> = {
  // Spirits
  'Rm': 'Rum',
  'Ra': 'Rhum Agricole',
  'Cc': 'Cachaça',
  'Vd': 'Vodka',
  'Gn': 'Gin',
  'Bb': 'Bourbon',
  'Ry': 'Rye Whiskey',
  'Sc': 'Scotch',
  'Wh': 'Whiskey',
  'Tq': 'Tequila',
  'Mz': 'Mezcal',
  'Br': 'Brandy',
  'Cg': 'Cognac',
  'Ps': 'Pisco',

  // Signature Flavors (liqueurs, purees, nectars)
  'Ol': 'Orange Liqueur',
  'Bc': 'Blue Curacao',
  'Lm': 'Limoncello',
  'Pe': 'Peach',
  'Cm': 'Raspberry',
  'Sf': 'Strawberry',
  'At': 'Apricot',
  'Mu': 'Blackberry',
  'Pw': 'Pear',
  'Mi': 'Melon',
  'Ly': 'Lychee',
  'Mg': 'Mango',
  'Gu': 'Guava',
  'Pp': 'Papaya',
  'Kq': 'Kumquat',
  'Yu': 'Yuzu',
  'Td': 'Tamarind',
  'Bn': 'Banana',
  'Ct': 'Chartreuse',
  'Ms': 'Maraschino',
  'El': 'Elderflower',
  'Fa': 'Falernum',
  'Dr': 'Drambuie',
  'Be': 'Bénédictine',
  'Gl': 'Galliano',
  'Sg': 'Sloe Gin',
  'Gq': 'Ginger Liqueur',
  'Ch': 'Cherry',
  'Cf': 'Coffee',
  'Am': 'Amaretto',
  'Fq': 'Hazelnut',
  'Nc': 'Coconut',
  'Ic': 'Irish Cream',
  'Cs': 'Cassis',
  'Co': 'Chocolate',
  'Cv': 'Violette',
  'Mn': 'Mint',
  'Rs': 'Rose',
  'Hb': 'Hibiscus',
  'Ad': 'Allspice Dram',
  'Vo': 'Advocaat',
  'L4': 'Licor 43',
  'Tu': 'Tuaca',
  'Sm': 'Sambuca',
  'St': 'Strega',
  'Gp': 'Grappa',

  // Sparkling
  'Sp': 'Sparkling Wine',

  // Savory
  'Tj': 'Tomato',
  'Wo': 'Worcestershire',

  // Carbonated Signatures
  'Gb': 'Ginger Beer',

  // Amari & Aperitivi
  'Cp': 'Campari',
  'Ap': 'Aperol',
  'Fe': 'Fernet',
  'Ab': 'Absinthe',
  'Sv': 'Sweet Vermouth',
  'Dv': 'Dry Vermouth',
  'Lt': 'Lillet',
  'Sh': 'Sherry',
  'Pu': 'Punt e Mes',
  'Ca': 'Cocchi Americano',
  'Yr': 'Cynar',
  'Mo': 'Montenegro',
  'Ae': 'Averna',
  'Nn': 'Nonino',
  'Ao': 'Amaro',
  'Sz': 'Suze',

  // Signature Syrups
  'Og': 'Orgeat',
  'Gr': 'Grenadine',
  'Pf': 'Passion Fruit',
  'Gs': 'Ginger Syrup',
  'Ci': 'Cinnamon Syrup',
  'Va': 'Vanilla Syrup',
  'Lv': 'Lavender Syrup',
  'Rb': 'Raspberry Syrup',

  // Acids
  'Li': 'Lime',
  'Le': 'Lemon',
  'Gf': 'Grapefruit',
  'Or': 'Orange',
  'Pi': 'Pineapple',
  'Cb': 'Cranberry',
  'Ac': 'Acids',

  // Sweets
  'Ss': 'Simple Syrup',
  'Rx': 'Rich Syrup',
  'Hn': 'Honey',
  'Av': 'Agave',
  'Dm': 'Demerara',
  'Ma': 'Maple',
  'Su': 'Sugar',
  'Sw': 'Sweeteners',

  // Bitters
  'An': 'Angostura',
  'Ob': 'Orange Bitters',
  'Py': 'Peychaud\'s',
  'Xb': 'Chocolate Bitters',
  'Bt': 'Bitters',

  // Dairy
  'Cr': 'Cream',
  'Ew': 'Egg White',
  'Ey': 'Egg Yolk',
  'Ml': 'Milk',
  'Dy': 'Dairy',
};

/**
 * Get human-readable name for a symbol
 */
export function getSymbolName(symbol: string): string {
  return SYMBOL_NAMES[symbol] || symbol;
}

/**
 * Parsed formula element with display info
 */
export interface FormulaSymbolInfo {
  symbol: string;
  name: string;
  coefficient: number;
  subscript: number;
  displayText: string;
}

/**
 * Parse a formula string into its component symbols with meanings
 *
 * @param formula - The formula string (e.g., "Rm₄ · 2Li₂ · Ss")
 * @returns Array of symbol info objects
 *
 * @example
 * parseFormulaSymbols("Rm₄ · 2Li₂ · Ss")
 * // Returns:
 * // [
 * //   { symbol: 'Rm', name: 'Rum', coefficient: 1, subscript: 4, displayText: 'Rm₄' },
 * //   { symbol: 'Li', name: 'Lime', coefficient: 2, subscript: 2, displayText: '2Li₂' },
 * //   { symbol: 'Ss', name: 'Simple Syrup', coefficient: 1, subscript: 1, displayText: 'Ss' }
 * // ]
 */
export function parseFormulaSymbols(formula: string): FormulaSymbolInfo[] {
  if (!formula) return [];

  // Split by separator (middle dot with optional spaces)
  const parts = formula.split(/\s*·\s*/);
  const results: FormulaSymbolInfo[] = [];

  // Map subscript characters back to numbers
  const subscriptToNum: Record<string, string> = {
    '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4',
    '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9',
  };

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    // Pattern: optional coefficient (digits), then symbol (letters), then optional subscript
    // e.g., "2Rm₄", "Li₂", "Ss", "3Ac₈"
    const match = trimmed.match(/^(\d*)([A-Za-z][A-Za-z0-9]?)([₀-₉]*)$/);

    if (match) {
      const [, coeffStr, symbol, subStr] = match;
      const coefficient = coeffStr ? parseInt(coeffStr, 10) : 1;

      // Convert subscript string to number
      let subscript = 1;
      if (subStr) {
        const numStr = subStr.split('').map(c => subscriptToNum[c] || c).join('');
        subscript = parseInt(numStr, 10) || 1;
      }

      results.push({
        symbol,
        name: getSymbolName(symbol),
        coefficient,
        subscript,
        displayText: trimmed,
      });
    }
  }

  return results;
}

// Export types
export type { FormulaElement, ParsedFormulaIngredient };
