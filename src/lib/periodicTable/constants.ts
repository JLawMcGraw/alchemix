/**
 * Periodic Table of Mixology - Constants
 *
 * Group and Period definitions for the 6×6 classification grid.
 */

import type { PeriodicGroup, PeriodicPeriod } from '@/types';
import type { MixologyGroup, MixologyPeriod, GroupInfo, PeriodInfo } from './types';

/**
 * Groups (Columns) - Functional Role
 *
 * Classification order (first match wins):
 * 1. Dashes/drops for aroma? → VI. Catalyst
 * 2. Primarily acidic (pH < 4)? → V. Reagent
 * 3. 0% ABV, primarily sugar? → IV. Sweetener
 * 4. Sweetened liqueur (15-40% ABV), ≤0.75oz? → III. Modifier
 * 5. Fortified/aromatized wine (15-22% ABV)? → II. Bridge
 * 6. High-proof (35%+ ABV), backbone? → I. Base
 */
export const GROUPS: Record<MixologyGroup, GroupInfo> = {
  1: { numeral: 'I', name: 'Base', desc: 'Structure / Vol', color: '#1E293B' },
  2: { numeral: 'II', name: 'Bridge', desc: 'Extension / Depth', color: '#7C3AED' },
  3: { numeral: 'III', name: 'Modifier', desc: 'Liqueur / Flavor', color: '#EC4899' },
  4: { numeral: 'IV', name: 'Sweetener', desc: 'Syrups / Brix', color: '#6366F1' },
  5: { numeral: 'V', name: 'Reagent', desc: 'Acids / Juices', color: '#F59E0B' },
  6: { numeral: 'VI', name: 'Catalyst', desc: 'Bitters / Extract', color: '#EF4444' },
};

/**
 * Periods (Rows) - Source Origin
 *
 * Override rule: If base is neutral BUT a botanical/herb DEFINES
 * the product's character, use Period 6 (Botanic).
 */
export const PERIODS: Record<MixologyPeriod, PeriodInfo> = {
  1: { name: 'Agave', profile: 'Smoke, Earth', color: '#0D9488' },
  2: { name: 'Cane', profile: 'Grass, Funk', color: '#65A30D' },
  3: { name: 'Grain', profile: 'Cereal, Bread', color: '#D97706' },
  4: { name: 'Grape', profile: 'Tannin, Wine', color: '#8B5CF6' },
  5: { name: 'Fruit', profile: 'Esters, Tropics', color: '#F43F5E' },
  6: { name: 'Botanic', profile: 'Herb, Root, Spice', color: '#0EA5E9' },
};

/** All group numbers for iteration */
export const GROUP_NUMBERS: MixologyGroup[] = [1, 2, 3, 4, 5, 6];

/** All period numbers for iteration */
export const PERIOD_NUMBERS: MixologyPeriod[] = [1, 2, 3, 4, 5, 6];

/**
 * Valid periodic groups for dropdown options
 */
export const PERIODIC_GROUPS: { value: PeriodicGroup; label: string; desc: string }[] = [
  { value: 'Base', label: 'Base', desc: 'Structure / Vol' },
  { value: 'Bridge', label: 'Bridge', desc: 'Extension / Depth' },
  { value: 'Modifier', label: 'Modifier', desc: 'Liqueur / Flavor' },
  { value: 'Sweetener', label: 'Sweetener', desc: 'Syrups / Brix' },
  { value: 'Reagent', label: 'Reagent', desc: 'Acids / Juices' },
  { value: 'Catalyst', label: 'Catalyst', desc: 'Bitters / Extract' },
];

/**
 * Valid periodic periods for dropdown options
 */
export const PERIODIC_PERIODS: { value: PeriodicPeriod; label: string; desc: string }[] = [
  { value: 'Agave', label: 'Agave', desc: 'Smoke, Earth' },
  { value: 'Cane', label: 'Cane', desc: 'Grass, Funk' },
  { value: 'Grain', label: 'Grain', desc: 'Cereal, Bread' },
  { value: 'Grape', label: 'Grape', desc: 'Tannin, Wine' },
  { value: 'Fruit', label: 'Fruit', desc: 'Esters, Tropics' },
  { value: 'Botanic', label: 'Botanic', desc: 'Herb, Spice' },
];

/**
 * Color mapping for periodic groups (for tag display)
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
 * Color mapping for periodic periods (for tag display)
 */
export const PERIOD_COLORS: Record<PeriodicPeriod, string> = {
  Agave: '#0D9488',
  Cane: '#65A30D',
  Grain: '#D97706',
  Grape: '#8B5CF6',
  Fruit: '#F43F5E',
  Botanic: '#0EA5E9',
};
