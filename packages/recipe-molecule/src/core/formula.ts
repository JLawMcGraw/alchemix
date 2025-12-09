/**
 * Chemical Formula Generator
 *
 * Generates compact chemical-style formulas for cocktail recipes
 * e.g., "Tq₂ · Ol₁ · Ac₁" for a Margarita
 *
 * Rules:
 * - Specific elements (spirits, liqueurs, signature ingredients) keep their symbol
 * - Generic elements (basic citrus, syrups, bitters) are grouped
 * - Subscripts show volume in oz
 * - Trace amounts (dashes, bitters) show no subscript
 */

import { parseIngredient, toOunces } from './parser';

// Element symbols from the Periodic Table of Mixology
// These must match the symbols in src/lib/periodicTable.ts

interface ElementMapping {
  symbol: string;
  keywords: string[];
}

// Specific elements - keep their individual symbol
const SPECIFIC_ELEMENTS: ElementMapping[] = [
  // Base Spirits
  { symbol: 'Rm', keywords: ['rum', 'white rum', 'dark rum', 'spiced rum', 'aged rum', 'overproof', 'jamaican rum', 'puerto rican rum'] },
  { symbol: 'Ra', keywords: ['rhum agricole', 'agricole', 'martinique'] },
  { symbol: 'Cc', keywords: ['cachaca', 'cachaça'] },
  { symbol: 'Vd', keywords: ['vodka'] },
  { symbol: 'Gn', keywords: ['gin', 'london dry', 'old tom', 'navy strength'] },
  { symbol: 'Wh', keywords: ['whiskey', 'whisky', 'irish whiskey'] },
  { symbol: 'Bb', keywords: ['bourbon'] },
  { symbol: 'Ry', keywords: ['rye', 'rye whiskey'] },
  { symbol: 'Sc', keywords: ['scotch', 'single malt', 'blended scotch', 'islay'] },
  { symbol: 'Tq', keywords: ['tequila', 'blanco', 'reposado', 'añejo', 'anejo'] },
  { symbol: 'Mz', keywords: ['mezcal', 'mescal'] },
  { symbol: 'Br', keywords: ['brandy', 'apple brandy', 'pear brandy'] },
  { symbol: 'Cg', keywords: ['cognac', 'vs', 'vsop', 'xo'] },
  { symbol: 'Ps', keywords: ['pisco'] },

  // Liqueurs (all specific)
  { symbol: 'Ol', keywords: ['orange liqueur', 'triple sec', 'cointreau', 'grand marnier', 'curacao', 'curaçao'] },
  { symbol: 'Cf', keywords: ['coffee liqueur', 'kahlua', 'kahlúa', 'mr black', 'espresso liqueur'] },
  { symbol: 'Am', keywords: ['amaretto', 'almond liqueur'] },
  { symbol: 'Bn', keywords: ['banana liqueur', 'creme de banane'] },
  { symbol: 'Ms', keywords: ['maraschino', 'luxardo'] },
  { symbol: 'El', keywords: ['elderflower', 'st germain', 'st. germain'] },
  { symbol: 'Cs', keywords: ['cassis', 'creme de cassis', 'crème de cassis', 'blackcurrant'] },
  { symbol: 'Co', keywords: ['cacao', 'creme de cacao', 'crème de cacao', 'chocolate liqueur'] },
  { symbol: 'Cv', keywords: ['violette', 'creme de violette', 'crème de violette', 'violet liqueur'] },
  { symbol: 'Mn', keywords: ['menthe', 'creme de menthe', 'crème de menthe', 'mint liqueur'] },

  // Signature sweeteners (keep specific)
  { symbol: 'Og', keywords: ['orgeat', 'almond syrup'] },
  { symbol: 'Gr', keywords: ['grenadine', 'pomegranate syrup'] },

  // Botanicals & Amari (all specific)
  { symbol: 'Cp', keywords: ['campari'] },
  { symbol: 'Ap', keywords: ['aperol'] },
  { symbol: 'Sv', keywords: ['sweet vermouth', 'vermouth rosso', 'carpano', 'antica formula'] },
  { symbol: 'Dv', keywords: ['dry vermouth', 'vermouth dry', 'dolin dry', 'noilly prat'] },
  { symbol: 'Fe', keywords: ['fernet', 'fernet branca', 'fernet-branca'] },
  { symbol: 'Ab', keywords: ['absinthe', 'pastis', 'pernod'] },
];

