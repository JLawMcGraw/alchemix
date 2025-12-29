import { describe, it, expect } from 'vitest';
import {
  CATEGORY_COLORS,
  SPIRIT_COLORS,
  SPIRIT_KEYWORDS,
  GROUP_COLORS,
  GROUP_COLORS_DARK,
  PERIOD_COLORS,
  PERIOD_COLORS_DARK,
  getSpiritColorFromIngredients,
  detectSpiritTypes,
} from './colors';

describe('colors utility', () => {
  describe('CATEGORY_COLORS', () => {
    it('should have colors for all main categories', () => {
      expect(CATEGORY_COLORS.spirit).toBeDefined();
      expect(CATEGORY_COLORS.liqueur).toBeDefined();
      expect(CATEGORY_COLORS.mixer).toBeDefined();
      expect(CATEGORY_COLORS.syrup).toBeDefined();
      expect(CATEGORY_COLORS.garnish).toBeDefined();
      expect(CATEGORY_COLORS.wine).toBeDefined();
      expect(CATEGORY_COLORS.beer).toBeDefined();
    });

    it('should have valid hex color format', () => {
      Object.values(CATEGORY_COLORS).forEach(color => {
        expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      });
    });
  });

  describe('SPIRIT_COLORS', () => {
    it('should have colors for common spirits', () => {
      expect(SPIRIT_COLORS.rum).toBeDefined();
      expect(SPIRIT_COLORS.gin).toBeDefined();
      expect(SPIRIT_COLORS.vodka).toBeDefined();
      expect(SPIRIT_COLORS.whiskey).toBeDefined();
      expect(SPIRIT_COLORS.tequila).toBeDefined();
      expect(SPIRIT_COLORS.brandy).toBeDefined();
    });

    it('should have same color for related spirits', () => {
      expect(SPIRIT_COLORS.whiskey).toBe(SPIRIT_COLORS.bourbon);
      expect(SPIRIT_COLORS.whiskey).toBe(SPIRIT_COLORS.rye);
      expect(SPIRIT_COLORS.whiskey).toBe(SPIRIT_COLORS.scotch);
      expect(SPIRIT_COLORS.tequila).toBe(SPIRIT_COLORS.mezcal);
      expect(SPIRIT_COLORS.brandy).toBe(SPIRIT_COLORS.cognac);
    });

    it('should have a default fallback color', () => {
      expect(SPIRIT_COLORS.default).toBeDefined();
    });
  });

  describe('SPIRIT_KEYWORDS', () => {
    it('should have keywords for each spirit type', () => {
      expect(SPIRIT_KEYWORDS.gin).toContain('gin');
      expect(SPIRIT_KEYWORDS.whiskey).toContain('bourbon');
      expect(SPIRIT_KEYWORDS.tequila).toContain('mezcal');
      expect(SPIRIT_KEYWORDS.rum).toContain('rum');
      expect(SPIRIT_KEYWORDS.vodka).toContain('vodka');
      expect(SPIRIT_KEYWORDS.brandy).toContain('cognac');
    });
  });

  describe('GROUP_COLORS', () => {
    it('should have colors for all periodic groups', () => {
      expect(GROUP_COLORS.Base).toBeDefined();
      expect(GROUP_COLORS.Bridge).toBeDefined();
      expect(GROUP_COLORS.Modifier).toBeDefined();
      expect(GROUP_COLORS.Sweetener).toBeDefined();
      expect(GROUP_COLORS.Reagent).toBeDefined();
      expect(GROUP_COLORS.Catalyst).toBeDefined();
    });

    it('should have valid hex color format', () => {
      Object.values(GROUP_COLORS).forEach(color => {
        expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      });
    });
  });

  describe('GROUP_COLORS_DARK', () => {
    it('should have colors for all periodic groups', () => {
      expect(GROUP_COLORS_DARK.Base).toBeDefined();
      expect(GROUP_COLORS_DARK.Bridge).toBeDefined();
      expect(GROUP_COLORS_DARK.Modifier).toBeDefined();
      expect(GROUP_COLORS_DARK.Sweetener).toBeDefined();
      expect(GROUP_COLORS_DARK.Reagent).toBeDefined();
      expect(GROUP_COLORS_DARK.Catalyst).toBeDefined();
    });

    it('should have different colors than light mode', () => {
      expect(GROUP_COLORS_DARK.Base).not.toBe(GROUP_COLORS.Base);
      expect(GROUP_COLORS_DARK.Reagent).not.toBe(GROUP_COLORS.Reagent);
    });
  });

  describe('PERIOD_COLORS', () => {
    it('should have colors for all periodic periods', () => {
      expect(PERIOD_COLORS.Agave).toBeDefined();
      expect(PERIOD_COLORS.Cane).toBeDefined();
      expect(PERIOD_COLORS.Grain).toBeDefined();
      expect(PERIOD_COLORS.Grape).toBeDefined();
      expect(PERIOD_COLORS.Fruit).toBeDefined();
      expect(PERIOD_COLORS.Botanic).toBeDefined();
    });
  });

  describe('PERIOD_COLORS_DARK', () => {
    it('should have colors for all periodic periods', () => {
      expect(PERIOD_COLORS_DARK.Agave).toBeDefined();
      expect(PERIOD_COLORS_DARK.Cane).toBeDefined();
      expect(PERIOD_COLORS_DARK.Grain).toBeDefined();
      expect(PERIOD_COLORS_DARK.Grape).toBeDefined();
      expect(PERIOD_COLORS_DARK.Fruit).toBeDefined();
      expect(PERIOD_COLORS_DARK.Botanic).toBeDefined();
    });
  });

  describe('getSpiritColorFromIngredients', () => {
    it('should return rum color for rum-based cocktails', () => {
      const ingredients = ['2 oz White Rum', 'Lime Juice', 'Simple Syrup'];
      expect(getSpiritColorFromIngredients(ingredients)).toBe(SPIRIT_COLORS.rum);
    });

    it('should return gin color for gin-based cocktails', () => {
      const ingredients = ['2 oz Gin', 'Tonic Water'];
      expect(getSpiritColorFromIngredients(ingredients)).toBe(SPIRIT_COLORS.gin);
    });

    it('should return whiskey color for whiskey-based cocktails', () => {
      const ingredients = ['2 oz Bourbon', 'Sweet Vermouth', 'Angostura Bitters'];
      expect(getSpiritColorFromIngredients(ingredients)).toBe(SPIRIT_COLORS.whiskey);
    });

    it('should return tequila color for tequila cocktails', () => {
      const ingredients = ['2 oz Tequila', 'Lime Juice', 'Triple Sec'];
      expect(getSpiritColorFromIngredients(ingredients)).toBe(SPIRIT_COLORS.tequila);
    });

    it('should return vodka color for vodka cocktails', () => {
      const ingredients = ['2 oz Vodka', 'Coffee Liqueur', 'Cream'];
      expect(getSpiritColorFromIngredients(ingredients)).toBe(SPIRIT_COLORS.vodka);
    });

    it('should return brandy color for brandy cocktails', () => {
      const ingredients = ['2 oz Cognac', 'Lemon Juice', 'Sugar'];
      expect(getSpiritColorFromIngredients(ingredients)).toBe(SPIRIT_COLORS.brandy);
    });

    it('should return default color when no spirit is found', () => {
      const ingredients = ['Club Soda', 'Lime'];
      expect(getSpiritColorFromIngredients(ingredients)).toBe(SPIRIT_COLORS.default);
    });

    it('should handle empty ingredients array', () => {
      expect(getSpiritColorFromIngredients([])).toBe(SPIRIT_COLORS.default);
    });

    it('should return first matching spirit color', () => {
      // Rum is checked before whiskey in the object, so it should return rum color
      const ingredients = ['Rum', 'Bourbon'];
      expect(getSpiritColorFromIngredients(ingredients)).toBe(SPIRIT_COLORS.rum);
    });

    it('should be case-insensitive', () => {
      const ingredients = ['RUM', 'LIME'];
      expect(getSpiritColorFromIngredients(ingredients)).toBe(SPIRIT_COLORS.rum);
    });
  });

  describe('detectSpiritTypes', () => {
    it('should detect single spirit type', () => {
      const ingredients = ['2 oz Gin', 'Tonic Water'];
      expect(detectSpiritTypes(ingredients)).toEqual(['gin']);
    });

    it('should detect multiple spirit types', () => {
      const ingredients = ['1 oz Gin', '1 oz Rum', 'Lime Juice'];
      const result = detectSpiritTypes(ingredients);
      expect(result).toContain('gin');
      expect(result).toContain('rum');
    });

    it('should use word boundary matching', () => {
      // "ginger" should not match "gin"
      const ingredients = ['Ginger Beer', 'Lime'];
      expect(detectSpiritTypes(ingredients)).toEqual([]);
    });

    it('should detect bourbon as whiskey', () => {
      const ingredients = ['2 oz Bourbon'];
      expect(detectSpiritTypes(ingredients)).toEqual(['whiskey']);
    });

    it('should detect scotch as whiskey', () => {
      const ingredients = ['2 oz Scotch Whisky'];
      expect(detectSpiritTypes(ingredients)).toEqual(['whiskey']);
    });

    it('should detect rye as whiskey', () => {
      const ingredients = ['2 oz Rye Whiskey'];
      expect(detectSpiritTypes(ingredients)).toEqual(['whiskey']);
    });

    it('should detect mezcal as tequila', () => {
      const ingredients = ['2 oz Mezcal'];
      expect(detectSpiritTypes(ingredients)).toEqual(['tequila']);
    });

    it('should detect cognac as brandy', () => {
      const ingredients = ['2 oz Cognac'];
      expect(detectSpiritTypes(ingredients)).toEqual(['brandy']);
    });

    it('should detect pisco as brandy', () => {
      const ingredients = ['2 oz Pisco'];
      expect(detectSpiritTypes(ingredients)).toEqual(['brandy']);
    });

    it('should return empty array for non-spirit ingredients', () => {
      const ingredients = ['Lime Juice', 'Simple Syrup', 'Mint'];
      expect(detectSpiritTypes(ingredients)).toEqual([]);
    });

    it('should handle empty ingredients array', () => {
      expect(detectSpiritTypes([])).toEqual([]);
    });

    it('should not duplicate spirits', () => {
      const ingredients = ['Gin', 'More Gin', 'London Dry Gin'];
      expect(detectSpiritTypes(ingredients)).toEqual(['gin']);
    });

    it('should be case-insensitive', () => {
      const ingredients = ['GIN', 'RUM'];
      const result = detectSpiritTypes(ingredients);
      expect(result).toContain('gin');
      expect(result).toContain('rum');
    });
  });
});
