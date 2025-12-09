/**
 * AlcheMix Formatting Utilities
 * Scientific/laboratory-style formatters for the Molecular Mixology design system
 */

/**
 * Format a measurement with leading zeros (scientific notation style)
 * Examples:
 *   formatMeasurement(1.5, 'oz') => '01.50 oz'
 *   formatMeasurement(2, 'oz') => '02.00 oz'
 *   formatMeasurement(0.5, 'oz') => '00.50 oz'
 *   formatMeasurement(3, 'dash') => '03 dash'
 *   formatMeasurement(12, 'ml') => '12.00 ml'
 *
 * @param value - The numeric value to format
 * @param unit - The unit of measurement (oz, ml, dash, etc.)
 * @param options - Formatting options
 * @returns Formatted measurement string
 */
export function formatMeasurement(
  value: number,
  unit: string,
  options: {
    decimals?: number;
    leadingZeros?: number;
    showDecimals?: boolean;
  } = {}
): string {
  const {
    decimals = 2,
    leadingZeros = 2,
    showDecimals = !isWholeUnitOnly(unit)
  } = options;

  // Format the number part
  let formattedValue: string;

  if (showDecimals) {
    // Format with decimals (e.g., "01.50")
    formattedValue = value.toFixed(decimals);
    // Add leading zeros to integer part
    const [intPart, decPart] = formattedValue.split('.');
    formattedValue = intPart.padStart(leadingZeros, '0') + '.' + decPart;
  } else {
    // Format without decimals (e.g., "03")
    formattedValue = Math.round(value).toString().padStart(leadingZeros, '0');
  }

  return `${formattedValue} ${normalizeUnit(unit)}`;
}

/**
 * Check if a unit should only show whole numbers (no decimals)
 */
function isWholeUnitOnly(unit: string): boolean {
  const wholeUnits = ['dash', 'dashes', 'drop', 'drops', 'piece', 'pieces', 'sprig', 'sprigs', 'leaf', 'leaves', 'slice', 'slices', 'wedge', 'wedges', 'cube', 'cubes', 'whole', 'egg', 'eggs'];
  return wholeUnits.includes(unit.toLowerCase());
}

/**
 * Normalize unit to singular form for display consistency
 */
function normalizeUnit(unit: string): string {
  const unitMap: Record<string, string> = {
    'dashes': 'dash',
    'drops': 'drop',
    'pieces': 'piece',
    'sprigs': 'sprig',
    'leaves': 'leaf',
    'slices': 'slice',
    'wedges': 'wedge',
    'cubes': 'cube',
    'eggs': 'egg',
    'ounces': 'oz',
    'ounce': 'oz',
    'milliliters': 'ml',
    'milliliter': 'ml',
    'teaspoons': 'tsp',
    'teaspoon': 'tsp',
    'tablespoons': 'tbsp',
    'tablespoon': 'tbsp',
  };

  return unitMap[unit.toLowerCase()] || unit.toLowerCase();
}

/**
 * Element symbol mapping for common ingredients
 * Used for chemical formula notation
 */
