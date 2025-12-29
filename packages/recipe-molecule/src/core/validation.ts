/**
 * Input Validation
 *
 * Validates recipe input and provides meaningful error messages.
 * Also defines custom error types for the library.
 */

import type { AlchemixRecipe, LayoutOptions, MoleculeNode } from './types';

// ═══════════════════════════════════════════════════════════════
// ERROR TYPES
// ═══════════════════════════════════════════════════════════════

/**
 * Base error class for recipe-molecule errors.
 * Extends Error with additional context for debugging.
 */
export class RecipeMoleculeError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'RecipeMoleculeError';
  }
}

/**
 * Error thrown when recipe input is invalid.
 */
export class ValidationError extends RecipeMoleculeError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', context);
    this.name = 'ValidationError';
  }
}

/**
 * Error thrown during layout computation.
 */
export class LayoutError extends RecipeMoleculeError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'LAYOUT_ERROR', context);
    this.name = 'LayoutError';
  }
}

/**
 * Error thrown during export operations.
 */
export class ExportError extends RecipeMoleculeError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'EXPORT_ERROR', context);
    this.name = 'ExportError';
  }
}

// ═══════════════════════════════════════════════════════════════
// VALIDATION RESULT
// ═══════════════════════════════════════════════════════════════

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ═══════════════════════════════════════════════════════════════
// RECIPE VALIDATION
// ═══════════════════════════════════════════════════════════════

/**
 * Validate an AlchemixRecipe input.
 *
 * @param recipe - The recipe to validate
 * @returns ValidationResult with any errors or warnings
 */
export function validateRecipe(recipe: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if recipe is an object
  if (!recipe || typeof recipe !== 'object') {
    errors.push('Recipe must be an object');
    return { valid: false, errors, warnings };
  }

  const r = recipe as Record<string, unknown>;

  // Check required fields
  if (!r.name) {
    errors.push('Recipe must have a name');
  } else if (typeof r.name !== 'string') {
    errors.push('Recipe name must be a string');
  } else if (r.name.trim().length === 0) {
    errors.push('Recipe name cannot be empty');
  }

  // Check ingredients
  if (r.ingredients === undefined || r.ingredients === null) {
    warnings.push('Recipe has no ingredients - will render empty molecule');
  } else if (typeof r.ingredients === 'string') {
    // Try to parse JSON string
    try {
      const parsed = JSON.parse(r.ingredients as string);
      if (!Array.isArray(parsed)) {
        warnings.push('Ingredients JSON is not an array - will try to parse as delimiter-separated');
      }
    } catch {
      // Not JSON, that's okay - will be parsed as delimiter-separated
    }
  } else if (Array.isArray(r.ingredients)) {
    if (r.ingredients.length === 0) {
      warnings.push('Recipe has empty ingredients array - will render empty molecule');
    }
    // Check for non-string ingredients
    const nonStrings = r.ingredients.filter(i => typeof i !== 'string');
    if (nonStrings.length > 0) {
      warnings.push(`${nonStrings.length} ingredient(s) are not strings and will be skipped`);
    }
  } else {
    errors.push('Ingredients must be an array or JSON string');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate layout options.
 *
 * @param options - Partial layout options to validate
 * @returns ValidationResult with any errors or warnings
 */
export function validateLayoutOptions(options: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!options || typeof options !== 'object') {
    // No options is fine - defaults will be used
    return { valid: true, errors, warnings };
  }

  const o = options as Partial<LayoutOptions>;

  // Validate dimensions
  if (o.width !== undefined) {
    if (typeof o.width !== 'number' || o.width <= 0) {
      errors.push('Width must be a positive number');
    } else if (o.width < 100) {
      warnings.push('Width less than 100px may result in cramped layout');
    }
  }

  if (o.height !== undefined) {
    if (typeof o.height !== 'number' || o.height <= 0) {
      errors.push('Height must be a positive number');
    } else if (o.height < 100) {
      warnings.push('Height less than 100px may result in cramped layout');
    }
  }

  // Validate chaos
  if (o.chaos !== undefined) {
    if (typeof o.chaos !== 'number') {
      errors.push('Chaos must be a number');
    } else if (o.chaos < 0 || o.chaos > 1) {
      warnings.push('Chaos should be between 0 and 1 - values will be clamped');
    }
  }

  // Validate radii
  if (o.minRadius !== undefined && (typeof o.minRadius !== 'number' || o.minRadius < 0)) {
    errors.push('minRadius must be a non-negative number');
  }

  if (o.maxRadius !== undefined && (typeof o.maxRadius !== 'number' || o.maxRadius < 0)) {
    errors.push('maxRadius must be a non-negative number');
  }

  if (o.minRadius !== undefined && o.maxRadius !== undefined && o.minRadius > o.maxRadius) {
    errors.push('minRadius cannot be greater than maxRadius');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ═══════════════════════════════════════════════════════════════
// LAYOUT VALIDATION
// ═══════════════════════════════════════════════════════════════

/**
 * Check for layout issues after computation.
 *
 * @param nodes - Computed node positions
 * @param width - Canvas width
 * @param height - Canvas height
 * @returns ValidationResult with any warnings about layout quality
 */
export function validateLayout(
  nodes: MoleculeNode[],
  width: number,
  height: number
): ValidationResult {
  const warnings: string[] = [];

  if (nodes.length === 0) {
    return { valid: true, errors: [], warnings };
  }

  // Check for nodes outside bounds
  const padding = 20;
  const outOfBounds = nodes.filter(
    n => n.x < padding || n.x > width - padding ||
         n.y < padding || n.y > height - padding
  );

  if (outOfBounds.length > 0) {
    warnings.push(
      `${outOfBounds.length} node(s) are near canvas edge - consider increasing dimensions`
    );
  }

  // Check for overlapping nodes
  const minDistance = 20;
  const overlapping: string[] = [];

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dx = nodes[i].x - nodes[j].x;
      const dy = nodes[i].y - nodes[j].y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < minDistance) {
        overlapping.push(`${nodes[i].label}-${nodes[j].label}`);
      }
    }
  }

  if (overlapping.length > 0) {
    warnings.push(
      `${overlapping.length} node pair(s) may overlap: ${overlapping.slice(0, 3).join(', ')}${overlapping.length > 3 ? '...' : ''}`
    );
  }

  return {
    valid: true,
    errors: [],
    warnings,
  };
}

// ═══════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════

/**
 * Assert that a recipe is valid, throwing ValidationError if not.
 *
 * @param recipe - The recipe to validate
 * @throws ValidationError if recipe is invalid
 */
export function assertValidRecipe(recipe: unknown): asserts recipe is AlchemixRecipe {
  const result = validateRecipe(recipe);

  if (!result.valid) {
    throw new ValidationError(
      `Invalid recipe: ${result.errors.join('; ')}`,
      { recipe, errors: result.errors }
    );
  }
}

/**
 * Log validation warnings to console (in development mode).
 */
export function logWarnings(result: ValidationResult, context: string): void {
  if (result.warnings.length > 0 && process.env.NODE_ENV !== 'production') {
    console.warn(
      `[recipe-molecule] ${context}: ${result.warnings.join('; ')}`
    );
  }
}
