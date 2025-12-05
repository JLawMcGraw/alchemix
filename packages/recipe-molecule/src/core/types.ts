/**
 * Recipe Molecule Visualization Types
 *
 * Represents cocktail recipes as chemical-style molecular structures
 */

// ═══════════════════════════════════════════════════════════════
// INGREDIENT TYPES & CLASSIFICATION
// ═══════════════════════════════════════════════════════════════

export type IngredientType =
  | 'spirit'    // Base spirits: vodka, gin, bourbon, tequila, rum
  | 'acid'      // Sours: citrus juice, vinegar
  | 'sweet'     // Sweeteners: syrups, liqueurs, honey
  | 'bitter'    // Bitters, coffee, amari
  | 'salt'      // Salt, spices, chili
  | 'dilution'  // Water, ice, soda
  | 'garnish'   // Herbs, peels, olives, cherries
  | 'dairy'     // Cream, milk
  | 'egg';      // Egg white, yolk

export type BondType =
  | 'single'    // ──── Combined/mixed ingredients
  | 'double'    // ════ Technique bond (shaken, muddled)
  | 'dashed';   // ╌╌╌╌ Garnish/optional

// ═══════════════════════════════════════════════════════════════
// COLOR PALETTE (Design Tokens)
// ═══════════════════════════════════════════════════════════════

export interface TypeStyle {
  fill: string;
  legend: string;
}

export const TYPE_COLORS: Record<IngredientType, TypeStyle> = {
  spirit:   { fill: '#e8e8e8', legend: 'Spirit' },
  acid:     { fill: '#fff59d', legend: 'Acid' },
  sweet:    { fill: '#ffcc80', legend: 'Sweet' },
  bitter:   { fill: '#ffab91', legend: 'Bitter' },
  salt:     { fill: '#ef9a9a', legend: 'Salt' },
  dilution: { fill: '#81d4fa', legend: 'Liqueur' },
  garnish:  { fill: '#a5d6a7', legend: 'Garnish' },
  dairy:    { fill: '#f3e5f5', legend: 'Dairy' },
  egg:      { fill: '#fff8e1', legend: 'Egg' },
};

// ═══════════════════════════════════════════════════════════════
// PARSED & CLASSIFIED INGREDIENTS
// ═══════════════════════════════════════════════════════════════

export interface ParsedIngredient {
  raw: string;              // Original: "2 oz fresh lime juice"
  name: string;             // Normalized: "lime juice"
  amount: number | null;    // 2
  unit: string | null;      // "oz"
  modifiers: string[];      // ["fresh"]
}

export interface ClassifiedIngredient extends ParsedIngredient {
  type: IngredientType;
  color: string;            // Hex from TYPE_COLORS
}

// ═══════════════════════════════════════════════════════════════
// MOLECULE STRUCTURE
// ═══════════════════════════════════════════════════════════════

export interface MoleculeNode extends ClassifiedIngredient {
  id: string;               // Unique identifier
  x: number;                // Position after layout
  y: number;
  radius: number;           // Proportional to amount
  label: string;            // Display name (short)
  sublabel?: string;        // Secondary text (e.g., "blanco", "fresh")
  parentId?: string;        // ID of parent node this was chained from (for bond generation)
}

export interface MoleculeBond {
  from: string;             // Node ID
  to: string;               // Node ID
  type: BondType;
}

export interface MoleculeBackbone {
  type: 'hexagon' | 'triangle';
  cx: number;
  cy: number;
  radius: number;
}

export interface MoleculeRecipe {
  name: string;
  method?: string;          // "shake · strain · coupe"
  nodes: MoleculeNode[];
  bonds: MoleculeBond[];
  backbone: MoleculeBackbone;
}

// ═══════════════════════════════════════════════════════════════
// LAYOUT OPTIONS
// ═══════════════════════════════════════════════════════════════

export interface LayoutOptions {
  width: number;
  height: number;
  chaos: number;            // 0-1, higher = more organic/random positioning
  iterations: number;       // Force simulation iterations (more = more settled)
  minRadius: number;        // Minimum node radius
  maxRadius: number;        // Maximum node radius
  baseRadius: number;       // Default radius for unknown amounts
}

export const DEFAULT_LAYOUT_OPTIONS: LayoutOptions = {
  width: 520,
  height: 420,
  chaos: 0.5,
  iterations: 300,
  minRadius: 6,
  maxRadius: 10,
  baseRadius: 8, // Half size ingredient nodes
};

// ═══════════════════════════════════════════════════════════════
// ALCHEMIX RECIPE (Input Format)
// ═══════════════════════════════════════════════════════════════

export interface AlchemixRecipe {
  id?: number;
  name: string;
  ingredients: string[] | string;  // Array or JSON string
  instructions?: string;
  glass?: string;
  category?: string;
}
