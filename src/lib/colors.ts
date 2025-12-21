/**
 * Shared color constants for the application
 * Consolidates duplicate color definitions from various components
 */

import type { PeriodicGroup, PeriodicPeriod } from '@/types';

/**
 * Category colors for inventory items
 */
export const CATEGORY_COLORS: Record<string, string> = {
  spirit: '#D97706',
  liqueur: '#8B5CF6',
  mixer: '#0EA5E9',
  syrup: '#6366F1',
  garnish: '#10B981',
  wine: '#BE185D',
  beer: '#CA8A04',
  other: '#94A3B8',
};

/**
 * Spirit colors for recipes (based on base spirit)
 */
export const SPIRIT_COLORS: Record<string, string> = {
  rum: '#65A30D',
  tequila: '#0D9488',
  mezcal: '#0D9488',
  whiskey: '#D97706',
  bourbon: '#D97706',
  rye: '#D97706',
  scotch: '#D97706',
  gin: '#0EA5E9',
  vodka: '#94A3B8',
  brandy: '#8B5CF6',
  cognac: '#8B5CF6',
  liqueur: '#EC4899',
  vermouth: '#10B981',
  amaro: '#10B981',
  default: '#64748B',
};

/**
 * Spirit detection keywords for recipe classification
 */
export const SPIRIT_KEYWORDS: Record<string, string[]> = {
  gin: ['gin', 'london dry', 'plymouth', 'navy strength'],
  whiskey: ['whiskey', 'whisky', 'bourbon', 'rye', 'scotch'],
  tequila: ['tequila', 'mezcal', 'blanco', 'reposado', 'anejo'],
  rum: ['rum', 'rhum', 'cachaca', 'agricole'],
  vodka: ['vodka'],
  brandy: ['brandy', 'cognac', 'armagnac', 'pisco', 'calvados'],
};

/**
 * Periodic group colors - Light mode
 */
export const GROUP_COLORS: Record<PeriodicGroup, string> = {
  Base: '#1E293B',
  Bridge: '#7C3AED',
  Modifier: '#EC4899',
  Sweetener: '#6366F1',
  Reagent: '#F59E0B',
  Catalyst: '#EF4444',
};

/**
 * Periodic group colors - Dark mode
 */
export const GROUP_COLORS_DARK: Record<PeriodicGroup, string> = {
  Base: '#94A3B8',
  Bridge: '#A78BFA',
  Modifier: '#F472B6',
  Sweetener: '#818CF8',
  Reagent: '#FBBF24',
  Catalyst: '#F87171',
};

/**
 * Periodic period colors - Light mode
 */
export const PERIOD_COLORS: Record<PeriodicPeriod, string> = {
  Agave: '#0D9488',
  Cane: '#65A30D',
  Grain: '#D97706',
  Grape: '#8B5CF6',
  Fruit: '#F43F5E',
  Botanic: '#0EA5E9',
};

/**
 * Periodic period colors - Dark mode
 */
export const PERIOD_COLORS_DARK: Record<PeriodicPeriod, string> = {
  Agave: '#14B8A6',
  Cane: '#84CC16',
  Grain: '#FBBF24',
  Grape: '#A78BFA',
  Fruit: '#FB7185',
  Botanic: '#38BDF8',
};

/**
 * Get spirit color from a recipe based on ingredients
 */
export function getSpiritColorFromIngredients(ingredients: string[]): string {
  for (const ing of ingredients) {
    const ingLower = (typeof ing === 'string' ? ing : '').toLowerCase();
    for (const [spirit, color] of Object.entries(SPIRIT_COLORS)) {
      if (spirit !== 'default' && ingLower.includes(spirit)) {
        return color;
      }
    }
  }
  return SPIRIT_COLORS.default;
}

/**
 * Detect spirit types from ingredients using word boundary matching
 */
export function detectSpiritTypes(ingredients: string[]): string[] {
  const foundSpirits = new Set<string>();

  for (const ingredient of ingredients) {
    const lower = ingredient.toLowerCase();
    for (const [spirit, keywords] of Object.entries(SPIRIT_KEYWORDS)) {
      if (keywords.some(k => {
        const regex = new RegExp(`\\b${k}\\b`, 'i');
        return regex.test(lower);
      })) {
        foundSpirits.add(spirit);
      }
    }
  }

  return Array.from(foundSpirits);
}