// Generic groupings - combine into single symbol
const GENERIC_GROUPS: Record<string, ElementMapping[]> = {
  // Acids - all citrus combines to Ac
  'Ac': [
    { symbol: 'Li', keywords: ['lime'] },
    { symbol: 'Le', keywords: ['lemon'] },
    { symbol: 'Or', keywords: ['oj', 'orange juice'] }, // "orange" alone is too generic
    { symbol: 'Gf', keywords: ['grapefruit'] },
    { symbol: 'Pi', keywords: ['pineapple'] },
    { symbol: 'Pf', keywords: ['passion fruit', 'passionfruit', 'passion'] },
  ],

  // Sweets - basic syrups combine to Sw
  'Sw': [
    { symbol: 'Ss', keywords: ['simple syrup', 'sugar syrup', '1:1 syrup', '2:1 syrup', 'rich syrup'] },
    { symbol: 'Hn', keywords: ['honey', 'honey syrup'] },
    { symbol: 'Av', keywords: ['agave', 'agave nectar', 'agave syrup'] },
    { symbol: 'Dm', keywords: ['demerara', 'demerara syrup', 'brown sugar syrup'] },
    { symbol: 'Ma', keywords: ['maple', 'maple syrup'] },
    { symbol: 'Cn', keywords: ['cinnamon syrup', 'cinnamon'] },
    { symbol: 'sugar', keywords: ['sugar', 'sugar cube', 'white sugar'] },
  ],

  // Bitters - combine to Bt (trace amounts)
  'Bt': [
    { symbol: 'An', keywords: ['angostura', 'angostura bitters', 'aromatic bitters'] },
    { symbol: 'Ob', keywords: ['orange bitters', 'regans orange'] },
    { symbol: 'Py', keywords: ['peychauds', "peychaud's", 'peychaud'] },
  ],

  // Dairy - combine to Dy
  'Dy': [
    { symbol: 'Cr', keywords: ['cream', 'heavy cream', 'whipping cream', 'half and half'] },
    { symbol: 'Ew', keywords: ['egg white', 'aquafaba'] },
    { symbol: 'Ey', keywords: ['egg yolk', 'yolk'] },
    { symbol: 'Ml', keywords: ['milk', 'whole milk', 'coconut milk', 'oat milk'] },
  ],
};

// Elements to omit from formula (carbonation/mixers)
const OMIT_KEYWORDS = [
  'soda', 'soda water', 'club soda', 'sparkling water', 'seltzer',
  'tonic', 'tonic water', 'indian tonic',
  'ginger beer', 'ginger ale',
  'cola', 'coke', 'coca-cola',
  'water', 'ice',
];

// Subscript number mapping
const SUBSCRIPT_MAP: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
  '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
  '.': '.', // Keep decimal as-is for now, or use subscript dot
};

/**
 * Convert a number to subscript string
 */
function toSubscript(num: number): string {
  if (num === 0) return '';

  // Round to nearest 0.25 for cleaner display
  const rounded = Math.round(num * 4) / 4;

  // Format: remove trailing zeros, max 2 decimal places
  const str = rounded.toFixed(2).replace(/\.?0+$/, '');

  return str.split('').map(char => SUBSCRIPT_MAP[char] || char).join('');
}

/**
 * Check if ingredient matches any keywords
 */
function matchesKeywords(ingredientText: string, keywords: string[]): boolean {
  const lower = ingredientText.toLowerCase();
  return keywords.some(kw => lower.includes(kw));
}

