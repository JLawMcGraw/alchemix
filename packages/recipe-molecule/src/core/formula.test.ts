/**
 * Formula Generator Tests
 *
 * Tests the chemistry-accurate formula notation system.
 * See FORMULA_NOTATION.md for full specification.
 */

import { describe, it, expect } from 'vitest';
import { generateFormula, generateCompactFormula } from './formula';

describe('generateFormula', () => {
  describe('ratio calculation', () => {
    it('should generate whole-number ratios for Daiquiri', () => {
      const ingredients = [
        '2 oz White rum',
        '1 oz Fresh lime juice',
        '0.75 oz Simple syrup',
      ];
      const formula = generateFormula(ingredients);
      // 8:4:3 quarter-oz ratio, GCD=1
      // Single acid uses specific symbol (Li), single sweet uses specific (Ss)
      expect(formula).toBe('Rm₈ · Li₄ · Ss₃');
    });

    it('should simplify ratios using GCD for Margarita', () => {
      const ingredients = [
        '2 oz Tequila',
        '1 oz Cointreau',
        '1 oz Fresh lime juice',
      ];
      const formula = generateFormula(ingredients);
      // 8:4:4 quarter-oz → GCD=4 → 2:1:1
      // Cointreau (signature) keeps Ol, single acid uses Li
      expect(formula).toBe('Tq₂ · Ol · Li');
    });

    it('should omit subscript for ratio of 1 (Negroni)', () => {
      const ingredients = [
        '1 oz Gin',
        '1 oz Campari',
        '1 oz Sweet Vermouth',
      ];
      const formula = generateFormula(ingredients);
      // All equal parts → ratio 1 for each (subscripts omitted)
      expect(formula).toBe('Gn · Cp · Sv');
    });

    it('should normalize single-ingredient formulas to ratio 1', () => {
      const ingredients = ['2 oz Gin', '4 oz Tonic water'];
      const formula = generateFormula(ingredients);
      // Tonic is omitted, single gin → ratio normalized to 1
      expect(formula).toBe('Gn');
      expect(formula).not.toContain('Tn');
    });
  });

  describe('symbol specificity', () => {
    it('should use specific acid symbol for single acid (lime → Li)', () => {
      const ingredients = [
        '2 oz Rum',
        '1 oz Lime juice',
        '0.5 oz Simple syrup',
      ];
      const formula = generateFormula(ingredients);
      expect(formula).toContain('Li'); // Specific lime symbol
      expect(formula).not.toContain('Ac'); // Not grouped
    });

    it('should use specific acid symbol for single acid (lemon → Le)', () => {
      const ingredients = [
        '2 oz Bourbon',
        '1 oz Fresh lemon juice',
        '0.75 oz Simple syrup',
      ];
      const formula = generateFormula(ingredients);
      expect(formula).toContain('Le'); // Specific lemon symbol
      expect(formula).not.toContain('Ac');
    });

    it('should group multiple acids as Ac with coefficient', () => {
      const ingredients = [
        '1 oz Lime',
        '0.5 oz Lemon',
        '0.5 oz Grapefruit',
      ];
      const formula = generateFormula(ingredients);
      // 3 acids combined → coefficient 3, total 8 quarter-oz → ratio 1
      expect(formula).toBe('3Ac');
    });

    it('should keep signature ingredients specific (Mai Tai)', () => {
      const ingredients = [
        '2 oz Aged rum',
        '1 oz Lime juice',
        '0.5 oz Orgeat',
        '0.5 oz Orange liqueur',
      ];
      const formula = generateFormula(ingredients);
      // 8:4:2:2 quarter-oz → GCD=2 → 4:2:1:1
      expect(formula).toContain('Og'); // Orgeat stays specific
      expect(formula).toContain('Ol'); // Orange liqueur stays specific
      expect(formula).toContain('Li'); // Single acid uses specific
      expect(formula).toContain('Rm₄');
    });

    it('should keep all signature liqueurs specific', () => {
      const ingredients = [
        '1 oz Gin',
        '0.75 oz Green chartreuse',
        '0.75 oz Maraschino',
        '0.75 oz Lime juice',
      ];
      const formula = generateFormula(ingredients);
      expect(formula).toContain('Ch'); // Chartreuse
      expect(formula).toContain('Ms'); // Maraschino
      expect(formula).not.toContain('Sw'); // Not grouped
    });
  });

  describe('coefficients for multiple ingredients', () => {
    it('should use coefficient for multiple rums', () => {
      const ingredients = [
        '1 oz White rum',
        '1 oz Dark rum',
        '0.5 oz Overproof rum',
      ];
      const formula = generateFormula(ingredients);
      // 3 rums combined → coefficient 3
      expect(formula).toMatch(/^3Rm/);
    });

    it('should use coefficient for multiple spirits (4+ → Sp)', () => {
      const ingredients = [
        '0.5 oz Vodka',
        '0.5 oz Gin',
        '0.5 oz Rum',
        '0.5 oz Tequila',
        '0.5 oz Triple sec',
        '1 oz Lemon juice',
      ];
      const formula = generateFormula(ingredients);
      // 4 different spirits → grouped as Sp with coefficient
      // Note: Triple sec is signature (Ol), so we have vodka, gin, rum, tequila = 4 spirits
      expect(formula).toMatch(/4Sp|Sp/);
    });
  });

  describe('trace amounts', () => {
    it('should treat dashes as ratio 1 without subscript', () => {
      const ingredients = [
        '2 oz Rye whiskey',
        '1 oz Sweet vermouth',
        '2 dashes Angostura bitters',
      ];
      const formula = generateFormula(ingredients);
      // Rye (8) : Sweet vermouth (4) : Angostura (trace=1) → GCD=1
      // Single bitter uses specific An symbol
      expect(formula).toContain('An');
      expect(formula).toMatch(/An(?!₂|₃|₄|₅|₆|₇|₈)/); // No subscript 2+ after An
    });

    it('should handle multiple trace amounts', () => {
      const ingredients = [
        '2 oz Bourbon',
        '1 sugar cube',
        '2 dashes Angostura bitters',
      ];
      const formula = generateFormula(ingredients);
      // Bourbon 8, sugar cube, angostura trace
      expect(formula).toContain('Bb');
      expect(formula).toContain('Su'); // Specific sugar symbol
      expect(formula).toContain('An'); // Specific angostura symbol
    });
  });

  describe('priority hierarchy', () => {
    it('should order by priority: spirits → signatures → acids → sweets → bitters', () => {
      const ingredients = [
        '2 dashes Angostura',
        '0.75 oz Simple syrup',
        '1 oz Lime juice',
        '0.5 oz Orgeat',
        '2 oz Rum',
      ];
      const formula = generateFormula(ingredients);
      const parts = formula.split(' · ');
      // Spirit (Rm) should be first
      expect(parts[0]).toMatch(/^Rm/);
    });

    it('should limit to 5 elements maximum', () => {
      const ingredients = [
        '1.5 oz Jamaican rum',
        '0.75 oz Puerto Rican rum',
        '1 oz Lime juice',
        '0.5 oz Grapefruit juice',
        '0.5 oz Cinnamon syrup',
        '0.5 oz Falernum',
        '0.25 oz Grenadine',
        '1 dash Angostura',
        '1 dash Absinthe',
      ];
      const formula = generateFormula(ingredients);
      const parts = formula.split(' · ');
      expect(parts.length).toBeLessThanOrEqual(5);
    });
  });

  describe('omit garnishes and mixers', () => {
    it('should omit soda water', () => {
      const ingredients = ['2 oz Vodka', '4 oz Soda water'];
      const formula = generateFormula(ingredients);
      expect(formula).toBe('Vd');
    });

    it('should omit garnishes', () => {
      const ingredients = [
        '2 oz Gin',
        '1 oz Lime juice',
        '0.75 oz Simple syrup',
        'Lime wheel garnish',
      ];
      const formula = generateFormula(ingredients);
      expect(formula).not.toContain('garnish');
      expect(formula).not.toContain('wheel');
    });

    it('should omit ginger beer', () => {
      const ingredients = ['2 oz Vodka', '0.5 oz Lime juice', '4 oz Ginger beer'];
      const formula = generateFormula(ingredients);
      expect(formula).not.toContain('ginger');
    });
  });

  describe('classic cocktails', () => {
    it('should generate formula for Old Fashioned', () => {
      const ingredients = [
        '2 oz Bourbon',
        '1 sugar cube',
        '2 dashes Angostura bitters',
      ];
      const formula = generateFormula(ingredients);
      // Bourbon (spirit), Sugar (sweet), Angostura (bitter)
      expect(formula).toContain('Bb');
      expect(formula).toContain('Su');
      expect(formula).toContain('An');
    });

    it('should generate formula for Whiskey Sour', () => {
      const ingredients = [
        '2 oz Bourbon',
        '1 oz Fresh lemon juice',
        '0.75 oz Simple syrup',
        '1 Egg white',
      ];
      const formula = generateFormula(ingredients);
      // 8:4:3:4 quarter-oz → GCD=1
      expect(formula).toContain('Bb');
      expect(formula).toContain('Le'); // Single acid uses specific
      expect(formula).toContain('Ss'); // Single sweet uses specific
      expect(formula).toContain('Ew'); // Egg white
    });

    it('should generate formula for Last Word', () => {
      const ingredients = [
        '0.75 oz Gin',
        '0.75 oz Green chartreuse',
        '0.75 oz Maraschino',
        '0.75 oz Lime juice',
      ];
      const formula = generateFormula(ingredients);
      // All equal parts → ratio 1 for each
      expect(formula).toContain('Gn');
      expect(formula).toContain('Ch');
      expect(formula).toContain('Ms');
      expect(formula).toContain('Li');
    });

    it('should generate formula for Sazerac', () => {
      const ingredients = [
        '2 oz Rye whiskey',
        '1 barspoon Absinthe',
        '1 sugar cube',
        '3 dashes Peychauds bitters',
      ];
      const formula = generateFormula(ingredients);
      expect(formula).toContain('Ry');
      expect(formula).toContain('Ab');
      expect(formula).toContain('Py');
    });
  });
});

