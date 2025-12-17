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
  { symbol: 'Ol', keywords: ['orange liqueur', 'triple sec', 'cointreau', 'grand marnier', 'curacao', 'curaçao', 'dry curacao'], category: 'signature', isSignature: true },
  { symbol: 'Ch', keywords: ['chartreuse', 'green chartreuse', 'yellow chartreuse'], category: 'signature', isSignature: true },
  { symbol: 'Ms', keywords: ['maraschino', 'luxardo'], category: 'signature', isSignature: true },
  { symbol: 'El', keywords: ['elderflower', 'st germain', 'st. germain'], category: 'signature', isSignature: true },
  { symbol: 'Fl', keywords: ['falernum', 'velvet falernum'], category: 'signature', isSignature: true },
  { symbol: 'Cf', keywords: ['coffee liqueur', 'kahlua', 'kahlúa', 'mr black', 'espresso liqueur'], category: 'signature', isSignature: true },
  { symbol: 'Am', keywords: ['amaretto', 'almond liqueur', 'disaronno'], category: 'signature', isSignature: true },
  { symbol: 'Bn', keywords: ['banana liqueur', 'creme de banane'], category: 'signature', isSignature: true },
  { symbol: 'Cs', keywords: ['cassis', 'creme de cassis', 'crème de cassis', 'blackcurrant'], category: 'signature', isSignature: true },
  { symbol: 'Co', keywords: ['cacao', 'creme de cacao', 'crème de cacao', 'chocolate liqueur'], category: 'signature', isSignature: true },
  { symbol: 'Cv', keywords: ['violette', 'creme de violette', 'crème de violette', 'violet liqueur'], category: 'signature', isSignature: true },
  { symbol: 'Mn', keywords: ['menthe', 'creme de menthe', 'crème de menthe', 'mint liqueur'], category: 'signature', isSignature: true },
  { symbol: 'Dm', keywords: ['drambuie'], category: 'signature', isSignature: true },
  { symbol: 'Bv', keywords: ['benedictine', 'bénédictine', 'b&b'], category: 'signature', isSignature: true },
  { symbol: 'Gl', keywords: ['galliano'], category: 'signature', isSignature: true },

  // ─── SIGNATURE AMARI & APERITIVI (never grouped) ───
  { symbol: 'Cp', keywords: ['campari'], category: 'signature', isSignature: true },
  { symbol: 'Ap', keywords: ['aperol'], category: 'signature', isSignature: true },
  { symbol: 'Fe', keywords: ['fernet', 'fernet branca', 'fernet-branca'], category: 'signature', isSignature: true },
  { symbol: 'Ab', keywords: ['absinthe', 'pastis', 'pernod', 'herbsaint'], category: 'signature', isSignature: true },
  { symbol: 'Sv', keywords: ['sweet vermouth', 'vermouth rosso', 'carpano', 'antica formula', 'punt e mes'], category: 'signature', isSignature: true },
  { symbol: 'Dv', keywords: ['dry vermouth', 'vermouth dry', 'dolin dry', 'noilly prat'], category: 'signature', isSignature: true },
  { symbol: 'Lv', keywords: ['lillet', 'lillet blanc', 'lillet rose'], category: 'signature', isSignature: true },
  { symbol: 'Sh', keywords: ['sherry', 'fino sherry', 'amontillado', 'oloroso', 'pedro ximenez', 'px'], category: 'signature', isSignature: true },

  // ─── SIGNATURE SYRUPS (never grouped) ───
  { symbol: 'Og', keywords: ['orgeat', 'almond syrup'], category: 'signature', isSignature: true },
  { symbol: 'Gr', keywords: ['grenadine', 'pomegranate syrup'], category: 'signature', isSignature: true },
  { symbol: 'Pf', keywords: ['passion fruit syrup', 'passionfruit syrup', 'passion fruit', 'passionfruit', 'lilikoi'], category: 'signature', isSignature: true },
  { symbol: 'Gb', keywords: ['ginger syrup', 'ginger'], category: 'signature', isSignature: true },
  { symbol: 'Ci', keywords: ['cinnamon syrup', 'cinnamon'], category: 'signature', isSignature: true },

  // ─── ACIDS (can be grouped as Ac) ───
  { symbol: 'Li', keywords: ['lime', 'lime juice', 'fresh lime'], category: 'acid' },
  { symbol: 'Le', keywords: ['lemon', 'lemon juice', 'fresh lemon'], category: 'acid' },
  { symbol: 'Gf', keywords: ['grapefruit', 'grapefruit juice'], category: 'acid' },
  { symbol: 'Or', keywords: ['orange juice', 'oj', 'fresh orange juice'], category: 'acid' },
  { symbol: 'Pi', keywords: ['pineapple', 'pineapple juice'], category: 'acid' },
  { symbol: 'Cr', keywords: ['cranberry', 'cranberry juice'], category: 'acid' },

  // ─── SWEETS (can be grouped as Sw) ───
  { symbol: 'Ss', keywords: ['simple syrup', 'sugar syrup', '1:1 syrup', 'simple'], category: 'sweet' },
  { symbol: 'Rs', keywords: ['rich syrup', '2:1 syrup', 'rich simple', 'rich demerara'], category: 'sweet' },
  { symbol: 'Hn', keywords: ['honey', 'honey syrup'], category: 'sweet' },
  { symbol: 'Av', keywords: ['agave', 'agave nectar', 'agave syrup'], category: 'sweet' },
  { symbol: 'De', keywords: ['demerara', 'demerara syrup', 'brown sugar syrup'], category: 'sweet' },
  { symbol: 'Ma', keywords: ['maple', 'maple syrup'], category: 'sweet' },
  { symbol: 'Su', keywords: ['sugar', 'sugar cube', 'white sugar', 'superfine sugar'], category: 'sweet' },

  // ─── BITTERS (can be grouped as Bt) ───
  { symbol: 'An', keywords: ['angostura', 'angostura bitters', 'aromatic bitters', 'ango'], category: 'bitter' },
  { symbol: 'Ob', keywords: ['orange bitters', 'regans orange', "regan's"], category: 'bitter' },
  { symbol: 'Py', keywords: ['peychauds', "peychaud's", 'peychaud'], category: 'bitter' },
  { symbol: 'Cb', keywords: ['chocolate bitters', 'mole bitters', 'aztec bitters'], category: 'bitter' },

  // ─── DAIRY (can be grouped as Dy) ───
  { symbol: 'Hw', keywords: ['heavy cream', 'cream', 'whipping cream'], category: 'dairy' },
  { symbol: 'Ew', keywords: ['egg white', 'aquafaba'], category: 'dairy' },
  { symbol: 'Ey', keywords: ['egg yolk', 'yolk'], category: 'dairy' },
  { symbol: 'Ml', keywords: ['milk', 'whole milk', 'half and half', 'half & half'], category: 'dairy' },
  { symbol: 'Cm', keywords: ['coconut milk', 'coconut cream', 'coco lopez', 'cream of coconut'], category: 'dairy' },
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

