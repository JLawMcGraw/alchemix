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
  | 'egg'       // Egg white, yolk
  | 'junction'; // Invisible connection point (phantom node)

export type BondType =
  | 'single'      // ──── Standard ingredients
  | 'double'      // ════ Spirit-to-spirit backbone
  | 'dashed'      // ╌╌╌╌ Optional/accent ingredients
  | 'wedge'       // ▲▲▲▲ Solid wedge - garnishes (stereochem "in front")
  | 'dashedWedge'; // ◁╌╌ Dashed wedge - bitters (stereochem "behind")

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
  dilution: { fill: '#81d4fa', legend: 'Mixer' },
  garnish:  { fill: '#a5d6a7', legend: 'Garnish' },
  dairy:    { fill: '#f3e5f5', legend: 'Dairy' },
  egg:      { fill: '#fff8e1', legend: 'Egg' },
  junction: { fill: 'transparent', legend: '' }, // Invisible - not shown in legend
};

/**
 * Determines if an ingredient type is terminal (bond ends here) or inline (bonds pass through)
 *
 * INLINE (bonds pass through, chain continues):
 *   - acid: Core flavor component
 *   - sweet: Balance element
 *   - dilution: Modifier/mixer
 *
 * TERMINAL (bond ends here):
 *   - garnish: Finishing touches
 *   - bitter: Small accent (wedge bond)
 *   - salt: Final accent
 *   - dairy: Final texture
 *   - egg: Final texture
 *   - spirit: Handled separately with benzene ring
 *   - junction: Always inline by definition
 */
export function isTerminalType(type: IngredientType): boolean {
  const terminalTypes: IngredientType[] = ['garnish', 'bitter', 'salt', 'dairy', 'egg'];
  return terminalTypes.includes(type);
}

export function isInlineType(type: IngredientType): boolean {
  const inlineTypes: IngredientType[] = ['acid', 'sweet', 'dilution', 'junction'];
  return inlineTypes.includes(type);
}

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
  isInline?: boolean;       // If true, bonds pass through this node (not terminal)
  outgoingAngle?: number;   // Angle for outgoing bond (when inline)
  branchCount?: number;     // For junction nodes: how many branches have been created
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
  width: 400,
  height: 300,
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
