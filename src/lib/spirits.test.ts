import { describe, it, expect } from 'vitest';
import {
  categorizeSpirit,
  matchesSpiritCategory,
  getSpiritCategories,
  SpiritCategory,
} from './spirits';

describe('spirits utility', () => {
  describe('categorizeSpirit', () => {
    describe('Whiskey category', () => {
      it('should categorize whiskey by type', () => {
        expect(categorizeSpirit('Whiskey', null)).toBe('Whiskey');
        expect(categorizeSpirit('whisky', null)).toBe('Whiskey');
      });

      it('should categorize bourbon as Whiskey', () => {
        expect(categorizeSpirit('Bourbon', null)).toBe('Whiskey');
        expect(categorizeSpirit(null, 'Buffalo Trace Bourbon')).toBe('Whiskey');
      });

      it('should categorize scotch as Whiskey', () => {
        expect(categorizeSpirit('Scotch', null)).toBe('Whiskey');
        expect(categorizeSpirit(null, 'Glenfiddich Scotch')).toBe('Whiskey');
      });

      it('should categorize rye as Whiskey', () => {
        expect(categorizeSpirit('Rye', null)).toBe('Whiskey');
        expect(categorizeSpirit(null, 'Rittenhouse Rye')).toBe('Whiskey');
      });

      it('should categorize Irish whiskey', () => {
        expect(categorizeSpirit('Irish Whiskey', null)).toBe('Whiskey');
        expect(categorizeSpirit(null, 'Jameson Irish Whiskey')).toBe('Whiskey');
      });

      it('should categorize Japanese whisky', () => {
        expect(categorizeSpirit('Japanese Whisky', null)).toBe('Whiskey');
        expect(categorizeSpirit(null, 'Hibiki Japanese Whisky')).toBe('Whiskey');
      });
    });

    describe('Rum category', () => {
      it('should categorize rum', () => {
        expect(categorizeSpirit('Rum', null)).toBe('Rum');
        expect(categorizeSpirit(null, 'Bacardi White Rum')).toBe('Rum');
      });

      it('should categorize rhum agricole', () => {
        expect(categorizeSpirit('Rhum', null)).toBe('Rum');
        expect(categorizeSpirit(null, 'Rhum Agricole')).toBe('Rum');
      });

      it('should categorize cachaça as Rum', () => {
        expect(categorizeSpirit('Cachaça', null)).toBe('Rum');
        expect(categorizeSpirit('cachaca', null)).toBe('Rum');
        expect(categorizeSpirit(null, 'Leblon Cachaça')).toBe('Rum');
      });

      it('should categorize ron as Rum', () => {
        expect(categorizeSpirit('Ron', null)).toBe('Rum');
        expect(categorizeSpirit(null, 'Ron Zacapa')).toBe('Rum');
      });
    });

    describe('Gin category', () => {
      it('should categorize gin', () => {
        expect(categorizeSpirit('Gin', null)).toBe('Gin');
        expect(categorizeSpirit(null, 'Tanqueray Gin')).toBe('Gin');
      });

      it('should categorize genever as Gin', () => {
        expect(categorizeSpirit('Genever', null)).toBe('Gin');
        expect(categorizeSpirit(null, 'Bols Genever')).toBe('Gin');
      });
    });

    describe('Vodka category', () => {
      it('should categorize vodka', () => {
        expect(categorizeSpirit('Vodka', null)).toBe('Vodka');
        expect(categorizeSpirit(null, 'Grey Goose Vodka')).toBe('Vodka');
        expect(categorizeSpirit(null, 'Tito\'s Handmade Vodka')).toBe('Vodka');
      });
    });

    describe('Tequila category', () => {
      it('should categorize tequila', () => {
        expect(categorizeSpirit('Tequila', null)).toBe('Tequila');
        expect(categorizeSpirit(null, 'Espolon Blanco Tequila')).toBe('Tequila');
        expect(categorizeSpirit(null, 'Don Julio Tequila')).toBe('Tequila');
      });

      it('should categorize mezcal as Tequila', () => {
        expect(categorizeSpirit('Mezcal', null)).toBe('Tequila');
        expect(categorizeSpirit(null, 'Del Maguey Mezcal')).toBe('Tequila');
      });

      // Word boundary matching prevents false positives like "Patron" matching "ron"
      it('should use word boundary matching to avoid false positives', () => {
        // "Patron" does NOT match "ron" because "ron" is not a whole word
        // Without a tequila keyword in the name, it falls back to Other Spirits
        expect(categorizeSpirit(null, 'Patron Silver')).toBe('Other Spirits');

        // With "tequila" explicitly in the name, it matches correctly
        expect(categorizeSpirit(null, 'Patron Tequila Silver')).toBe('Tequila');

        // Standard tequila names work correctly
        expect(categorizeSpirit(null, 'Casamigos Tequila')).toBe('Tequila');
      });
    });

    describe('Brandy category', () => {
      it('should categorize brandy', () => {
        expect(categorizeSpirit('Brandy', null)).toBe('Brandy');
        expect(categorizeSpirit(null, 'E&J Brandy')).toBe('Brandy');
      });

      it('should categorize cognac as Brandy', () => {
        expect(categorizeSpirit('Cognac', null)).toBe('Brandy');
        expect(categorizeSpirit(null, 'Hennessy Cognac')).toBe('Brandy');
      });

      it('should categorize armagnac as Brandy', () => {
        expect(categorizeSpirit('Armagnac', null)).toBe('Brandy');
      });

      it('should categorize pisco as Brandy', () => {
        expect(categorizeSpirit('Pisco', null)).toBe('Brandy');
        expect(categorizeSpirit(null, 'Pisco Porton')).toBe('Brandy');
      });

      it('should categorize calvados as Brandy', () => {
        expect(categorizeSpirit('Calvados', null)).toBe('Brandy');
      });
    });

    describe('Other Spirits category', () => {
      it('should return Other Spirits for empty input', () => {
        expect(categorizeSpirit(null, null)).toBe('Other Spirits');
        expect(categorizeSpirit('', '')).toBe('Other Spirits');
        expect(categorizeSpirit(undefined, undefined)).toBe('Other Spirits');
      });

      it('should return Other Spirits for unrecognized spirits', () => {
        expect(categorizeSpirit('Baijiu', null)).toBe('Other Spirits');
        expect(categorizeSpirit(null, 'Aquavit')).toBe('Other Spirits');
        expect(categorizeSpirit('Soju', null)).toBe('Other Spirits');
      });
    });

    describe('combined type and name matching', () => {
      it('should match from name when type is generic', () => {
        expect(categorizeSpirit('Spirit', 'Makers Mark Bourbon')).toBe('Whiskey');
        expect(categorizeSpirit('Liquor', 'Havana Club Rum')).toBe('Rum');
      });

      it('should match from type even when name is different', () => {
        expect(categorizeSpirit('Bourbon', 'Makers Mark')).toBe('Whiskey');
        expect(categorizeSpirit('Gin', 'Hendricks')).toBe('Gin');
      });

      it('should NOT match "ginger beer" to Gin (word boundary)', () => {
        expect(categorizeSpirit('mixer', 'Ginger Beer')).toBe('Other Spirits');
        expect(categorizeSpirit('', 'Fever Tree Ginger Beer')).toBe('Other Spirits');
      });
    });
  });

  describe('matchesSpiritCategory', () => {
    describe('matching specific categories', () => {
      it('should match Whiskey category', () => {
        expect(matchesSpiritCategory('Bourbon', 'Whiskey')).toBe(true);
        expect(matchesSpiritCategory('Whiskey', 'Whiskey')).toBe(true);
        expect(matchesSpiritCategory('Rum', 'Whiskey')).toBe(false);
      });

      it('should match Rum category', () => {
        expect(matchesSpiritCategory('Rum', 'Rum')).toBe(true);
        expect(matchesSpiritCategory('Cachaça', 'Rum')).toBe(true);
        expect(matchesSpiritCategory('Gin', 'Rum')).toBe(false);
      });

      it('should match Gin category', () => {
        expect(matchesSpiritCategory('Gin', 'Gin')).toBe(true);
        expect(matchesSpiritCategory('Genever', 'Gin')).toBe(true);
        expect(matchesSpiritCategory('Vodka', 'Gin')).toBe(false);
      });

      it('should match Vodka category', () => {
        expect(matchesSpiritCategory('Vodka', 'Vodka')).toBe(true);
        expect(matchesSpiritCategory('Gin', 'Vodka')).toBe(false);
      });

      it('should match Tequila category', () => {
        expect(matchesSpiritCategory('Tequila', 'Tequila')).toBe(true);
        expect(matchesSpiritCategory('Mezcal', 'Tequila')).toBe(true);
        expect(matchesSpiritCategory('Rum', 'Tequila')).toBe(false);
      });

      it('should match Brandy category', () => {
        expect(matchesSpiritCategory('Brandy', 'Brandy')).toBe(true);
        expect(matchesSpiritCategory('Cognac', 'Brandy')).toBe(true);
        expect(matchesSpiritCategory('Pisco', 'Brandy')).toBe(true);
        expect(matchesSpiritCategory('Whiskey', 'Brandy')).toBe(false);
      });
    });

    describe('Other Spirits matching', () => {
      it('should match unrecognized spirits to Other Spirits', () => {
        expect(matchesSpiritCategory('Baijiu', 'Other Spirits')).toBe(true);
        expect(matchesSpiritCategory('Aquavit', 'Other Spirits')).toBe(true);
        expect(matchesSpiritCategory('Soju', 'Other Spirits')).toBe(true);
      });

      it('should match empty/undefined to Other Spirits', () => {
        expect(matchesSpiritCategory(undefined, 'Other Spirits')).toBe(true);
        expect(matchesSpiritCategory('', 'Other Spirits')).toBe(true);
      });

      it('should NOT match known spirits to Other Spirits', () => {
        expect(matchesSpiritCategory('Bourbon', 'Other Spirits')).toBe(false);
        expect(matchesSpiritCategory('Rum', 'Other Spirits')).toBe(false);
        expect(matchesSpiritCategory('Gin', 'Other Spirits')).toBe(false);
      });
    });

    describe('matching with name parameter', () => {
      it('should use name for matching when type is generic', () => {
        expect(matchesSpiritCategory('Spirit', 'Whiskey', 'Buffalo Trace Bourbon')).toBe(true);
        expect(matchesSpiritCategory('', 'Rum', 'Bacardi White Rum')).toBe(true);
      });

      it('should return false for empty type with no name match', () => {
        expect(matchesSpiritCategory(undefined, 'Whiskey', null)).toBe(false);
        expect(matchesSpiritCategory('', 'Gin', '')).toBe(false);
      });
    });

    describe('word boundary matching', () => {
      it('should NOT match "ginger beer" to Gin (word boundary)', () => {
        expect(matchesSpiritCategory('mixer', 'Gin', 'Ginger Beer')).toBe(false);
        expect(matchesSpiritCategory('', 'Gin', 'Fever Tree Ginger Beer')).toBe(false);
      });

      it('should still match actual gin products', () => {
        expect(matchesSpiritCategory('gin', 'Gin', 'Hendricks Gin')).toBe(true);
        expect(matchesSpiritCategory('', 'Gin', 'Tanqueray London Dry Gin')).toBe(true);
      });
    });
  });

  describe('getSpiritCategories', () => {
    it('should return all spirit categories', () => {
      const categories = getSpiritCategories();
      expect(categories).toContain('Whiskey');
      expect(categories).toContain('Rum');
      expect(categories).toContain('Gin');
      expect(categories).toContain('Vodka');
      expect(categories).toContain('Tequila');
      expect(categories).toContain('Brandy');
      expect(categories).toContain('Other Spirits');
    });

    it('should return exactly 7 categories', () => {
      const categories = getSpiritCategories();
      expect(categories).toHaveLength(7);
    });

    it('should return categories in correct type', () => {
      const categories = getSpiritCategories();
      categories.forEach(cat => {
        expect(typeof cat).toBe('string');
      });
    });
  });
});
