/**
 * Periodic Table of Mixology Elements
 *
 * This defines general ingredient CATEGORIES (not specific inventory items).
 * Think of it as "what types of ingredients exist in mixology?"
 *
 * Each element has:
 * - symbol: 2-3 letter abbreviation (like periodic table)
 * - name: Full category name
 * - group: Color coding group for visual organization
 * - atomicNumber: Display number (for visual reference only)
 */

export type ElementGroup =
  | 'agave'       // Teal - Tequila, Mezcal
  | 'grain'       // Amber - Whiskey, Bourbon, Rye
  | 'cane'        // Green - Rum, Cachaça
  | 'juniper'     // Sky Blue - Gin
  | 'grape'       // Violet - Brandy, Cognac, Pisco
  | 'neutral'     // Slate - Vodka
  | 'botanical'   // Pink - Amaro, Vermouth, Bitters
  | 'acid'        // Yellow - Citrus
  | 'sugar'       // Indigo - Syrups, Liqueurs
  | 'dairy'       // Cream - Cream, Eggs
  | 'carbonation' // Silver - Soda, Tonic
  | 'garnish';    // Mint Green - Fresh herbs, garnishes

export interface PeriodicElement {
  symbol: string;
  name: string;
  group: ElementGroup;
  atomicNumber: number;
  keywords?: string[]; // For matching user inventory items
  hidden?: boolean; // If true, only renders when user has matching inventory in stock
}

export interface ElementSection {
  title: string;
  elements: PeriodicElement[];
}

/**
 * CSS variable mapping for element group colors
 */
export const GROUP_COLORS: Record<ElementGroup, string> = {
  agave: 'var(--bond-agave)',
  grain: 'var(--bond-grain)',
  cane: 'var(--bond-cane)',
  juniper: 'var(--bond-juniper)',
  grape: 'var(--bond-grape)',
  neutral: 'var(--bond-neutral)',
  botanical: 'var(--bond-botanical)',
  acid: 'var(--bond-acid)',
  sugar: 'var(--bond-sugar)',
  dairy: 'var(--bond-dairy)',
  carbonation: 'var(--bond-carbonation)',
  garnish: 'var(--bond-garnish)',
};

/**
 * All periodic table elements organized by section
 */
