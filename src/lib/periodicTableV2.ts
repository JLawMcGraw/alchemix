/**
 * Periodic Table of Mixology V2
 *
 * A 6×6 classification system for cocktail ingredients:
 * - Groups (Columns) = Functional role (what it DOES)
 * - Periods (Rows) = Source origin (where it COMES FROM)
 *
 * @version 2.0.0
 * @date December 2025
 */

import type { InventoryItem } from '@/types';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/** Group = Column (Function/Role) */
export type MixologyGroup = 1 | 2 | 3 | 4 | 5 | 6;

/** Period = Row (Origin/Source) */
export type MixologyPeriod = 1 | 2 | 3 | 4 | 5 | 6;

/** Classification confidence level */
export type ClassificationConfidence = 'high' | 'medium' | 'low' | 'manual';

/** Classification result */
export interface Classification {
  group: MixologyGroup;
  period: MixologyPeriod;
  confidence: ClassificationConfidence;
  reasoning?: string;
}

/** Cell position on the grid */
export interface CellPosition {
  group: MixologyGroup;
  period: MixologyPeriod;
}

/** Group metadata */
export interface GroupInfo {
  numeral: string;
  name: string;
  desc: string;
  color: string;
}

/** Period metadata */
export interface PeriodInfo {
  name: string;
  profile: string;
  color: string;
}

/** Inventory item with its classification */
export interface ClassifiedItem {
  item: InventoryItem;
  classification: Classification;
}

/** Cell data for rendering */
export interface CellData {
  group: MixologyGroup;
  period: MixologyPeriod;
  items: ClassifiedItem[];
  hasInventory: boolean;
  count: number;
}

/** Predefined element type for the periodic table */
export interface ElementType {
  symbol: string;       // 2-letter symbol like "Rm", "Gn", "Wh" or "--" for empty
  name: string;         // Display name like "Rum", "Gin", "Whiskey"
  group: MixologyGroup;
  period: MixologyPeriod;
  abv?: string;         // ABV range like "40%", "40-50%"
  brix?: string;        // Brix for sweeteners (displays as "° Bx")
  ph?: string;          // pH for reagents
  usage?: string;       // Usage pattern like "Dashes", "Drops"
  primary?: boolean;    // Primary element in this cell (displayed first)
  empty?: boolean;      // True for Rare/Neutral placeholder cells
  keywords: string[];   // Keywords for matching inventory items
}