// Keywords for ingredients to omit from formula
const OMIT_KEYWORDS = [
  'soda', 'soda water', 'club soda', 'sparkling water', 'seltzer',
  'tonic', 'tonic water', 'indian tonic',
  'ginger beer', 'ginger ale',
  'cola', 'coke', 'coca-cola', 'pepsi',
  'water', 'ice', 'crushed ice', 'ice cubes',
  'garnish', 'twist', 'wheel', 'wedge', 'peel', 'zest',
  'mint leaves', 'mint sprig', 'basil', 'rosemary',
  'cherry', 'olive', 'onion', 'cucumber',
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
  return OMIT_KEYWORDS.some(kw => {
    const regex = new RegExp(`\\b${kw}\\b`, 'i');
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
  if (shouldOmit(ingredient)) return null;

  const parsed = parseIngredient(ingredient);
  const ingredientText = `${parsed.name} ${ingredient}`.toLowerCase();
  const quarterOz = toQuarterOunces(parsed.amount, parsed.unit);
  const isTrace = isTraceAmount(parsed.unit, quarterOz);

  // Find matching element
  for (const elem of ELEMENTS) {
    if (matchesKeywords(ingredientText, elem.keywords)) {
      return {
        symbol: elem.symbol,
        category: elem.category,
        quarterOz: isTrace ? 1 : quarterOz, // Trace amounts get ratio of 1
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

// Export types
export type { FormulaElement, ParsedFormulaIngredient };
