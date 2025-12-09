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
  | 'carbonation'; // Silver - Soda, Tonic

export interface PeriodicElement {
  symbol: string;
  name: string;
  group: ElementGroup;
  atomicNumber: number;
  keywords?: string[]; // For matching user inventory items
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
};

/**
 * All periodic table elements organized by section
 */
export const PERIODIC_SECTIONS: ElementSection[] = [
  {
    title: 'BASE SPIRITS',
    elements: [
      { symbol: 'Rm', name: 'Rum', group: 'cane', atomicNumber: 1, keywords: ['rum', 'white rum', 'dark rum', 'spiced rum', 'aged rum', 'overproof'] },
      { symbol: 'Ra', name: 'Rhum Agricole', group: 'cane', atomicNumber: 2, keywords: ['rhum agricole', 'agricole', 'martinique'] },
      { symbol: 'Cc', name: 'Cachaça', group: 'cane', atomicNumber: 3, keywords: ['cachaca', 'cachaça'] },
      { symbol: 'Vd', name: 'Vodka', group: 'neutral', atomicNumber: 4, keywords: ['vodka'] },
      { symbol: 'Gn', name: 'Gin', group: 'juniper', atomicNumber: 5, keywords: ['gin', 'london dry', 'old tom', 'navy strength'] },
      { symbol: 'Wh', name: 'Whiskey', group: 'grain', atomicNumber: 6, keywords: ['whiskey', 'whisky', 'irish whiskey'] },
      { symbol: 'Bb', name: 'Bourbon', group: 'grain', atomicNumber: 7, keywords: ['bourbon'] },
      { symbol: 'Ry', name: 'Rye', group: 'grain', atomicNumber: 8, keywords: ['rye', 'rye whiskey'] },
      { symbol: 'Sc', name: 'Scotch', group: 'grain', atomicNumber: 9, keywords: ['scotch', 'single malt', 'blended scotch', 'islay'] },
      { symbol: 'Tq', name: 'Tequila', group: 'agave', atomicNumber: 10, keywords: ['tequila', 'blanco', 'reposado', 'añejo', 'anejo'] },
      { symbol: 'Mz', name: 'Mezcal', group: 'agave', atomicNumber: 11, keywords: ['mezcal', 'mescal'] },
      { symbol: 'Br', name: 'Brandy', group: 'grape', atomicNumber: 12, keywords: ['brandy', 'apple brandy', 'pear brandy'] },
      { symbol: 'Cg', name: 'Cognac', group: 'grape', atomicNumber: 13, keywords: ['cognac', 'vs', 'vsop', 'xo'] },
      { symbol: 'Ps', name: 'Pisco', group: 'grape', atomicNumber: 14, keywords: ['pisco'] },
    ],
  },
  {
    title: 'LIQUEURS',
    elements: [
      { symbol: 'Ol', name: 'Orange Liqueur', group: 'sugar', atomicNumber: 15, keywords: ['orange liqueur', 'triple sec', 'cointreau', 'grand marnier', 'curacao', 'curaçao'] },
      { symbol: 'Cf', name: 'Coffee Liqueur', group: 'sugar', atomicNumber: 16, keywords: ['coffee liqueur', 'kahlua', 'mr black', 'espresso liqueur'] },
      { symbol: 'Am', name: 'Amaretto', group: 'sugar', atomicNumber: 17, keywords: ['amaretto', 'almond liqueur'] },
      { symbol: 'Bn', name: 'Banana Liqueur', group: 'sugar', atomicNumber: 18, keywords: ['banana liqueur', 'creme de banane'] },
      { symbol: 'Ms', name: 'Maraschino', group: 'sugar', atomicNumber: 19, keywords: ['maraschino', 'luxardo'] },
      { symbol: 'El', name: 'Elderflower', group: 'sugar', atomicNumber: 20, keywords: ['elderflower', 'st germain', 'st. germain'] },
      { symbol: 'Cs', name: 'Crème de Cassis', group: 'sugar', atomicNumber: 21, keywords: ['cassis', 'creme de cassis', 'crème de cassis', 'blackcurrant'] },
      { symbol: 'Co', name: 'Crème de Cacao', group: 'sugar', atomicNumber: 22, keywords: ['cacao', 'creme de cacao', 'crème de cacao', 'chocolate liqueur'] },
      { symbol: 'Cv', name: 'Crème de Violette', group: 'sugar', atomicNumber: 23, keywords: ['violette', 'creme de violette', 'crème de violette', 'violet liqueur'] },
      { symbol: 'Mn', name: 'Crème de Menthe', group: 'sugar', atomicNumber: 24, keywords: ['menthe', 'creme de menthe', 'crème de menthe', 'mint liqueur'] },
    ],
  },
  {
    title: 'CITRUS & ACIDS',
    elements: [
      { symbol: 'Li', name: 'Lime', group: 'acid', atomicNumber: 25, keywords: ['lime', 'lime juice', 'fresh lime'] },
      { symbol: 'Le', name: 'Lemon', group: 'acid', atomicNumber: 26, keywords: ['lemon', 'lemon juice', 'fresh lemon'] },
      { symbol: 'Or', name: 'Orange', group: 'acid', atomicNumber: 27, keywords: ['orange', 'orange juice', 'fresh orange'] },
      { symbol: 'Gf', name: 'Grapefruit', group: 'acid', atomicNumber: 28, keywords: ['grapefruit', 'grapefruit juice'] },
      { symbol: 'Pi', name: 'Pineapple', group: 'acid', atomicNumber: 29, keywords: ['pineapple', 'pineapple juice'] },
      { symbol: 'Pf', name: 'Passion Fruit', group: 'acid', atomicNumber: 30, keywords: ['passion fruit', 'passionfruit', 'passion fruit puree'] },
    ],
  },
  {
    title: 'SWEETENERS',
    elements: [
      { symbol: 'Ss', name: 'Simple Syrup', group: 'sugar', atomicNumber: 31, keywords: ['simple syrup', 'sugar syrup', '1:1 syrup', '2:1 syrup'] },
      { symbol: 'Hn', name: 'Honey', group: 'sugar', atomicNumber: 32, keywords: ['honey', 'honey syrup'] },
      { symbol: 'Av', name: 'Agave', group: 'sugar', atomicNumber: 33, keywords: ['agave', 'agave nectar', 'agave syrup'] },
      { symbol: 'Gr', name: 'Grenadine', group: 'sugar', atomicNumber: 34, keywords: ['grenadine', 'pomegranate syrup'] },
      { symbol: 'Og', name: 'Orgeat', group: 'sugar', atomicNumber: 35, keywords: ['orgeat', 'almond syrup'] },
      { symbol: 'Dm', name: 'Demerara', group: 'sugar', atomicNumber: 36, keywords: ['demerara', 'demerara syrup', 'brown sugar syrup'] },
      { symbol: 'Ma', name: 'Maple', group: 'sugar', atomicNumber: 37, keywords: ['maple', 'maple syrup'] },
      { symbol: 'Cn', name: 'Cinnamon', group: 'sugar', atomicNumber: 38, keywords: ['cinnamon syrup', 'cinnamon'] },
    ],
  },
  {
    title: 'BITTERS & BOTANICALS',
    elements: [
      { symbol: 'An', name: 'Angostura', group: 'botanical', atomicNumber: 39, keywords: ['angostura', 'angostura bitters', 'aromatic bitters'] },
      { symbol: 'Ob', name: 'Orange Bitters', group: 'botanical', atomicNumber: 40, keywords: ['orange bitters', 'regans orange'] },
      { symbol: 'Py', name: "Peychaud's", group: 'botanical', atomicNumber: 41, keywords: ['peychauds', "peychaud's", 'peychaud'] },
      { symbol: 'Cp', name: 'Campari', group: 'botanical', atomicNumber: 42, keywords: ['campari'] },
      { symbol: 'Ap', name: 'Aperol', group: 'botanical', atomicNumber: 43, keywords: ['aperol'] },
      { symbol: 'Sv', name: 'Sweet Vermouth', group: 'botanical', atomicNumber: 44, keywords: ['sweet vermouth', 'vermouth rosso', 'carpano', 'antica formula'] },
      { symbol: 'Dv', name: 'Dry Vermouth', group: 'botanical', atomicNumber: 45, keywords: ['dry vermouth', 'vermouth dry', 'dolin dry', 'noilly prat'] },
      { symbol: 'Fe', name: 'Fernet', group: 'botanical', atomicNumber: 46, keywords: ['fernet', 'fernet branca', 'fernet-branca'] },
      { symbol: 'Ab', name: 'Absinthe', group: 'botanical', atomicNumber: 47, keywords: ['absinthe', 'pastis', 'pernod'] },
    ],
  },
  {
    title: 'MIXERS & OTHER',
    elements: [
      { symbol: 'Sw', name: 'Soda Water', group: 'carbonation', atomicNumber: 48, keywords: ['soda', 'soda water', 'club soda', 'sparkling water', 'seltzer'] },
      { symbol: 'Tn', name: 'Tonic', group: 'carbonation', atomicNumber: 49, keywords: ['tonic', 'tonic water', 'indian tonic'] },
      { symbol: 'Gb', name: 'Ginger Beer', group: 'carbonation', atomicNumber: 50, keywords: ['ginger beer', 'ginger ale'] },
      { symbol: 'Cl', name: 'Cola', group: 'carbonation', atomicNumber: 51, keywords: ['cola', 'coke', 'coca-cola'] },
      { symbol: 'Cr', name: 'Cream', group: 'dairy', atomicNumber: 52, keywords: ['cream', 'heavy cream', 'whipping cream', 'half and half'] },
      { symbol: 'Ew', name: 'Egg White', group: 'dairy', atomicNumber: 53, keywords: ['egg white', 'egg', 'aquafaba'] },
      { symbol: 'Ey', name: 'Egg Yolk', group: 'dairy', atomicNumber: 54, keywords: ['egg yolk', 'yolk'] },
      { symbol: 'Ml', name: 'Milk', group: 'dairy', atomicNumber: 55, keywords: ['milk', 'whole milk', 'coconut milk', 'oat milk'] },
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
 * @param itemName The name or type of the inventory item
 * @returns Matching elements or empty array
 */
export function findMatchingElements(itemName: string): PeriodicElement[] {
  const searchTerm = itemName.toLowerCase().trim();

  return ALL_ELEMENTS.filter((element) => {
    // Check if element name matches
    if (element.name.toLowerCase().includes(searchTerm)) {
      return true;
    }

    // Check if any keywords match
    if (element.keywords?.some((keyword) =>
      searchTerm.includes(keyword) || keyword.includes(searchTerm)
    )) {
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
 * Check if inventory items exist for an element category
 * @param element The periodic element
 * @param inventoryItems Array of user's inventory items (need name and type fields)
 * @returns true if user has at least one matching item
 */
export function hasInventoryForElement(
  element: PeriodicElement,
  inventoryItems: Array<{ name: string; type?: string }>
): boolean {
  return inventoryItems.some((item) => {
    const itemText = `${item.name} ${item.type || ''}`.toLowerCase();

    // Check element name
    if (itemText.includes(element.name.toLowerCase())) {
      return true;
    }

    // Check keywords
    return element.keywords?.some((keyword) => itemText.includes(keyword)) ?? false;
  });
}

/**
 * Count inventory items for an element category
 */
export function countInventoryForElement(
  element: PeriodicElement,
  inventoryItems: Array<{ name: string; type?: string }>
): number {
  return inventoryItems.filter((item) => {
    const itemText = `${item.name} ${item.type || ''}`.toLowerCase();

    if (itemText.includes(element.name.toLowerCase())) {
      return true;
    }

    return element.keywords?.some((keyword) => itemText.includes(keyword)) ?? false;
  }).length;
}
