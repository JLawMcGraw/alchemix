/**
 * Hexagonal Backbone Layout Engine
 *
 * Creates chemistry-inspired molecular visualizations for cocktail recipes.
 * The algorithm is DETERMINISTIC - same recipe always produces identical layout.
 *
 * ## Visual Structure
 *
 * ```
 *        [Garnish]
 *           |
 *      ┌────┴────┐
 *     /          \
 *   [Ac]──────[SPIRIT]──────[Sw]
 *     \          /
 *      └────┬────┘
 *           |
 *        [Bt]
 * ```
 *
 * - **Spirits** occupy benzene-style hexagon rings at the center
 * - **Other ingredients** attach to hexagon corners via bonds
 * - **Chains** extend outward at 120° angles (hexagonal zig-zag)
 *
 * ## Algorithm Overview
 *
 * 1. **Spirit Positioning**: Place spirit nodes first using preset patterns:
 *    - 1 spirit: centered
 *    - 2 spirits: vertical stack
 *    - 3 spirits: triangle (same type) or V-shape (different types)
 *    - 4 spirits: rhombus (duplicates) or vertical stack (all different)
 *    - 5+ spirits: vertical stack
 *
 * 2. **Ingredient Distribution**: Assign ingredients to spirit hexagon corners:
 *    - Acids → right corners (1, 0, 2)
 *    - Sweets → branch from acids or use adjacent corners
 *    - Bitters → left corners (4, 5, 3)
 *    - Garnishes → remaining corners
 *
 * 3. **Chain Layout**: Each corner can have up to MAX_CHAIN_LENGTH (4) ingredients
 *    - Chains extend at 120° angles (±60° alternating for zig-zag)
 *    - Junction nodes created when multiple ingredients share a branch point
 *
 * 4. **Collision Detection**: Prevent overlapping nodes with MIN_NODE_DISTANCE
 *
 * 5. **Bounds Clamping**: Ensure all nodes stay within CANVAS_PADDING
 *
 * ## Determinism
 *
 * Layout consistency is achieved via:
 * - Seeded random number generator based on ingredient name hash
 * - Fixed corner assignment priorities
 * - No force simulation (pure geometric calculation)
 */

import type {
  ClassifiedIngredient,
  MoleculeNode,
  LayoutOptions,
  MoleculeBackbone,
  IngredientType,
} from './types';
import { 
  DEFAULT_LAYOUT_OPTIONS, 
  isInlineType, 
  isTerminalType, 
  TYPE_COLORS,
  SPIRIT_FAMILY_KEYWORDS,
  SPIRIT_FAMILY_ROTATION,
  type SpiritFamily,
} from './types';
import { getDisplayLabel } from './classifier';
import {
  HEX_RADIUS,
  TEXT_RADIUS,
  TARGET_BOND_LENGTH,
  CHAIN_BOND_LENGTH,
  HEX_GRID_SPACING,
  CORNER_ANGLES,
  EDGE_ANGLES,
  MAX_CHAIN_LENGTH,
  MIN_NODE_DISTANCE,
  CANVAS_PADDING,
  INLINE_BRANCH_ANGLE,
  TERMINAL_BRANCH_ANGLE,
} from './constants';

// ═══════════════════════════════════════════════════════════════
// HEXAGON GEOMETRY
// ═══════════════════════════════════════════════════════════════

interface HexVertex {
  x: number;
  y: number;
  angle: number;
}

/**
 * Generate hexagon vertices
 * Vertices are numbered 0-5, starting from top, going clockwise
 */
function getHexagonVertices(
  cx: number,
  cy: number,
  radius: number
): HexVertex[] {
  const vertices: HexVertex[] = [];
  for (let i = 0; i < 6; i++) {
    // Start from top (-90°), go clockwise
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    vertices.push({
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
      angle,
    });
  }
  return vertices;
}

/**
 * Get position extending outward from a hexagon vertex
 */
function getExtendedPosition(
  vertex: HexVertex,
  cx: number,
  cy: number,
  distance: number
): { x: number; y: number } {
  return {
    x: vertex.x + Math.cos(vertex.angle) * distance,
    y: vertex.y + Math.sin(vertex.angle) * distance,
  };
}

// ═══════════════════════════════════════════════════════════════
// SPIRIT FAMILY DETECTION
// ═══════════════════════════════════════════════════════════════

/**
 * Determine the spirit family from an ingredient name.
 * Matches against known spirit keywords.
 * 
 * @param spiritName - The name of the spirit ingredient
 * @returns The spirit family, or 'other' if unrecognized
 */
export function getSpiritFamily(spiritName: string): SpiritFamily {
  const lower = spiritName.toLowerCase();
  for (const [keyword, family] of Object.entries(SPIRIT_FAMILY_KEYWORDS)) {
    if (lower.includes(keyword)) return family;
  }
  return 'other';
}

/**
 * Determine the dominant spirit family from a list of spirits.
 * Uses majority voting with first-listed as tiebreaker.
 * 
 * @param spirits - Array of classified spirit ingredients
 * @returns The dominant spirit family
 */
export function getDominantSpiritFamily(spirits: ClassifiedIngredient[]): SpiritFamily {
  if (spirits.length === 0) return 'other';
  
  // Count occurrences of each family
  const familyCounts: Record<SpiritFamily, number> = {
    whiskey: 0,
    rum: 0,
    gin: 0,
    tequila: 0,
    vodka: 0,
    brandy: 0,
    other: 0,
  };
  
  spirits.forEach(s => {
    const family = getSpiritFamily(s.name);
    familyCounts[family]++;
  });
  
  // Find max count
  let maxCount = 0;
  let maxFamily: SpiritFamily = 'other';
  
  for (const [family, count] of Object.entries(familyCounts)) {
    if (count > maxCount) {
      maxCount = count;
      maxFamily = family as SpiritFamily;
    }
  }
  
  // Check for tie - use first spirit as tiebreaker
  const tiedFamilies = Object.entries(familyCounts)
    .filter(([_, count]) => count === maxCount)
    .map(([family]) => family as SpiritFamily);
  
  if (tiedFamilies.length > 1) {
    const firstSpiritFamily = getSpiritFamily(spirits[0].name);
    if (tiedFamilies.includes(firstSpiritFamily)) {
      return firstSpiritFamily;
    }
  }
  
  return maxFamily;
}

/**
 * Compute the rotation angle for a molecule based on its dominant spirit family.
 * 
 * @param spirits - Array of classified spirit ingredients
 * @returns Rotation angle in degrees
 */
export function computeMoleculeRotation(spirits: ClassifiedIngredient[]): number {
  const family = getDominantSpiritFamily(spirits);
  return SPIRIT_FAMILY_ROTATION[family];
}

/**
 * Adjust corner indices to compensate for molecule rotation.
 * 
 * When a molecule is rotated, we need to shift which corners are "preferred"
 * so that after rotation, the branches still end up in the expected positions
 * (acids on east, bitters on west, etc.).
 * 
 * @param corners - Original corner preferences (e.g., [1, 0, 2] for acids)
 * @param rotationDegrees - Rotation angle in degrees (0, 60, 120, 180, 240, 300)
 * @returns Adjusted corner indices
 */
function adjustCornersForRotation(corners: number[], rotationDegrees: number): number[] {
  // Each corner is 60° apart, so we shift by rotation/60
  // We shift in the opposite direction to compensate for the rotation
  const shift = Math.round(rotationDegrees / 60) % 6;
  if (shift === 0) return corners;
  
  return corners.map(corner => {
    // Subtract shift (opposite of rotation) and wrap around 0-5
    let adjusted = (corner - shift) % 6;
    if (adjusted < 0) adjusted += 6;
    return adjusted;
  });
}