/**
 * Check if ingredient should be omitted
 * Uses word boundary matching to avoid false positives (e.g., "ice" in "juice")
 */
function shouldOmit(ingredientText: string): boolean {
  const lower = ingredientText.toLowerCase();
  return OMIT_KEYWORDS.some(kw => {
    // Use word boundary regex to match whole words only
    const regex = new RegExp(`\\b${kw}\\b`, 'i');
    return regex.test(lower);
  });
}

interface FormulaElement {
  symbol: string;
  volume: number;
  isTrace: boolean;
}

/**
 * Generate a chemical formula from recipe ingredients
 *
 * @param ingredients Array of ingredient strings (e.g., ["2 oz Tequila", "1 oz Lime juice"])
 * @returns Formatted formula string (e.g., "Tq₂ · Ol₁ · Ac₁")
 */
export function generateFormula(ingredients: string[]): string {
  const elements = new Map<string, FormulaElement>();

  for (const ingredient of ingredients) {
    // Skip omitted ingredients (soda, tonic, etc.)
    if (shouldOmit(ingredient)) continue;

    const parsed = parseIngredient(ingredient);
    // Match against both parsed name and raw ingredient string
    const ingredientText = `${parsed.name} ${ingredient}`.toLowerCase();
    const volume = parsed.amount ? toOunces(parsed.amount, parsed.unit) : 0;
    const isTrace = parsed.unit === 'dash' || parsed.unit === 'dashes' ||
                    parsed.unit === 'drop' || parsed.unit === 'drops' ||
                    parsed.unit === 'barspoon' || parsed.unit === 'rinse' ||
                    volume < 0.125;

    // Check specific elements first
    let matched = false;
    for (const elem of SPECIFIC_ELEMENTS) {
      if (matchesKeywords(ingredientText, elem.keywords)) {
        const existing = elements.get(elem.symbol);
        if (existing) {
          existing.volume += volume;
          existing.isTrace = existing.isTrace && isTrace;
        } else {
          elements.set(elem.symbol, { symbol: elem.symbol, volume, isTrace });
        }
        matched = true;
        break;
      }
    }

    if (matched) continue;

    // Check generic groups
    for (const [groupSymbol, groupElements] of Object.entries(GENERIC_GROUPS)) {
      for (const elem of groupElements) {
        if (matchesKeywords(ingredientText, elem.keywords)) {
          const existing = elements.get(groupSymbol);
          if (existing) {
            existing.volume += volume;
            existing.isTrace = existing.isTrace && isTrace;
          } else {
            elements.set(groupSymbol, { symbol: groupSymbol, volume, isTrace });
          }
          matched = true;
          break;
        }
      }
      if (matched) break;
    }

    // If no match found, skip (could add fallback generic symbol if needed)
  }

  // Sort by volume (descending), then alphabetically
  const sorted = Array.from(elements.values())
    .sort((a, b) => {
      if (b.volume !== a.volume) return b.volume - a.volume;
      return a.symbol.localeCompare(b.symbol);
    });

  // Format each element
  const parts = sorted.map(elem => {
    if (elem.isTrace || elem.volume < 0.125) {
      return elem.symbol; // No subscript for trace amounts
    }
    return `${elem.symbol}${toSubscript(elem.volume)}`;
  });

  return parts.join(' · ');
}

/**
 * Generate formula with optional max elements limit
 * Shows "+N" if more elements exist beyond the limit
 */
export function generateCompactFormula(
  ingredients: string[],
  maxElements: number = 5
): string {
  const fullFormula = generateFormula(ingredients);
  const parts = fullFormula.split(' · ');

  if (parts.length <= maxElements) {
    return fullFormula;
  }

  const shown = parts.slice(0, maxElements);
  const remaining = parts.length - maxElements;

  return `${shown.join(' · ')} +${remaining}`;
}

// Export types
export type { FormulaElement };
