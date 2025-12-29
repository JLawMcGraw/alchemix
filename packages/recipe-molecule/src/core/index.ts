/**
 * Recipe Molecule Core
 *
 * Pure TypeScript library for transforming recipe data
 * into molecular visualization structures
 */

// Types
export * from './types';

// Constants
export * from './constants';

// Parser
export { parseIngredient, parseIngredients, toOunces } from './parser';

// Classifier
export {
  classifyIngredient,
  classifyIngredients,
  getDisplayLabel,
  getTypeName,
  calculateChaos,
} from './classifier';

// Layout
export {
  computeLayout,
  generateBackbone,
  hexagonPoints,
  trianglePoints,
} from './layout';

// Bonds
export {
  generateBonds,
  getDoubleBondLines,
  shortenBondToEdge,
} from './bonds';

// Formula
export {
  generateFormula,
  generateCompactFormula,
  getSymbolName,
  parseFormulaSymbols,
  type FormulaSymbolInfo,
} from './formula';

// Validation
export {
  ValidationError,
  LayoutError,
  ExportError,
  RecipeMoleculeError,
  validateRecipe,
  validateLayoutOptions,
  validateLayout,
  assertValidRecipe,
  logWarnings,
  type ValidationResult,
} from './validation';
