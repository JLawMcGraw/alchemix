/**
 * @alchemix/recipe-molecule
 *
 * Chemical bond visualization for cocktail recipes
 * Transforms recipe data into molecular structure diagrams
 *
 * @example
 * ```tsx
 * import { Molecule, transformRecipe } from '@alchemix/recipe-molecule';
 *
 * const alchemixRecipe = {
 *   name: 'Margarita',
 *   ingredients: ['2 oz Tequila', '1 oz Lime juice', '0.75 oz Cointreau'],
 *   instructions: 'Shake with ice, strain into coupe',
 *   glass: 'Coupe'
 * };
 *
 * const moleculeRecipe = transformRecipe(alchemixRecipe);
 *
 * <Molecule recipe={moleculeRecipe} />
 * ```
 */

// Core types and utilities
export * from './core/types';
export {
  parseIngredient,
  parseIngredients,
  toOunces,
} from './core/parser';
export {
  classifyIngredient,
  classifyIngredients,
  getDisplayLabel,
  calculateChaos,
} from './core/classifier';
export {
  computeLayout,
  generateBackbone,
  hexagonPoints,
  trianglePoints,
} from './core/layout';
export {
  generateBonds,
  getDoubleBondLines,
  shortenBondToEdge,
} from './core/bonds';
export {
  generateFormula,
  generateCompactFormula,
  getSymbolName,
  parseFormulaSymbols,
  type FormulaSymbolInfo,
} from './core/formula';

// Adapter
export { transformRecipe, transformRecipes } from './adapter';

// React components
export { Molecule } from './components/Molecule';
export { Backbone } from './components/Backbone';
export { Bond } from './components/Bond';
export { Node } from './components/Node';
export { Legend } from './components/Legend';
export { Tooltip } from './components/Tooltip';

// Export utilities
export {
  exportSVG,
  exportPNG,
  getSVGString,
  svgToPNG,
  getPNGDataURL,
} from './export';