/** Element cell with matched inventory items */
export interface ElementCellData {
  element: ElementType;
  matchedItems: InventoryItem[];
  count: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════════
// PREDEFINED ELEMENTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Predefined elements for the Periodic Table of Mixology
 * Each element represents a TYPE of ingredient (not individual bottles)
 * User's inventory items are matched against these types
 *
 * Note: Cells with empty: true are "Rare" or "Neutral" placeholders
 */
export const ELEMENTS: ElementType[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // PERIOD 1: AGAVE
  // ═══════════════════════════════════════════════════════════════════════════

  // Group 1: Base - Agave
  { symbol: 'Tq', name: 'Tequila Blanco', group: 1, period: 1, abv: '40%', primary: true, keywords: ['tequila', 'tequila blanco', 'blanco', 'silver tequila'] },
  { symbol: 'Mz', name: 'Mezcal', group: 1, period: 1, abv: '40-55%', keywords: ['mezcal', 'mescal'] },
  { symbol: 'Ra', name: 'Raicilla', group: 1, period: 1, abv: '38-45%', keywords: ['raicilla'] },

  // Group 2: Bridge - Agave (Rare)
  { symbol: '--', name: 'Rare', group: 2, period: 1, empty: true, primary: true, keywords: [] },

  // Group 3: Modifier - Agave
  { symbol: 'Av', name: 'Agavero', group: 3, period: 1, abv: '32%', primary: true, keywords: ['agavero'] },
  { symbol: 'Da', name: 'Damiana Liqueur', group: 3, period: 1, abv: '30%', keywords: ['damiana', 'damiana liqueur'] },

  // Group 4: Sweetener - Agave
  { symbol: 'Ag', name: 'Agave Nectar', group: 4, period: 1, brix: '75', primary: true, keywords: ['agave', 'agave nectar', 'agave syrup'] },
  { symbol: 'Sp', name: 'Spiced Agave', group: 4, period: 1, brix: '70', keywords: ['spiced agave'] },

  // Group 5: Reagent - Agave
  { symbol: 'Lm', name: 'Lime Juice', group: 5, period: 1, ph: '2.2', primary: true, keywords: ['lime', 'lime juice', 'fresh lime'] },

  // Group 6: Catalyst - Agave
  { symbol: 'Mo', name: 'Mole Bitters', group: 6, period: 1, usage: 'Dashes', primary: true, keywords: ['mole bitters', 'xocolatl mole', 'chocolate mole'] },
  { symbol: 'Hb', name: 'Habanero Tincture', group: 6, period: 1, usage: 'Drops', keywords: ['habanero', 'habanero bitters', 'hellfire bitters', 'habanero tincture'] },

  // ═══════════════════════════════════════════════════════════════════════════
  // PERIOD 2: CANE
  // ═══════════════════════════════════════════════════════════════════════════

  // Group 1: Base - Cane
  { symbol: 'Rm', name: 'Rum', group: 1, period: 2, abv: '40-50%', primary: true, keywords: ['rum', 'white rum', 'light rum', 'silver rum', 'gold rum', 'aged rum', 'dark rum', 'black rum'] },
  { symbol: 'Ca', name: 'Cachaça', group: 1, period: 2, abv: '38-48%', keywords: ['cachaca', 'cachaça'] },
  { symbol: 'Rh', name: 'Rhum Agricole', group: 1, period: 2, abv: '40-50%', keywords: ['agricole', 'rhum agricole'] },

  // Group 2: Bridge - Cane (Rare)
  { symbol: '--', name: 'Rare', group: 2, period: 2, empty: true, primary: true, keywords: [] },

  // Group 3: Modifier - Cane
  { symbol: 'Fa', name: 'Falernum', group: 3, period: 2, abv: '11-18%', primary: true, keywords: ['falernum', 'velvet falernum'] },
  { symbol: 'Co', name: 'Coconut Rum', group: 3, period: 2, abv: '21%', keywords: ['coconut rum', 'malibu'] },
  { symbol: 'Pi', name: 'Pimento Dram', group: 3, period: 2, abv: '22%', keywords: ['pimento dram', 'allspice dram'] },

  // Group 4: Sweetener - Cane
  { symbol: 'De', name: 'Demerara Syrup', group: 4, period: 2, brix: '65', primary: true, keywords: ['demerara', 'demerara syrup', 'demerara sugar'] },
  { symbol: 'Pa', name: 'Panela', group: 4, period: 2, brix: '70', keywords: ['panela', 'piloncillo'] },
  { symbol: 'Ms', name: 'Molasses', group: 4, period: 2, brix: '75', keywords: ['molasses', 'blackstrap'] },
  { symbol: 'Sc', name: 'Cane Juice', group: 4, period: 2, brix: '20', keywords: ['cane juice', 'sugarcane juice'] },

  // Group 5: Reagent - Cane
  { symbol: 'Gf', name: 'Grapefruit', group: 5, period: 2, ph: '3.0', primary: true, keywords: ['grapefruit', 'grapefruit juice', 'ruby red'] },

  // Group 6: Catalyst - Cane
  { symbol: 'Ti', name: 'Tiki Bitters', group: 6, period: 2, usage: 'Dashes', primary: true, keywords: ['tiki bitters'] },
  { symbol: 'El', name: 'Elemakule', group: 6, period: 2, usage: 'Dashes', keywords: ['elemakule', 'elemakule tiki'] },

  // ═══════════════════════════════════════════════════════════════════════════
  // PERIOD 3: GRAIN
  // ═══════════════════════════════════════════════════════════════════════════

  // Group 1: Base - Grain
  { symbol: 'Wh', name: 'Whiskey', group: 1, period: 3, abv: '40-50%', primary: true, keywords: ['whiskey', 'whisky', 'bourbon', 'rye', 'rye whiskey', 'scotch', 'single malt', 'blended scotch', 'islay', 'irish whiskey', 'japanese whisky'] },
  { symbol: 'Vo', name: 'Vodka', group: 1, period: 3, abv: '40%', keywords: ['vodka'] },
  { symbol: 'Gv', name: 'Genever', group: 1, period: 3, abv: '35-42%', keywords: ['genever', 'jenever'] },
  { symbol: 'Sa', name: 'Sake', group: 1, period: 3, abv: '15-20%', keywords: ['sake', 'nihonshu'] },
  { symbol: 'Be', name: 'Beer/Stout', group: 1, period: 3, abv: '4-12%', keywords: ['beer', 'stout', 'ale', 'lager', 'ipa'] },
  { symbol: 'So', name: 'Soju', group: 1, period: 3, abv: '16-25%', keywords: ['soju'] },

  // Group 2: Bridge - Grain
  { symbol: 'Ir', name: 'Irish Cream', group: 2, period: 3, abv: '17%', primary: true, keywords: ['irish cream', 'baileys'] },
  { symbol: 'Dr', name: 'Drambuie', group: 2, period: 3, abv: '40%', keywords: ['drambuie'] },

  // Group 3: Modifier - Grain
  { symbol: 'Ky', name: 'Kahlúa', group: 3, period: 3, abv: '20%', primary: true, keywords: ['kahlua', 'kahlúa', 'coffee liqueur', 'mr black', 'tia maria'] },

  // Group 4: Sweetener - Grain
  { symbol: 'Si', name: 'Simple Syrup', group: 4, period: 3, brix: '50', primary: true, keywords: ['simple syrup', 'sugar syrup', '1:1', '2:1', 'rich simple'] },
  { symbol: 'Rs', name: 'Rice Syrup', group: 4, period: 3, brix: '55', keywords: ['rice syrup'] },
  { symbol: 'Or', name: 'Orgeat', group: 4, period: 3, brix: '60', keywords: ['orgeat', 'almond syrup'] },

  // Group 5: Reagent - Grain (Neutral - no acid from grain)
  { symbol: '--', name: 'Neutral', group: 5, period: 3, empty: true, primary: true, keywords: [] },

  // Group 6: Catalyst - Grain
  { symbol: 'An', name: 'Angostura', group: 6, period: 3, usage: 'Dashes', primary: true, keywords: ['angostura', 'angostura bitters', 'aromatic bitters'] },
  { symbol: 'Wa', name: 'Walnut Bitters', group: 6, period: 3, usage: 'Dashes', keywords: ['walnut bitters', 'black walnut'] },
  { symbol: 'Cb', name: 'Chocolate Bitters', group: 6, period: 3, usage: 'Dashes', keywords: ['chocolate bitters', 'cacao bitters'] },

  // ═══════════════════════════════════════════════════════════════════════════
  // PERIOD 4: GRAPE
  // ═══════════════════════════════════════════════════════════════════════════

  // Group 1: Base - Grape
  { symbol: 'Br', name: 'Brandy/Cognac', group: 1, period: 4, abv: '40%', primary: true, keywords: ['brandy', 'cognac', 'vs', 'vsop', 'xo', 'armagnac'] },
  { symbol: 'Ps', name: 'Pisco', group: 1, period: 4, abv: '38-48%', keywords: ['pisco'] },
  { symbol: 'Gp', name: 'Grappa', group: 1, period: 4, abv: '35-60%', keywords: ['grappa'] },

  // Group 2: Bridge - Grape
  { symbol: 'Sv', name: 'Sweet Vermouth', group: 2, period: 4, abv: '16%', primary: true, keywords: ['sweet vermouth', 'vermouth', 'carpano', 'antica formula', 'punt e mes'] },
  { symbol: 'Dv', name: 'Dry Vermouth', group: 2, period: 4, abv: '18%', keywords: ['dry vermouth', 'dolin', 'noilly prat'] },
  { symbol: 'Sh', name: 'Sherry/Port', group: 2, period: 4, abv: '15-22%', keywords: ['sherry', 'fino', 'manzanilla', 'amontillado', 'oloroso', 'px', 'port', 'ruby port', 'tawny port'] },

  // Group 3: Modifier - Grape
  { symbol: 'Ch', name: 'Chambord', group: 3, period: 4, abv: '16.5%', primary: true, keywords: ['chambord'] },
  { symbol: 'GM', name: 'Grand Marnier', group: 3, period: 4, abv: '40%', keywords: ['grand marnier'] },
  { symbol: 'Ma', name: 'Maraschino', group: 3, period: 4, abv: '32%', keywords: ['maraschino', 'luxardo'] },

  // Group 4: Sweetener - Grape
  { symbol: 'Wi', name: 'Wine Syrup', group: 4, period: 4, brix: '55', primary: true, keywords: ['wine syrup'] },
  { symbol: 'Ho', name: 'Honey', group: 4, period: 4, brix: '80', keywords: ['honey', 'honey syrup'] },
  { symbol: 'Ba', name: 'Balsamic Glaze', group: 4, period: 4, brix: '60', keywords: ['balsamic', 'balsamic glaze', 'balsamic reduction'] },

  // Group 5: Reagent - Grape
  { symbol: 'Ln', name: 'Lemon Juice', group: 5, period: 4, ph: '2.3', primary: true, keywords: ['lemon', 'lemon juice', 'fresh lemon'] },
  { symbol: 'Ve', name: 'Verjus', group: 5, period: 4, ph: '2.8', keywords: ['verjus', 'verjuice'] },
  { symbol: 'Ta', name: 'Tartaric Acid', group: 5, period: 4, ph: '2.0', keywords: ['tartaric acid', 'citric acid'] },

  // Group 6: Catalyst - Grape
  { symbol: 'Py', name: "Peychaud's", group: 6, period: 4, usage: 'Dashes', primary: true, keywords: ['peychaud', "peychaud's", 'peychauds', 'creole bitters'] },
  { symbol: 'Gb', name: 'Grapefruit Bitters', group: 6, period: 4, usage: 'Dashes', keywords: ['grapefruit bitters'] },

  // ═══════════════════════════════════════════════════════════════════════════
  // PERIOD 5: FRUIT
  // ═══════════════════════════════════════════════════════════════════════════

  // Group 1: Base - Fruit
  { symbol: 'Ap', name: 'Applejack', group: 1, period: 5, abv: '40%', primary: true, keywords: ['applejack', 'apple brandy'] },
  { symbol: 'Cv', name: 'Calvados', group: 1, period: 5, abv: '40%', keywords: ['calvados'] },
  { symbol: 'Ev', name: 'Eau de Vie', group: 1, period: 5, abv: '40-45%', keywords: ['eau de vie', 'kirschwasser', 'kirsch', 'poire williams', 'pear brandy'] },
  { symbol: 'Ci', name: 'Hard Cider', group: 1, period: 5, abv: '4-8%', keywords: ['cider', 'hard cider'] },
  { symbol: 'Um', name: 'Umeshu', group: 1, period: 5, abv: '10-15%', keywords: ['umeshu', 'plum wine'] },
  { symbol: 'Po', name: 'Pommeau', group: 1, period: 5, abv: '16-18%', keywords: ['pommeau'] },

  // Group 2: Bridge - Fruit (Rare)
  { symbol: '--', name: 'Rare', group: 2, period: 5, empty: true, primary: true, keywords: [] },

  // Group 3: Modifier - Fruit
  { symbol: 'Bn', name: 'Banana Liqueur', group: 3, period: 5, abv: '20-25%', primary: true, keywords: ['banana liqueur', 'creme de banane'] },
  { symbol: 'Bk', name: 'Blackberry Liq.', group: 3, period: 5, abv: '16%', keywords: ['blackberry liqueur', 'creme de mure'] },
  { symbol: 'Cu', name: 'Curaçao/Triple Sec', group: 3, period: 5, abv: '15-40%', keywords: ['curacao', 'curaçao', 'blue curacao', 'triple sec', 'cointreau', 'orange liqueur', 'grand marnier'] },

  // Group 4: Sweetener - Fruit
  { symbol: 'Pf', name: 'Passion Fruit', group: 4, period: 5, brix: '60', primary: true, keywords: ['passion fruit syrup', 'passionfruit syrup'] },
  { symbol: 'Gd', name: 'Grenadine', group: 4, period: 5, brix: '55', keywords: ['grenadine', 'pomegranate syrup'] },
  { symbol: 'Rb', name: 'Raspberry Syrup', group: 4, period: 5, brix: '55', keywords: ['raspberry syrup'] },

  // Group 5: Reagent - Fruit
  { symbol: 'Oj', name: 'Orange Juice', group: 5, period: 5, ph: '3.5', primary: true, keywords: ['orange', 'orange juice', 'fresh orange', 'blood orange'] },
  { symbol: 'Pn', name: 'Pineapple Juice', group: 5, period: 5, ph: '3.4', keywords: ['pineapple', 'pineapple juice'] },
  { symbol: 'Yu', name: 'Yuzu', group: 5, period: 5, ph: '2.5', keywords: ['yuzu'] },

  // Group 6: Catalyst - Fruit
  { symbol: 'Ob', name: 'Orange Bitters', group: 6, period: 5, usage: 'Dashes', primary: true, keywords: ['orange bitters', "regan's orange", 'regans orange'] },
  { symbol: 'Rh', name: 'Rhubarb Bitters', group: 6, period: 5, usage: 'Dashes', keywords: ['rhubarb bitters'] },
  { symbol: 'Chy', name: 'Cherry Bitters', group: 6, period: 5, usage: 'Dashes', keywords: ['cherry bitters'] },

  // ═══════════════════════════════════════════════════════════════════════════
  // PERIOD 6: BOTANIC
  // ═══════════════════════════════════════════════════════════════════════════

  // Group 1: Base - Botanic
  { symbol: 'Gn', name: 'Gin', group: 1, period: 6, abv: '40-47%', primary: true, keywords: ['gin', 'london dry', 'london dry gin', 'old tom', 'old tom gin', 'navy strength', 'plymouth gin'] },
  { symbol: 'Ab', name: 'Absinthe', group: 1, period: 6, abv: '45-74%', keywords: ['absinthe'] },
  { symbol: 'Aq', name: 'Aquavit', group: 1, period: 6, abv: '40-45%', keywords: ['aquavit', 'akvavit'] },

  // Group 2: Bridge - Botanic
  { symbol: 'Am', name: 'Amaro', group: 2, period: 6, abv: '16-40%', primary: true, keywords: ['amaro', 'averna', 'montenegro', 'nonino', 'fernet', 'fernet branca', 'cynar'] },
  { symbol: 'Ar', name: 'Aperol', group: 2, period: 6, abv: '11%', keywords: ['aperol'] },
  { symbol: 'Li', name: 'Lillet', group: 2, period: 6, abv: '17%', keywords: ['lillet', 'lillet blanc', 'lillet rose', 'cocchi americano'] },

  // Group 3: Modifier - Botanic
  { symbol: 'St', name: 'St-Germain', group: 3, period: 6, abv: '20%', primary: true, keywords: ['st-germain', 'st germain', 'elderflower liqueur', 'elderflower'] },
  { symbol: 'Su', name: 'Suze', group: 3, period: 6, abv: '15%', keywords: ['suze', 'salers'] },
  { symbol: 'Ga', name: 'Galliano', group: 3, period: 6, abv: '42.3%', keywords: ['galliano'] },
  { symbol: 'Pd', name: 'Pernod', group: 3, period: 6, abv: '40%', keywords: ['pernod'] },
  { symbol: 'Ps', name: 'Pastis', group: 3, period: 6, abv: '40-45%', keywords: ['pastis', 'ricard'] },
  { symbol: 'Oz', name: 'Ouzo', group: 3, period: 6, abv: '37-50%', keywords: ['ouzo'] },
  { symbol: 'Sb', name: 'Sambuca', group: 3, period: 6, abv: '38-42%', keywords: ['sambuca'] },
  { symbol: 'Ch', name: 'Chartreuse', group: 3, period: 6, abv: '40-55%', keywords: ['chartreuse', 'green chartreuse', 'yellow chartreuse'] },
  { symbol: 'Bnd', name: 'Benedictine', group: 3, period: 6, abv: '40%', keywords: ['benedictine', 'b&b'] },

  // Group 4: Sweetener - Botanic
  { symbol: 'Cn', name: 'Cinnamon Syrup', group: 4, period: 6, brix: '55', primary: true, keywords: ['cinnamon syrup'] },
  { symbol: 'Gi', name: 'Ginger Syrup', group: 4, period: 6, brix: '55', keywords: ['ginger syrup'] },
  { symbol: 'Va', name: 'Vanilla Syrup', group: 4, period: 6, brix: '50', keywords: ['vanilla syrup'] },
  { symbol: 'Lv', name: 'Lavender Syrup', group: 4, period: 6, brix: '55', keywords: ['lavender syrup'] },

  // Group 5: Reagent - Botanic
  { symbol: 'Gj', name: 'Ginger Juice', group: 5, period: 6, ph: '5.5', primary: true, keywords: ['ginger', 'ginger juice', 'fresh ginger'] },
  { symbol: 'Cj', name: 'Cucumber Juice', group: 5, period: 6, ph: '5.8', keywords: ['cucumber', 'cucumber juice'] },

  // Group 6: Catalyst - Botanic
  { symbol: 'Ce', name: 'Celery Bitters', group: 6, period: 6, usage: 'Dashes', primary: true, keywords: ['celery bitters'] },
  { symbol: 'La', name: 'Lavender Bitters', group: 6, period: 6, usage: 'Dashes', keywords: ['lavender bitters'] },
  { symbol: 'Cd', name: 'Cardamom', group: 6, period: 6, usage: 'Dashes', keywords: ['cardamom bitters', 'cardamom'] },
];

// ═══════════════════════════════════════════════════════════════════════════
// CLASSIFICATION MAP
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Keyword → Classification lookup
 *
 * Rules:
 * - Liqueurs: Follow base SPIRIT, not flavoring
 * - Syrups: Follow SUGAR SOURCE
 * - Acids: Follow FRUIT SOURCE or traditional spirit pairing
 */
export const CLASSIFICATION_MAP: Record<string, CellPosition> = {
  // ═══════════════════════════════════════════════════════════════════════
  // GROUP 1: BASE SPIRITS (35%+ ABV, backbone of drink)
  // ═══════════════════════════════════════════════════════════════════════

  // Period 1: Agave
  'tequila': { group: 1, period: 1 },
  'tequila blanco': { group: 1, period: 1 },
  'tequila reposado': { group: 1, period: 1 },
  'tequila añejo': { group: 1, period: 1 },
  'tequila anejo': { group: 1, period: 1 },
  'mezcal': { group: 1, period: 1 },
  'raicilla': { group: 1, period: 1 },
  'sotol': { group: 1, period: 1 },
  'bacanora': { group: 1, period: 1 },

  // Period 2: Cane
  'rum': { group: 1, period: 2 },
  'white rum': { group: 1, period: 2 },
  'light rum': { group: 1, period: 2 },
  'gold rum': { group: 1, period: 2 },
  'dark rum': { group: 1, period: 2 },
  'aged rum': { group: 1, period: 2 },
  'black rum': { group: 1, period: 2 },
  'spiced rum': { group: 1, period: 2 },
  'overproof rum': { group: 1, period: 2 },
  'navy rum': { group: 1, period: 2 },
  'jamaican rum': { group: 1, period: 2 },
  'demerara rum': { group: 1, period: 2 },
  'rhum agricole': { group: 1, period: 2 },
  'agricole': { group: 1, period: 2 },
  'cachaça': { group: 1, period: 2 },
  'cachaca': { group: 1, period: 2 },
  'clairin': { group: 1, period: 2 },

  // Period 3: Grain
  'whiskey': { group: 1, period: 3 },
  'whisky': { group: 1, period: 3 },
  'bourbon': { group: 1, period: 3 },
  'rye': { group: 1, period: 3 },
  'rye whiskey': { group: 1, period: 3 },
  'scotch': { group: 1, period: 3 },
  'single malt': { group: 1, period: 3 },
  'blended scotch': { group: 1, period: 3 },
  'islay': { group: 1, period: 3 },
  'irish whiskey': { group: 1, period: 3 },
  'japanese whisky': { group: 1, period: 3 },
  'canadian whisky': { group: 1, period: 3 },
  'corn whiskey': { group: 1, period: 3 },
  'tennessee whiskey': { group: 1, period: 3 },
  'vodka': { group: 1, period: 3 },
  'genever': { group: 1, period: 3 },
  'jenever': { group: 1, period: 3 },
  'soju': { group: 1, period: 3 },
  'baijiu': { group: 1, period: 3 },
  'shochu': { group: 1, period: 3 },
  'sake': { group: 1, period: 3 },

  // Period 4: Grape
  'brandy': { group: 1, period: 4 },
  'cognac': { group: 1, period: 4 },
  'vs cognac': { group: 1, period: 4 },
  'vsop': { group: 1, period: 4 },
  'xo cognac': { group: 1, period: 4 },
  'armagnac': { group: 1, period: 4 },
  'pisco': { group: 1, period: 4 },
  'grappa': { group: 1, period: 4 },
  'marc': { group: 1, period: 4 },
  'singani': { group: 1, period: 4 },

  // Period 5: Fruit
  'applejack': { group: 1, period: 5 },
  'apple brandy': { group: 1, period: 5 },
  'calvados': { group: 1, period: 5 },
  'pear brandy': { group: 1, period: 5 },
  'poire williams': { group: 1, period: 5 },
  'eau de vie': { group: 1, period: 5 },
  'kirschwasser': { group: 1, period: 5 },
  'kirsch': { group: 1, period: 5 },
  'slivovitz': { group: 1, period: 5 },
  'plum brandy': { group: 1, period: 5 },
  'apricot brandy': { group: 1, period: 5 },

  // Period 6: Botanic (neutral base, botanical defines character)
  'gin': { group: 1, period: 6 },
  'london dry': { group: 1, period: 6 },
  'london dry gin': { group: 1, period: 6 },
  'old tom': { group: 1, period: 6 },
  'old tom gin': { group: 1, period: 6 },
  'navy strength': { group: 1, period: 6 },
  'navy strength gin': { group: 1, period: 6 },
  'plymouth gin': { group: 1, period: 6 },
  'sloe gin': { group: 1, period: 6 },
  'absinthe': { group: 1, period: 6 },
  'aquavit': { group: 1, period: 6 },
  'akvavit': { group: 1, period: 6 },

  // ═══════════════════════════════════════════════════════════════════════
  // GROUP 2: BRIDGE (Fortified/aromatized wines, 15-22% ABV)
  // ═══════════════════════════════════════════════════════════════════════

  // Period 3: Grain
  'irish cream': { group: 2, period: 3 },
  'baileys': { group: 2, period: 3 },
  'drambuie': { group: 2, period: 3 },

  // Period 4: Grape
  'vermouth': { group: 2, period: 4 },
  'sweet vermouth': { group: 2, period: 4 },
  'dry vermouth': { group: 2, period: 4 },
  'blanc vermouth': { group: 2, period: 4 },
  'rosso vermouth': { group: 2, period: 4 },
  'carpano': { group: 2, period: 4 },
  'antica formula': { group: 2, period: 4 },
  'dolin': { group: 2, period: 4 },
  'noilly prat': { group: 2, period: 4 },
  'cocchi': { group: 2, period: 4 },
  'sherry': { group: 2, period: 4 },
  'fino sherry': { group: 2, period: 4 },
  'manzanilla': { group: 2, period: 4 },
  'amontillado': { group: 2, period: 4 },
  'oloroso': { group: 2, period: 4 },
  'pedro ximenez': { group: 2, period: 4 },
  'px sherry': { group: 2, period: 4 },
  'port': { group: 2, period: 4 },
  'ruby port': { group: 2, period: 4 },
  'tawny port': { group: 2, period: 4 },
  'madeira': { group: 2, period: 4 },
  'marsala': { group: 2, period: 4 },
  'dubonnet': { group: 2, period: 4 },
  'pineau des charentes': { group: 2, period: 4 },

  // Period 5: Fruit
  'pommeau': { group: 2, period: 5 },
  'umeshu': { group: 2, period: 5 },

  // Period 6: Botanic
  'amaro': { group: 2, period: 6 },
  'aperol': { group: 2, period: 6 },
  'campari': { group: 2, period: 6 },
  'cynar': { group: 2, period: 6 },
  'averna': { group: 2, period: 6 },
  'montenegro': { group: 2, period: 6 },
  'nonino': { group: 2, period: 6 },
  'fernet': { group: 2, period: 6 },
  'fernet branca': { group: 2, period: 6 },
  'fernet-branca': { group: 2, period: 6 },
  'lillet': { group: 2, period: 6 },
  'lillet blanc': { group: 2, period: 6 },
  'lillet rosé': { group: 2, period: 6 },
  'cocchi americano': { group: 2, period: 6 },
  'byrrh': { group: 2, period: 6 },
  'amer picon': { group: 2, period: 6 },
  'suze': { group: 2, period: 6 },
  'salers': { group: 2, period: 6 },
  'china-china': { group: 2, period: 6 },
  'punt e mes': { group: 2, period: 6 },

  // ═══════════════════════════════════════════════════════════════════════
  // GROUP 3: MODIFIER (Sweetened liqueurs, 15-40% ABV, used ≤0.75oz)
  // ═══════════════════════════════════════════════════════════════════════

  // Period 1: Agave
  'agavero': { group: 3, period: 1 },
  'damiana': { group: 3, period: 1 },
  'damiana liqueur': { group: 3, period: 1 },

  // Period 2: Cane
  'falernum': { group: 3, period: 2 },
  'velvet falernum': { group: 3, period: 2 },
  'coconut rum': { group: 3, period: 2 },
  'malibu': { group: 3, period: 2 },
  'pimento dram': { group: 3, period: 2 },
  'allspice dram': { group: 3, period: 2 },
  'batavia arrack': { group: 3, period: 2 },
  'plantation pineapple': { group: 3, period: 2 },

  // Period 3: Grain
  'kahlua': { group: 3, period: 3 },
  'kahlúa': { group: 3, period: 3 },
  'coffee liqueur': { group: 3, period: 3 },
  'mr black': { group: 3, period: 3 },
  'tia maria': { group: 3, period: 3 },
  'amaretto': { group: 3, period: 3 },
  'disaronno': { group: 3, period: 3 },
  'frangelico': { group: 3, period: 3 },
  'hazelnut liqueur': { group: 3, period: 3 },
  'tuaca': { group: 3, period: 3 },

  // Period 4: Grape (cognac/brandy base)
  'grand marnier': { group: 3, period: 4 },
  'chambord': { group: 3, period: 4 },
  'maraschino': { group: 3, period: 4 },
  'luxardo': { group: 3, period: 4 },
  'cherry heering': { group: 3, period: 4 },
  'creme de cassis': { group: 3, period: 4 },
  'crème de cassis': { group: 3, period: 4 },
  'cassis': { group: 3, period: 4 },

  // Period 5: Fruit
  'triple sec': { group: 3, period: 5 },
  'cointreau': { group: 3, period: 5 },
  'curacao': { group: 3, period: 5 },
  'curaçao': { group: 3, period: 5 },
  'blue curacao': { group: 3, period: 5 },
  'orange liqueur': { group: 3, period: 5 },
  'banana liqueur': { group: 3, period: 5 },
  'creme de banane': { group: 3, period: 5 },
  'crème de banane': { group: 3, period: 5 },
  'midori': { group: 3, period: 5 },
  'melon liqueur': { group: 3, period: 5 },
  'peach schnapps': { group: 3, period: 5 },
  'peach liqueur': { group: 3, period: 5 },
  'apricot liqueur': { group: 3, period: 5 },
  'limoncello': { group: 3, period: 5 },
  'raspberry liqueur': { group: 3, period: 5 },
  'blackberry liqueur': { group: 3, period: 5 },
  'passion fruit liqueur': { group: 3, period: 5 },
  'passoã': { group: 3, period: 5 },

  // Period 6: Botanic (neutral base, botanical character)
  'st-germain': { group: 3, period: 6 },
  'st germain': { group: 3, period: 6 },
  'elderflower liqueur': { group: 3, period: 6 },
  'elderflower': { group: 3, period: 6 },
  'chartreuse': { group: 3, period: 6 },
  'green chartreuse': { group: 3, period: 6 },
  'yellow chartreuse': { group: 3, period: 6 },
  'benedictine': { group: 3, period: 6 },
  'b&b': { group: 3, period: 6 },
  'galliano': { group: 3, period: 6 },
  'strega': { group: 3, period: 6 },
  'licor 43': { group: 3, period: 6 },
  'pernod': { group: 3, period: 6 },
  'pastis': { group: 3, period: 6 },
  'ricard': { group: 3, period: 6 },
  'ouzo': { group: 3, period: 6 },
  'sambuca': { group: 3, period: 6 },
  'anisette': { group: 3, period: 6 },
  'arak': { group: 3, period: 6 },
  'creme de menthe': { group: 3, period: 6 },
  'crème de menthe': { group: 3, period: 6 },
  'creme de violette': { group: 3, period: 6 },
  'crème de violette': { group: 3, period: 6 },
  'creme de cacao': { group: 3, period: 6 },
  'crème de cacao': { group: 3, period: 6 },
  'ginger liqueur': { group: 3, period: 6 },
  'domaine de canton': { group: 3, period: 6 },

  // ═══════════════════════════════════════════════════════════════════════
  // GROUP 4: SWEETENER (0% ABV, primarily sugar)
  // ═══════════════════════════════════════════════════════════════════════

  // Period 1: Agave
  'agave nectar': { group: 4, period: 1 },
  'agave syrup': { group: 4, period: 1 },
  'agave': { group: 4, period: 1 },

  // Period 2: Cane
  'demerara syrup': { group: 4, period: 2 },
  'demerara': { group: 4, period: 2 },
  'turbinado syrup': { group: 4, period: 2 },
  'molasses': { group: 4, period: 2 },
  'panela': { group: 4, period: 2 },
  'piloncillo': { group: 4, period: 2 },
  'muscovado': { group: 4, period: 2 },
  'brown sugar syrup': { group: 4, period: 2 },
  'cane syrup': { group: 4, period: 2 },
  'sugarcane juice': { group: 4, period: 2 },

  // Period 3: Grain (refined/neutral)
  'simple syrup': { group: 4, period: 3 },
  'sugar syrup': { group: 4, period: 3 },
  'rich simple syrup': { group: 4, period: 3 },
  '1:1 syrup': { group: 4, period: 3 },
  '2:1 syrup': { group: 4, period: 3 },
  'gomme syrup': { group: 4, period: 3 },
  'orgeat': { group: 4, period: 3 },
  'almond syrup': { group: 4, period: 3 },
  'rice syrup': { group: 4, period: 3 },

  // Period 4: Grape (floral pairing)
  'honey': { group: 4, period: 4 },
  'honey syrup': { group: 4, period: 4 },
  'wine syrup': { group: 4, period: 4 },
  'balsamic glaze': { group: 4, period: 4 },
  'balsamic reduction': { group: 4, period: 4 },

  // Period 5: Fruit
  'grenadine': { group: 4, period: 5 },
  'pomegranate syrup': { group: 4, period: 5 },
  'passion fruit syrup': { group: 4, period: 5 },
  'raspberry syrup': { group: 4, period: 5 },
  'strawberry syrup': { group: 4, period: 5 },
  'blackberry syrup': { group: 4, period: 5 },
  'blueberry syrup': { group: 4, period: 5 },
  'cherry syrup': { group: 4, period: 5 },
  'peach syrup': { group: 4, period: 5 },
  'mango syrup': { group: 4, period: 5 },
  'pineapple syrup': { group: 4, period: 5 },
  'banana syrup': { group: 4, period: 5 },

  // Period 6: Botanic
  'ginger syrup': { group: 4, period: 6 },
  'cinnamon syrup': { group: 4, period: 6 },
  'vanilla syrup': { group: 4, period: 6 },
  'lavender syrup': { group: 4, period: 6 },
  'rosemary syrup': { group: 4, period: 6 },
  'mint syrup': { group: 4, period: 6 },
  'basil syrup': { group: 4, period: 6 },
  'jalapeño syrup': { group: 4, period: 6 },
  'habanero syrup': { group: 4, period: 6 },
  'tea syrup': { group: 4, period: 6 },
  'hibiscus syrup': { group: 4, period: 6 },
  'elderflower syrup': { group: 4, period: 6 },

  // ═══════════════════════════════════════════════════════════════════════
  // GROUP 5: REAGENT (Acids/Juices, pH < 4)
  // ═══════════════════════════════════════════════════════════════════════

  // Period 1: Agave (margarita logic)
  'lime': { group: 5, period: 1 },
  'lime juice': { group: 5, period: 1 },
  'fresh lime': { group: 5, period: 1 },

  // Period 2: Cane (tiki logic)
  'grapefruit': { group: 5, period: 2 },
  'grapefruit juice': { group: 5, period: 2 },
  'fresh grapefruit': { group: 5, period: 2 },
  'ruby red grapefruit': { group: 5, period: 2 },

  // Period 4: Grape (sidecar logic)
  'lemon': { group: 5, period: 4 },
  'lemon juice': { group: 5, period: 4 },
  'fresh lemon': { group: 5, period: 4 },
  'verjus': { group: 5, period: 4 },
  'verjuice': { group: 5, period: 4 },
  'citric acid': { group: 5, period: 4 },
  'tartaric acid': { group: 5, period: 4 },

  // Period 5: Fruit
  'orange': { group: 5, period: 5 },
  'orange juice': { group: 5, period: 5 },
  'fresh orange': { group: 5, period: 5 },
  'blood orange': { group: 5, period: 5 },
  'pineapple': { group: 5, period: 5 },
  'pineapple juice': { group: 5, period: 5 },
  'passion fruit': { group: 5, period: 5 },
  'passion fruit puree': { group: 5, period: 5 },
  'passionfruit': { group: 5, period: 5 },
  'mango': { group: 5, period: 5 },
  'mango juice': { group: 5, period: 5 },
  'guava': { group: 5, period: 5 },
  'papaya': { group: 5, period: 5 },
  'cranberry': { group: 5, period: 5 },
  'cranberry juice': { group: 5, period: 5 },
  'pomegranate juice': { group: 5, period: 5 },
  'apple juice': { group: 5, period: 5 },
  'apple cider': { group: 5, period: 5 },
  'yuzu': { group: 5, period: 5 },
  'calamansi': { group: 5, period: 5 },
  'tamarind': { group: 5, period: 5 },

  // Period 6: Botanic
  'ginger': { group: 5, period: 6 },
  'ginger juice': { group: 5, period: 6 },
  'fresh ginger': { group: 5, period: 6 },
  'cucumber': { group: 5, period: 6 },
  'cucumber juice': { group: 5, period: 6 },
  'celery juice': { group: 5, period: 6 },
  'carrot juice': { group: 5, period: 6 },
  'tomato': { group: 5, period: 6 },
  'tomato juice': { group: 5, period: 6 },

  // ═══════════════════════════════════════════════════════════════════════
  // GROUP 6: CATALYST (Bitters/Extracts, used in dashes/drops)
  // ═══════════════════════════════════════════════════════════════════════

  // Period 1: Agave
  'mole bitters': { group: 6, period: 1 },
  'xocolatl mole bitters': { group: 6, period: 1 },
  'habanero bitters': { group: 6, period: 1 },
  'hellfire bitters': { group: 6, period: 1 },

  // Period 2: Cane
  'tiki bitters': { group: 6, period: 2 },
  'elemakule tiki bitters': { group: 6, period: 2 },

  // Period 3: Grain
  'angostura': { group: 6, period: 3 },
  'angostura bitters': { group: 6, period: 3 },
  'aromatic bitters': { group: 6, period: 3 },
  'walnut bitters': { group: 6, period: 3 },
  'black walnut bitters': { group: 6, period: 3 },
  'chocolate bitters': { group: 6, period: 3 },
  'coffee bitters': { group: 6, period: 3 },
  'old fashioned bitters': { group: 6, period: 3 },
  'whiskey barrel bitters': { group: 6, period: 3 },

  // Period 4: Grape
  'peychauds': { group: 6, period: 4 },
  "peychaud's": { group: 6, period: 4 },
  'peychaud': { group: 6, period: 4 },
  'creole bitters': { group: 6, period: 4 },

  // Period 5: Fruit
  'orange bitters': { group: 6, period: 5 },
  'regans orange': { group: 6, period: 5 },
  "regan's orange": { group: 6, period: 5 },
  'grapefruit bitters': { group: 6, period: 5 },
  'lemon bitters': { group: 6, period: 5 },
  'cherry bitters': { group: 6, period: 5 },
  'cranberry bitters': { group: 6, period: 5 },
  'rhubarb bitters': { group: 6, period: 5 },
  'plum bitters': { group: 6, period: 5 },

  // Period 6: Botanic
  'celery bitters': { group: 6, period: 6 },
  'lavender bitters': { group: 6, period: 6 },
  'cardamom bitters': { group: 6, period: 6 },
  'cardamom': { group: 6, period: 6 },
  'cinnamon bitters': { group: 6, period: 6 },
  'ginger bitters': { group: 6, period: 6 },
  'mint bitters': { group: 6, period: 6 },
  'fee brothers': { group: 6, period: 6 },
  'bittermens': { group: 6, period: 6 },
  'scrappy\'s': { group: 6, period: 6 },
  'scrappys': { group: 6, period: 6 },
  'bitters': { group: 6, period: 6 },
};

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORY FALLBACKS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Fallback classification based on inventory category
 * Used when keyword matching fails
 */
export const CATEGORY_FALLBACKS: Record<string, CellPosition> = {
  'spirit': { group: 1, period: 3 },     // Default to Base, Grain
  'liqueur': { group: 3, period: 6 },    // Default to Modifier, Botanic
  'mixer': { group: 5, period: 5 },      // Default to Reagent, Fruit
  'syrup': { group: 4, period: 3 },      // Default to Sweetener, Grain
  'garnish': { group: 6, period: 6 },    // Default to Catalyst, Botanic
  'wine': { group: 2, period: 4 },       // Default to Bridge, Grape
  'beer': { group: 1, period: 3 },       // Default to Base, Grain
  'other': { group: 3, period: 6 },      // Default to Modifier, Botanic
};

// ═══════════════════════════════════════════════════════════════════════════
// CLASSIFICATION ENGINE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Normalize text for matching
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/['']/g, "'"); // Normalize apostrophes
}

