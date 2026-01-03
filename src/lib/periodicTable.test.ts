import { describe, it, expect } from 'vitest';
import {
  PERIODIC_SECTIONS,
  ALL_ELEMENTS,
  GROUP_COLORS,
  findMatchingElements,
  getElementBySymbol,
  getElementsByGroup,
  itemMatchesElement,
  hasInventoryForElement,
  countInventoryForElement,
  getInventoryForElement,
  elementToAddModalPreFill,
  ElementGroup,
} from './periodicTable';

describe('periodicTable utility', () => {
  describe('data structure', () => {
    it('should have all expected sections', () => {
      const sectionTitles = PERIODIC_SECTIONS.map((s) => s.title);
      expect(sectionTitles).toContain('BASE SPIRITS');
      expect(sectionTitles).toContain('LIQUEURS');
      expect(sectionTitles).toContain('CITRUS & ACIDS');
      expect(sectionTitles).toContain('SWEETENERS');
      expect(sectionTitles).toContain('BITTERS & BOTANICALS');
      expect(sectionTitles).toContain('MIXERS & OTHER');
      expect(sectionTitles).toContain('GARNISHES');
    });

    it('should have unique atomic numbers', () => {
      const atomicNumbers = ALL_ELEMENTS.map((el) => el.atomicNumber);
      const uniqueNumbers = new Set(atomicNumbers);
      expect(uniqueNumbers.size).toBe(atomicNumbers.length);
    });

    it('should have mostly unique symbols (some duplicates expected for related elements)', () => {
      const symbols = ALL_ELEMENTS.map((el) => el.symbol);
      const uniqueSymbols = new Set(symbols);
      // Some symbols are intentionally reused (e.g., Sg for Sloe Gin and Sage, Lv for Lavender syrup and garnish)
      // We expect at least 95% unique symbols
      expect(uniqueSymbols.size).toBeGreaterThan(symbols.length * 0.95);
    });

    it('should have valid groups for all elements', () => {
      const validGroups: ElementGroup[] = [
        'agave', 'grain', 'cane', 'juniper', 'grape', 'neutral',
        'botanical', 'acid', 'sugar', 'dairy', 'carbonation', 'garnish',
      ];
      ALL_ELEMENTS.forEach((el) => {
        expect(validGroups).toContain(el.group);
      });
    });
  });

  describe('GROUP_COLORS', () => {
    it('should have colors for all element groups', () => {
      const groups: ElementGroup[] = [
        'agave', 'grain', 'cane', 'juniper', 'grape', 'neutral',
        'botanical', 'acid', 'sugar', 'dairy', 'carbonation', 'garnish',
      ];
      groups.forEach((group) => {
        expect(GROUP_COLORS[group]).toBeDefined();
        expect(GROUP_COLORS[group]).toContain('var(--bond-');
      });
    });
  });

  describe('findMatchingElements', () => {
    it('should find elements by exact name', () => {
      const results = findMatchingElements('rum');
      expect(results.some((el) => el.symbol === 'Rm')).toBe(true);
    });

    it('should find elements by keyword', () => {
      const results = findMatchingElements('bourbon');
      expect(results.some((el) => el.symbol === 'Bb')).toBe(true);
    });

    it('should be case-insensitive', () => {
      const lower = findMatchingElements('vodka');
      const upper = findMatchingElements('VODKA');
      expect(lower).toEqual(upper);
    });

    it('should use whole-word matching', () => {
      // "gin" should not match "ginger"
      const ginResults = findMatchingElements('ginger');
      expect(ginResults.some((el) => el.symbol === 'Gn')).toBe(false);
    });

    it('should return empty array for no matches', () => {
      const results = findMatchingElements('xyznonexistent');
      expect(results).toHaveLength(0);
    });
  });

  describe('getElementBySymbol', () => {
    it('should find elements by symbol', () => {
      const rum = getElementBySymbol('Rm');
      expect(rum).toBeDefined();
      expect(rum?.name).toBe('Rum');
    });

    it('should be case-insensitive', () => {
      const lower = getElementBySymbol('rm');
      const upper = getElementBySymbol('RM');
      expect(lower).toEqual(upper);
    });

    it('should return undefined for invalid symbols', () => {
      const result = getElementBySymbol('XX');
      expect(result).toBeUndefined();
    });
  });

  describe('getElementsByGroup', () => {
    it('should return all elements in a group', () => {
      const grainElements = getElementsByGroup('grain');
      expect(grainElements.length).toBeGreaterThan(0);
      grainElements.forEach((el) => {
        expect(el.group).toBe('grain');
      });
    });

    it('should include expected elements in grain group', () => {
      const grainElements = getElementsByGroup('grain');
      const symbols = grainElements.map((el) => el.symbol);
      expect(symbols).toContain('Wh'); // Whiskey
      expect(symbols).toContain('Bb'); // Bourbon
      expect(symbols).toContain('Ry'); // Rye
      expect(symbols).toContain('Sc'); // Scotch
    });

    it('should return empty array for non-existent group', () => {
      const results = getElementsByGroup('nonexistent' as ElementGroup);
      expect(results).toHaveLength(0);
    });
  });

  describe('itemMatchesElement', () => {
    const ginElement = ALL_ELEMENTS.find((el) => el.symbol === 'Gn')!;
    const beerElement = ALL_ELEMENTS.find((el) => el.symbol === 'Bx')!;
    const rumElement = ALL_ELEMENTS.find((el) => el.symbol === 'Rm')!;

    it('should match items by name keyword', () => {
      expect(itemMatchesElement({ name: 'Tanqueray Gin' }, ginElement)).toBe(true);
      expect(itemMatchesElement({ name: 'Beefeater London Dry Gin' }, ginElement)).toBe(true);
    });

    it('should match items by type', () => {
      expect(itemMatchesElement({ name: 'Tanqueray', type: 'Gin' }, ginElement)).toBe(true);
    });

    it('should NOT match ginger beer to gin (whole word matching)', () => {
      expect(itemMatchesElement({ name: 'Ginger Beer' }, ginElement)).toBe(false);
      expect(itemMatchesElement({ name: 'Fever Tree Ginger Beer' }, ginElement)).toBe(false);
    });

    it('should NOT match ginger beer to beer (exclusion rule)', () => {
      expect(itemMatchesElement({ name: 'Ginger Beer' }, beerElement)).toBe(false);
    });

    it('should match specific rum variants', () => {
      expect(itemMatchesElement({ name: 'Bacardi White Rum' }, rumElement)).toBe(true);
      expect(itemMatchesElement({ name: 'Dark Rum' }, rumElement)).toBe(true);
      expect(itemMatchesElement({ name: 'Overproof Rum' }, rumElement)).toBe(true);
    });

    it('should be case-insensitive', () => {
      expect(itemMatchesElement({ name: 'TANQUERAY GIN' }, ginElement)).toBe(true);
      expect(itemMatchesElement({ name: 'tanqueray gin' }, ginElement)).toBe(true);
    });
  });

  describe('hasInventoryForElement', () => {
    const ginElement = ALL_ELEMENTS.find((el) => el.symbol === 'Gn')!;

    it('should return true if user has matching inventory in stock', () => {
      const inventory = [
        { name: 'Tanqueray Gin', stock_number: 1 },
        { name: 'Vodka', stock_number: 2 },
      ];
      expect(hasInventoryForElement(ginElement, inventory)).toBe(true);
    });

    it('should return false if no matching inventory', () => {
      const inventory = [
        { name: 'Vodka', stock_number: 1 },
        { name: 'Rum', stock_number: 1 },
      ];
      expect(hasInventoryForElement(ginElement, inventory)).toBe(false);
    });

    it('should return true even if matching item is out of stock (item exists in inventory)', () => {
      const inventory = [
        { name: 'Tanqueray Gin', stock_number: 0 },
      ];
      // Items with stock=0 are still "owned" - they just need restocking
      expect(hasInventoryForElement(ginElement, inventory)).toBe(true);
    });

    it('should treat undefined stock_number as in stock (legacy items)', () => {
      const inventory = [
        { name: 'Tanqueray Gin' }, // no stock_number
      ];
      expect(hasInventoryForElement(ginElement, inventory)).toBe(true);
    });
  });

  describe('countInventoryForElement', () => {
    const rumElement = ALL_ELEMENTS.find((el) => el.symbol === 'Rm')!;

    it('should return total stock sum for matching items', () => {
      const inventory = [
        { name: 'Bacardi White Rum', stock_number: 1 },
        { name: 'Dark Rum', stock_number: 2 },
        { name: 'Vodka', stock_number: 1 },
      ];
      // Returns sum of stock_number (1 + 2 = 3)
      expect(countInventoryForElement(rumElement, inventory)).toBe(3);
    });

    it('should include zero-stock items in count (returns 0 for them)', () => {
      const inventory = [
        { name: 'Bacardi White Rum', stock_number: 1 },
        { name: 'Dark Rum', stock_number: 0 },
      ];
      // Returns sum: 1 + 0 = 1
      expect(countInventoryForElement(rumElement, inventory)).toBe(1);
    });

    it('should return 0 for no matches', () => {
      const inventory = [
        { name: 'Vodka', stock_number: 1 },
      ];
      expect(countInventoryForElement(rumElement, inventory)).toBe(0);
    });
  });

  describe('getInventoryForElement', () => {
    const vodkaElement = ALL_ELEMENTS.find((el) => el.symbol === 'Vd')!;

    it('should return matching in-stock items', () => {
      const inventory = [
        { name: 'Grey Goose Vodka', stock_number: 1 },
        { name: 'Titos Vodka', stock_number: 2 },
        { name: 'Gin', stock_number: 1 },
      ];
      const result = getInventoryForElement(vodkaElement, inventory);
      expect(result).toHaveLength(2);
      expect(result.map((i) => i.name)).toContain('Grey Goose Vodka');
      expect(result.map((i) => i.name)).toContain('Titos Vodka');
    });

    it('should include zero-stock items (they exist in inventory)', () => {
      const inventory = [
        { name: 'Grey Goose Vodka', stock_number: 0 },
        { name: 'Titos Vodka', stock_number: 1 },
      ];
      const result = getInventoryForElement(vodkaElement, inventory);
      // Both items are returned - zero-stock items are still "owned"
      expect(result).toHaveLength(2);
      expect(result.map((i) => i.name)).toContain('Grey Goose Vodka');
      expect(result.map((i) => i.name)).toContain('Titos Vodka');
    });
  });

  describe('elementToAddModalPreFill', () => {
    it('should return spirit category for base spirit elements', () => {
      const rumElement = ALL_ELEMENTS.find((el) => el.symbol === 'Rm')!;
      const result = elementToAddModalPreFill(rumElement);
      expect(result.category).toBe('spirit');
      expect(result.name).toBe('Rum');
      expect(result.periodic_group).toBe('Base');
      expect(result.periodic_period).toBe('Cane');
    });

    it('should return liqueur category for sugar group elements', () => {
      const orangeLiqueurElement = ALL_ELEMENTS.find((el) => el.symbol === 'Ol')!;
      const result = elementToAddModalPreFill(orangeLiqueurElement);
      expect(result.category).toBe('liqueur');
      expect(result.periodic_group).toBe('Sweetener');
    });

    it('should return garnish category for garnish group elements', () => {
      const mintElement = ALL_ELEMENTS.find((el) => el.symbol === 'Mt')!;
      const result = elementToAddModalPreFill(mintElement);
      expect(result.category).toBe('garnish');
      expect(result.periodic_period).toBe('Botanic');
    });

    it('should return mixer category for carbonation elements', () => {
      const sodaElement = ALL_ELEMENTS.find((el) => el.symbol === 'Sw')!;
      const result = elementToAddModalPreFill(sodaElement);
      expect(result.category).toBe('mixer');
      expect(result.periodic_group).toBe('Catalyst');
    });

    it('should return pantry category for dairy elements', () => {
      const creamElement = ALL_ELEMENTS.find((el) => el.symbol === 'Cr')!;
      const result = elementToAddModalPreFill(creamElement);
      expect(result.category).toBe('pantry');
      expect(result.periodic_group).toBe('Bridge');
    });

    it('should return liqueur category for botanical elements like Campari', () => {
      const campariElement = ALL_ELEMENTS.find((el) => el.symbol === 'Cp')!;
      const result = elementToAddModalPreFill(campariElement);
      expect(result.category).toBe('liqueur');
      expect(result.periodic_group).toBe('Modifier');
    });

    it('should return bitters category for bitters elements', () => {
      const angosturaElement = ALL_ELEMENTS.find((el) => el.symbol === 'An')!;
      const result = elementToAddModalPreFill(angosturaElement);
      expect(result.category).toBe('bitters');

      const orangeBittersElement = ALL_ELEMENTS.find((el) => el.symbol === 'Ob')!;
      expect(elementToAddModalPreFill(orangeBittersElement).category).toBe('bitters');

      const peychaudsElement = ALL_ELEMENTS.find((el) => el.symbol === 'Py')!;
      expect(elementToAddModalPreFill(peychaudsElement).category).toBe('bitters');
    });

    it('should return wine category for vermouths and fortified wines', () => {
      const sweetVermouthElement = ALL_ELEMENTS.find((el) => el.symbol === 'Sv')!;
      expect(elementToAddModalPreFill(sweetVermouthElement).category).toBe('wine');

      const dryVermouthElement = ALL_ELEMENTS.find((el) => el.symbol === 'Dv')!;
      expect(elementToAddModalPreFill(dryVermouthElement).category).toBe('wine');

      const lilletElement = ALL_ELEMENTS.find((el) => el.symbol === 'Lt')!;
      expect(elementToAddModalPreFill(lilletElement).category).toBe('wine');

      const sparklingWineElement = ALL_ELEMENTS.find((el) => el.symbol === 'Sp')!;
      expect(elementToAddModalPreFill(sparklingWineElement).category).toBe('wine');
    });

    it('should return beer category for beer element', () => {
      const beerElement = ALL_ELEMENTS.find((el) => el.symbol === 'Bx')!;
      const result = elementToAddModalPreFill(beerElement);
      expect(result.category).toBe('beer');
    });

    it('should return pantry category for espresso and tea', () => {
      const espressoElement = ALL_ELEMENTS.find((el) => el.symbol === 'Es')!;
      expect(elementToAddModalPreFill(espressoElement).category).toBe('pantry');

      const teaElement = ALL_ELEMENTS.find((el) => el.symbol === 'Te')!;
      expect(elementToAddModalPreFill(teaElement).category).toBe('pantry');
    });

    it('should return liqueur category for Irish Cream despite dairy group', () => {
      const irishCreamElement = ALL_ELEMENTS.find((el) => el.symbol === 'Ic')!;
      const result = elementToAddModalPreFill(irishCreamElement);
      expect(result.category).toBe('liqueur');
    });

    it('should map grain group to correct periodic properties', () => {
      const bourbonElement = ALL_ELEMENTS.find((el) => el.symbol === 'Bb')!;
      const result = elementToAddModalPreFill(bourbonElement);
      expect(result.periodic_group).toBe('Base');
      expect(result.periodic_period).toBe('Grain');
    });

    it('should map agave group to correct periodic properties', () => {
      const tequilaElement = ALL_ELEMENTS.find((el) => el.symbol === 'Tq')!;
      const result = elementToAddModalPreFill(tequilaElement);
      expect(result.periodic_group).toBe('Base');
      expect(result.periodic_period).toBe('Agave');
    });

    it('should map grape group to correct periodic properties', () => {
      const cognacElement = ALL_ELEMENTS.find((el) => el.symbol === 'Cg')!;
      const result = elementToAddModalPreFill(cognacElement);
      expect(result.periodic_group).toBe('Base');
      expect(result.periodic_period).toBe('Grape');
    });
  });

  describe('element exclusions', () => {
    it('should not match "demerara rum" to Demerara syrup element', () => {
      const demeraraElement = ALL_ELEMENTS.find((el) => el.symbol === 'Dm')!;
      expect(itemMatchesElement({ name: 'Demerara Rum' }, demeraraElement)).toBe(false);
      expect(itemMatchesElement({ name: 'Demerara Overproof' }, demeraraElement)).toBe(false);
    });

    it('should not match "sloe gin" to Gin element', () => {
      const ginElement = ALL_ELEMENTS.find((el) => el.symbol === 'Gn')!;
      expect(itemMatchesElement({ name: 'Sloe Gin' }, ginElement)).toBe(false);
    });

    it('should not match "orange bitters" to Orange (citrus) element', () => {
      const orangeElement = ALL_ELEMENTS.find((el) => el.symbol === 'Or')!;
      expect(itemMatchesElement({ name: 'Orange Bitters' }, orangeElement)).toBe(false);
    });

    it('should not match "orange liqueur" to Orange (citrus) element', () => {
      const orangeElement = ALL_ELEMENTS.find((el) => el.symbol === 'Or')!;
      expect(itemMatchesElement({ name: 'Orange Liqueur' }, orangeElement)).toBe(false);
      expect(itemMatchesElement({ name: 'Triple Sec' }, orangeElement)).toBe(false);
    });
  });

  describe('hidden elements', () => {
    it('should mark rare/specialty elements as hidden', () => {
      const japaneseWhisky = ALL_ELEMENTS.find((el) => el.symbol === 'Jw');
      expect(japaneseWhisky?.hidden).toBe(true);

      const aquavit = ALL_ELEMENTS.find((el) => el.symbol === 'Aq');
      expect(aquavit?.hidden).toBe(true);
    });

    it('should NOT mark common elements as hidden', () => {
      const rum = ALL_ELEMENTS.find((el) => el.symbol === 'Rm');
      expect(rum?.hidden).toBeFalsy();

      const gin = ALL_ELEMENTS.find((el) => el.symbol === 'Gn');
      expect(gin?.hidden).toBeFalsy();
    });
  });
});
