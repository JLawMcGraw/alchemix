import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  RecipeMoleculeError,
  ValidationError,
  LayoutError,
  ExportError,
  validateRecipe,
  validateLayoutOptions,
  validateLayout,
  assertValidRecipe,
  logWarnings,
  ValidationResult,
} from './validation';
import type { MoleculeNode } from './types';

describe('validation', () => {
  describe('Error Classes', () => {
    describe('RecipeMoleculeError', () => {
      it('should create error with message, code, and context', () => {
        const error = new RecipeMoleculeError('Test error', 'TEST_CODE', { foo: 'bar' });
        expect(error.message).toBe('Test error');
        expect(error.code).toBe('TEST_CODE');
        expect(error.context).toEqual({ foo: 'bar' });
        expect(error.name).toBe('RecipeMoleculeError');
      });

      it('should create error without context', () => {
        const error = new RecipeMoleculeError('Test error', 'TEST_CODE');
        expect(error.context).toBeUndefined();
      });

      it('should be an instance of Error', () => {
        const error = new RecipeMoleculeError('Test', 'TEST');
        expect(error).toBeInstanceOf(Error);
      });
    });

    describe('ValidationError', () => {
      it('should create validation error with correct code', () => {
        const error = new ValidationError('Invalid input', { field: 'name' });
        expect(error.code).toBe('VALIDATION_ERROR');
        expect(error.name).toBe('ValidationError');
        expect(error.context).toEqual({ field: 'name' });
      });

      it('should be an instance of RecipeMoleculeError', () => {
        const error = new ValidationError('Test');
        expect(error).toBeInstanceOf(RecipeMoleculeError);
      });
    });

    describe('LayoutError', () => {
      it('should create layout error with correct code', () => {
        const error = new LayoutError('Layout failed', { nodes: 5 });
        expect(error.code).toBe('LAYOUT_ERROR');
        expect(error.name).toBe('LayoutError');
        expect(error.context).toEqual({ nodes: 5 });
      });

      it('should be an instance of RecipeMoleculeError', () => {
        const error = new LayoutError('Test');
        expect(error).toBeInstanceOf(RecipeMoleculeError);
      });
    });

    describe('ExportError', () => {
      it('should create export error with correct code', () => {
        const error = new ExportError('Export failed', { format: 'png' });
        expect(error.code).toBe('EXPORT_ERROR');
        expect(error.name).toBe('ExportError');
        expect(error.context).toEqual({ format: 'png' });
      });

      it('should be an instance of RecipeMoleculeError', () => {
        const error = new ExportError('Test');
        expect(error).toBeInstanceOf(RecipeMoleculeError);
      });
    });
  });

  describe('validateRecipe', () => {
    describe('valid recipes', () => {
      it('should validate recipe with name and array ingredients', () => {
        const result = validateRecipe({
          name: 'Daiquiri',
          ingredients: ['2 oz rum', '1 oz lime juice', '0.75 oz simple syrup'],
        });
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should validate recipe with name and JSON string ingredients', () => {
        const result = validateRecipe({
          name: 'Mojito',
          ingredients: JSON.stringify(['2 oz rum', 'Mint', 'Lime']),
        });
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    describe('invalid recipes', () => {
      it('should reject null input', () => {
        const result = validateRecipe(null);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Recipe must be an object');
      });

      it('should reject undefined input', () => {
        const result = validateRecipe(undefined);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Recipe must be an object');
      });

      it('should reject non-object input', () => {
        const result = validateRecipe('string');
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Recipe must be an object');
      });

      it('should reject recipe without name', () => {
        const result = validateRecipe({ ingredients: ['rum'] });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Recipe must have a name');
      });

      it('should reject recipe with non-string name', () => {
        const result = validateRecipe({ name: 123, ingredients: ['rum'] });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Recipe name must be a string');
      });

      it('should reject recipe with empty name', () => {
        const result = validateRecipe({ name: '   ', ingredients: ['rum'] });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Recipe name cannot be empty');
      });

      it('should reject recipe with invalid ingredients type', () => {
        const result = validateRecipe({ name: 'Test', ingredients: 123 });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Ingredients must be an array or JSON string');
      });
    });

    describe('warnings', () => {
      it('should warn about missing ingredients', () => {
        const result = validateRecipe({ name: 'Empty' });
        expect(result.valid).toBe(true);
        expect(result.warnings).toContain('Recipe has no ingredients - will render empty molecule');
      });

      it('should warn about null ingredients', () => {
        const result = validateRecipe({ name: 'Null', ingredients: null });
        expect(result.valid).toBe(true);
        expect(result.warnings).toContain('Recipe has no ingredients - will render empty molecule');
      });

      it('should warn about empty ingredients array', () => {
        const result = validateRecipe({ name: 'Empty', ingredients: [] });
        expect(result.valid).toBe(true);
        expect(result.warnings).toContain('Recipe has empty ingredients array - will render empty molecule');
      });

      it('should warn about non-string ingredients in array', () => {
        const result = validateRecipe({ name: 'Mixed', ingredients: ['rum', 123, null] });
        expect(result.valid).toBe(true);
        expect(result.warnings.some(w => w.includes('are not strings'))).toBe(true);
      });

      it('should warn about JSON string that is not an array', () => {
        const result = validateRecipe({ name: 'Object', ingredients: '{"rum": "2oz"}' });
        expect(result.valid).toBe(true);
        expect(result.warnings.some(w => w.includes('not an array'))).toBe(true);
      });
    });
  });

  describe('validateLayoutOptions', () => {
    describe('valid options', () => {
      it('should accept undefined options', () => {
        const result = validateLayoutOptions(undefined);
        expect(result.valid).toBe(true);
      });

      it('should accept null options', () => {
        const result = validateLayoutOptions(null);
        expect(result.valid).toBe(true);
      });

      it('should accept valid dimensions', () => {
        const result = validateLayoutOptions({ width: 300, height: 300 });
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should accept valid chaos value', () => {
        const result = validateLayoutOptions({ chaos: 0.5 });
        expect(result.valid).toBe(true);
      });

      it('should accept valid radius values', () => {
        const result = validateLayoutOptions({ minRadius: 10, maxRadius: 30 });
        expect(result.valid).toBe(true);
      });
    });

    describe('invalid options', () => {
      it('should reject negative width', () => {
        const result = validateLayoutOptions({ width: -100 });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Width must be a positive number');
      });

      it('should reject zero width', () => {
        const result = validateLayoutOptions({ width: 0 });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Width must be a positive number');
      });

      it('should reject non-number width', () => {
        const result = validateLayoutOptions({ width: 'auto' });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Width must be a positive number');
      });

      it('should reject negative height', () => {
        const result = validateLayoutOptions({ height: -100 });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Height must be a positive number');
      });

      it('should reject non-number chaos', () => {
        const result = validateLayoutOptions({ chaos: 'high' });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Chaos must be a number');
      });

      it('should reject negative minRadius', () => {
        const result = validateLayoutOptions({ minRadius: -5 });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('minRadius must be a non-negative number');
      });

      it('should reject negative maxRadius', () => {
        const result = validateLayoutOptions({ maxRadius: -5 });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('maxRadius must be a non-negative number');
      });

      it('should reject minRadius greater than maxRadius', () => {
        const result = validateLayoutOptions({ minRadius: 30, maxRadius: 10 });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('minRadius cannot be greater than maxRadius');
      });
    });

    describe('warnings', () => {
      it('should warn about small width', () => {
        const result = validateLayoutOptions({ width: 50 });
        expect(result.valid).toBe(true);
        expect(result.warnings.some(w => w.includes('Width less than 100px'))).toBe(true);
      });

      it('should warn about small height', () => {
        const result = validateLayoutOptions({ height: 50 });
        expect(result.valid).toBe(true);
        expect(result.warnings.some(w => w.includes('Height less than 100px'))).toBe(true);
      });

      it('should warn about chaos outside 0-1 range', () => {
        const result = validateLayoutOptions({ chaos: 2 });
        expect(result.valid).toBe(true);
        expect(result.warnings.some(w => w.includes('between 0 and 1'))).toBe(true);
      });
    });
  });

  describe('validateLayout', () => {
    const createNode = (x: number, y: number, label: string): MoleculeNode => ({
      id: `node-${label}`,
      raw: label,
      name: label.toLowerCase(),
      amount: 1,
      unit: 'oz',
      modifiers: [],
      x,
      y,
      radius: 20,
      label,
      sublabel: '',
      type: 'spirit',
      color: '#000',
      isInline: false,
    });

    it('should accept valid layout with nodes inside bounds', () => {
      const nodes = [
        createNode(100, 100, 'RUM'),
        createNode(150, 150, 'LIME'),
      ];
      const result = validateLayout(nodes, 300, 300);
      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('should accept empty nodes array', () => {
      const result = validateLayout([], 300, 300);
      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('should warn about nodes near edges', () => {
      const nodes = [
        createNode(5, 5, 'RUM'), // Near top-left corner
      ];
      const result = validateLayout(nodes, 300, 300);
      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => w.includes('near canvas edge'))).toBe(true);
    });

    it('should warn about nodes outside right edge', () => {
      const nodes = [
        createNode(295, 150, 'RUM'), // Near right edge
      ];
      const result = validateLayout(nodes, 300, 300);
      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => w.includes('near canvas edge'))).toBe(true);
    });

    it('should warn about nodes outside bottom edge', () => {
      const nodes = [
        createNode(150, 295, 'RUM'), // Near bottom edge
      ];
      const result = validateLayout(nodes, 300, 300);
      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => w.includes('near canvas edge'))).toBe(true);
    });

    it('should warn about overlapping nodes', () => {
      const nodes = [
        createNode(100, 100, 'RUM'),
        createNode(105, 105, 'GIN'), // Very close to RUM
      ];
      const result = validateLayout(nodes, 300, 300);
      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => w.includes('may overlap'))).toBe(true);
    });

    it('should list overlapping pairs in warning', () => {
      const nodes = [
        createNode(100, 100, 'RUM'),
        createNode(105, 105, 'GIN'),
      ];
      const result = validateLayout(nodes, 300, 300);
      expect(result.warnings.some(w => w.includes('RUM-GIN'))).toBe(true);
    });

    it('should truncate long overlap list with ellipsis', () => {
      const nodes = [
        createNode(100, 100, 'A'),
        createNode(105, 105, 'B'),
        createNode(110, 110, 'C'),
        createNode(115, 115, 'D'),
        createNode(120, 120, 'E'),
      ];
      const result = validateLayout(nodes, 300, 300);
      expect(result.warnings.some(w => w.includes('...'))).toBe(true);
    });
  });

  describe('assertValidRecipe', () => {
    it('should not throw for valid recipe', () => {
      expect(() => {
        assertValidRecipe({
          name: 'Daiquiri',
          ingredients: ['rum', 'lime'],
        });
      }).not.toThrow();
    });

    it('should throw ValidationError for invalid recipe', () => {
      expect(() => {
        assertValidRecipe({ ingredients: ['rum'] });
      }).toThrow(ValidationError);
    });

    it('should include error details in thrown error', () => {
      try {
        assertValidRecipe({ ingredients: ['rum'] });
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect((error as ValidationError).context?.errors).toContain('Recipe must have a name');
      }
    });
  });

  describe('logWarnings', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let consoleWarnSpy: any;

    beforeEach(() => {
      consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleWarnSpy.mockRestore();
    });

    it('should log warnings in development mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: ['Test warning 1', 'Test warning 2'],
      };

      logWarnings(result, 'Test context');

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[recipe-molecule] Test context: Test warning 1; Test warning 2'
      );

      process.env.NODE_ENV = originalEnv;
    });

    it('should not log warnings in production mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: ['Test warning'],
      };

      logWarnings(result, 'Test context');

      expect(consoleWarnSpy).not.toHaveBeenCalled();

      process.env.NODE_ENV = originalEnv;
    });

    it('should not log when no warnings', () => {
      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      logWarnings(result, 'Test context');

      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });
});