/**
 * Extract searchable keywords from an inventory item
 */
function extractKeywords(item: InventoryItem): string[] {
  const keywords: string[] = [];

  if (item.name) {
    keywords.push(normalizeText(item.name));
    // Also add individual words
    normalizeText(item.name).split(/\s+/).forEach(word => {
      if (word.length > 2) keywords.push(word);
    });
  }

  if (item.type) {
    keywords.push(normalizeText(item.type));
    normalizeText(item.type).split(/\s+/).forEach(word => {
      if (word.length > 2) keywords.push(word);
    });
  }

  return [...new Set(keywords)]; // Dedupe
}

/**
 * Classify an inventory item into Group/Period
 *
 * @param item - The inventory item to classify
 * @param userOverride - Optional manual override from database
 * @returns Classification result with confidence level
 */
export function classifyInventoryItem(
  item: InventoryItem,
  userOverride?: CellPosition | null
): Classification {
  // 1. Check for manual override first
  if (userOverride) {
    return {
      group: userOverride.group,
      period: userOverride.period,
      confidence: 'manual',
      reasoning: 'User override',
    };
  }

  const keywords = extractKeywords(item);

  // 2. Try exact match on full name/type
  for (const keyword of keywords) {
    if (CLASSIFICATION_MAP[keyword]) {
      const match = CLASSIFICATION_MAP[keyword];
      return {
        group: match.group as MixologyGroup,
        period: match.period as MixologyPeriod,
        confidence: 'high',
        reasoning: `Matched keyword: "${keyword}"`,
      };
    }
  }

  // 3. Try partial match (keyword contains or is contained by map key)
  for (const keyword of keywords) {
    for (const [mapKey, position] of Object.entries(CLASSIFICATION_MAP)) {
      if (keyword.includes(mapKey) || mapKey.includes(keyword)) {
        return {
          group: position.group as MixologyGroup,
          period: position.period as MixologyPeriod,
          confidence: 'medium',
          reasoning: `Partial match: "${keyword}" ~ "${mapKey}"`,
        };
      }
    }
  }

  // 4. Fall back to category-based classification
  if (item.category && CATEGORY_FALLBACKS[item.category]) {
    const fallback = CATEGORY_FALLBACKS[item.category];
    return {
      group: fallback.group as MixologyGroup,
      period: fallback.period as MixologyPeriod,
      confidence: 'low',
      reasoning: `Category fallback: ${item.category}`,
    };
  }

  // 5. Ultimate fallback: Modifier, Botanic
  return {
    group: 3,
    period: 6,
    confidence: 'low',
    reasoning: 'Default fallback',
  };
}