const ELEMENT_SYMBOLS: Record<string, string> = {
  // Spirits - Base
  'rum': 'Rm',
  'rhum agricole': 'Ra',
  'cachaca': 'Cc',
  'cachaça': 'Cc',
  'vodka': 'Vd',
  'gin': 'Gn',
  'whiskey': 'Wh',
  'whisky': 'Wh',
  'bourbon': 'Bb',
  'rye': 'Ry',
  'rye whiskey': 'Ry',
  'scotch': 'Sc',
  'tequila': 'Tq',
  'mezcal': 'Mz',
  'brandy': 'Br',
  'cognac': 'Cg',
  'pisco': 'Ps',

  // Liqueurs
  'orange liqueur': 'Ol',
  'triple sec': 'Ol',
  'cointreau': 'Ol',
  'grand marnier': 'Gm',
  'coffee liqueur': 'Cf',
  'kahlua': 'Cf',
  'amaretto': 'Am',
  'maraschino': 'Ms',
  'maraschino liqueur': 'Ms',
  'elderflower': 'El',
  'st. germain': 'El',
  'st germain': 'El',
  'creme de cassis': 'Cs',
  'crème de cassis': 'Cs',
  'creme de cacao': 'Co',
  'crème de cacao': 'Co',
  'creme de violette': 'Cv',
  'crème de violette': 'Cv',
  'chartreuse': 'Ch',
  'green chartreuse': 'Gc',
  'yellow chartreuse': 'Yc',
  'benedictine': 'Bd',
  'drambuie': 'Db',
  'frangelico': 'Fg',
  'galliano': 'Gl',

  // Vermouth & Aperitifs
  'sweet vermouth': 'Sv',
  'dry vermouth': 'Dv',
  'blanc vermouth': 'Bv',
  'campari': 'Cp',
  'aperol': 'Ap',
  'fernet': 'Fn',
  'fernet branca': 'Fn',

  // Bitters
  'angostura': 'An',
  'angostura bitters': 'An',
  'orange bitters': 'Ob',
  'peychauds': 'Py',
  "peychaud's": 'Py',
  'chocolate bitters': 'Cb',

  // Citrus
  'lime': 'Li',
  'lime juice': 'Li',
  'lemon': 'Le',
  'lemon juice': 'Le',
  'orange': 'Or',
  'orange juice': 'Or',
  'grapefruit': 'Gf',
  'grapefruit juice': 'Gf',
  'pineapple': 'Pi',
  'pineapple juice': 'Pi',
  'passion fruit': 'Pf',
  'cranberry': 'Cn',
  'cranberry juice': 'Cn',

  // Sweeteners
  'simple syrup': 'Ss',
  'simple': 'Ss',
  'honey': 'Hn',
  'honey syrup': 'Hn',
  'agave': 'Ag',
  'agave syrup': 'Ag',
  'agave nectar': 'Ag',
  'grenadine': 'Gr',
  'orgeat': 'Og',
  'demerara syrup': 'Ds',
  'demerara': 'Ds',
  'maple syrup': 'Mp',
  'maple': 'Mp',
  'cinnamon syrup': 'Ci',
  'ginger syrup': 'Gs',
  'falernum': 'Fa',

  // Dairy & Eggs
  'cream': 'Cr',
  'heavy cream': 'Cr',
  'egg white': 'Ew',
  'egg': 'Eg',
  'whole egg': 'Eg',
  'egg yolk': 'Ey',
  'milk': 'Mk',
  'coconut cream': 'Cc',
  'coconut milk': 'Cm',

  // Carbonation
  'soda': 'Sw',
  'soda water': 'Sw',
  'club soda': 'Sw',
  'tonic': 'Tn',
  'tonic water': 'Tn',
  'ginger beer': 'Gb',
  'ginger ale': 'Ga',
  'champagne': 'Cq',
  'sparkling wine': 'Sp',
  'prosecco': 'Pr',
  'cola': 'Cl',

  // Other
  'water': 'H2O',
  'ice': 'Ic',
  'salt': 'Na',
  'sugar': 'Su',
  'mint': 'Mt',
  'basil': 'Ba',
  'rosemary': 'Ro',
  'thyme': 'Th',
  'lavender': 'Lv',
  'absinthe': 'Ab',
};

/**
 * Get the 2-letter element symbol for an ingredient
 * Falls back to first 2 letters if not in mapping
 *
 * @param ingredient - The ingredient name
 * @returns 2-letter symbol (e.g., "Ry" for Rye)
 */
export function getElementSymbol(ingredient: string): string {
  const normalized = ingredient.toLowerCase().trim();

  // Direct match
  if (ELEMENT_SYMBOLS[normalized]) {
    return ELEMENT_SYMBOLS[normalized];
  }

  // Partial match (e.g., "rye whiskey" should match "rye")
  for (const [key, symbol] of Object.entries(ELEMENT_SYMBOLS)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return symbol;
    }
  }

  // Fallback: capitalize first 2 letters
  const cleaned = normalized.replace(/[^a-z]/g, '');
  if (cleaned.length >= 2) {
    return cleaned.charAt(0).toUpperCase() + cleaned.charAt(1).toLowerCase();
  }
  return cleaned.toUpperCase() || '??';
}

