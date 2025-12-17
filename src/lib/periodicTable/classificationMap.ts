/**
 * Periodic Table of Mixology - Classification Maps
 *
 * Keyword → Classification lookups for ingredient classification.
 */

import type { CellPosition } from './types';

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

  // Period 6: Botanic
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

  // Period 4: Grape
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
  'raspberry liqueur': { group: 3, period: 4 },  // With Chambord
  'black raspberry liqueur': { group: 3, period: 4 },  // With Chambord
  'framboise': { group: 3, period: 4 },  // With Chambord
  'blackberry liqueur': { group: 3, period: 5 },
  'passion fruit liqueur': { group: 3, period: 5 },
  'passoã': { group: 3, period: 5 },

  // Period 6: Botanic
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

  // Period 3: Grain
  'simple syrup': { group: 4, period: 3 },
  'sugar syrup': { group: 4, period: 3 },
  'rich simple syrup': { group: 4, period: 3 },
  '1:1 syrup': { group: 4, period: 3 },
  '2:1 syrup': { group: 4, period: 3 },
  'gomme syrup': { group: 4, period: 3 },
  'orgeat': { group: 4, period: 3 },
  'almond syrup': { group: 4, period: 3 },
  'rice syrup': { group: 4, period: 3 },

  // Period 4: Grape
  'honey': { group: 4, period: 4 },
  'honey syrup': { group: 4, period: 4 },
  'wine syrup': { group: 4, period: 4 },
  'balsamic glaze': { group: 4, period: 4 },
  'balsamic reduction': { group: 4, period: 4 },

  // Period 5: Fruit
  'grenadine': { group: 4, period: 5 },
  'pomegranate syrup': { group: 4, period: 5 },
  'passion fruit syrup': { group: 4, period: 5 },
  'passionfruit syrup': { group: 4, period: 5 },
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

  // Period 1: Agave
  'lime': { group: 5, period: 1 },
  'lime juice': { group: 5, period: 1 },
  'fresh lime': { group: 5, period: 1 },

  // Period 2: Cane
  'grapefruit': { group: 5, period: 2 },
  'grapefruit juice': { group: 5, period: 2 },
  'fresh grapefruit': { group: 5, period: 2 },
  'ruby red grapefruit': { group: 5, period: 2 },

  // Period 4: Grape
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
  'ginger beer': { group: 5, period: 6 },
  'ginger ale': { group: 5, period: 6 },
  'cucumber': { group: 5, period: 6 },
  'cucumber juice': { group: 5, period: 6 },
  'celery juice': { group: 5, period: 6 },
  'carrot juice': { group: 5, period: 6 },
  'tomato': { group: 5, period: 6 },
  'tomato juice': { group: 5, period: 6 },
  'soda water': { group: 5, period: 6 },
  'soda': { group: 5, period: 6 },
  'club soda': { group: 5, period: 6 },
  'sparkling water': { group: 5, period: 6 },
  'tonic': { group: 5, period: 6 },
  'tonic water': { group: 5, period: 6 },
  'cola': { group: 5, period: 6 },

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

/**
 * Fallback classification based on inventory category
 * Used when keyword matching fails
 */
export const CATEGORY_FALLBACKS: Record<string, CellPosition> = {
  'spirit': { group: 1, period: 3 },
  'liqueur': { group: 3, period: 6 },
  'mixer': { group: 5, period: 5 },
  'syrup': { group: 4, period: 3 },
  'garnish': { group: 6, period: 6 },
  'wine': { group: 2, period: 4 },
  'beer': { group: 1, period: 3 },
  'other': { group: 3, period: 6 },
};