/**
 * Classify multiple inventory items and group by cell
 *
 * @param items - Array of inventory items
 * @param userOverrides - Map of itemId → CellPosition overrides
 * @returns Map of "group-period" → ClassifiedItem[]
 */
export function classifyAndGroupItems(
  items: InventoryItem[],
  userOverrides?: Map<number, CellPosition>
): Map<string, ClassifiedItem[]> {
  const grouped = new Map<string, ClassifiedItem[]>();

  // Initialize all cells
  for (const group of GROUP_NUMBERS) {
    for (const period of PERIOD_NUMBERS) {
      grouped.set(`${group}-${period}`, []);
    }
  }

  // Classify and group each item
  for (const item of items) {
    const override = userOverrides?.get(item.id);
    const classification = classifyInventoryItem(item, override);
    const key = `${classification.group}-${classification.period}`;

    const cell = grouped.get(key) || [];
    cell.push({ item, classification });
    grouped.set(key, cell);
  }

  return grouped;
}

/**
 * Build cell data for rendering the grid
 *
 * @param items - Array of inventory items
 * @param userOverrides - Map of itemId → CellPosition overrides
 * @returns 2D array of CellData [period][group]
 */
export function buildGridData(
  items: InventoryItem[],
  userOverrides?: Map<number, CellPosition>
): CellData[][] {
  const grouped = classifyAndGroupItems(items, userOverrides);

  const grid: CellData[][] = [];

  for (const period of PERIOD_NUMBERS) {
    const row: CellData[] = [];
    for (const group of GROUP_NUMBERS) {
      const key = `${group}-${period}`;
      const cellItems = grouped.get(key) || [];

      row.push({
        group,
        period,
        items: cellItems,
        hasInventory: cellItems.length > 0,
        count: cellItems.length,
      });
    }
    grid.push(row);
  }

  return grid;
}