// ═══════════════════════════════════════════════════════════════
// RING FORMATION FOR EQUAL-AMOUNT INGREDIENTS
// ═══════════════════════════════════════════════════════════════

/**
 * Represents a group of same-type ingredients that should form a ring.
 */
export interface RingGroup {
  type: IngredientType;
  ingredients: ClassifiedIngredient[];
  ringSize: number;
}

/**
 * Detect groups of ingredients that should form rings.
 * 
 * A ring is formed when:
 * - 3-6 ingredients of the same type
 * - All have non-null amounts
 * - All amounts are exactly equal
 * 
 * @param ingredients - Array of classified ingredients (excluding spirits)
 * @returns Array of ring groups to be formed
 */
export function detectRingGroups(ingredients: ClassifiedIngredient[]): RingGroup[] {
  const ringGroups: RingGroup[] = [];
  
  // Group ingredients by type (excluding spirits and junctions)
  const byType: Record<string, ClassifiedIngredient[]> = {};
  
  for (const ing of ingredients) {
    if (ing.type === 'spirit' || ing.type === 'junction') continue;
    
    if (!byType[ing.type]) {
      byType[ing.type] = [];
    }
    byType[ing.type].push(ing);
  }
  
  // Check each type group for ring eligibility
  for (const [type, group] of Object.entries(byType)) {
    // Need 3-6 ingredients for a ring
    if (group.length < 3 || group.length > 6) continue;
    
    // All must have non-null amounts
    if (group.some(ing => ing.amount === null)) continue;
    
    // All amounts must be exactly equal
    const firstAmount = group[0].amount;
    const allEqual = group.every(ing => ing.amount === firstAmount);
    
    if (allEqual) {
      ringGroups.push({
        type: type as IngredientType,
        ingredients: group,
        ringSize: group.length,
      });
    }
  }
  
  return ringGroups;
}

/**
 * Ring vertex positions for a regular polygon.
 */
interface RingVertex {
  x: number;
  y: number;
  angle: number;  // Angle from ring center
}

/**
 * Computed ring layout with vertex positions.
 */
export interface RingLayout {
  centerX: number;
  centerY: number;
  vertices: RingVertex[];
  attachmentVertexIndex: number;  // Which vertex connects to backbone
  radius: number;  // Ring radius
}

/**
 * Compute the layout for a ring of ingredients.
 * 
 * The ring is positioned so that one vertex (the attachment vertex) is
 * at the attachment point, with the ring extending outward from the backbone.
 * 
 * @param ringSize - Number of vertices (3-6)
 * @param attachX - X coordinate of attachment point (where ring connects to backbone)
 * @param attachY - Y coordinate of attachment point
 * @param incomingAngle - Angle from backbone to attachment point
 * @returns Ring layout with vertex positions
 */
export function computeRingLayout(
  ringSize: number,
  attachX: number,
  attachY: number,
  incomingAngle: number
): RingLayout {
  // Ring radius based on standard bond length
  // Using slightly smaller radius for rings to keep them compact
  const ringRadius = CHAIN_BOND_LENGTH * 0.7;
  
  // Calculate internal angle of regular polygon
  // Internal angle = (n-2) * 180 / n
  const internalAngle = ((ringSize - 2) * Math.PI) / ringSize;
  
  // Angle between adjacent vertices from center
  const vertexAngle = (2 * Math.PI) / ringSize;
  
  // The attachment vertex is at index 0
  // Position ring center so vertex 0 is at attachment point
  // Ring extends in the direction of incomingAngle
  const centerX = attachX + Math.cos(incomingAngle) * ringRadius;
  const centerY = attachY + Math.sin(incomingAngle) * ringRadius;
  
  // Generate vertices
  // Start from the attachment point and go around
  const vertices: RingVertex[] = [];
  
  // First vertex is at attachment point
  // Calculate starting angle: the angle from center to attachment point
  const startAngle = Math.atan2(attachY - centerY, attachX - centerX);
  
  for (let i = 0; i < ringSize; i++) {
    const angle = startAngle + i * vertexAngle;
    vertices.push({
      x: centerX + ringRadius * Math.cos(angle),
      y: centerY + ringRadius * Math.sin(angle),
      angle,
    });
  }
  
  return {
    centerX,
    centerY,
    vertices,
    attachmentVertexIndex: 0,
    radius: ringRadius,
  };
}

/**
 * Get the preferred corner for a ring based on its ingredient type.
 * This determines where the ring attaches to the spirit backbone.
 * 
 * @param type - Ingredient type
 * @param rotationDegrees - Molecule rotation to compensate for
 */
function getRingPreferredCorner(type: IngredientType, rotationDegrees: number = 0): number[] {
  let baseCorners: number[];
  switch (type) {
    case 'acid':
      baseCorners = [2, 1, 3]; // Lower-right area
      break;
    case 'sweet':
      baseCorners = [0, 1, 5]; // Upper-right area
      break;
    case 'bitter':
      baseCorners = [4, 5, 3]; // Left area
      break;
    case 'garnish':
      baseCorners = [5, 0, 4]; // Upper-left area
      break;
    default:
      baseCorners = [2, 3, 1]; // Default to bottom area
  }
  return adjustCornersForRotation(baseCorners, rotationDegrees);
}

// ═══════════════════════════════════════════════════════════════
// MAIN LAYOUT FUNCTION
// ═══════════════════════════════════════════════════════════════

/**
 * Compute node positions for a molecular recipe visualization.
 *
 * This is the main entry point for the layout algorithm. It takes classified
 * ingredients and returns positioned nodes ready for rendering.
 *
 * @param ingredients - Array of classified ingredients from the classifier
 * @param options - Layout configuration (width, height, chaos, radii)
 * @returns Array of positioned MoleculeNode objects with x, y coordinates
 *
 * @example
 * ```typescript
 * const classified = classifyIngredients(parseIngredients(recipe.ingredients));
 * const nodes = computeLayout(classified, { width: 400, height: 300 });
 * // nodes now have x, y positions for rendering
 * ```
 *
 * @remarks
 * The algorithm processes in phases:
 * 1. Separate spirits from other ingredients
 * 2. Position spirits using preset geometric patterns
 * 3. Assign other ingredients to hexagon corners
 * 4. Chain ingredients that share corners
 * 5. Detect and resolve collisions
 * 6. Clamp positions to canvas bounds
 */
