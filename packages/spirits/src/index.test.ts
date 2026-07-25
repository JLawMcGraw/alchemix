import { describe, it, expect } from 'vitest';
import {
  SPIRIT_FAMILIES,
  SPIRIT_FAMILY_KEYWORDS,
  SPIRIT_FAMILY_LABELS,
  SPIRIT_VARIANTS,
  normalizeSpiritType,
  getSpiritSynonyms,
  matchesSpiritFamily,
  recipeMatchesSpiritConstraint,
} from './index';

describe('@alchemix/spirits', () => {
  it('defines the six canonical families with labels and keywords', () => {
    expect(SPIRIT_FAMILIES).toEqual(['whiskey', 'rum', 'gin', 'vodka', 'tequila', 'brandy']);
    for (const family of SPIRIT_FAMILIES) {
      expect(SPIRIT_FAMILY_KEYWORDS[family].length).toBeGreaterThan(0);
      expect(SPIRIT_FAMILY_LABELS[family]).toBeTruthy();
    }
  });

  describe('normalizeSpiritType', () => {
    it('maps variants to their canonical family', () => {
      expect(normalizeSpiritType('bourbon')).toBe('whiskey');
      expect(normalizeSpiritType('Bourbon')).toBe('whiskey');
      expect(normalizeSpiritType('rye whiskey')).toBe('whiskey');
      expect(normalizeSpiritType('mezcal')).toBe('tequila');
      expect(normalizeSpiritType('white rum')).toBe('rum');
    });

    it('resolves variants that had drifted across the old lists', () => {
      expect(normalizeSpiritType('cachaça')).toBe('rum');
      expect(normalizeSpiritType('cachaca')).toBe('rum');
      expect(normalizeSpiritType('ron')).toBe('rum');
      expect(normalizeSpiritType('genever')).toBe('gin');
      expect(normalizeSpiritType('grappa')).toBe('brandy');
      expect(normalizeSpiritType('calvados')).toBe('brandy');
    });

    it('returns null for unknown or empty input', () => {
      expect(normalizeSpiritType(null)).toBeNull();
      expect(normalizeSpiritType('')).toBeNull();
      expect(normalizeSpiritType('   ')).toBeNull();
      expect(normalizeSpiritType('elderflower cordial')).toBeNull();
    });

    it('does not match spirit names hidden inside other words', () => {
      expect(normalizeSpiritType('ginger')).toBeNull(); // not "gin"
      expect(normalizeSpiritType('citron')).toBeNull(); // not "ron"
    });
  });

  describe('matchesSpiritFamily', () => {
    it('matches at word boundaries only', () => {
      expect(matchesSpiritFamily('London Dry Gin', 'gin')).toBe(true);
      expect(matchesSpiritFamily('ginger beer', 'gin')).toBe(false);
      expect(matchesSpiritFamily('Aged Jamaican Rum', 'rum')).toBe(true);
    });
  });

  describe('getSpiritSynonyms', () => {
    it('returns the family keyword set', () => {
      expect(getSpiritSynonyms('rum')).toContain('cachaca');
      expect(getSpiritSynonyms('tequila')).toContain('mezcal');
    });
  });

  describe('recipeMatchesSpiritConstraint', () => {
    it('allows everything when there is no constraint', () => {
      expect(recipeMatchesSpiritConstraint('2 oz gin, tonic', null)).toBe(true);
    });

    it('accepts a recipe that contains the required family', () => {
      expect(recipeMatchesSpiritConstraint('2 oz white rum, lime, sugar', 'rum')).toBe(true);
      expect(recipeMatchesSpiritConstraint('2 oz bourbon, bitters', 'whiskey')).toBe(true);
    });

    it('rejects a recipe whose base spirit is a different family', () => {
      expect(recipeMatchesSpiritConstraint('2 oz gin, tonic water', 'rum')).toBe(false);
    });

    it('allows a recipe with no identifiable base spirit', () => {
      expect(recipeMatchesSpiritConstraint('lemon juice, sugar, soda water', 'rum')).toBe(true);
    });

    it('does not treat ginger as a gin conflict (word-boundary fix)', () => {
      expect(recipeMatchesSpiritConstraint('2 oz rum, ginger beer, lime', 'rum')).toBe(true);
    });

    it('does not treat citron as a rum (ron) conflict', () => {
      expect(recipeMatchesSpiritConstraint('2 oz vodka, citron, soda', 'vodka')).toBe(true);
    });
  });

  it('exposes a de-duplicated flat variant list', () => {
    expect(SPIRIT_VARIANTS).toContain('bourbon');
    expect(SPIRIT_VARIANTS).toContain('mezcal');
    expect(new Set(SPIRIT_VARIANTS).size).toBe(SPIRIT_VARIANTS.length);
  });
});
