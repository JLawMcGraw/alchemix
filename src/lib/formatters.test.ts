import { describe, it, expect } from 'vitest';
import {
  formatMeasurement,
  getElementSymbol,
  formatFormulaComponent,
  toSubscript,
  toSuperscript,
  formatFormula,
  padNumber,
  formatDecimal,
} from './formatters';

describe('formatters utility', () => {
  describe('formatMeasurement', () => {
    describe('liquid measurements (oz, ml)', () => {
      it('should format oz with leading zeros and decimals', () => {
        expect(formatMeasurement(1.5, 'oz')).toBe('01.50 oz');
        expect(formatMeasurement(2, 'oz')).toBe('02.00 oz');
        expect(formatMeasurement(0.5, 'oz')).toBe('00.50 oz');
      });

      it('should format ml with leading zeros and decimals', () => {
        expect(formatMeasurement(30, 'ml')).toBe('30.00 ml');
        expect(formatMeasurement(45.5, 'ml')).toBe('45.50 ml');
      });

      it('should normalize ounce/ounces to oz', () => {
        expect(formatMeasurement(1.5, 'ounce')).toBe('01.50 oz');
        expect(formatMeasurement(2, 'ounces')).toBe('02.00 oz');
      });
    });

    describe('whole unit measurements (dash, drop, etc.)', () => {
      it('should format dashes without decimals', () => {
        expect(formatMeasurement(3, 'dash')).toBe('03 dash');
        expect(formatMeasurement(2, 'dashes')).toBe('02 dash');
      });

      it('should format drops without decimals', () => {
        expect(formatMeasurement(5, 'drop')).toBe('05 drop');
        expect(formatMeasurement(3, 'drops')).toBe('03 drop');
      });

      it('should format pieces without decimals', () => {
        expect(formatMeasurement(2, 'piece')).toBe('02 piece');
        expect(formatMeasurement(1, 'pieces')).toBe('01 piece');
      });

      it('should format sprigs without decimals', () => {
        expect(formatMeasurement(2, 'sprig')).toBe('02 sprig');
        expect(formatMeasurement(3, 'sprigs')).toBe('03 sprig');
      });

      it('should format slices without decimals', () => {
        expect(formatMeasurement(1, 'slice')).toBe('01 slice');
        expect(formatMeasurement(2, 'slices')).toBe('02 slice');
      });

      it('should format wedges without decimals', () => {
        expect(formatMeasurement(1, 'wedge')).toBe('01 wedge');
      });

      it('should format eggs without decimals', () => {
        expect(formatMeasurement(1, 'egg')).toBe('01 egg');
        expect(formatMeasurement(2, 'eggs')).toBe('02 egg');
      });
    });

    describe('custom options', () => {
      it('should respect custom decimal places', () => {
        expect(formatMeasurement(1.5, 'oz', { decimals: 1 })).toBe('01.5 oz');
        expect(formatMeasurement(1.555, 'oz', { decimals: 3 })).toBe('01.555 oz');
      });

      it('should respect custom leading zeros', () => {
        expect(formatMeasurement(5, 'oz', { leadingZeros: 3 })).toBe('005.00 oz');
        expect(formatMeasurement(12, 'oz', { leadingZeros: 1 })).toBe('12.00 oz');
      });

      it('should allow forcing decimals on whole units', () => {
        expect(formatMeasurement(3, 'dash', { showDecimals: true })).toBe('03.00 dash');
      });

      it('should allow hiding decimals on liquid units', () => {
        expect(formatMeasurement(2, 'oz', { showDecimals: false })).toBe('02 oz');
      });
    });

    describe('teaspoon/tablespoon units', () => {
      it('should normalize teaspoon variants to tsp', () => {
        expect(formatMeasurement(1, 'teaspoon')).toBe('01.00 tsp');
        expect(formatMeasurement(0.5, 'teaspoons')).toBe('00.50 tsp');
        expect(formatMeasurement(1, 'tsp')).toBe('01.00 tsp');
      });

      it('should normalize tablespoon variants to tbsp', () => {
        expect(formatMeasurement(1, 'tablespoon')).toBe('01.00 tbsp');
        expect(formatMeasurement(2, 'tablespoons')).toBe('02.00 tbsp');
        expect(formatMeasurement(1.5, 'tbsp')).toBe('01.50 tbsp');
      });
    });
  });

  describe('getElementSymbol', () => {
    describe('spirits', () => {
      it('should return correct symbols for base spirits', () => {
        expect(getElementSymbol('rum')).toBe('Rm');
        expect(getElementSymbol('vodka')).toBe('Vd');
        expect(getElementSymbol('gin')).toBe('Gn');
        expect(getElementSymbol('whiskey')).toBe('Wh');
        expect(getElementSymbol('tequila')).toBe('Tq');
        expect(getElementSymbol('brandy')).toBe('Br');
      });

      it('should return correct symbols for whiskey variants', () => {
        expect(getElementSymbol('bourbon')).toBe('Bb');
        expect(getElementSymbol('rye')).toBe('Ry');
        expect(getElementSymbol('scotch')).toBe('Sc');
      });

      it('should return correct symbols for rum variants', () => {
        expect(getElementSymbol('rhum agricole')).toBe('Ra');
        expect(getElementSymbol('cachaça')).toBe('Cc');
        expect(getElementSymbol('cachaca')).toBe('Cc');
      });
    });

    describe('liqueurs', () => {
      it('should return correct symbols for common liqueurs', () => {
        expect(getElementSymbol('triple sec')).toBe('Ol');
        expect(getElementSymbol('cointreau')).toBe('Ol');
        expect(getElementSymbol('kahlua')).toBe('Cf');
        expect(getElementSymbol('amaretto')).toBe('Am');
        expect(getElementSymbol('maraschino')).toBe('Ms');
      });

      it('should return correct symbols for chartreuse', () => {
        expect(getElementSymbol('chartreuse')).toBe('Ch');
        expect(getElementSymbol('green chartreuse')).toBe('Gc');
        expect(getElementSymbol('yellow chartreuse')).toBe('Yc');
      });

      it('should return correct symbols for elderflower liqueur', () => {
        expect(getElementSymbol('elderflower')).toBe('El');
        expect(getElementSymbol('st. germain')).toBe('El');
        expect(getElementSymbol('st germain')).toBe('El');
      });
    });

    describe('vermouth & aperitifs', () => {
      it('should return correct symbols for vermouth', () => {
        expect(getElementSymbol('sweet vermouth')).toBe('Sv');
        expect(getElementSymbol('dry vermouth')).toBe('Dv');
        expect(getElementSymbol('blanc vermouth')).toBe('Bv');
      });

      it('should return correct symbols for aperitifs', () => {
        expect(getElementSymbol('campari')).toBe('Cp');
        expect(getElementSymbol('aperol')).toBe('Ap');
        expect(getElementSymbol('fernet')).toBe('Fn');
      });
    });

    describe('bitters', () => {
      it('should return correct symbols for bitters', () => {
        expect(getElementSymbol('angostura')).toBe('An');
        expect(getElementSymbol('angostura bitters')).toBe('An');
        expect(getElementSymbol('orange bitters')).toBe('Ob');
        expect(getElementSymbol("peychaud's")).toBe('Py');
      });
    });

    describe('citrus & juices', () => {
      it('should return correct symbols for citrus', () => {
        expect(getElementSymbol('lime')).toBe('Li');
        expect(getElementSymbol('lime juice')).toBe('Li');
        expect(getElementSymbol('lemon')).toBe('Le');
        expect(getElementSymbol('lemon juice')).toBe('Le');
        expect(getElementSymbol('orange juice')).toBe('Or');
        expect(getElementSymbol('grapefruit')).toBe('Gf');
      });
    });

    describe('sweeteners', () => {
      it('should return correct symbols for syrups', () => {
        expect(getElementSymbol('simple syrup')).toBe('Ss');
        expect(getElementSymbol('honey syrup')).toBe('Hn');
        expect(getElementSymbol('agave')).toBe('Ag');
        expect(getElementSymbol('grenadine')).toBe('Gr');
        expect(getElementSymbol('orgeat')).toBe('Og');
      });
    });

    describe('carbonation', () => {
      it('should return correct symbols for sodas', () => {
        expect(getElementSymbol('soda water')).toBe('Sw');
        expect(getElementSymbol('club soda')).toBe('Sw');
        expect(getElementSymbol('tonic water')).toBe('Tn');
        expect(getElementSymbol('ginger beer')).toBe('Gb');
      });
    });

    describe('fallback behavior', () => {
      it('should return first 2 letters capitalized for unknown ingredients', () => {
        expect(getElementSymbol('unknown ingredient')).toBe('Un');
        expect(getElementSymbol('mystery')).toBe('My');
      });

      it('should handle partial matches', () => {
        // "rye whiskey" should match "rye"
        expect(getElementSymbol('rye whiskey')).toBe('Ry');
      });

      it('should handle case insensitivity', () => {
        expect(getElementSymbol('RUM')).toBe('Rm');
        expect(getElementSymbol('Vodka')).toBe('Vd');
        expect(getElementSymbol('GIN')).toBe('Gn');
      });

      it('should fall back to first two letters for unrecognized inputs', () => {
        // Unrecognized multi-word ingredient
        expect(getElementSymbol('xyz ingredient')).toBe('Xy');
        expect(getElementSymbol('mystery liquor')).toBe('My');
      });

      it('should handle partial matching edge cases', () => {
        // Empty string triggers partial match (all keys "include" empty string)
        // Returns first match in ELEMENT_SYMBOLS object
        const emptyResult = getElementSymbol('');
        expect(typeof emptyResult).toBe('string');
        expect(emptyResult.length).toBe(2);
      });
    });
  });

  describe('toSubscript', () => {
    it('should convert single digits to subscript', () => {
      expect(toSubscript(0)).toBe('₀');
      expect(toSubscript(1)).toBe('₁');
      expect(toSubscript(2)).toBe('₂');
      expect(toSubscript(5)).toBe('₅');
      expect(toSubscript(9)).toBe('₉');
    });

    it('should convert multi-digit numbers to subscript', () => {
      expect(toSubscript(10)).toBe('₁₀');
      expect(toSubscript(23)).toBe('₂₃');
      expect(toSubscript(100)).toBe('₁₀₀');
    });
  });

  describe('toSuperscript', () => {
    it('should convert single digits to superscript', () => {
      expect(toSuperscript(0)).toBe('⁰');
      expect(toSuperscript(1)).toBe('¹');
      expect(toSuperscript(2)).toBe('²');
      expect(toSuperscript(5)).toBe('⁵');
      expect(toSuperscript(9)).toBe('⁹');
    });

    it('should convert multi-digit numbers to superscript', () => {
      expect(toSuperscript(10)).toBe('¹⁰');
      expect(toSuperscript(23)).toBe('²³');
    });
  });

  describe('formatFormulaComponent', () => {
    it('should format ingredient with quantity 1 (no subscript)', () => {
      expect(formatFormulaComponent('rum', 1)).toBe('Rm');
      expect(formatFormulaComponent('gin', 1)).toBe('Gn');
    });

    it('should format ingredient with quantity > 1 (with subscript)', () => {
      expect(formatFormulaComponent('rum', 2)).toBe('Rm₂');
      expect(formatFormulaComponent('lime juice', 3)).toBe('Li₃');
    });

    it('should round decimal quantities', () => {
      expect(formatFormulaComponent('vodka', 1.5)).toBe('Vd₂');
      expect(formatFormulaComponent('gin', 2.4)).toBe('Gn₂');
    });

    it('should default to quantity 1', () => {
      expect(formatFormulaComponent('bourbon')).toBe('Bb');
    });
  });

  describe('formatFormula', () => {
    it('should format a simple cocktail formula', () => {
      const ingredients = [
        { ingredient: 'Rye Whiskey', amount: 2, unit: 'oz' },
        { ingredient: 'Sweet Vermouth', amount: 1, unit: 'oz' },
        { ingredient: 'Angostura Bitters', amount: 2, unit: 'dash' },
      ];
      expect(formatFormula(ingredients)).toBe('Ry₂ · Sv · An₂');
    });

    it('should filter out garnishes', () => {
      const ingredients = [
        { ingredient: 'Gin', amount: 2, unit: 'oz' },
        { ingredient: 'Lime Juice', amount: 0.75, unit: 'oz' },
        { ingredient: 'Cherry', amount: 1, unit: 'piece' },
        { ingredient: 'Lime Wheel', amount: 1, unit: 'piece' },
      ];
      const result = formatFormula(ingredients);
      expect(result).not.toContain('Cherry');
      expect(result).not.toContain('Wheel');
    });

    it('should filter out ice', () => {
      const ingredients = [
        { ingredient: 'Vodka', amount: 2, unit: 'oz' },
        { ingredient: 'Ice', amount: 1, unit: 'cup' },
      ];
      const result = formatFormula(ingredients);
      expect(result).toBe('Vd₂');
      expect(result).not.toContain('Ic');
    });

    it('should return empty string for garnish-only ingredients', () => {
      const ingredients = [
        { ingredient: 'Cherry garnish', amount: 1, unit: 'piece' },
        { ingredient: 'Olive', amount: 2, unit: 'piece' },
      ];
      expect(formatFormula(ingredients)).toBe('');
    });

    it('should join components with interpunct', () => {
      const ingredients = [
        { ingredient: 'Rum', amount: 1, unit: 'oz' },
        { ingredient: 'Lime', amount: 1, unit: 'oz' },
        { ingredient: 'Simple Syrup', amount: 1, unit: 'oz' },
      ];
      expect(formatFormula(ingredients)).toBe('Rm · Li · Ss');
    });
  });

  describe('padNumber', () => {
    it('should pad single digit numbers', () => {
      expect(padNumber(3)).toBe('03');
      expect(padNumber(0)).toBe('00');
      expect(padNumber(9)).toBe('09');
    });

    it('should not pad numbers that are already at or above width', () => {
      expect(padNumber(10)).toBe('10');
      expect(padNumber(100)).toBe('100');
    });

    it('should respect custom digit count', () => {
      expect(padNumber(3, 3)).toBe('003');
      expect(padNumber(3, 4)).toBe('0003');
      expect(padNumber(123, 5)).toBe('00123');
    });

    it('should round decimal numbers', () => {
      expect(padNumber(3.7)).toBe('04');
      expect(padNumber(3.2)).toBe('03');
    });
  });

  describe('formatDecimal', () => {
    it('should format with default 2 int digits and 2 decimal digits', () => {
      expect(formatDecimal(1.5)).toBe('01.50');
      expect(formatDecimal(0.5)).toBe('00.50');
      expect(formatDecimal(12.34)).toBe('12.34');
    });

    it('should respect custom int digit count', () => {
      expect(formatDecimal(5, 3)).toBe('005.00');
      expect(formatDecimal(123, 1)).toBe('123.00');
    });

    it('should respect custom decimal digit count', () => {
      expect(formatDecimal(1.5, 2, 1)).toBe('01.5');
      expect(formatDecimal(1.555, 2, 3)).toBe('01.555');
    });

    it('should handle large numbers', () => {
      expect(formatDecimal(100.5)).toBe('100.50');
      expect(formatDecimal(999.99)).toBe('999.99');
    });
  });
});