export function computeLayout(
  ingredients: ClassifiedIngredient[],
  options: Partial<LayoutOptions> = {}
): MoleculeNode[] {
  const opts: LayoutOptions = { ...DEFAULT_LAYOUT_OPTIONS, ...options };
  const { width, height, chaos } = opts;

  if (ingredients.length === 0) return [];

  // Create seeded random for consistent layouts
  const seed = hashRecipe(ingredients);
  const random = seededRandom(seed);

  // Hexagon parameters imported from constants.ts
  // HEX_RADIUS (22), TEXT_RADIUS (8), TARGET_BOND_LENGTH (18), CHAIN_BOND_LENGTH (34)

  // True center of viewBox - spirit centroid will be placed here
  const viewCenterX = width * 0.5;
  const viewCenterY = height * 0.5;

  // CORNER_ANGLES imported from constants.ts

  // Get position at uniform distance from hexagon corner
  // This ensures all visual bond lines have the same length
  const getCornerPosition = (cx: number, cy: number, cornerIndex: number) => {
    const angle = CORNER_ANGLES[cornerIndex % 6];
    // First, get the hexagon corner position
    const cornerX = cx + Math.cos(angle) * HEX_RADIUS;
    const cornerY = cy + Math.sin(angle) * HEX_RADIUS;
    // Place ingredient so that visual bond = TARGET_BOND_LENGTH
    // Bond is drawn from corner to text center, shortened by TEXT_RADIUS at text end
    // So distance from corner = TARGET_BOND_LENGTH + TEXT_RADIUS
    const distFromCorner = TARGET_BOND_LENGTH + TEXT_RADIUS;
    return {
      x: cornerX + Math.cos(angle) * distFromCorner,
      y: cornerY + Math.sin(angle) * distFromCorner,
    };
  };

  // Separate spirits from other ingredients
  const spirits = ingredients.filter(i => i.type === 'spirit');
  const others = ingredients.filter(i => i.type !== 'spirit');

  // Compute rotation to adjust corner preferences
  // This compensates for spirit-family-based rotation applied at render time
  const moleculeRotation = computeMoleculeRotation(spirits);

  const nodes: MoleculeNode[] = [];

  // Global position tracking to avoid collisions across spirits
  const usedPositions: { x: number; y: number }[] = [];

  // Check if a position is too close to any already-placed position
  const isPositionTooClose = (x: number, y: number): boolean => {
    for (const pos of usedPositions) {
      const dx = x - pos.x;
      const dy = y - pos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < MIN_NODE_DISTANCE) {
        return true;
      }
    }
    return false;
  };

  // Register a position as used
  const registerPosition = (x: number, y: number) => {
    usedPositions.push({ x, y });
  };

  // HEX_GRID_SPACING and EDGE_ANGLES imported from constants.ts

  // Check spirit type relationships for layout decisions
  // Look for common spirit keywords in all spirit names
  const spiritKeywords = [
    'rum', 'vodka', 'gin', 'tequila', 'mezcal', 'whiskey', 'whisky', 'bourbon',
    'rye', 'scotch', 'brandy', 'cognac', 'cachaca', 'pisco', 'sake', 'soju'
  ];

  const getBaseSpiritType = (name: string): string | null => {
    const lower = name.toLowerCase();
    for (const keyword of spiritKeywords) {
      if (lower.includes(keyword)) return keyword;
    }
    return null;
  };

  // Check if ALL spirits are the same type (for 3-spirit triangle layout)
  const firstSpiritBase = spirits.length > 0 ? getBaseSpiritType(spirits[0].name) : null;
  const allSameSpiritType = spirits.length > 1 && firstSpiritBase !== null &&
    spirits.every(s => getBaseSpiritType(s.name) === firstSpiritBase);

  // Check if ALL spirits are DIFFERENT types (for 4-spirit vertical stack)
  // If any duplicates exist, use rhombus layout instead
  const spiritBaseTypes = spirits.map(s => getBaseSpiritType(s.name));
  const uniqueTypes = new Set(spiritBaseTypes.filter(t => t !== null));
  const allDifferentSpiritTypes = uniqueTypes.size === spirits.length;

  // Calculate spirit positions relative to origin (0, 0) first
  // Then find centroid and offset to place centroid at viewCenter
  const spiritPositions: { x: number; y: number }[] = [];

  if (spirits.length === 1) {
    spiritPositions.push({ x: 0, y: 0 });
  } else if (spirits.length === 2) {
    // Two spirits: place vertically adjacent on honeycomb grid
    spiritPositions.push({ x: 0, y: -HEX_GRID_SPACING / 2 });
    spiritPositions.push({ x: 0, y: HEX_GRID_SPACING / 2 });
  } else if (spirits.length === 3) {
    if (allSameSpiritType) {
      // Same spirit type: compact triangle
      const angle30 = Math.PI / 6;
      const angle330 = Math.PI * 11 / 6;
      spiritPositions.push({ x: 0, y: 0 }); // Left spirit (anchor)
      spiritPositions.push({
        x: Math.cos(angle30) * HEX_GRID_SPACING,
        y: Math.sin(angle30) * HEX_GRID_SPACING
      }); // Lower-right
      spiritPositions.push({
        x: Math.cos(angle330) * HEX_GRID_SPACING,
        y: Math.sin(angle330) * HEX_GRID_SPACING
      }); // Upper-right
    } else {
      // Different spirit types: V-shape
      const angle1 = Math.PI * 7 / 6; // 210°
      const angle2 = Math.PI * 11 / 6; // 330°
      spiritPositions.push({ x: 0, y: 0 }); // Top spirit
      spiritPositions.push({
        x: Math.cos(angle1) * HEX_GRID_SPACING,
        y: Math.sin(angle1) * HEX_GRID_SPACING
      }); // Bottom-left
      spiritPositions.push({
        x: Math.cos(angle2) * HEX_GRID_SPACING,
        y: Math.sin(angle2) * HEX_GRID_SPACING
      }); // Bottom-right
    }
  } else if (spirits.length === 4) {
    // 4 spirits: vertical stack only if ALL 4 are different types, otherwise rhombus
    if (allDifferentSpiritTypes) {
      // All different spirit types: vertical stack (clear separation)
      const startY = -((spirits.length - 1) * HEX_GRID_SPACING) / 2;
      spirits.forEach((_, i) => {
        spiritPositions.push({ x: 0, y: startY + i * HEX_GRID_SPACING });
      });
    } else {
      // Has duplicate spirit types: rhombus layout (compact honeycomb cluster)
      // 4 hexagons arranged as a rhombus where all touch their neighbors:
      //      [1]
      // [0]      [3]
      //      [2]
      // Using honeycomb grid directions (30° and 330° from hex 0)
      const cos30 = Math.sqrt(3) / 2; // ≈ 0.866
      const sin30 = 0.5;
      spiritPositions.push({ x: 0, y: 0 }); // left anchor
      spiritPositions.push({ x: cos30 * HEX_GRID_SPACING, y: -sin30 * HEX_GRID_SPACING }); // upper-right
      spiritPositions.push({ x: cos30 * HEX_GRID_SPACING, y: sin30 * HEX_GRID_SPACING }); // lower-right
      spiritPositions.push({ x: cos30 * 2 * HEX_GRID_SPACING, y: 0 }); // far right
    }
  } else {
    // 5+ spirits: vertical stack
    const startY = -((spirits.length - 1) * HEX_GRID_SPACING) / 2;
    spirits.forEach((_, i) => {
      spiritPositions.push({ x: 0, y: startY + i * HEX_GRID_SPACING });
    });
  }

  // Calculate centroid of spirit positions
  const centroidX = spiritPositions.reduce((sum, p) => sum + p.x, 0) / spiritPositions.length;
  const centroidY = spiritPositions.reduce((sum, p) => sum + p.y, 0) / spiritPositions.length;

  // Offset to place centroid at view center
  const offsetX = viewCenterX - centroidX;
  const offsetY = viewCenterY - centroidY;

  // Create spirit nodes with offset applied
  spirits.forEach((spirit, i) => {
    const x = spiritPositions[i].x + offsetX;
    const y = spiritPositions[i].y + offsetY;
    nodes.push(createNode(spirit, nodes.length, x, y, opts));
    registerPosition(x, y); // Track spirit positions for collision detection
  });

  // Handle spirit-less recipes (mocktails, mixers) by using main liquid as center
  let effectiveSpiritCount = spirits.length;
  let mainIngredientUsed: ClassifiedIngredient | null = null;
  if (spirits.length === 0) {
    if (others.length === 0) return nodes; // No ingredients at all

    // Find the main liquid ingredient to use as center (first acid, sweet, or dilution)
    const mainIngredient = others.find(i =>
      i.type === 'acid' || i.type === 'sweet' || i.type === 'dilution'
    ) || others[0]; // Fallback to first ingredient

    mainIngredientUsed = mainIngredient;

    // Place main ingredient at view center as the "spirit" equivalent
    nodes.push(createNode(
      mainIngredient,
      nodes.length,
      viewCenterX,
      viewCenterY,
      opts
    ));
    registerPosition(viewCenterX, viewCenterY); // Track position for collision detection
    // Treat as having 1 spirit for layout purposes
    effectiveSpiritCount = 1;
  }

  // Categorize other ingredients (exclude main ingredient if used as center for spirit-less recipes)
  const othersToPlace = mainIngredientUsed
    ? others.filter(i => i !== mainIngredientUsed)
    : others;
  
  // Detect ring groups (same-type ingredients with exact equal amounts)
  const ringGroups = detectRingGroups(othersToPlace);
  
  // Get all ingredients that are part of rings (to exclude from normal placement)
  const ringIngredientSet = new Set<ClassifiedIngredient>();
  ringGroups.forEach(rg => rg.ingredients.forEach(ing => ringIngredientSet.add(ing)));
  
  // Filter out ring ingredients from normal categorization
  const nonRingIngredients = othersToPlace.filter(i => !ringIngredientSet.has(i));
  
  const acids = nonRingIngredients.filter(i => i.type === 'acid');
  const sweets = nonRingIngredients.filter(i => i.type === 'sweet');
  const bitters = nonRingIngredients.filter(i => i.type === 'bitter');
  const garnishes = nonRingIngredients.filter(i => i.type === 'garnish');
  const remaining = nonRingIngredients.filter(i =>
    !['acid', 'sweet', 'bitter', 'garnish'].includes(i.type)
  );

  // Track used corners per spirit: [spiritIndex][cornerIndex] = true if used
  // Use effectiveSpiritCount to handle spirit-less recipes with virtual center
  const usedCorners: boolean[][] = Array(effectiveSpiritCount).fill(null).map(() => Array(6).fill(false));

  // Get available corners for a spirit (avoid corners pointing to other spirits)
  // With rotated hexagon: 0=upper-right, 1=right, 2=lower-right, 3=lower-left, 4=left, 5=upper-left
  // Edge directions (to adjacent hexes): 30°, 90°, 150°, 210°, 270°, 330°
  const getAvailableCorners = (spiritIdx: number): number[] => {
    if (effectiveSpiritCount === 1) {
      return [0, 1, 2, 3, 4, 5];
    }
    if (effectiveSpiritCount === 2) {
      // Vertical stack: spirit 0 on top, spirit 1 on bottom
      // Top spirit avoids lower corners (2, 3), bottom spirit avoids upper corners (0, 5)
      if (spiritIdx === 0) return [0, 1, 5, 4]; // top spirit: upper-right, right, upper-left, left
      return [1, 2, 3, 4]; // bottom spirit: right, lower-right, lower-left, left
    }
    if (effectiveSpiritCount === 3) {
      if (allSameSpiritType) {
        // Same-type triangle (SVG coords, Y+ is down):
        // - Spirit 0: Left (anchor)
        // - Spirit 1: Lower-right (at 30° from Spirit 0)
        // - Spirit 2: Upper-right (at 330° from Spirit 0)
        //
        // Flat-top hexagon corners: 0=-60°, 1=0°, 2=60°, 3=120°, 4=180°, 5=-120°
        // Edge directions to adjacent hexes:
        //   30° (lower-right) → through edge bounded by corners 1-2
        //   330° (upper-right) → through edge bounded by corners 0-1
        //   90° (down) → through edge bounded by corners 2-3
        //   270° (up) → through edge bounded by corners 5-0
        //   150° (lower-left) → through edge bounded by corners 3-4
        //   210° (upper-left) → through edge bounded by corners 4-5
        //
        // Spirit 0 (left): neighbors at 30° and 330°
        //   - 30° edge: corners 1-2; 330° edge: corners 0-1
        //   - Junction corner: 1; Edge corners: 0, 2
        //   - Available: 3, 4, 5
        //
        // Spirit 1 (lower-right): neighbors at 210° (Spirit 0) and 270° (Spirit 2)
        //   - 210° edge: corners 4-5; 270° edge: corners 5-0
        //   - Junction corner: 5; Edge corners: 0, 4
        //   - Available: 1, 2, 3
        //
        // Spirit 2 (upper-right): neighbors at 150° (Spirit 0) and 90° (Spirit 1)
        //   - 150° edge: corners 3-4; 90° edge: corners 2-3
        //   - Junction corner: 3; Edge corners: 2, 4
        //   - Available: 0, 1, 5 (corners away from both neighbors)
        if (spiritIdx === 0) return [3, 4, 5]; // left spirit
        if (spiritIdx === 1) return [1, 2, 3]; // lower-right spirit
        return [0, 5]; // upper-right spirit - corner 1 too close to Spirit 1
      } else {
        // Different-type V-shape (SVG coords where Y+ is down):
        // Spirit 0: Bottom center (anchor)
        // Spirit 1: Upper-left (at 210° from Spirit 0, which is X-, Y- in SVG)
        // Spirit 2: Upper-right (at 330° from Spirit 0, which is X+, Y- in SVG)
        //
        // Spirit 0 (bottom): neighbors at 210° and 330°
        //   - 210° edge: corners 4-5; 330° edge: corners 0-1
        //   - Available: 2, 3 (bottom corners, away from both neighbors)
        //
        // Spirit 1 (upper-left): neighbor at 30° (Spirit 0 below-right)
        //   - 30° edge: corners 1-2
        //   - Corner 0 points toward Spirit 2 - EXCLUDED to avoid overlap
        //   - Available: 3, 4, 5 (away from Spirit 0 and Spirit 2)
        //
        // Spirit 2 (upper-right): neighbor at 150° (Spirit 0 below-left)
        //   - 150° edge: corners 3-4
        //   - Corner 5 points toward Spirit 1 - EXCLUDED to avoid overlap
        //   - Available: 0, 1, 2 (away from Spirit 0 and Spirit 1)
        if (spiritIdx === 0) return [2, 3]; // bottom spirit
        if (spiritIdx === 1) return [3, 4, 5]; // upper-left spirit (no corner 0)
        return [0, 1, 2]; // upper-right spirit (no corner 5)
      }
    }
    // 4 spirits: rhombus layout (if any duplicates) or vertical stack (if all different)
    if (effectiveSpiritCount === 4 && !allDifferentSpiritTypes) {
      // Rhombus layout:
      //      [1]
      // [0]      [3]
      //      [2]
      // Spirit 0 (left): neighbors at 30° (1) and 330° (2) → avoid corners 0,1,2 (right side)
      // Spirit 1 (upper-right): neighbors at 210° (0) and 330° (3) → avoid corners 3,4,5 (left side)
      // Spirit 2 (lower-right): neighbors at 150° (0) and 30° (3) → avoid corners 4,5,0 (upper-left)
      // Spirit 3 (far right): neighbors at 150° (1) and 210° (2) → avoid corners 3,4 (left side)
      if (spiritIdx === 0) return [3, 4, 5]; // left: use left-facing corners
      if (spiritIdx === 1) return [0, 1, 5]; // upper-right: use upper and right corners
      if (spiritIdx === 2) return [1, 2, 3]; // lower-right: use lower and right corners
      return [0, 1, 2]; // far right: use right-facing corners
    }
    // 4+ vertical stack (different types or 5+ spirits)
    if (spiritIdx === 0) return [0, 1, 4, 5];
    if (spiritIdx === effectiveSpiritCount - 1) return [1, 2, 3, 4];
    return [1, 4]; // middle spirits only use left and right
  };

  // Track the last placed node and position for each corner (for chaining)
  // Now includes incomingAngle to calculate proper 120° zig-zag
  // cornerIdx tracks which corner this chain is from (for special zig-zag patterns)
  const lastNodeAtCorner: Record<string, { id: string; x: number; y: number; chainStep: number; incomingAngle: number; cornerIdx: number }> = {};

  // MAX_CHAIN_LENGTH imported from constants.ts

  // Check if a corner's chain has reached max length
  const isCornerAtMaxLength = (spiritIdx: number, cornerIdx: number): boolean => {
    const cornerKey = `${spiritIdx}-${cornerIdx}`;
    const lastNode = lastNodeAtCorner[cornerKey];
    return lastNode !== undefined && lastNode.chainStep >= MAX_CHAIN_LENGTH;
  };

  // Place ingredient at a spirit's hexagon corner
  // Inline ingredients (acid, sweet, dilution) have bonds passing through at 120° angles
  // Terminal ingredients (garnish, bitter, salt, dairy, egg) are endpoints
  const placeAtCorner = (
    ing: ClassifiedIngredient,
    spiritIdx: number,
    cornerIdx: number,
    chainOffset: number = 0,
    useJunction: boolean = false
  ): boolean => {
    const spirit = nodes[spiritIdx];
    const cornerKey = `${spiritIdx}-${cornerIdx}`;
    let parentId: string | undefined;
    let finalX: number;
    let finalY: number;
    let incomingAngle: number;

    const radialAngle = CORNER_ANGLES[cornerIdx];

    if (chainOffset === 0) {
      // First ingredient at this corner
      const basePos = getCornerPosition(spirit.x, spirit.y, cornerIdx);

      // Insert junction between spirit and ingredient when needed for branching
      if (useJunction && !cornerJunctions[cornerKey]) {
        // Create junction at distance from spirit center
        // Junction is placed so spirit-corner-to-junction visual bond = TARGET_BOND_LENGTH
        // Bond goes from hex corner to junction center (junction has no radius)
        const junctionDist = HEX_RADIUS + TARGET_BOND_LENGTH;
        const junctionX = spirit.x + Math.cos(radialAngle) * junctionDist;
        const junctionY = spirit.y + Math.sin(radialAngle) * junctionDist;
        const junction = createJunctionNode(junctionX, junctionY, spirit.id);
        junction.branchCount = 0; // Track how many branches from this junction
        nodes.push(junction);
        cornerJunctions[cornerKey] = junction;

        // Place ingredient at angle from junction based on ingredient type
        // Terminal types (garnish, bitter, etc.) use wider 109.5° tetrahedral angle
        // Inline types (acid, sweet, etc.) use standard 120° hexagonal angle
        // Junction has no visual radius, text label shortened by TEXT_RADIUS
        // So center-to-center = TARGET_BOND_LENGTH + TEXT_RADIUS
        const branchAngleOffset = isTerminalType(ing.type) ? TERMINAL_BRANCH_ANGLE : INLINE_BRANCH_ANGLE;
        // For corners on the right side (1, 2), branch upward (-offset) so chains
        // zig-zag in upper-right quadrant instead of always going down-right.
        // For corners on the left side (3, 4), also branch upward for symmetry.
        // Upper corners (0, 5) branch downward (+offset) toward center mass.
        const useNegativeOffset = (cornerIdx === 1 || cornerIdx === 2 || cornerIdx === 3 || cornerIdx === 4);
        const branchAngle = useNegativeOffset
          ? radialAngle - branchAngleOffset
          : radialAngle + branchAngleOffset;
        const junctionToBranchLength = TARGET_BOND_LENGTH + TEXT_RADIUS; // 26px → 18px visual
        finalX = junctionX + Math.cos(branchAngle) * junctionToBranchLength;
        finalY = junctionY + Math.sin(branchAngle) * junctionToBranchLength;
        parentId = junction.id;
        incomingAngle = branchAngle;
        junction.branchCount = 1;

        // Initialize the chain tracking from junction
        lastNodeAtCorner[cornerKey] = { id: junction.id, x: junctionX, y: junctionY, chainStep: 0, incomingAngle: radialAngle, cornerIdx };
      } else if (cornerJunctions[cornerKey]) {
        // Junction already exists at this corner, connect from it
        const junction = cornerJunctions[cornerKey];
        // Alternate branch direction based on ingredient type
        // Terminal types use wider angle for more spread
        const branchNum = junction.branchCount || 0;
        const branchAngleOffset = isTerminalType(ing.type) ? TERMINAL_BRANCH_ANGLE : INLINE_BRANCH_ANGLE;
        const branchAngle = radialAngle + (branchNum % 2 === 0 ? branchAngleOffset : -branchAngleOffset);
        // Junction has no visual radius, text label shortened by TEXT_RADIUS
        const junctionToBranchLength = TARGET_BOND_LENGTH + TEXT_RADIUS; // 26px to match first branch
        finalX = junction.x + Math.cos(branchAngle) * junctionToBranchLength;
        finalY = junction.y + Math.sin(branchAngle) * junctionToBranchLength;
        parentId = junction.id;
        incomingAngle = branchAngle;
        junction.branchCount = (junction.branchCount || 0) + 1;
      } else {
        // No junction - direct connection from spirit
        finalX = basePos.x;
        finalY = basePos.y;
        parentId = spirit.id;
        incomingAngle = radialAngle;
      }
    } else {
      // Chained ingredient: continue from previous node at appropriate angle
      const lastNode = lastNodeAtCorner[cornerKey];
      if (lastNode) {
        // Calculate outgoing angle based on ingredient type
        // Terminal types use wider 109.5° tetrahedral angle
        // Inline types use standard 120° hexagonal zig-zag
        const stepNum = lastNode.chainStep;
        const baseBranchAngle = isTerminalType(ing.type) ? TERMINAL_BRANCH_ANGLE : INLINE_BRANCH_ANGLE;
        // Corners 1,2,3,4 start with negative offset, so invert their zig-zag pattern
        // Corners 0,5 start with positive offset, use normal pattern
        const useInvertedPattern = (lastNode.cornerIdx === 1 || lastNode.cornerIdx === 2 || 
                                    lastNode.cornerIdx === 3 || lastNode.cornerIdx === 4);
        const angleOffset = useInvertedPattern
          ? (stepNum % 2 === 0 ? -baseBranchAngle : baseBranchAngle)  // Inverted pattern
          : (stepNum % 2 === 0 ? baseBranchAngle : -baseBranchAngle); // Normal pattern
        const outAngle = lastNode.incomingAngle + angleOffset;

        // Use CHAIN_BOND_LENGTH for text-to-text connections to account for shortening at both ends
        finalX = lastNode.x + Math.cos(outAngle) * CHAIN_BOND_LENGTH;
        finalY = lastNode.y + Math.sin(outAngle) * CHAIN_BOND_LENGTH;
        parentId = lastNode.id;
        incomingAngle = outAngle;
      } else {
        // Fallback: shouldn't happen, but place at corner
        const basePos = getCornerPosition(spirit.x, spirit.y, cornerIdx);
        finalX = basePos.x;
        finalY = basePos.y;
        parentId = spirit.id;
        incomingAngle = radialAngle;
      }
    }

    // Clamp to bounds (don't skip ingredients, just keep them on canvas)
    finalX = Math.max(CANVAS_PADDING, Math.min(width - CANVAS_PADDING, finalX));
    finalY = Math.max(CANVAS_PADDING, Math.min(height - CANVAS_PADDING, finalY));

    // Check for collision with existing positions
    if (isPositionTooClose(finalX, finalY)) {
      return false; // Collision detected - caller should try another corner
    }

    // Determine if this ingredient is inline (chain continues) or terminal (chain ends)
    const isInline = isInlineType(ing.type);

    const node = createNode(ing, nodes.length, finalX, finalY, opts, parentId, isInline, incomingAngle);
    nodes.push(node);

    // Register this position to prevent future collisions
    registerPosition(finalX, finalY);

    // Update the last node at this corner for future chaining
    // Only inline nodes can have chains continue through them
    const prevChainStep = lastNodeAtCorner[cornerKey]?.chainStep ?? -1;
    const prevCornerIdx = lastNodeAtCorner[cornerKey]?.cornerIdx ?? cornerIdx;
    lastNodeAtCorner[cornerKey] = {
      id: node.id,
      x: finalX,
      y: finalY,
      chainStep: prevChainStep + 1,
      incomingAngle: incomingAngle,
      cornerIdx: prevCornerIdx
    };

    return true;
  };

  // Distribute ingredients across spirits, using corners
  // With rotated hexagon: 0=upper-right, 1=right, 2=lower-right, 3=lower-left, 4=left, 5=upper-left

  // Helper to find best available corner for a spirit, preferring certain corners
  const findBestCorner = (spiritIdx: number, preferredCorners: number[]): number | null => {
    const available = getAvailableCorners(spiritIdx);
    // First try preferred corners that are available and unused
    for (const pref of preferredCorners) {
      if (available.includes(pref) && !usedCorners[spiritIdx][pref]) {
        return pref;
      }
    }
    // Then try any unused corner
    for (const c of available) {
      if (!usedCorners[spiritIdx][c]) {
        return c;
      }
    }
    // All corners used - return null to indicate chaining needed
    return null;
  };

  // Track which corner each ingredient type is using per spirit (for chaining same type)
  const typeCornerMap: Record<string, Record<number, number>> = {
    acid: {},
    sweet: {},
    garnish: {},
    bitter: {},
  };

  // Calculate counts per type to determine when branching junctions are needed
  const totalIngredients = others.length;

  // Count how many ingredients will share each corner direction
  // Junctions only needed when multiple ingredients branch from same point
  const acidCount = acids.length;
  const sweetCount = sweets.length;
  const bitterCount = bitters.length;
  const garnishCount = garnishes.length;

  // Junction node creation helper
  let junctionCounter = 0;
  const createJunctionNode = (
    x: number,
    y: number,
    parentId?: string
  ): MoleculeNode => {
    const id = `junction-${junctionCounter++}`;
    return {
      id,
      raw: '',
      name: '',
      amount: null,
      unit: null,
      modifiers: [],
      type: 'junction',
      color: 'transparent',
      x,
      y,
      radius: 0, // Invisible
      label: '',
      parentId,
    };
  };

  // Track junctions created at each corner for reuse
  const cornerJunctions: Record<string, MoleculeNode> = {};

  // Determine which spirit each type should attach to based on spirit count
  // Strategy: Balance the visual by distributing ingredient types across spirits
  //
  // For 2 spirits (vertical stack): top=0, bottom=1
  //   - Top spirit: Acids (sour) and Sweets (balance) - the "flavor core"
  //   - Bottom spirit: Bitters (accent) and Garnishes (finish) - the "finishing touches"
  //
  // For 3 spirits (triangle or V-shape):
  //   - Spirit 0 (anchor): Acids and first sweet
  //   - Spirit 1: Remaining sweets and bitters
  //   - Spirit 2: Garnishes and remaining ingredients
  //
  // For 4+ spirits: Distribute by type groupings
  const getTypeSpirit = (type: 'acid' | 'sweet' | 'bitter' | 'garnish', index: number): number => {
    // For spirit-less recipes or single spirit, everything goes to index 0
    if (effectiveSpiritCount === 1) return 0;

    if (effectiveSpiritCount === 2) {
      // Top spirit (0) gets acids and sweets (flavor core)
      // Bottom spirit (1) gets bitters and garnishes (finishing touches)
      if (type === 'acid' || type === 'sweet') return 0;
      return 1;
    }

    if (effectiveSpiritCount === 3) {
      // Distribute by ingredient type to balance visual
      // For V-shape (different spirit types): Spirit 2 (upper-right) has horizontal corners
      // For triangle (same spirit types): Spirit 0 (left) works well
      if (type === 'acid') return allSameSpiritType ? 0 : 2; // Acids on spirit with horizontal corners
      if (type === 'sweet') return allSameSpiritType ? (index === 0 ? 0 : 1) : (index === 0 ? 2 : 1);
      if (type === 'bitter') return 1; // Bitters on spirit 1
      if (type === 'garnish') return allSameSpiritType ? 2 : 0; // Garnishes opposite from acids
      return index % 3;
    }

    // 4+ spirits: group by type, then distribute within groups
    if (type === 'acid') return 0; // All acids on first spirit
    if (type === 'sweet') return Math.min(1, effectiveSpiritCount - 1); // Sweets on second spirit
    if (type === 'bitter') return Math.min(2, effectiveSpiritCount - 1); // Bitters on third
    if (type === 'garnish') return effectiveSpiritCount - 1; // Garnishes on last spirit
    return index % effectiveSpiritCount;
  };

  // ═══════════════════════════════════════════════════════════════
  // RING PLACEMENT
  // ═══════════════════════════════════════════════════════════════
  
  // Place ring groups before individual ingredients
  let ringCounter = 0;
  ringGroups.forEach((ringGroup) => {
    const ringId = `ring-${ringCounter++}`;
    const spiritIdx = 0; // Rings always attach to first/primary spirit
    
    // Get preferred corner for this ring type, adjusted for rotation
    const preferredCorners = getRingPreferredCorner(ringGroup.type, moleculeRotation);
    const corner = findBestCorner(spiritIdx, preferredCorners);
    
    if (corner === null) return; // No available corner
    
    usedCorners[spiritIdx][corner] = true;
    
    const spirit = nodes[spiritIdx];
    const radialAngle = CORNER_ANGLES[corner];
    
    // Calculate attachment point (where ring connects to spirit backbone)
    const attachPos = getCornerPosition(spirit.x, spirit.y, corner);
    
    // Compute ring layout
    const ringLayout = computeRingLayout(
      ringGroup.ringSize,
      attachPos.x,
      attachPos.y,
      radialAngle
    );
    
    // Create nodes for each ring vertex
    ringGroup.ingredients.forEach((ing, vertexIdx) => {
      const vertex = ringLayout.vertices[vertexIdx];
      
      // Check for collision
      if (isPositionTooClose(vertex.x, vertex.y)) {
        // Skip this ring if collision detected
        // TODO: Could try repositioning instead
        return;
      }
      
      const node = createNode(
        ing,
        nodes.length,
        vertex.x,
        vertex.y,
        opts,
        vertexIdx === 0 ? spirit.id : undefined, // Only attachment vertex has parent
        false, // Ring nodes are not inline
        vertex.angle
      );
      
      // Add ring metadata
      node.ringId = ringId;
      node.ringIndex = vertexIdx;
      node.ringSize = ringGroup.ringSize;
      
      nodes.push(node);
      registerPosition(vertex.x, vertex.y);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // CHAIN PLACEMENT (non-ring ingredients)
  // ═══════════════════════════════════════════════════════════════

  // Place acids - chain them together
  // Junction only if multiple acids OR acids+sweets share same corner (sour pairing)
  acids.forEach((ing, i) => {
    const spiritIdx = getTypeSpirit('acid', i);
    // Need junction if: multiple acids, OR acid+sweet will share corner
    const needsJunction = acidCount > 1 || (acidCount > 0 && sweetCount > 0);

    if (typeCornerMap.acid[spiritIdx] === undefined) {
      // Prefer right/east corners for acids (1=right, 0=upper-right, 2=lower-right)
      // Adjust for rotation so acids still appear on east after molecule rotates
      const preferredCorners = adjustCornersForRotation([1, 0, 2], moleculeRotation);
      const corner = findBestCorner(spiritIdx, preferredCorners);
      if (corner !== null) {
        typeCornerMap.acid[spiritIdx] = corner;
        usedCorners[spiritIdx][corner] = true;
        // Only use junction if branching is needed
        placeAtCorner(ing, spiritIdx, corner, 0, needsJunction);
      } else {
        const corners = getAvailableCorners(spiritIdx);
        placeAtCorner(ing, spiritIdx, corners[0], 1, false);
      }
    } else {
      const corner = typeCornerMap.acid[spiritIdx];
      // Check if corner chain is at max length - if so, find a new corner
      if (isCornerAtMaxLength(spiritIdx, corner)) {
        const fallbackCorners = adjustCornersForRotation([0, 2, 5, 3], moleculeRotation);
        const newCorner = findBestCorner(spiritIdx, fallbackCorners); // Try other corners
        if (newCorner !== null) {
          typeCornerMap.acid[spiritIdx] = newCorner;
          usedCorners[spiritIdx][newCorner] = true;
          placeAtCorner(ing, spiritIdx, newCorner, 0, false);
        } else {
          // Fallback: continue chaining even if at max (better than not placing)
          placeAtCorner(ing, spiritIdx, corner, i, false);
        }
      } else {
        // Chain acids together - each one is 1 bond further out
        placeAtCorner(ing, spiritIdx, corner, i, false);
      }
    }
  });

  // Place sweets - chain them, potentially branching from acids for sour pairing
  // Track how many sweets placed per spirit for proper distribution
  const sweetsPlacedPerSpirit: Record<number, number> = {};

  sweets.forEach((ing, i) => {
    const spiritIdx = getTypeSpirit('sweet', i);
    sweetsPlacedPerSpirit[spiritIdx] = (sweetsPlacedPerSpirit[spiritIdx] || 0);
    const sweetNumOnSpirit = sweetsPlacedPerSpirit[spiritIdx];

    // Need junction only if multiple sweets on their own corner
    const needsJunction = sweetCount > 1;

    // If we have acids on the same spirit and this is the first sweet, branch from the last acid
    // This creates the classic acid-sweet "sour" branch
    if (sweetNumOnSpirit === 0 && acids.length > 0 && typeCornerMap.acid[spiritIdx] !== undefined) {
      const acidCorner = typeCornerMap.acid[spiritIdx];
      // Place sweet as a branch from the acid chain
      placeAtCorner(ing, spiritIdx, acidCorner, acids.length, false);
      typeCornerMap.sweet[spiritIdx] = acidCorner;
      sweetsPlacedPerSpirit[spiritIdx]++;
    } else if (typeCornerMap.sweet[spiritIdx] === undefined) {
      // First sweet at this spirit (no acids) - find a corner
      // Adjust for rotation to maintain consistent visual placement
      const allCorners = adjustCornersForRotation([1, 2, 0, 3, 4, 5], moleculeRotation);
      for (const corner of allCorners) {
        const available = getAvailableCorners(spiritIdx);
        if (available.includes(corner) && !usedCorners[spiritIdx][corner]) {
          if (placeAtCorner(ing, spiritIdx, corner, 0, needsJunction)) {
            typeCornerMap.sweet[spiritIdx] = corner;
            usedCorners[spiritIdx][corner] = true;
            sweetsPlacedPerSpirit[spiritIdx]++;
            break;
          }
        }
      }
    } else {
      // After first 2 sweets on this spirit, find a NEW corner for better distribution
      if (sweetNumOnSpirit >= 2) {
        // Prefer left corners for variety, adjusted for rotation
        const preferLeft = adjustCornersForRotation([4, 5, 3, 0, 1, 2], moleculeRotation);
        let placed = false;
        for (const altCorner of preferLeft) {
          const currentCorner = typeCornerMap.sweet[spiritIdx];
          if (altCorner !== currentCorner) {
            const available = getAvailableCorners(spiritIdx);
            if (available.includes(altCorner) && !usedCorners[spiritIdx][altCorner]) {
              if (placeAtCorner(ing, spiritIdx, altCorner, 0, false)) {
                usedCorners[spiritIdx][altCorner] = true;
                typeCornerMap.sweet[spiritIdx] = altCorner;
                sweetsPlacedPerSpirit[spiritIdx]++;
                placed = true;
                break;
              }
            }
          }
        }
        // Fallback: chain from current corner
        if (!placed) {
          const corner = typeCornerMap.sweet[spiritIdx];
          placeAtCorner(ing, spiritIdx, corner, sweetNumOnSpirit, false);
          sweetsPlacedPerSpirit[spiritIdx]++;
        }
      } else {
        // Chain from current corner (sweets 1-2)
        const corner = typeCornerMap.sweet[spiritIdx];
        placeAtCorner(ing, spiritIdx, corner, sweetNumOnSpirit, false);
        sweetsPlacedPerSpirit[spiritIdx]++;
      }
    }
  });

  // Place bitters - these get their own branch
  // Junction only if multiple bitters
  bitters.forEach((ing, i) => {
    const spiritIdx = getTypeSpirit('bitter', i);
    const needsJunction = bitterCount > 1;

    if (typeCornerMap.bitter[spiritIdx] === undefined) {
      // Prefer left/west corners for bitters (4=left, 5=upper-left, 3=lower-left)
      // Adjust for rotation so bitters still appear on west after molecule rotates
      const preferredCorners = adjustCornersForRotation([4, 5, 3], moleculeRotation);
      const corner = findBestCorner(spiritIdx, preferredCorners);
      if (corner !== null) {
        typeCornerMap.bitter[spiritIdx] = corner;
        usedCorners[spiritIdx][corner] = true;
        // Only use junction if multiple bitters
        placeAtCorner(ing, spiritIdx, corner, 0, needsJunction);
      } else {
        const corners = getAvailableCorners(spiritIdx);
        placeAtCorner(ing, spiritIdx, corners[0], 1, false);
      }
    } else {
      const corner = typeCornerMap.bitter[spiritIdx];
      placeAtCorner(ing, spiritIdx, corner, i, false);
    }
  });

  // Place garnishes - separate branch
  // Junction only if multiple garnishes
  garnishes.forEach((ing, i) => {
    const spiritIdx = getTypeSpirit('garnish', i);
    const needsJunction = garnishCount > 1;

    if (typeCornerMap.garnish[spiritIdx] === undefined) {
      // First garnish - find a corner that doesn't collide
      // Adjust for rotation to maintain consistent visual placement
      const preferredCorners = adjustCornersForRotation([4, 3, 5, 0, 1, 2], moleculeRotation);
      let placed = false;

      for (const corner of preferredCorners) {
        const available = getAvailableCorners(spiritIdx);
        if (available.includes(corner) && !usedCorners[spiritIdx][corner]) {
          if (placeAtCorner(ing, spiritIdx, corner, 0, needsJunction)) {
            typeCornerMap.garnish[spiritIdx] = corner;
            usedCorners[spiritIdx][corner] = true;
            placed = true;
            break;
          }
        }
      }

      // Fallback: try any corner even if marked used
      if (!placed) {
        for (const corner of preferredCorners) {
          if (placeAtCorner(ing, spiritIdx, corner, 0, false)) {
            typeCornerMap.garnish[spiritIdx] = corner;
            placed = true;
            break;
          }
        }
      }
    } else {
      // Second+ garnish - try branching from junction, but find open position
      const corner = typeCornerMap.garnish[spiritIdx];
      if (!placeAtCorner(ing, spiritIdx, corner, 0, false)) {
        // Collision at junction branch - try a completely different corner
        const allCorners = [0, 1, 2, 3, 4, 5];
        for (const altCorner of allCorners) {
          if (altCorner !== corner) {
            const available = getAvailableCorners(spiritIdx);
            if (available.includes(altCorner) && !usedCorners[spiritIdx][altCorner]) {
              if (placeAtCorner(ing, spiritIdx, altCorner, 0, false)) {
                usedCorners[spiritIdx][altCorner] = true;
                break;
              }
            }
          }
        }
      }
    }
  });

  // Place remaining at any available corner with spacing - distribute across spirits
  // No junctions for remaining - direct connections
  remaining.forEach((ing, i) => {
    const spiritIdx = i % effectiveSpiritCount;
    const preferredCorners = adjustCornersForRotation([2, 3, 1, 0, 4, 5], moleculeRotation);
    const corner = findBestCorner(spiritIdx, preferredCorners);

    if (corner !== null) {
      usedCorners[spiritIdx][corner] = true;
      // Direct connection, no junction
      placeAtCorner(ing, spiritIdx, corner, 0, false);
    } else {
      const corners = getAvailableCorners(spiritIdx);
      placeAtCorner(ing, spiritIdx, corners[0], 1 + Math.floor(i / corners.length), false);
    }
  });

  // Ensure all nodes are within bounds
  nodes.forEach(node => {
    node.x = Math.max(CANVAS_PADDING, Math.min(width - CANVAS_PADDING, node.x));
    node.y = Math.max(CANVAS_PADDING, Math.min(height - CANVAS_PADDING, node.y));
  });

  return nodes;
}

// ═══════════════════════════════════════════════════════════════
// NODE CREATION
// ═══════════════════════════════════════════════════════════════

/**
 * Create a MoleculeNode from a classified ingredient with position data.
 *
 * @internal
 * @param ingredient - The classified ingredient data
 * @param index - Unique index for generating node ID
 * @param x - X position in SVG coordinates
 * @param y - Y position in SVG coordinates
 * @param options - Layout options for radius calculation
 * @param parentId - ID of parent node (for bond generation)
 * @param isInline - If true, bonds can pass through this node
 * @param outgoingAngle - Direction for chained nodes
 */
function createNode(
  ingredient: ClassifiedIngredient,
  index: number,
  x: number,
  y: number,
  options: LayoutOptions,
  parentId?: string,
  isInline?: boolean,
  outgoingAngle?: number
): MoleculeNode {
  const { label, sublabel } = getDisplayLabel(ingredient.name);
  const radius = calculateRadius(ingredient, options);

  return {
    ...ingredient,
    id: `node-${index}`,
    x,
    y,
    radius,
    label,
    sublabel,
    parentId,
    isInline,
    outgoingAngle,
  };
}

// ═══════════════════════════════════════════════════════════════
// BACKBONE GENERATION
// ═══════════════════════════════════════════════════════════════

/**
 * Generate the backbone structure (central hexagon) for the molecule.
 *
 * The backbone defines the central anchor point for the visualization.
 * When nodes are provided, it centers on the first spirit node.
 *
 * @param width - Canvas width
 * @param height - Canvas height
 * @param nodes - Optional positioned nodes to center on
 * @returns MoleculeBackbone with center coordinates and radius
 */
export function generateBackbone(
  width: number,
  height: number,
  nodes?: MoleculeNode[]
): MoleculeBackbone {
  let cx = width * 0.38;
  let cy = height * 0.45;

  if (nodes && nodes.length > 0) {
    const spirit = nodes.find(n => n.type === 'spirit');
    if (spirit) {
      cx = spirit.x;
      cy = spirit.y;
    }
  }

  return {
    type: 'hexagon',
    cx,
    cy,
    radius: 45,
  };
}

/**
 * Generate SVG polygon points string for a hexagon.
 *
 * Creates a flat-top hexagon (vertex at top) suitable for use
 * in SVG <polygon> elements.
 *
 * @param cx - Center X coordinate
 * @param cy - Center Y coordinate
 * @param radius - Distance from center to vertices
 * @returns Space-separated coordinate pairs: "x1,y1 x2,y2 ..."
 */
export function hexagonPoints(cx: number, cy: number, radius: number): string {
  const points: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);
    points.push(`${x},${y}`);
  }
  return points.join(' ');
}

/**
 * Generate SVG polygon points string for an equilateral triangle.
 *
 * Creates an upward-pointing triangle suitable for use
 * in SVG <polygon> elements.
 *
 * @param cx - Center X coordinate
 * @param cy - Center Y coordinate
 * @param radius - Distance from center to vertices
 * @returns Space-separated coordinate pairs: "x1,y1 x2,y2 x3,y3"
 */
export function trianglePoints(cx: number, cy: number, radius: number): string {
  const points: string[] = [];
  for (let i = 0; i < 3; i++) {
    const angle = (Math.PI * 2 / 3) * i - Math.PI / 2;
    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);
    points.push(`${x},${y}`);
  }
  return points.join(' ');
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

/**
 * Calculate node radius based on ingredient type.
 * Spirits get larger radius to accommodate the benzene ring.
 *
 * @internal
 */
function calculateRadius(
  ingredient: ClassifiedIngredient,
  options: LayoutOptions
): number {
  if (ingredient.type === 'spirit') {
    return 18; // Larger spirit nodes for benzene ring
  }
  return options.baseRadius;
}

/**
 * Generate a deterministic hash from ingredient names.
 * Used to seed the random number generator for consistent layouts.
 *
 * @internal
 * @param ingredients - Array of classified ingredients
 * @returns Positive integer hash value
 */
function hashRecipe(ingredients: ClassifiedIngredient[]): number {
  const str = ingredients.map(i => i.name).join('|');
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

/**
 * Create a seeded pseudo-random number generator.
 *
 * Uses Linear Congruential Generator (LCG) algorithm with
 * constants from MINSTD. Ensures the same seed always
 * produces the same sequence of numbers.
 *
 * @param seed - Initial seed value (from hashRecipe)
 * @returns Function that returns next random number in [0, 1)
 *
 * @example
 * ```typescript
 * const random = seededRandom(12345);
 * console.log(random()); // Always same value for seed 12345
 * console.log(random()); // Next value in sequence
 * ```
 */
export function seededRandom(seed: number): () => number {
  return () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
}
