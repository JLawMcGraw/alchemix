import { describe, it, expect } from 'vitest';
import { parseIngredient, parseIngredients, toOunces } from './parser';

describe('Ingredient Parser', () => {
  describe('parseIngredient', () => {
    describe('Amount parsing', () => {
      it('should parse whole numbers', () => {
        const result = parseIngredient('2 oz rum');
        expect(result.amount).toBe(2);
      });

      it('should parse decimal numbers', () => {
        const result = parseIngredient('1.5 oz vodka');
        expect(result.amount).toBe(1.5);
      });

      it('should parse fractions', () => {
        const result = parseIngredient('1/2 oz lime juice');
        expect(result.amount).toBe(0.5);
      });

      it('should parse 3/4 fractions', () => {
        const result = parseIngredient('3/4 oz simple syrup');
        expect(result.amount).toBe(0.75);
      });

      it('should parse mixed numbers', () => {
        const result = parseIngredient('1 1/2 oz bourbon');
        expect(result.amount).toBe(1.5);
      });

      it('should parse 2 1/4 mixed numbers', () => {
        const result = parseIngredient('2 1/4 oz tequila');
        expect(result.amount).toBe(2.25);
      });

      it('should parse Unicode fraction ½', () => {
        const result = parseIngredient('½ oz lime juice');
        expect(result.amount).toBe(0.5);
        expect(result.unit).toBe('oz');
      });

      it('should parse Unicode fraction ¾', () => {
        const result = parseIngredient('¾ ounce fresh lime juice');
        expect(result.amount).toBe(0.75);
        expect(result.unit).toBe('oz');
      });

      it('should parse Unicode fraction ¼', () => {
        const result = parseIngredient('¼ oz simple syrup');
        expect(result.amount).toBe(0.25);
        expect(result.unit).toBe('oz');
      });

      it('should parse mixed Unicode fractions like 1½', () => {
        const result = parseIngredient('1½ oz bourbon');
        expect(result.amount).toBe(1.5);
        expect(result.unit).toBe('oz');
      });

      it('should handle no amount', () => {
        const result = parseIngredient('Orange peel');
        expect(result.amount).toBeNull();
      });

      it('should handle amount without unit', () => {
        const result = parseIngredient('1 sugar cube');
        expect(result.amount).toBe(1);
      });
    });

    describe('Unit parsing', () => {
      it('should parse oz', () => {
        const result = parseIngredient('2 oz rum');
        expect(result.unit).toBe('oz');
      });

      it('should normalize ounces to oz', () => {
        const result = parseIngredient('2 ounces rum');
        expect(result.unit).toBe('oz');
      });

      it('should parse ml', () => {
        const result = parseIngredient('30 ml vodka');
        expect(result.unit).toBe('ml');
      });

      it('should parse dash', () => {
        const result = parseIngredient('2 dashes bitters');
        expect(result.unit).toBe('dash');
      });

      it('should parse barspoon', () => {
        const result = parseIngredient('1 barspoon sugar');
        expect(result.unit).toBe('barspoon');
      });

      it('should normalize teaspoon to tsp', () => {
        const result = parseIngredient('1 teaspoon honey');
        expect(result.unit).toBe('tsp');
      });

      it('should normalize tablespoon to tbsp', () => {
        const result = parseIngredient('1 tablespoon syrup');
        expect(result.unit).toBe('tbsp');
      });

      it('should parse slice', () => {
        const result = parseIngredient('2 slices cucumber');
        expect(result.unit).toBe('slice');
      });

      it('should parse sprig', () => {
        const result = parseIngredient('1 sprig mint');
        expect(result.unit).toBe('sprig');
      });

      it('should handle no unit', () => {
        const result = parseIngredient('Orange peel');
        expect(result.unit).toBeNull();
      });
    });

    describe('Name parsing', () => {
      it('should extract ingredient name', () => {
        const result = parseIngredient('2 oz rum');
        expect(result.name).toBe('rum');
      });

      it('should extract multi-word names', () => {
        const result = parseIngredient('1 oz lime juice');
        expect(result.name).toBe('lime juice');
      });

      it('should handle names without amount/unit', () => {
        const result = parseIngredient('Orange peel');
        expect(result.name).toBe('orange peel');
      });

      it('should normalize name to lowercase', () => {
        const result = parseIngredient('2 oz BOURBON');
        expect(result.name).toBe('bourbon');
      });

      it('should preserve raw input', () => {
        const result = parseIngredient('2 oz BOURBON');
        expect(result.raw).toBe('2 oz BOURBON');
      });
    });

    describe('Modifier extraction', () => {
      it('should extract fresh modifier', () => {
        const result = parseIngredient('1 oz fresh lime juice');
        expect(result.modifiers).toContain('fresh');
        expect(result.name).toBe('lime juice');
      });

      it('should extract multiple modifiers', () => {
        const result = parseIngredient('1 oz fresh squeezed lemon juice');
        expect(result.modifiers).toContain('fresh');
        expect(result.modifiers).toContain('squeezed');
      });

      it('should extract chilled modifier', () => {
        const result = parseIngredient('2 oz chilled vodka');
        expect(result.modifiers).toContain('chilled');
      });

      it('should extract muddled modifier', () => {
        const result = parseIngredient('3 muddled mint leaves');
        expect(result.modifiers).toContain('muddled');
      });
    });

    describe('Edge cases', () => {
      it('should handle empty string', () => {
        const result = parseIngredient('');
        expect(result.name).toBe('');
        expect(result.amount).toBeNull();
        expect(result.unit).toBeNull();
      });

      it('should handle whitespace only', () => {
        const result = parseIngredient('   ');
        expect(result.name).toBe('');
      });

      it('should handle extra whitespace', () => {
        const result = parseIngredient('  2   oz   rum  ');
        expect(result.amount).toBe(2);
        expect(result.unit).toBe('oz');
        expect(result.name).toBe('rum');
      });

      it('should handle complex ingredient strings', () => {
        const result = parseIngredient('1 1/2 oz fresh lime juice');
        expect(result.amount).toBe(1.5);
        expect(result.unit).toBe('oz');
        expect(result.modifiers).toContain('fresh');
        expect(result.name).toBe('lime juice');
      });
    });
  });

  describe('parseIngredients', () => {
    it('should parse array of ingredients', () => {
      const results = parseIngredients(['2 oz rum', '1 oz lime juice']);
      expect(results).toHaveLength(2);
      expect(results[0].name).toBe('rum');
      expect(results[1].name).toBe('lime juice');
    });

    it('should parse JSON string of ingredients', () => {
      const results = parseIngredients('["2 oz rum", "1 oz lime juice"]');
      expect(results).toHaveLength(2);
      expect(results[0].name).toBe('rum');
      expect(results[1].name).toBe('lime juice');
    });

    it('should handle empty array', () => {
      const results = parseIngredients([]);
      expect(results).toHaveLength(0);
    });

    describe('each pattern expansion', () => {
      it('should expand "each:" pattern with colon', () => {
        const results = parseIngredients(['1/2 oz each: gin, brandy, and bourbon']);
        expect(results).toHaveLength(3);
        expect(results[0].name).toBe('gin');
        expect(results[0].amount).toBe(0.5);
        expect(results[1].name).toBe('brandy');
        expect(results[1].amount).toBe(0.5);
        expect(results[2].name).toBe('bourbon');
        expect(results[2].amount).toBe(0.5);
      });

      it('should expand "each" pattern without colon', () => {
        const results = parseIngredients(['1/2 oz each gin, brandy, bourbon']);
        expect(results).toHaveLength(3);
        expect(results[0].name).toBe('gin');
        expect(results[1].name).toBe('brandy');
        expect(results[2].name).toBe('bourbon');
      });

      it('should expand "each" pattern with just "and"', () => {
        const results = parseIngredients(['1 oz each rum and vodka']);
        expect(results).toHaveLength(2);
        expect(results[0].name).toBe('rum');
        expect(results[1].name).toBe('vodka');
      });

      it('should preserve other ingredients in the list', () => {
        const results = parseIngredients([
          '2 oz tequila',
          '1/2 oz each: lime juice and lemon juice',
          '1 oz simple syrup'
        ]);
        expect(results).toHaveLength(4);
        expect(results[0].name).toBe('tequila');
        expect(results[1].name).toBe('lime juice');
        expect(results[2].name).toBe('lemon juice');
        expect(results[3].name).toBe('simple syrup');
      });
    });
  });

  describe('toOunces', () => {
    it('should return oz as-is', () => {
      expect(toOunces(2, 'oz')).toBe(2);
    });

    it('should convert ml to oz', () => {
      const result = toOunces(30, 'ml');
      expect(result).toBeCloseTo(1.01, 1);
    });

    it('should convert dash to oz', () => {
      const result = toOunces(2, 'dash');
      expect(result).toBeCloseTo(0.0625, 3);
    });

    it('should convert barspoon to oz', () => {
      const result = toOunces(1, 'barspoon');
      expect(result).toBe(0.125);
    });

    it('should convert tsp to oz', () => {
      const result = toOunces(1, 'tsp');
      expect(result).toBeCloseTo(0.167, 2);
    });

    it('should convert tbsp to oz', () => {
      const result = toOunces(1, 'tbsp');
      expect(result).toBe(0.5);
    });

    it('should convert cup to oz', () => {
      const result = toOunces(1, 'cup');
      expect(result).toBe(8);
    });

    it('should return default for null amount', () => {
      expect(toOunces(null, 'oz')).toBe(0.5);
    });

    it('should handle null unit with amount', () => {
      const result = toOunces(2, null);
      expect(result).toBe(1); // 2 * 0.5 default factor
    });

    it('should handle unknown units', () => {
      const result = toOunces(1, 'unknown');
      expect(result).toBe(0.5);
    });
  });
});