/**
 * Format an ingredient as a chemical formula component
 * Example: formatFormulaComponent("Rye Whiskey", 2) => "Ry₂"
 *
 * @param ingredient - The ingredient name
 * @param quantity - The quantity (will become subscript)
 * @returns Formula component string with subscript
 */
export function formatFormulaComponent(
  ingredient: string,
  quantity: number = 1
): string {
  const symbol = getElementSymbol(ingredient);
  const subscript = quantity > 1 ? toSubscript(Math.round(quantity)) : '';
  return `${symbol}${subscript}`;
}

/**
 * Convert a number to subscript characters
 * Example: toSubscript(2) => "₂"
 */
export function toSubscript(num: number): string {
  const subscripts: Record<string, string> = {
    '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
    '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉'
  };
  return num.toString().split('').map(d => subscripts[d] || d).join('');
}

/**
 * Convert a number to superscript characters
 * Example: toSuperscript(2) => "²"
 */
export function toSuperscript(num: number): string {
  const superscripts: Record<string, string> = {
    '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
    '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹'
  };
  return num.toString().split('').map(d => superscripts[d] || d).join('');
}

/**
 * Format a complete recipe as a chemical formula
 * Example: formatFormula([
 *   { ingredient: "Rye Whiskey", amount: 2, unit: "oz" },
 *   { ingredient: "Sweet Vermouth", amount: 1, unit: "oz" },
 *   { ingredient: "Angostura Bitters", amount: 2, unit: "dash" }
 * ]) => "Ry₂ · Sv₁ · An₂"
 *
 * @param ingredients - Array of recipe ingredients
 * @returns Formatted chemical formula string
 */
export function formatFormula(
  ingredients: Array<{ ingredient: string; amount: number; unit: string }>
): string {
  // Filter out garnishes and ice for the formula
  const formulaIngredients = ingredients.filter(ing => {
    const name = ing.ingredient.toLowerCase();
    const isGarnish = ['garnish', 'cherry', 'olive', 'twist', 'peel', 'wheel', 'wedge', 'sprig', 'leaf'].some(g => name.includes(g));
    const isIce = name.includes('ice');
    return !isGarnish && !isIce;
  });

  if (formulaIngredients.length === 0) {
    return '';
  }

  // Convert each ingredient to formula component
  const components = formulaIngredients.map(ing => {
    // Normalize quantity: convert to oz equivalent for spirits, or use raw amount for dashes/etc
    const qty = normalizeQuantityForFormula(ing.amount, ing.unit);
    return formatFormulaComponent(ing.ingredient, qty);
  });

  // Join with interpunct separator
  return components.join(' · ');
}

/**
 * Normalize quantity to a simple integer for formula display
 * - oz/ml amounts: round to nearest integer
 * - dashes/drops: use raw count
 * - other: use 1
 */
function normalizeQuantityForFormula(amount: number, unit: string): number {
  const normalized = normalizeUnit(unit);

  if (['oz', 'ml', 'cl'].includes(normalized)) {
    return Math.max(1, Math.round(amount));
  }

  if (['dash', 'drop', 'tsp', 'tbsp'].includes(normalized)) {
    return Math.max(1, Math.round(amount));
  }

  // For anything else, use 1
  return 1;
}

/**
 * Format a number with leading zeros
 * Example: padNumber(3, 2) => "03"
 */
export function padNumber(value: number, digits: number = 2): string {
  return Math.round(value).toString().padStart(digits, '0');
}

/**
 * Format a decimal with fixed precision and leading zeros
 * Example: formatDecimal(1.5, 2, 2) => "01.50"
 */
export function formatDecimal(
  value: number,
  intDigits: number = 2,
  decDigits: number = 2
): string {
  const fixed = value.toFixed(decDigits);
  const [intPart, decPart] = fixed.split('.');
  return intPart.padStart(intDigits, '0') + '.' + decPart;
}