export const PERIODIC_SECTIONS: ElementSection[] = [
  {
    title: 'BASE SPIRITS',
    elements: [
      // Always visible (core spirits)
      { symbol: 'Rm', name: 'Rum', group: 'cane', atomicNumber: 1, keywords: ['rum', 'white rum', 'dark rum', 'spiced rum', 'aged rum', 'overproof'] },
      { symbol: 'Ra', name: 'Rhum Agricole', group: 'cane', atomicNumber: 2, keywords: ['rhum agricole', 'agricole', 'martinique'] },
      { symbol: 'Cc', name: 'Cachaça', group: 'cane', atomicNumber: 3, keywords: ['cachaca', 'cachaça'] },
      { symbol: 'Vd', name: 'Vodka', group: 'neutral', atomicNumber: 4, keywords: ['vodka'] },
      { symbol: 'Gn', name: 'Gin', group: 'juniper', atomicNumber: 5, keywords: ['gin', 'london dry', 'old tom', 'navy strength'] },
      { symbol: 'Wh', name: 'Whiskey', group: 'grain', atomicNumber: 6, keywords: ['whiskey', 'whisky', 'irish whiskey'] },
      { symbol: 'Bb', name: 'Bourbon', group: 'grain', atomicNumber: 7, keywords: ['bourbon'] },
      { symbol: 'Ry', name: 'Rye', group: 'grain', atomicNumber: 8, keywords: ['rye', 'rye whiskey'] },
      { symbol: 'Sc', name: 'Scotch', group: 'grain', atomicNumber: 9, keywords: ['scotch', 'blended scotch', 'islay', 'speyside', 'highland'] },
      { symbol: 'Tq', name: 'Tequila', group: 'agave', atomicNumber: 10, keywords: ['tequila', 'blanco', 'reposado', 'añejo', 'anejo'] },
      { symbol: 'Mz', name: 'Mezcal', group: 'agave', atomicNumber: 11, keywords: ['mezcal', 'mescal'] },
      { symbol: 'Br', name: 'Brandy', group: 'grape', atomicNumber: 12, keywords: ['brandy'] },
      { symbol: 'Cg', name: 'Cognac', group: 'grape', atomicNumber: 13, keywords: ['cognac', 'vsop', 'hennessy', 'remy martin'] },
      { symbol: 'Ps', name: 'Pisco', group: 'grape', atomicNumber: 14, keywords: ['pisco'] },
      // Hidden (appear when user adds matching inventory)
      { symbol: 'Jw', name: 'Japanese Whisky', group: 'grain', atomicNumber: 15, keywords: ['japanese whisky', 'japanese whiskey', 'nikka', 'suntory', 'hibiki', 'yamazaki', 'hakushu'], hidden: true },
      { symbol: 'Ar', name: 'Armagnac', group: 'grape', atomicNumber: 16, keywords: ['armagnac'], hidden: true },
      { symbol: 'Cd', name: 'Calvados', group: 'grape', atomicNumber: 17, keywords: ['calvados', 'apple brandy', 'applejack'], hidden: true },
      { symbol: 'Aq', name: 'Aquavit', group: 'botanical', atomicNumber: 18, keywords: ['aquavit', 'akvavit'], hidden: true },
      { symbol: 'Gp', name: 'Grappa', group: 'grape', atomicNumber: 19, keywords: ['grappa'], hidden: true },
      { symbol: 'So', name: 'Soju', group: 'neutral', atomicNumber: 20, keywords: ['soju'], hidden: true },
      { symbol: 'Bj', name: 'Baijiu', group: 'grain', atomicNumber: 21, keywords: ['baijiu'], hidden: true },
      { symbol: 'Gv', name: 'Genever', group: 'juniper', atomicNumber: 22, keywords: ['genever', 'jenever'], hidden: true },
    ],
  },
  {
    title: 'LIQUEURS',
    elements: [
      // Always visible (core liqueurs)
      { symbol: 'Ol', name: 'Orange Liqueur', group: 'sugar', atomicNumber: 23, keywords: ['orange liqueur', 'triple sec', 'cointreau', 'grand marnier', 'curacao', 'curaçao'] },
      { symbol: 'Cf', name: 'Coffee Liqueur', group: 'sugar', atomicNumber: 24, keywords: ['coffee liqueur', 'kahlua', 'mr black', 'espresso liqueur'] },
      { symbol: 'Am', name: 'Amaretto', group: 'sugar', atomicNumber: 25, keywords: ['amaretto', 'almond liqueur', 'disaronno'] },
      { symbol: 'Bn', name: 'Banana Liqueur', group: 'sugar', atomicNumber: 26, keywords: ['banana liqueur', 'creme de banane'] },
      { symbol: 'Ms', name: 'Maraschino', group: 'sugar', atomicNumber: 27, keywords: ['maraschino', 'luxardo maraschino'] },
      { symbol: 'El', name: 'Elderflower', group: 'sugar', atomicNumber: 28, keywords: ['elderflower', 'st germain', 'st. germain', 'elderflower liqueur'] },
      { symbol: 'Cs', name: 'Crème de Cassis', group: 'sugar', atomicNumber: 29, keywords: ['cassis', 'creme de cassis', 'crème de cassis', 'blackcurrant liqueur'] },
      { symbol: 'Co', name: 'Crème de Cacao', group: 'sugar', atomicNumber: 30, keywords: ['cacao', 'creme de cacao', 'crème de cacao', 'chocolate liqueur'] },
      { symbol: 'Cv', name: 'Crème de Violette', group: 'sugar', atomicNumber: 31, keywords: ['violette', 'creme de violette', 'crème de violette', 'violet liqueur'] },
      { symbol: 'Mn', name: 'Crème de Menthe', group: 'sugar', atomicNumber: 32, keywords: ['menthe', 'creme de menthe', 'crème de menthe', 'mint liqueur'] },
      { symbol: 'Ct', name: 'Chartreuse', group: 'sugar', atomicNumber: 33, keywords: ['chartreuse', 'green chartreuse', 'yellow chartreuse'] },
      // Hidden (appear when user adds matching inventory)
      { symbol: 'Be', name: 'Bénédictine', group: 'sugar', atomicNumber: 34, keywords: ['benedictine', 'bénédictine', 'b&b'], hidden: true },
      { symbol: 'Dr', name: 'Drambuie', group: 'sugar', atomicNumber: 35, keywords: ['drambuie'], hidden: true },
      { symbol: 'Fq', name: 'Frangelico', group: 'sugar', atomicNumber: 36, keywords: ['frangelico', 'hazelnut liqueur'], hidden: true },
      { symbol: 'Gl', name: 'Galliano', group: 'sugar', atomicNumber: 37, keywords: ['galliano'], hidden: true },
      { symbol: 'Cm', name: 'Chambord', group: 'sugar', atomicNumber: 38, keywords: ['chambord', 'raspberry liqueur'], hidden: true },
      { symbol: 'Mi', name: 'Midori', group: 'sugar', atomicNumber: 39, keywords: ['midori', 'melon liqueur'], hidden: true },
      { symbol: 'Ic', name: 'Irish Cream', group: 'dairy', atomicNumber: 40, keywords: ['irish cream', 'baileys', "bailey's"], hidden: true },
      { symbol: 'Fa', name: 'Falernum', group: 'sugar', atomicNumber: 41, keywords: ['falernum', 'velvet falernum'], hidden: true },
      { symbol: 'Ad', name: 'Allspice Dram', group: 'sugar', atomicNumber: 42, keywords: ['allspice dram', 'pimento dram', 'st elizabeth'], hidden: true },
      { symbol: 'Pe', name: 'Crème de Pêche', group: 'sugar', atomicNumber: 43, keywords: ['peche', 'peach liqueur', 'creme de peche', 'peach schnapps'], hidden: true },
      { symbol: 'Mu', name: 'Crème de Mûre', group: 'sugar', atomicNumber: 44, keywords: ['mure', 'blackberry liqueur', 'creme de mure'], hidden: true },
      { symbol: 'Lm', name: 'Limoncello', group: 'sugar', atomicNumber: 45, keywords: ['limoncello'], hidden: true },
      { symbol: 'Sg', name: 'Sloe Gin', group: 'sugar', atomicNumber: 46, keywords: ['sloe gin'], hidden: true },
      { symbol: 'Ch', name: 'Cherry Heering', group: 'sugar', atomicNumber: 47, keywords: ['cherry heering', 'cherry liqueur', 'heering'], hidden: true },
    ],
  },
  {
    title: 'CITRUS & ACIDS',
    elements: [
      // Always visible (core citrus)
      { symbol: 'Li', name: 'Lime', group: 'acid', atomicNumber: 48, keywords: ['lime', 'lime juice', 'fresh lime'] },
      { symbol: 'Le', name: 'Lemon', group: 'acid', atomicNumber: 49, keywords: ['lemon', 'lemon juice', 'fresh lemon'] },
      { symbol: 'Or', name: 'Orange', group: 'acid', atomicNumber: 50, keywords: ['orange', 'orange juice', 'fresh orange'] },
      { symbol: 'Gf', name: 'Grapefruit', group: 'acid', atomicNumber: 51, keywords: ['grapefruit', 'grapefruit juice'] },
      { symbol: 'Pi', name: 'Pineapple', group: 'acid', atomicNumber: 52, keywords: ['pineapple', 'pineapple juice'] },
      { symbol: 'Pf', name: 'Passion Fruit', group: 'acid', atomicNumber: 53, keywords: ['passion fruit', 'passionfruit', 'passion fruit puree', 'passion fruit syrup'] },
      // Hidden (appear when user adds matching inventory)
      { symbol: 'Cb', name: 'Cranberry', group: 'acid', atomicNumber: 54, keywords: ['cranberry', 'cranberry juice'], hidden: true },
      { symbol: 'Pg', name: 'Pomegranate', group: 'acid', atomicNumber: 55, keywords: ['pomegranate', 'pomegranate juice', 'pom'], hidden: true },
      { symbol: 'Yu', name: 'Yuzu', group: 'acid', atomicNumber: 56, keywords: ['yuzu', 'yuzu juice'], hidden: true },
      { symbol: 'Bo', name: 'Blood Orange', group: 'acid', atomicNumber: 57, keywords: ['blood orange', 'blood orange juice'], hidden: true },
      { symbol: 'Td', name: 'Tamarind', group: 'acid', atomicNumber: 58, keywords: ['tamarind', 'tamarind paste'], hidden: true },
      { symbol: 'Tj', name: 'Tomato', group: 'acid', atomicNumber: 59, keywords: ['tomato juice', 'tomato', 'clamato'], hidden: true },
    ],
  },
  {
    title: 'SWEETENERS',
    elements: [
      // Always visible (core sweeteners)
      { symbol: 'Ss', name: 'Simple Syrup', group: 'sugar', atomicNumber: 60, keywords: ['simple syrup', 'sugar syrup', '1:1 syrup', '2:1 syrup', 'rich simple'] },
      { symbol: 'Hn', name: 'Honey', group: 'sugar', atomicNumber: 61, keywords: ['honey', 'honey syrup'] },
      { symbol: 'Av', name: 'Agave Syrup', group: 'sugar', atomicNumber: 62, keywords: ['agave syrup', 'agave nectar', 'blue agave syrup'] },
      { symbol: 'Gr', name: 'Grenadine', group: 'sugar', atomicNumber: 63, keywords: ['grenadine', 'pomegranate syrup'] },
      { symbol: 'Og', name: 'Orgeat', group: 'sugar', atomicNumber: 64, keywords: ['orgeat', 'almond syrup'] },
      { symbol: 'Dm', name: 'Demerara', group: 'sugar', atomicNumber: 65, keywords: ['demerara', 'demerara syrup', 'brown sugar syrup'] },
      { symbol: 'Ma', name: 'Maple', group: 'sugar', atomicNumber: 66, keywords: ['maple', 'maple syrup'] },
      { symbol: 'Ci', name: 'Cinnamon Syrup', group: 'sugar', atomicNumber: 67, keywords: ['cinnamon syrup'] },
      // Hidden (appear when user adds matching inventory)
      { symbol: 'Gs', name: 'Ginger Syrup', group: 'sugar', atomicNumber: 68, keywords: ['ginger syrup'], hidden: true },
      { symbol: 'Va', name: 'Vanilla Syrup', group: 'sugar', atomicNumber: 69, keywords: ['vanilla syrup'], hidden: true },
      { symbol: 'Lv', name: 'Lavender Syrup', group: 'sugar', atomicNumber: 70, keywords: ['lavender syrup'], hidden: true },
      { symbol: 'Rs', name: 'Rose Syrup', group: 'sugar', atomicNumber: 71, keywords: ['rose syrup', 'rose water'], hidden: true },
      { symbol: 'Hb', name: 'Hibiscus Syrup', group: 'sugar', atomicNumber: 72, keywords: ['hibiscus syrup', 'hibiscus'], hidden: true },
      { symbol: 'Rb', name: 'Raspberry Syrup', group: 'sugar', atomicNumber: 73, keywords: ['raspberry syrup'], hidden: true },
      { symbol: 'Cy', name: 'Cane Syrup', group: 'sugar', atomicNumber: 74, keywords: ['cane syrup'], hidden: true },
    ],
  },
  {
    title: 'BITTERS & BOTANICALS',
    elements: [
      // Always visible (core bitters/botanicals)
      { symbol: 'An', name: 'Angostura', group: 'botanical', atomicNumber: 75, keywords: ['angostura', 'angostura bitters', 'aromatic bitters'] },
      { symbol: 'Ob', name: 'Orange Bitters', group: 'botanical', atomicNumber: 76, keywords: ['orange bitters', 'regans orange'] },
      { symbol: 'Py', name: "Peychaud's", group: 'botanical', atomicNumber: 77, keywords: ['peychauds', "peychaud's", 'peychaud'] },
      { symbol: 'Cp', name: 'Campari', group: 'botanical', atomicNumber: 78, keywords: ['campari'] },
      { symbol: 'Ap', name: 'Aperol', group: 'botanical', atomicNumber: 79, keywords: ['aperol'] },
      { symbol: 'Sv', name: 'Sweet Vermouth', group: 'botanical', atomicNumber: 80, keywords: ['sweet vermouth', 'vermouth rosso', 'carpano', 'antica formula', 'cocchi vermouth'] },
      { symbol: 'Dv', name: 'Dry Vermouth', group: 'botanical', atomicNumber: 81, keywords: ['dry vermouth', 'vermouth dry', 'dolin dry', 'noilly prat'] },
      { symbol: 'Fe', name: 'Fernet', group: 'botanical', atomicNumber: 82, keywords: ['fernet', 'fernet branca', 'fernet-branca'] },
      { symbol: 'Ab', name: 'Absinthe', group: 'botanical', atomicNumber: 83, keywords: ['absinthe', 'pastis', 'pernod', 'herbsaint'] },
      // Hidden (appear when user adds matching inventory)
      { symbol: 'Xb', name: 'Chocolate Bitters', group: 'botanical', atomicNumber: 84, keywords: ['chocolate bitters'], hidden: true },
      { symbol: 'Yb', name: 'Celery Bitters', group: 'botanical', atomicNumber: 85, keywords: ['celery bitters'], hidden: true },
      { symbol: 'Zb', name: 'Mole Bitters', group: 'botanical', atomicNumber: 86, keywords: ['mole bitters'], hidden: true },
      { symbol: 'Yr', name: 'Cynar', group: 'botanical', atomicNumber: 87, keywords: ['cynar', 'artichoke'], hidden: true },
      { symbol: 'Mo', name: 'Amaro Montenegro', group: 'botanical', atomicNumber: 88, keywords: ['montenegro', 'amaro montenegro'], hidden: true },
      { symbol: 'Ae', name: 'Amaro Averna', group: 'botanical', atomicNumber: 89, keywords: ['averna', 'amaro averna'], hidden: true },
      { symbol: 'Sz', name: 'Suze', group: 'botanical', atomicNumber: 90, keywords: ['suze', 'gentian'], hidden: true },
      { symbol: 'Lt', name: 'Lillet', group: 'botanical', atomicNumber: 91, keywords: ['lillet', 'lillet blanc', 'lillet rouge'], hidden: true },
      { symbol: 'Ca', name: 'Cocchi Americano', group: 'botanical', atomicNumber: 92, keywords: ['cocchi americano'], hidden: true },
      { symbol: 'Pu', name: 'Punt e Mes', group: 'botanical', atomicNumber: 93, keywords: ['punt e mes'], hidden: true },
      { symbol: 'Ao', name: 'Amaro', group: 'botanical', atomicNumber: 94, keywords: ['amaro'], hidden: true },
      { symbol: 'Nn', name: 'Amaro Nonino', group: 'botanical', atomicNumber: 95, keywords: ['nonino', 'amaro nonino'], hidden: true },
    ],
  },
  {
    title: 'MIXERS & OTHER',
    elements: [
      // Always visible (core mixers)
      { symbol: 'Sw', name: 'Soda Water', group: 'carbonation', atomicNumber: 96, keywords: ['soda', 'soda water', 'club soda', 'sparkling water', 'seltzer'] },
      { symbol: 'Tn', name: 'Tonic', group: 'carbonation', atomicNumber: 97, keywords: ['tonic', 'tonic water', 'indian tonic'] },
      { symbol: 'Gb', name: 'Ginger Beer', group: 'carbonation', atomicNumber: 98, keywords: ['ginger beer'] },
      { symbol: 'Cl', name: 'Cola', group: 'carbonation', atomicNumber: 99, keywords: ['cola', 'coke', 'coca-cola', 'pepsi'] },
      { symbol: 'Cr', name: 'Cream', group: 'dairy', atomicNumber: 100, keywords: ['cream', 'heavy cream', 'whipping cream', 'half and half'] },
      { symbol: 'Ew', name: 'Egg White', group: 'dairy', atomicNumber: 101, keywords: ['egg white', 'aquafaba'] },
      { symbol: 'Ey', name: 'Egg Yolk', group: 'dairy', atomicNumber: 102, keywords: ['egg yolk', 'yolk'] },
      { symbol: 'Ml', name: 'Milk', group: 'dairy', atomicNumber: 103, keywords: ['milk', 'whole milk', 'oat milk'] },
      { symbol: 'Nc', name: 'Coconut Cream', group: 'dairy', atomicNumber: 104, keywords: ['coconut cream', 'cream of coconut', 'coco lopez', 'coconut milk'] },
      { symbol: 'Sp', name: 'Sparkling Wine', group: 'grape', atomicNumber: 105, keywords: ['champagne', 'prosecco', 'cava', 'sparkling wine', 'cremant'] },
      // Hidden (appear when user adds matching inventory)
      { symbol: 'Ge', name: 'Ginger Ale', group: 'carbonation', atomicNumber: 106, keywords: ['ginger ale'], hidden: true },
      { symbol: 'Cw', name: 'Coconut Water', group: 'carbonation', atomicNumber: 107, keywords: ['coconut water'], hidden: true },
      { symbol: 'Bx', name: 'Beer', group: 'grain', atomicNumber: 108, keywords: ['beer', 'lager', 'ale', 'ipa', 'stout', 'pilsner'], hidden: true },
      { symbol: 'Wn', name: 'Wine', group: 'grape', atomicNumber: 109, keywords: ['wine', 'red wine', 'white wine', 'rosé', 'rose wine'], hidden: true },
      { symbol: 'Es', name: 'Espresso', group: 'botanical', atomicNumber: 110, keywords: ['espresso', 'coffee', 'cold brew'], hidden: true },
      { symbol: 'Te', name: 'Tea', group: 'botanical', atomicNumber: 111, keywords: ['tea', 'black tea', 'green tea', 'earl grey', 'chai'], hidden: true },
    ],
  },
  {
    title: 'GARNISHES',
    elements: [
      // Always visible (most common garnish)
      { symbol: 'Mt', name: 'Fresh Mint', group: 'garnish', atomicNumber: 112, keywords: ['mint', 'fresh mint', 'spearmint', 'peppermint'] },
      // Hidden (appear when user adds matching inventory)
      { symbol: 'Bs', name: 'Fresh Basil', group: 'garnish', atomicNumber: 113, keywords: ['basil', 'fresh basil', 'thai basil'], hidden: true },
      { symbol: 'Ro', name: 'Rosemary', group: 'garnish', atomicNumber: 114, keywords: ['rosemary', 'fresh rosemary'], hidden: true },
      { symbol: 'Th', name: 'Thyme', group: 'garnish', atomicNumber: 115, keywords: ['thyme', 'fresh thyme'], hidden: true },
      { symbol: 'Cu', name: 'Cucumber', group: 'garnish', atomicNumber: 116, keywords: ['cucumber'], hidden: true },
      { symbol: 'Jp', name: 'Jalapeño', group: 'garnish', atomicNumber: 117, keywords: ['jalapeno', 'jalapeño', 'chili', 'chile', 'habanero'], hidden: true },
      { symbol: 'Ov', name: 'Olives', group: 'garnish', atomicNumber: 118, keywords: ['olive', 'olives', 'cocktail olive'], hidden: true },
      { symbol: 'Mc', name: 'Maraschino Cherry', group: 'garnish', atomicNumber: 119, keywords: ['maraschino cherry', 'luxardo cherry', 'brandied cherry', 'cocktail cherry'], hidden: true },
      { symbol: 'Tw', name: 'Citrus Twist', group: 'garnish', atomicNumber: 120, keywords: ['twist', 'peel', 'zest', 'orange peel', 'lemon peel', 'lemon twist', 'orange twist'], hidden: true },
      { symbol: 'Sr', name: 'Salt Rim', group: 'garnish', atomicNumber: 121, keywords: ['salt rim', 'tajin', 'li hing mui', 'rimming salt'], hidden: true },
      { symbol: 'Sx', name: 'Sugar Rim', group: 'garnish', atomicNumber: 122, keywords: ['sugar rim'], hidden: true },
      { symbol: 'Nb', name: 'Nutmeg', group: 'garnish', atomicNumber: 123, keywords: ['nutmeg', 'fresh nutmeg', 'grated nutmeg'], hidden: true },
    ],
  },
];

