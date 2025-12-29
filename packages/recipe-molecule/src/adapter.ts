/**
 * Alchemix Adapter
 *
 * Transforms Alchemix recipe format into MoleculeRecipe for visualization.
 * Includes input validation and helpful warnings for common issues.
 */

import type {
  AlchemixRecipe,
  MoleculeRecipe,
  LayoutOptions,
} from './core/types';
import { DEFAULT_LAYOUT_OPTIONS } from './core/types';
import { parseIngredients } from './core/parser';
import { classifyIngredients, calculateChaos } from './core/classifier';
import { computeLayout, generateBackbone } from './core/layout';
import { generateBonds } from './core/bonds';
import {
  validateRecipe,
  validateLayoutOptions,
  validateLayout,
  logWarnings,
  ValidationError,
} from './core/validation';

// Re-export validation utilities for consumers
export {
  validateRecipe,
  validateLayoutOptions,
  ValidationError,
} from './core/validation';

// ═══════════════════════════════════════════════════════════════
// MAIN ADAPTER
// ═══════════════════════════════════════════════════════════════

/**
 * Transform an Alchemix recipe into a MoleculeRecipe for visualization.
 *
 * @param recipe - The recipe to transform (name and ingredients required)
 * @param options - Optional layout configuration
 * @returns MoleculeRecipe ready for rendering
 * @throws ValidationError if recipe is invalid (missing name, wrong type)
 *
 * @example
 * ```typescript
 * const molecule = transformRecipe({
 *   name: 'Daiquiri',
 *   ingredients: ['2 oz rum', '1 oz lime juice', '0.75 oz simple syrup'],
 * });
 * ```
 */
export function transformRecipe(
  recipe: AlchemixRecipe,
  options?: Partial<LayoutOptions>
): MoleculeRecipe {
  // Validate recipe input
  const recipeValidation = validateRecipe(recipe);
  if (!recipeValidation.valid) {
    throw new ValidationError(
      `Invalid recipe: ${recipeValidation.errors.join('; ')}`,
      { recipe, errors: recipeValidation.errors }
    );
  }
  logWarnings(recipeValidation, `Recipe "${recipe.name}"`);

  // Validate layout options
  const optionsValidation = validateLayoutOptions(options);
  if (!optionsValidation.valid) {
    throw new ValidationError(
      `Invalid layout options: ${optionsValidation.errors.join('; ')}`,
      { options, errors: optionsValidation.errors }
    );
  }
  logWarnings(optionsValidation, 'Layout options');

  const opts: LayoutOptions = { ...DEFAULT_LAYOUT_OPTIONS, ...options };

  // 1. Normalize ingredients to array
  const ingredientList = normalizeIngredients(recipe.ingredients);

  if (ingredientList.length === 0) {
    // Return empty molecule for recipes with no ingredients
    return {
      name: recipe.name,
      method: deriveMethod(recipe.instructions, recipe.glass),
      nodes: [],
      bonds: [],
      backbone: generateBackbone(opts.width, opts.height),
    };
  }

  // 2. Parse ingredient strings into structured data
  const parsed = parseIngredients(ingredientList);

  // 3. Classify each ingredient by type
  const classified = classifyIngredients(parsed);

  // 4. Calculate chaos level based on ingredient commonness
  const chaos = options?.chaos ?? calculateChaos(classified);
  const layoutOpts = { ...opts, chaos };

  // 5. Compute node positions
  const nodes = computeLayout(classified, layoutOpts);

  // 6. Validate layout quality and log any warnings
  const layoutValidation = validateLayout(nodes, opts.width, opts.height);
  logWarnings(layoutValidation, `Layout for "${recipe.name}"`);

  // 7. Generate bonds between nodes
  const bonds = generateBonds(nodes);

  // 8. Generate backbone shape
  const backbone = generateBackbone(opts.width, opts.height, nodes);

  // 9. Derive method description from instructions/glass
  const method = deriveMethod(recipe.instructions, recipe.glass);

  return {
    name: recipe.name,
    method,
    nodes,
    bonds,
    backbone,
  };
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

/**
 * Normalize ingredients to string array
 * Handles both array and JSON string formats from Alchemix
 */
function normalizeIngredients(ingredients: string[] | string): string[] {
  if (Array.isArray(ingredients)) {
    return ingredients.filter(Boolean);
  }

  if (typeof ingredients === 'string') {
    try {
      const parsed = JSON.parse(ingredients);
      if (Array.isArray(parsed)) {
        return parsed.filter(Boolean);
      }
    } catch {
      // Not JSON, treat as single ingredient or delimiter-separated
      return ingredients
        .split(/[;|]/)
        .map(s => s.trim())
        .filter(Boolean);
    }
  }

  return [];
}

/**
 * Derive method description from instructions and glass type
 */
function deriveMethod(
  instructions?: string,
  glass?: string
): string | undefined {
  const parts: string[] = [];

  // Extract technique from instructions
  if (instructions) {
    const lower = instructions.toLowerCase();

    if (lower.includes('shake')) {
      parts.push('shake');
    } else if (lower.includes('stir')) {
      parts.push('stir');
    } else if (lower.includes('build')) {
      parts.push('build');
    } else if (lower.includes('muddle')) {
      parts.push('muddle');
    } else if (lower.includes('blend')) {
      parts.push('blend');
    }

    // Check for straining
    if (lower.includes('strain') || lower.includes('double strain')) {
      parts.push('strain');
    }
  }

  // Add glass type
  if (glass) {
    const glassType = normalizeGlass(glass);
    if (glassType) {
      parts.push(glassType);
    }
  }

  return parts.length > 0 ? parts.join(' · ') : undefined;
}

/**
 * Normalize glass names to short form
 */
function normalizeGlass(glass: string): string {
  const lower = glass.toLowerCase();

  const glassMap: Record<string, string> = {
    'coupe': 'coupe',
    'coupe glass': 'coupe',
    'martini': 'martini',
    'martini glass': 'martini',
    'cocktail glass': 'martini',
    'rocks': 'rocks',
    'rocks glass': 'rocks',
    'old fashioned': 'rocks',
    'old fashioned glass': 'rocks',
    'lowball': 'rocks',
    'highball': 'highball',
    'highball glass': 'highball',
    'collins': 'collins',
    'collins glass': 'collins',
    'nick and nora': 'nick & nora',
    'flute': 'flute',
    'champagne flute': 'flute',
    'wine glass': 'wine',
    'copper mug': 'mug',
    'moscow mule mug': 'mug',
    'hurricane': 'hurricane',
    'hurricane glass': 'hurricane',
    'tiki': 'tiki',
    'tiki mug': 'tiki',
    'shot': 'shot',
    'shot glass': 'shot',
    'snifter': 'snifter',
    'brandy snifter': 'snifter',
  };

  return glassMap[lower] || glass.toLowerCase();
}

// ═══════════════════════════════════════════════════════════════
// BATCH PROCESSING
// ═══════════════════════════════════════════════════════════════

/**
 * Transform multiple recipes at once
 */
export function transformRecipes(
  recipes: AlchemixRecipe[],
  options?: Partial<LayoutOptions>
): MoleculeRecipe[] {
  return recipes.map(recipe => transformRecipe(recipe, options));
}
