/**
 * Formula Generator Tests
 */

import { describe, it, expect } from 'vitest';
import { generateFormula, generateCompactFormula } from './formula';

describe('generateFormula', () => {
  it('should generate formula for Margarita', () => {
    const ingredients = [
      '2 oz Tequila',
      '1 oz Cointreau',
      '1 oz Fresh lime juice',
    ];
    const formula = generateFormula(ingredients);
    // All elements present, order may vary for equal volumes
    expect(formula).toContain('Tq₂');
    expect(formula).toContain('Ol₁');
    expect(formula).toContain('Ac₁');
  });

  it('should generate formula for Negroni', () => {
    const ingredients = [
      '1 oz Gin',
      '1 oz Campari',
      '1 oz Sweet Vermouth',
    ];
    const formula = generateFormula(ingredients);
    // All equal volume, so check for presence (order may vary alphabetically)
    expect(formula).toContain('Gn₁');
    expect(formula).toContain('Cp₁');
    expect(formula).toContain('Sv₁');
  });

  it('should generate formula for Old Fashioned', () => {
    const ingredients = [
      '2 oz Bourbon',
      '1 sugar cube',
      '2 dashes Angostura bitters',
    ];
    const formula = generateFormula(ingredients);
    // Bourbon specific, sugar → Sw, bitters → Bt (trace)
    expect(formula).toContain('Bb₂');
    expect(formula).toContain('Bt');
  });

  it('should generate formula for Daiquiri', () => {
    const ingredients = [
      '2 oz White rum',
      '1 oz Fresh lime juice',
      '0.75 oz Simple syrup',
    ];
    const formula = generateFormula(ingredients);
    expect(formula).toBe('Rm₂ · Ac₁ · Sw₀.₇₅');
  });

  it('should generate formula for Whiskey Sour', () => {
    const ingredients = [
      '2 oz Bourbon',
      '1 oz Fresh lemon juice',
      '0.75 oz Simple syrup',
      '1 Egg white',
    ];
    const formula = generateFormula(ingredients);
    expect(formula).toContain('Bb₂');
    expect(formula).toContain('Ac₁');
    expect(formula).toContain('Sw');
    expect(formula).toContain('Dy');
  });

  it('should keep Orgeat specific in Mai Tai', () => {
    const ingredients = [
      '2 oz Aged rum',
      '1 oz Lime juice',
      '0.5 oz Orgeat',
      '0.5 oz Orange liqueur',
    ];
    const formula = generateFormula(ingredients);
    expect(formula).toContain('Rm₂');
    expect(formula).toContain('Og'); // Orgeat stays specific
    expect(formula).toContain('Ol'); // Orange liqueur stays specific
    expect(formula).toContain('Ac'); // Lime grouped to Ac
  });

  it('should combine multiple citrus into Ac', () => {
    const ingredients = [
      '1 oz Lime',
      '0.5 oz Lemon',
      '0.5 oz Grapefruit',
    ];
    const formula = generateFormula(ingredients);
    // All citrus should combine to Ac with summed volume
    expect(formula).toBe('Ac₂');
  });

  it('should omit soda/mixers', () => {
    const ingredients = [
      '2 oz Gin',
      '4 oz Tonic water',
    ];
    const formula = generateFormula(ingredients);
    expect(formula).toBe('Gn₂');
    expect(formula).not.toContain('Tn');
  });

  it('should handle trace amounts without subscript', () => {
    const ingredients = [
      '2 oz Rye whiskey',
      '1 oz Sweet vermouth',
      '2 dashes Angostura bitters',
    ];
    const formula = generateFormula(ingredients);
    // Bitters should have no subscript
    expect(formula).toMatch(/Bt(?![₀-₉])/);
  });
});

describe('generateCompactFormula', () => {
  it('should limit elements and show +N', () => {
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
    expect(compact).toContain('+');
  });

  it('should not add +N if under limit', () => {
    const ingredients = [
      '2 oz Gin',
      '1 oz Campari',
      '1 oz Sweet Vermouth',
    ];
    const compact = generateCompactFormula(ingredients, 5);
    expect(compact).not.toContain('+');
  });
});
