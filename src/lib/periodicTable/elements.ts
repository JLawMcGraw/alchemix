/**
 * Periodic Table of Mixology - Elements
 *
 * Predefined elements for the periodic table.
 * Each element represents a TYPE of ingredient (not individual bottles).
 */

import type { ElementType } from './types';

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
  { symbol: 'Ag', name: 'Agave Nectar', group: 4, period: 1, brix: '75', primary: true, keywords: ['agave nectar', 'agave syrup'] },
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

  // Group 5: Reagent - Grain (Neutral)
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