/**
 * Get cell key string
 */
export function getCellKey(group: MixologyGroup, period: MixologyPeriod): string {
  return `${group}-${period}`;
}

/**
 * Parse cell key string
 */
export function parseCellKey(key: string): CellPosition | null {
  const [groupStr, periodStr] = key.split('-');
  const group = parseInt(groupStr, 10) as MixologyGroup;
  const period = parseInt(periodStr, 10) as MixologyPeriod;

  if (group >= 1 && group <= 6 && period >= 1 && period <= 6) {
    return { group, period };
  }
  return null;
}

/**
 * Get human-readable cell name
 */
export function getCellName(group: MixologyGroup, period: MixologyPeriod): string {
  return `${PERIODS[period].name} ${GROUPS[group].name}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// ELEMENT MATCHING ENGINE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Check if a word is a valid word boundary match
 * Prevents false matches like "gin" matching "ginger" or "apple" matching "pineapple"
 */
function isWordBoundaryMatch(text: string, keyword: string): boolean {
  // Create regex that matches keyword only at word boundaries
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`\\b${escaped}\\b`, 'i');
  return regex.test(text);
}

/**
 * Match an inventory item against predefined elements
 * Returns all matching elements (sorted by relevance)
 *
 * Uses strict word boundary matching to prevent false positives like:
 * - "gin" matching "ginger"
 * - "apple" matching "pineapple"
 * - "rum" matching "spectrum"
 */
export function matchItemToElements(item: InventoryItem): ElementType[] {
  const itemText = normalizeText(`${item.name} ${item.type || ''}`);

  const matches: { element: ElementType; score: number }[] = [];

  for (const element of ELEMENTS) {
    // Skip empty cells
    if (element.empty) continue;

    let score = 0;

    for (const keyword of element.keywords) {
      const normalizedKeyword = normalizeText(keyword);

      // Multi-word keyword: check if contained as complete phrase
      if (normalizedKeyword.includes(' ')) {
        if (itemText.includes(normalizedKeyword)) {
          // Exact phrase match gets highest score
          score += 20;
        }
      } else {
        // Single word: require word boundary match
        if (isWordBoundaryMatch(itemText, normalizedKeyword)) {
          score += 10;
        }
      }
    }

    if (score > 0) {
      matches.push({ element, score });
    }
  }

  // Sort by score descending, then by primary flag
  matches.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // Prefer primary elements when scores are equal
    if (a.element.primary && !b.element.primary) return -1;
    if (!a.element.primary && b.element.primary) return 1;
    return 0;
  });

  return matches.map(m => m.element);
}

/**
 * Get primary element for a cell (group/period)
 */
export function getPrimaryElement(group: MixologyGroup, period: MixologyPeriod): ElementType | null {
  return ELEMENTS.find(e => e.group === group && e.period === period && e.primary) || null;
}

/**
 * Get all elements for a cell
 */
export function getElementsForCell(group: MixologyGroup, period: MixologyPeriod): ElementType[] {
  return ELEMENTS.filter(e => e.group === group && e.period === period);
}

/**
 * Build element cell data with matched inventory items
 */
export function buildElementCellData(
  inventoryItems: InventoryItem[]
): Map<string, ElementCellData[]> {
  const cellData = new Map<string, ElementCellData[]>();

  // Initialize all cells
  for (const group of GROUP_NUMBERS) {
    for (const period of PERIOD_NUMBERS) {
      const key = getCellKey(group, period);
      const elements = getElementsForCell(group, period);

      // Create ElementCellData for each element in this cell
      cellData.set(key, elements.map(element => ({
        element,
        matchedItems: [],
        count: 0,
      })));
    }
  }

  // Match each inventory item to elements
  for (const item of inventoryItems) {
    const matchedElements = matchItemToElements(item);

    if (matchedElements.length > 0) {
      // Get the best matching element
      const bestMatch = matchedElements[0];
      const key = getCellKey(bestMatch.group, bestMatch.period);
      const cellElements = cellData.get(key);

      if (cellElements) {
        const elementData = cellElements.find(e => e.element.symbol === bestMatch.symbol);
        if (elementData) {
          elementData.matchedItems.push(item);
          elementData.count = elementData.matchedItems.length;
        }
      }
    }
  }

  return cellData;
}

/** Return type for getCellDisplayData */
export interface CellDisplayData {
  /** Primary element for this cell */
  element: ElementType | null;
  /** Element to display (may differ from primary if user has different items) */
  displayElement: ElementType | null;
  /** All inventory items matched to this cell */
  matchedItems: InventoryItem[];
  /** Total count of items in this cell */
  count: number;
  /** Whether user has no items in this cell */
  isEmpty: boolean;
  /** Set of element symbols the user has in their bar */
  ownedElementSymbols: Set<string>;
}

/**
 * Get a single display element for a cell
 * - If user has items matching an element in this cell, show that element
 * - Prioritize the primary element, but if user doesn't have it, show first matching element
 * - If user has no items in this cell, show primary element as empty
 *
 * Two-phase matching:
 * 1. First try to match via ELEMENTS keywords (strict word boundary)
 * 2. Fall back to CLASSIFICATION_MAP for items that don't match any element keywords
 */
export function getCellDisplayData(
  group: MixologyGroup,
  period: MixologyPeriod,
  inventoryItems: InventoryItem[]
): CellDisplayData {
  const elements = getElementsForCell(group, period);
  const primaryElement = getPrimaryElement(group, period);

  if (elements.length === 0) {
    return { element: null, displayElement: null, matchedItems: [], count: 0, isEmpty: true, ownedElementSymbols: new Set() };
  }

  // Build a map of element symbol -> matched items
  const elementMatchMap = new Map<string, InventoryItem[]>();
  elements.forEach(el => elementMatchMap.set(el.symbol, []));

  // Also collect items that match via CLASSIFICATION_MAP to this cell
  const classificationMatchedItems: InventoryItem[] = [];

  // Match inventory items to specific elements in this cell
  for (const item of inventoryItems) {
    // Phase 1: Try element keyword matching
    const matchedElements = matchItemToElements(item);
    const cellMatch = matchedElements.find(e => e.group === group && e.period === period);

    if (cellMatch) {
      const items = elementMatchMap.get(cellMatch.symbol) || [];
      items.push(item);
      elementMatchMap.set(cellMatch.symbol, items);
    } else {
      // Phase 2: Fall back to CLASSIFICATION_MAP
      const classification = classifyInventoryItem(item);
      if (classification.group === group && classification.period === period) {
        classificationMatchedItems.push(item);
      }
    }
  }

  // Collect all matched items (element matches + classification matches)
  const allMatchedItems: InventoryItem[] = [];
  const ownedElementSymbols = new Set<string>();

  elementMatchMap.forEach((items, symbol) => {
    allMatchedItems.push(...items);
    if (items.length > 0) {
      ownedElementSymbols.add(symbol);
    }
  });
  allMatchedItems.push(...classificationMatchedItems);

  // Find the best element to display:
  // 1. If primary element has matches, use it
  // 2. Otherwise, use first element with matches
  // 3. If only classification matches exist, use primary element
  // 4. If no matches, use primary element (or first element) as empty
  let displayElement: ElementType | null = null;

  if (primaryElement && !primaryElement.empty) {
    const primaryMatches = elementMatchMap.get(primaryElement.symbol) || [];
    if (primaryMatches.length > 0) {
      displayElement = primaryElement;
    }
  }

  if (!displayElement) {
    // Find first element with matches
    for (const el of elements) {
      if (el.empty) continue;
      const matches = elementMatchMap.get(el.symbol) || [];
      if (matches.length > 0) {
        displayElement = el;
        break;
      }
    }
  }

  // If we have classification matches but no element matches, use primary element
  if (!displayElement && classificationMatchedItems.length > 0) {
    displayElement = primaryElement;
  }

  // Fallback to primary element (may be empty/Rare)
  if (!displayElement) {
    displayElement = primaryElement || elements[0];
  }

  return {
    element: primaryElement || elements[0],
    displayElement,
    matchedItems: allMatchedItems,
    count: allMatchedItems.length,
    isEmpty: allMatchedItems.length === 0,
    ownedElementSymbols,
  };
}
