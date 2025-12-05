/**
 * Ingredient Parser
 *
 * Converts raw ingredient strings into structured data
 * Examples:
 *   "2 oz fresh lime juice" → { amount: 2, unit: "oz", name: "lime juice", modifiers: ["fresh"] }
 *   "1 sugar cube" → { amount: 1, unit: null, name: "sugar cube", modifiers: [] }
 *   "Orange peel" → { amount: null, unit: null, name: "orange peel", modifiers: [] }
 */

import type { ParsedIngredient } from './types';

// ═══════════════════════════════════════════════════════════════
// UNIT PATTERNS
// ═══════════════════════════════════════════════════════════════

const UNITS = [
  'oz', 'ounce', 'ounces',
  'ml', 'milliliter', 'milliliters',
  'cl', 'centiliter', 'centiliters',
  'dash', 'dashes',
  'drop', 'drops',
  'barspoon', 'barspoons', 'bsp',
  'tsp', 'teaspoon', 'teaspoons',
  'tbsp', 'tablespoon', 'tablespoons',
  'cup', 'cups',
  'part', 'parts',
  'slice', 'slices',
  'piece', 'pieces',
  'sprig', 'sprigs',
  'leaf', 'leaves',
  'wheel', 'wheels',
  'wedge', 'wedges',
  'twist', 'twists',
  'cube', 'cubes',
  'whole',
];

// Modifiers that describe the ingredient but aren't part of the name
const MODIFIERS = [
  'fresh', 'freshly', 'squeezed',
  'chilled', 'cold', 'room temperature',
  'muddled', 'crushed', 'cracked',
  'large', 'small', 'medium',
  'thin', 'thick',
  'expressed', 'flamed',
  'dry', 'wet',
  'light', 'heavy',
  'aged', 'young',
  'organic', 'homemade',
  'topped', 'float', 'rinse',
];

// ═══════════════════════════════════════════════════════════════
// PARSER
// ═══════════════════════════════════════════════════════════════

/**
 * Main parsing function
 */
export function parseIngredient(raw: string): ParsedIngredient {
  const trimmed = raw.trim();

  if (!trimmed) {
    return {
      raw,
      name: '',
      amount: null,
      unit: null,
      modifiers: [],
    };
  }

  // Try to extract amount and unit from the beginning
  const { amount, unit, remainder } = extractAmountAndUnit(trimmed);

  // Extract modifiers from the remainder
  const { modifiers, name } = extractModifiers(remainder);

  return {
    raw,
    name: normalizeName(name),
    amount,
    unit: normalizeUnit(unit),
    modifiers,
  };
}

/**
 * Parse multiple ingredients
 */
export function parseIngredients(ingredients: string[] | string): ParsedIngredient[] {
  // Handle JSON string input
  const list = typeof ingredients === 'string'
    ? JSON.parse(ingredients) as string[]
    : ingredients;

  return list.map(parseIngredient);
}

// ═══════════════════════════════════════════════════════════════
// EXTRACTION HELPERS
// ═══════════════════════════════════════════════════════════════

interface AmountResult {
  amount: number | null;
  unit: string | null;
  remainder: string;
}

function extractAmountAndUnit(str: string): AmountResult {
  // Pattern: optional amount (decimal, fraction, or whole number) + optional unit
  // Examples: "2 oz", "1.5 oz", "1/2 oz", "2", "Orange peel"

  // Match fractions like "1/2", "3/4"
  const fractionPattern = /^(\d+)\/(\d+)\s*/;
  const fractionMatch = str.match(fractionPattern);

  if (fractionMatch) {
    const amount = parseInt(fractionMatch[1]) / parseInt(fractionMatch[2]);
    const afterFraction = str.slice(fractionMatch[0].length);
    const { unit, remainder } = extractUnit(afterFraction);
    return { amount, unit, remainder };
  }

  // Match mixed numbers like "1 1/2"
  const mixedPattern = /^(\d+)\s+(\d+)\/(\d+)\s*/;
  const mixedMatch = str.match(mixedPattern);

  if (mixedMatch) {
    const whole = parseInt(mixedMatch[1]);
    const fraction = parseInt(mixedMatch[2]) / parseInt(mixedMatch[3]);
    const amount = whole + fraction;
    const afterMixed = str.slice(mixedMatch[0].length);
    const { unit, remainder } = extractUnit(afterMixed);
    return { amount, unit, remainder };
  }

  // Match decimal or whole numbers
  const numberPattern = /^(\d+(?:\.\d+)?)\s*/;
  const numberMatch = str.match(numberPattern);

  if (numberMatch) {
    const amount = parseFloat(numberMatch[1]);
    const afterNumber = str.slice(numberMatch[0].length);
    const { unit, remainder } = extractUnit(afterNumber);
    return { amount, unit, remainder };
  }

  // No amount found
  return { amount: null, unit: null, remainder: str };
}

