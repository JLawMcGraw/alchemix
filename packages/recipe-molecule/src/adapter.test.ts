import { describe, it, expect } from 'vitest';
import {
  transformRecipe,
  transformRecipes,
  validateRecipe,
  validateLayoutOptions,
  ValidationError,
} from './adapter';
import type { AlchemixRecipe } from './core/types';

describe('adapter', () => {
  describe('transformRecipe', () => {
    describe('basic transformation', () => {
      it('should transform a simple recipe', () => {
        const recipe: AlchemixRecipe = {
          name: 'Daiquiri',
          ingredients: ['2 oz rum', '1 oz lime juice', '0.75 oz simple syrup'],
        };

        const result = transformRecipe(recipe);

        expect(result.name).toBe('Daiquiri');
        expect(result.nodes).toBeDefined();
        expect(result.nodes.length).toBeGreaterThan(0);
        expect(result.bonds).toBeDefined();
        expect(result.backbone).toBeDefined();
      });

      it('should handle recipe with no ingredients', () => {
        const recipe: AlchemixRecipe = {
          name: 'Empty',
          ingredients: [],
        };

        const result = transformRecipe(recipe);

        expect(result.name).toBe('Empty');
        expect(result.nodes).toHaveLength(0);
        expect(result.bonds).toHaveLength(0);
      });

      it('should handle recipe with JSON string ingredients', () => {
        const recipe: AlchemixRecipe = {
          name: 'Mojito',
          ingredients: JSON.stringify(['2 oz rum', 'Mint', 'Lime']),
        };

        const result = transformRecipe(recipe);

        expect(result.name).toBe('Mojito');
        expect(result.nodes.length).toBeGreaterThan(0);
      });

      it('should handle delimiter-separated string ingredients', () => {
        const recipe: AlchemixRecipe = {
          name: 'Test',
          ingredients: '2 oz rum; 1 oz lime juice',
        };

        const result = transformRecipe(recipe);

        expect(result.name).toBe('Test');
        expect(result.nodes.length).toBeGreaterThan(0);
      });

      it('should handle pipe-separated string ingredients', () => {
        const recipe: AlchemixRecipe = {
          name: 'Test',
          ingredients: '2 oz rum | 1 oz lime juice',
        };

        const result = transformRecipe(recipe);

        expect(result.name).toBe('Test');
        expect(result.nodes.length).toBeGreaterThan(0);
      });
    });

    describe('method derivation', () => {
      it('should derive shake method from instructions', () => {
        const recipe: AlchemixRecipe = {
          name: 'Margarita',
          ingredients: ['2 oz tequila', '1 oz lime'],
          instructions: 'Shake with ice and strain',
        };

        const result = transformRecipe(recipe);

        expect(result.method).toContain('shake');
        expect(result.method).toContain('strain');
      });

      it('should derive stir method from instructions', () => {
        const recipe: AlchemixRecipe = {
          name: 'Manhattan',
          ingredients: ['2 oz rye', '1 oz sweet vermouth'],
          instructions: 'Stir with ice',
        };

        const result = transformRecipe(recipe);

        expect(result.method).toContain('stir');
      });

      it('should derive build method from instructions', () => {
        const recipe: AlchemixRecipe = {
          name: 'G&T',
          ingredients: ['2 oz gin', 'tonic'],
          instructions: 'Build in glass over ice',
        };

        const result = transformRecipe(recipe);

        expect(result.method).toContain('build');
      });

      it('should derive muddle method from instructions', () => {
        const recipe: AlchemixRecipe = {
          name: 'Mojito',
          ingredients: ['2 oz rum', 'mint', 'lime'],
          instructions: 'Muddle mint and lime, add rum',
        };

        const result = transformRecipe(recipe);

        expect(result.method).toContain('muddle');
      });

      it('should derive blend method from instructions', () => {
        const recipe: AlchemixRecipe = {
          name: 'Pina Colada',
          ingredients: ['2 oz rum', 'pineapple', 'coconut'],
          instructions: 'Blend all ingredients with ice',
        };

        const result = transformRecipe(recipe);

        expect(result.method).toContain('blend');
      });

      it('should include glass type in method', () => {
        const recipe: AlchemixRecipe = {
          name: 'Daiquiri',
          ingredients: ['2 oz rum'],
          glass: 'coupe',
        };

        const result = transformRecipe(recipe);

        expect(result.method).toContain('coupe');
      });

      it('should normalize glass names', () => {
        const testCases = [
          { glass: 'coupe glass', expected: 'coupe' },
          { glass: 'martini glass', expected: 'martini' },
          { glass: 'cocktail glass', expected: 'martini' },
          { glass: 'rocks glass', expected: 'rocks' },
          { glass: 'old fashioned', expected: 'rocks' },
          { glass: 'old fashioned glass', expected: 'rocks' },
          { glass: 'lowball', expected: 'rocks' },
          { glass: 'highball glass', expected: 'highball' },
          { glass: 'collins glass', expected: 'collins' },
          { glass: 'nick and nora', expected: 'nick & nora' },
          { glass: 'champagne flute', expected: 'flute' },
          { glass: 'copper mug', expected: 'mug' },
          { glass: 'moscow mule mug', expected: 'mug' },
          { glass: 'hurricane glass', expected: 'hurricane' },
          { glass: 'tiki mug', expected: 'tiki' },
          { glass: 'shot glass', expected: 'shot' },
          { glass: 'brandy snifter', expected: 'snifter' },
        ];

        testCases.forEach(({ glass, expected }) => {
          const recipe: AlchemixRecipe = {
            name: 'Test',
            ingredients: ['2 oz rum'],
            glass,
          };

          const result = transformRecipe(recipe);
          expect(result.method).toContain(expected);
        });
      });

      it('should return undefined method if no instructions or glass', () => {
        const recipe: AlchemixRecipe = {
          name: 'Simple',
          ingredients: ['2 oz rum'],
        };

        const result = transformRecipe(recipe);

        expect(result.method).toBeUndefined();
      });
    });

    describe('layout options', () => {
      it('should accept custom dimensions', () => {
        const recipe: AlchemixRecipe = {
          name: 'Daiquiri',
          ingredients: ['2 oz rum', '1 oz lime juice'],
        };

        const result = transformRecipe(recipe, { width: 400, height: 400 });

        // The layout should be computed with custom dimensions
        expect(result.nodes).toBeDefined();
        expect(result.backbone).toBeDefined();
      });

      it('should accept custom chaos value', () => {
        const recipe: AlchemixRecipe = {
          name: 'Daiquiri',
          ingredients: ['2 oz rum'],
        };

        // Should not throw with chaos option
        expect(() => {
          transformRecipe(recipe, { chaos: 0.5 });
        }).not.toThrow();
      });

      it('should override auto-calculated chaos when provided', () => {
        const recipe: AlchemixRecipe = {
          name: 'Daiquiri',
          ingredients: ['2 oz rum'],
        };

        // Both should work without throwing
        const result1 = transformRecipe(recipe);
        const result2 = transformRecipe(recipe, { chaos: 0.8 });

        expect(result1.nodes).toBeDefined();
        expect(result2.nodes).toBeDefined();
      });
    });

    describe('validation errors', () => {
      it('should throw ValidationError for recipe without name', () => {
        expect(() => {
          transformRecipe({ ingredients: ['rum'] } as AlchemixRecipe);
        }).toThrow(ValidationError);
      });

      it('should throw ValidationError for empty name', () => {
        expect(() => {
          transformRecipe({ name: '', ingredients: ['rum'] } as AlchemixRecipe);
        }).toThrow(ValidationError);
      });

      it('should throw ValidationError for invalid layout options', () => {
        const recipe: AlchemixRecipe = {
          name: 'Test',
          ingredients: ['rum'],
        };

        expect(() => {
          transformRecipe(recipe, { width: -100 });
        }).toThrow(ValidationError);
      });

      it('should throw ValidationError for minRadius > maxRadius', () => {
        const recipe: AlchemixRecipe = {
          name: 'Test',
          ingredients: ['rum'],
        };

        expect(() => {
          transformRecipe(recipe, { minRadius: 50, maxRadius: 10 });
        }).toThrow(ValidationError);
      });
    });

    describe('ingredient normalization', () => {
      it('should filter out falsy ingredients', () => {
        const recipe: AlchemixRecipe = {
          name: 'Test',
          ingredients: ['2 oz rum', '', null as unknown as string, '1 oz lime'],
        };

        const result = transformRecipe(recipe);

        // Should have nodes for rum and lime, not empty strings
        expect(result.nodes.length).toBeGreaterThan(0);
      });

      it('should handle invalid JSON gracefully', () => {
        const recipe: AlchemixRecipe = {
          name: 'Test',
          ingredients: 'not valid json; 2 oz rum',
        };

        const result = transformRecipe(recipe);

        // Should treat as delimiter-separated
        expect(result.nodes.length).toBeGreaterThan(0);
      });
    });

    describe('classic cocktails', () => {
      it('should transform a Negroni', () => {
        const recipe: AlchemixRecipe = {
          name: 'Negroni',
          ingredients: ['1 oz gin', '1 oz campari', '1 oz sweet vermouth'],
          instructions: 'Stir with ice, strain into rocks glass',
          glass: 'rocks',
        };

        const result = transformRecipe(recipe);

        expect(result.name).toBe('Negroni');
        // Node count depends on classification - may include modifiers
        expect(result.nodes.length).toBeGreaterThanOrEqual(3);
        expect(result.method).toContain('stir');
        expect(result.method).toContain('strain');
        expect(result.method).toContain('rocks');
      });

      it('should transform an Old Fashioned', () => {
        const recipe: AlchemixRecipe = {
          name: 'Old Fashioned',
          ingredients: ['2 oz bourbon', '0.25 oz simple syrup', '2 dashes angostura bitters'],
          glass: 'old fashioned glass',
        };

        const result = transformRecipe(recipe);

        expect(result.name).toBe('Old Fashioned');
        // Node count depends on classification - may include modifiers
        expect(result.nodes.length).toBeGreaterThanOrEqual(3);
        expect(result.method).toContain('rocks');
      });

      it('should transform a Margarita', () => {
        const recipe: AlchemixRecipe = {
          name: 'Margarita',
          ingredients: ['2 oz tequila', '1 oz lime juice', '0.75 oz cointreau'],
          instructions: 'Shake with ice and strain',
          glass: 'coupe',
        };

        const result = transformRecipe(recipe);

        expect(result.name).toBe('Margarita');
        // Node count depends on classification - may include modifiers
        expect(result.nodes.length).toBeGreaterThanOrEqual(3);
        expect(result.method).toContain('shake');
      });
    });
  });

  describe('transformRecipes', () => {
    it('should transform multiple recipes', () => {
      const recipes: AlchemixRecipe[] = [
        { name: 'Daiquiri', ingredients: ['2 oz rum', '1 oz lime'] },
        { name: 'G&T', ingredients: ['2 oz gin', 'tonic'] },
      ];

      const results = transformRecipes(recipes);

      expect(results).toHaveLength(2);
      expect(results[0].name).toBe('Daiquiri');
      expect(results[1].name).toBe('G&T');
    });

    it('should apply options to all recipes', () => {
      const recipes: AlchemixRecipe[] = [
        { name: 'Recipe 1', ingredients: ['rum'] },
        { name: 'Recipe 2', ingredients: ['gin'] },
      ];

      const results = transformRecipes(recipes, { width: 400, height: 400 });

      expect(results).toHaveLength(2);
      results.forEach(result => {
        expect(result.nodes).toBeDefined();
        expect(result.backbone).toBeDefined();
      });
    });

    it('should handle empty recipes array', () => {
      const results = transformRecipes([]);
      expect(results).toHaveLength(0);
    });

    it('should throw if any recipe is invalid', () => {
      const recipes = [
        { name: 'Valid', ingredients: ['rum'] },
        { ingredients: ['gin'] } as AlchemixRecipe, // Missing name
      ];

      expect(() => {
        transformRecipes(recipes);
      }).toThrow(ValidationError);
    });
  });

  describe('re-exported validation functions', () => {
    it('should export validateRecipe', () => {
      expect(typeof validateRecipe).toBe('function');
      const result = validateRecipe({ name: 'Test', ingredients: ['rum'] });
      expect(result.valid).toBe(true);
    });

    it('should export validateLayoutOptions', () => {
      expect(typeof validateLayoutOptions).toBe('function');
      const result = validateLayoutOptions({ width: 300 });
      expect(result.valid).toBe(true);
    });

    it('should export ValidationError', () => {
      expect(ValidationError).toBeDefined();
      const error = new ValidationError('Test');
      expect(error).toBeInstanceOf(Error);
    });
  });
});