/**
 * Flat array of all elements for easier searching
 */
export const ALL_ELEMENTS: PeriodicElement[] = PERIODIC_SECTIONS.flatMap(
  (section) => section.elements
);

/**
 * Find elements that match a user's inventory item
 * Uses whole-word matching to prevent false positives
 * @param itemName The name or type of the inventory item
 * @returns Matching elements or empty array
 */
export function findMatchingElements(itemName: string): PeriodicElement[] {
  const searchTerm = itemName.toLowerCase().trim();

  return ALL_ELEMENTS.filter((element) => {
    // Check if element name matches as a whole word in the search term
    if (matchesWholeWord(searchTerm, element.name.toLowerCase())) {
      return true;
    }

    // Check if any keywords match as whole words in the search term
    if (element.keywords?.some((keyword) => matchesWholeWord(searchTerm, keyword))) {
      return true;
    }

    return false;
  });
}

/**
 * Get element by symbol
 */
export function getElementBySymbol(symbol: string): PeriodicElement | undefined {
  return ALL_ELEMENTS.find((el) => el.symbol.toLowerCase() === symbol.toLowerCase());
}

/**
 * Get all elements in a specific group
 */
export function getElementsByGroup(group: ElementGroup): PeriodicElement[] {
  return ALL_ELEMENTS.filter((el) => el.group === group);
}