function extractUnit(str: string): { unit: string | null; remainder: string } {
  const lower = str.toLowerCase();

  for (const unit of UNITS) {
    // Match unit at start, followed by space or end of string
    const pattern = new RegExp(`^(${unit})(?:\\s+|$)`, 'i');
    const match = str.match(pattern);

    if (match) {
      return {
        unit: match[1],
        remainder: str.slice(match[0].length).trim(),
      };
    }
  }

  return { unit: null, remainder: str };
}

function extractModifiers(str: string): { modifiers: string[]; name: string } {
  const words = str.split(/\s+/);
  const modifiers: string[] = [];
  const nameWords: string[] = [];

  for (const word of words) {
    const lower = word.toLowerCase();
    if (MODIFIERS.includes(lower)) {
      modifiers.push(lower);
    } else {
      nameWords.push(word);
    }
  }

  return {
    modifiers,
    name: nameWords.join(' '),
  };
}

// ═══════════════════════════════════════════════════════════════
// NORMALIZATION
// ═══════════════════════════════════════════════════════════════

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[·•·]/g, '') // Remove bullet characters
    .replace(/\s+/g, ' ')  // Normalize whitespace
    .trim();
}

function normalizeUnit(unit: string | null): string | null {
  if (!unit) return null;

  const lower = unit.toLowerCase();

  // Normalize to standard units
  const unitMap: Record<string, string> = {
    'ounce': 'oz',
    'ounces': 'oz',
    'milliliter': 'ml',
    'milliliters': 'ml',
    'centiliter': 'cl',
    'centiliters': 'cl',
    'teaspoon': 'tsp',
    'teaspoons': 'tsp',
    'tablespoon': 'tbsp',
    'tablespoons': 'tbsp',
    'barspoons': 'barspoon',
    'bsp': 'barspoon',
    'dashes': 'dash',
    'drops': 'drop',
    'cubes': 'cube',
    'slices': 'slice',
    'pieces': 'piece',
    'sprigs': 'sprig',
    'leaves': 'leaf',
    'wheels': 'wheel',
    'wedges': 'wedge',
    'twists': 'twist',
    'cups': 'cup',
    'parts': 'part',
  };

  return unitMap[lower] || lower;
}

// ═══════════════════════════════════════════════════════════════
// AMOUNT CONVERSION (for proportional sizing)
// ═══════════════════════════════════════════════════════════════

/**
 * Convert any amount/unit to ounces for consistent sizing
 */
export function toOunces(amount: number | null, unit: string | null): number {
  if (amount === null) return 0.5; // Default for garnishes/unknowns

  if (!unit) return amount * 0.5; // Assume small units (cubes, etc.)

  const conversions: Record<string, number> = {
    'oz': 1,
    'ml': 0.033814,
    'cl': 0.33814,
    'dash': 0.03125,     // ~1/32 oz
    'drop': 0.0016907,   // ~1/600 oz
    'barspoon': 0.125,   // ~1/8 oz
    'tsp': 0.166667,     // ~1/6 oz
    'tbsp': 0.5,
    'cup': 8,
    'part': 1,           // Treat as 1 oz for relative sizing
    'cube': 0.25,
    'slice': 0.25,
    'piece': 0.25,
    'sprig': 0.125,
    'leaf': 0.0625,
    'wheel': 0.25,
    'wedge': 0.25,
    'twist': 0.125,
    'whole': 1,
  };

  const factor = conversions[unit] || 0.5;
  return amount * factor;
}
