/**
 * Recipe Utility Functions and Constants
 *
 * Helper functions and configuration for the recipes page.
 * Extracted from page.tsx for better organization.
 */

import type { SpiritCategory } from '@/lib/spirits';

/**
 * Spirit keywords for ingredient detection
 */
export const SPIRIT_KEYWORDS: Record<string, string[]> = {
  'Gin': ['gin', 'london dry', 'plymouth', 'navy strength', 'sloe gin'],
  'Whiskey': ['whiskey', 'whisky', 'bourbon', 'rye', 'scotch', 'irish whiskey', 'japanese whisky'],
  'Tequila': ['tequila', 'mezcal', 'blanco', 'reposado', 'anejo'],
  'Rum': ['rum', 'rhum', 'white rum', 'dark rum', 'spiced rum', 'cachaca', 'agricole'],
  'Vodka': ['vodka'],
  'Brandy': ['brandy', 'cognac', 'armagnac', 'pisco', 'calvados', 'grappa'],
  'Liqueur': [
    'liqueur', 'amaretto', 'cointreau', 'triple sec', 'curacao', 'chartreuse',
    'benedictine', 'campari', 'aperol', 'kahlua', 'baileys', 'frangelico',
    'maraschino', 'absinthe', 'st germain', 'grand marnier', 'drambuie',
    'midori', 'galliano', 'sambuca', 'limoncello'
  ],
};

/**
 * Mastery filter configuration
 */
export const MASTERY_FILTERS = [
  { key: 'craftable', label: 'Craftable', color: '#10B981', filter: 'craftable' },
  { key: 'near-miss', label: 'Near Miss', color: '#0EA5E9', filter: 'almost' },
  { key: '2-3-away', label: '2-3 Away', color: '#F59E0B', filter: 'need-few' },
  { key: 'major-gaps', label: 'Major Gaps', color: '#94A3B8', filter: 'major-gaps' },
] as const;

export type MasteryFilterKey = typeof MASTERY_FILTERS[number]['filter'];

/**
 * Check if keyword matches at word boundary (prevents "gin" matching "ginger")
 */
export const isWordMatch = (text: string, keyword: string): boolean => {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`\\b${escaped}\\b`, 'i');
  return regex.test(text);
};

/**
 * Get spirit types from ingredients (used for filter dropdown)
 */
export const getIngredientSpirits = (ingredients: string[]): string[] => {
  const foundSpirits = new Set<string>();
  for (const ingredient of ingredients) {
    for (const [spirit, keywords] of Object.entries(SPIRIT_KEYWORDS)) {
      if (keywords.some(keyword => isWordMatch(ingredient, keyword))) {
        foundSpirits.add(spirit);
        break;
      }
    }
  }
  return Array.from(foundSpirits);
};

/**
 * Parse ingredients from various formats
 */
export const parseIngredients = (ingredients: string | string[] | undefined): string[] => {
  if (!ingredients) return [];
  if (Array.isArray(ingredients)) return ingredients;
  try {
    const parsed = JSON.parse(ingredients);
    return Array.isArray(parsed) ? parsed : [ingredients];
  } catch {
    return ingredients.split(',').map(i => i.trim());
  }
};

/**
 * Get available spirit types from recipes
 */
export const getAvailableSpiritTypes = (recipes: Array<{ ingredients?: string | string[] }>): Array<SpiritCategory | 'all'> => {
  const allSpirits = new Set<SpiritCategory>();
  recipes.forEach((recipe) => {
    const ingredients = parseIngredients(recipe.ingredients);
    const spirits = getIngredientSpirits(ingredients);
    spirits.forEach(s => allSpirits.add(s as SpiritCategory));
  });
  return ['all', ...Array.from(allSpirits)];
};

/**
 * Get mastery count from stats
 */
export const getMasteryCount = (
  key: string,
  stats: { craftable?: number; nearMisses?: number; missing2to3?: number; missing4plus?: number } | null
): number => {
  if (!stats) return 0;
  switch (key) {
    case 'craftable': return stats.craftable || 0;
    case 'near-miss': return stats.nearMisses || 0;
    case '2-3-away': return stats.missing2to3 || 0;
    case 'major-gaps': return stats.missing4plus || 0;
    default: return 0;
  }
};

/**
 * Pagination page size for collection view
 */
export const COLLECTION_PAGE_SIZE = 24;