/**
 * Helper to check if an item is in stock
 */
function isInStock(item: { stock_number?: number }): boolean {
  // If stock_number is undefined, assume it's in stock (legacy items)
  // If stock_number is 0 or negative, it's out of stock
  return item.stock_number === undefined || item.stock_number > 0;
}

/**
 * Check if a keyword matches as a whole word in the text
 * Prevents "gin" from matching "ginger" or "alambique serrano single cask"
 */
function matchesWholeWord(text: string, keyword: string): boolean {
  // Create a regex that matches the keyword as a whole word
  // \b matches word boundaries (start/end of string, spaces, punctuation)
  const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
  return regex.test(text);
}

/**
 * Exclusion rules to prevent false positives
 * Maps element symbols to keywords that should NOT match
 * e.g., "ginger beer" should match Ginger Beer (Gb), not Beer (Bx)
 */
const ELEMENT_EXCLUSIONS: Record<string, string[]> = {
  'Bx': ['ginger beer', 'root beer'],  // Beer should not match ginger beer or root beer
  'Gn': ['sloe gin'],  // Gin should not match sloe gin (it has its own element)
};

/**
 * Check if an item matches an element (by name or keywords)
 * Uses whole-word matching to prevent false positives like "ginger" matching "gin"
 */
function itemMatchesElement(
  item: { name: string; type?: string },
  element: PeriodicElement
): boolean {
  const itemText = `${item.name} ${item.type || ''}`.toLowerCase();

  // Check exclusions first - if item matches an exclusion pattern, don't match this element
  const exclusions = ELEMENT_EXCLUSIONS[element.symbol];
  if (exclusions?.some((exclusion) => itemText.includes(exclusion))) {
    return false;
  }

  // Check element name (whole word match)
  if (matchesWholeWord(itemText, element.name.toLowerCase())) {
    return true;
  }

  // Check keywords (whole word match)
  return element.keywords?.some((keyword) => matchesWholeWord(itemText, keyword)) ?? false;
}