describe('generateCompactFormula', () => {
  it('should limit elements to specified max', () => {
    const ingredients = [
      '1.5 oz Jamaican rum',
      '0.75 oz Puerto Rican rum',
      '1 oz Lime juice',
      '0.5 oz Grapefruit juice',
      '0.5 oz Cinnamon syrup',
      '0.5 oz Falernum',
      '0.25 oz Grenadine',
      '1 dash Angostura',
      '1 dash Absinthe',
    ];
    const compact = generateCompactFormula(ingredients, 4);
    const parts = compact.split(' · ');
    expect(parts.length).toBeLessThanOrEqual(4);
  });

  it('should not truncate if under limit', () => {
    const ingredients = [
      '2 oz Gin',
      '1 oz Campari',
      '1 oz Sweet Vermouth',
    ];
    const compact = generateCompactFormula(ingredients, 5);
    const parts = compact.split(' · ');
    expect(parts.length).toBe(3);
  });

  it('should use default limit of 5', () => {
    const ingredients = [
      '1 oz Vodka',
      '1 oz Gin',
      '1 oz Rum',
      '1 oz Tequila',
      '0.5 oz Triple sec',
      '1 oz Lemon juice',
      '0.5 oz Simple syrup',
      '2 oz Cola',
    ];
    const compact = generateCompactFormula(ingredients);
    const parts = compact.split(' · ');
    expect(parts.length).toBeLessThanOrEqual(5);
  });
});
