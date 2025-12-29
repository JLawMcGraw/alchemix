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
} from './types';
import { DEFAULT_LAYOUT_OPTIONS, isInlineType, isTerminalType, TYPE_COLORS } from './types';
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
  const acids = othersToPlace.filter(i => i.type === 'acid');
  const sweets = othersToPlace.filter(i => i.type === 'sweet');
  const bitters = othersToPlace.filter(i => i.type === 'bitter');
  const garnishes = othersToPlace.filter(i => i.type === 'garnish');
  const remaining = othersToPlace.filter(i =>
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

        // Place ingredient at 60° angle from junction (hexagonal zig-zag)
        // Junction has no visual radius, text label shortened by TEXT_RADIUS
        // So center-to-center = TARGET_BOND_LENGTH + TEXT_RADIUS
        // For lower-right corner (60°), branch east (0°) instead of southwest
        // This makes chains spread horizontally first, then zig-zag
        const branchAngle = (cornerIdx === 2)
          ? radialAngle - (Math.PI / 3)  // -60° → horizontal east for lower-right corner
          : radialAngle + (Math.PI / 3); // +60° for other corners
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
        // Alternate branch direction: first branch +60°, second branch -60°
        const branchNum = junction.branchCount || 0;
        const branchAngle = radialAngle + (branchNum % 2 === 0 ? (Math.PI / 3) : -(Math.PI / 3));
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
      // Chained ingredient: continue from previous node at 60° angle
      const lastNode = lastNodeAtCorner[cornerKey];
      if (lastNode) {
        // Calculate outgoing angle: incoming angle + 60° (or -60° alternating for zig-zag)
        // This creates the gentle hexagonal zig-zag pattern matching the benzene ring
        const stepNum = lastNode.chainStep;
        // Alternate between +60° and -60° to create zig-zag
        // For corner 2 (lower-right), invert the pattern since we started with -60°
        const isCorner2 = lastNode.cornerIdx === 2;
        const angleOffset = isCorner2
          ? (stepNum % 2 === 0 ? -(Math.PI / 3) : (Math.PI / 3))  // Inverted for corner 2
          : (stepNum % 2 === 0 ? (Math.PI / 3) : -(Math.PI / 3)); // Normal pattern
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
      if (type === 'acid') return 0; // Acids on anchor spirit
      if (type === 'sweet') return index === 0 ? 0 : 1; // First sweet with acids, rest on spirit 1
      if (type === 'bitter') return 1; // Bitters on spirit 1
      if (type === 'garnish') return 2; // Garnishes on spirit 2
      return index % 3;
    }

    // 4+ spirits: group by type, then distribute within groups
    if (type === 'acid') return 0; // All acids on first spirit
    if (type === 'sweet') return Math.min(1, effectiveSpiritCount - 1); // Sweets on second spirit
    if (type === 'bitter') return Math.min(2, effectiveSpiritCount - 1); // Bitters on third
    if (type === 'garnish') return effectiveSpiritCount - 1; // Garnishes on last spirit
    return index % effectiveSpiritCount;
  };

  // Place acids - chain them together
  // Junction only if multiple acids OR acids+sweets share same corner (sour pairing)
  acids.forEach((ing, i) => {
    const spiritIdx = getTypeSpirit('acid', i);
    // Need junction if: multiple acids, OR acid+sweet will share corner
    const needsJunction = acidCount > 1 || (acidCount > 0 && sweetCount > 0);

    if (typeCornerMap.acid[spiritIdx] === undefined) {
      // Prefer right/east corners for acids (1=right, 0=upper-right, 2=lower-right)
      const corner = findBestCorner(spiritIdx, [1, 0, 2]);
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
        const newCorner = findBestCorner(spiritIdx, [0, 2, 5, 3]); // Try other corners
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
      const allCorners = [1, 2, 0, 3, 4, 5];
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
        const preferLeft = [4, 5, 3, 0, 1, 2]; // Prefer left corners for variety
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
      const corner = findBestCorner(spiritIdx, [4, 5, 3]);
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
      const preferredCorners = [4, 3, 5, 0, 1, 2]; // Try all corners
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
    const corner = findBestCorner(spiritIdx, [2, 3, 1, 0, 4, 5]);

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