/**
 * Check if inventory items exist for an element category
 * @param element The periodic element
 * @param inventoryItems Array of user's inventory items (need name, type, and stock_number fields)
 * @returns true if user has at least one matching item IN STOCK
 */
export function hasInventoryForElement(
  element: PeriodicElement,
  inventoryItems: Array<{ name: string; type?: string; stock_number?: number }>
): boolean {
  return inventoryItems.some((item) => {
    // Skip items that are out of stock
    if (!isInStock(item)) {
      return false;
    }
    return itemMatchesElement(item, element);
  });
}

/**
 * Count inventory items for an element category (only counts in-stock items)
 */
export function countInventoryForElement(
  element: PeriodicElement,
  inventoryItems: Array<{ name: string; type?: string; stock_number?: number }>
): number {
  return inventoryItems.filter((item) => {
    // Skip items that are out of stock
    if (!isInStock(item)) {
      return false;
    }
    return itemMatchesElement(item, element);
  }).length;
}

/**
 * Get all inventory items that match an element (only in-stock items)
 */
export function getInventoryForElement(
  element: PeriodicElement,
  inventoryItems: Array<{ name: string; type?: string; stock_number?: number }>
): Array<{ name: string; type?: string; stock_number?: number }> {
  return inventoryItems.filter((item) => {
    // Skip items that are out of stock
    if (!isInStock(item)) {
      return false;
    }
    return itemMatchesElement(item, element);
  });
}
