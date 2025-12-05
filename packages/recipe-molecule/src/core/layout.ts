/**
 * Hexagonal Backbone Layout Engine
 *
 * Creates chemical bond-style molecular structures:
 * - Central hexagonal ring (benzene) as the backbone
 * - Spirits connect to or form the hexagon
 * - Other ingredients attach at hexagon vertices
 * - Extended chain from one side for additional ingredients
 */

import type {
  ClassifiedIngredient,
  MoleculeNode,
  LayoutOptions,
  MoleculeBackbone,
} from './types';
import { DEFAULT_LAYOUT_OPTIONS } from './types';
import { getDisplayLabel } from './classifier';

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

  // Hexagon parameters - all equal for perfect hexagonal honeycomb grid
  // Must match BENZENE_RADIUS in Molecule.tsx and Bond.tsx (30)
  const hexRadius = 30; // Benzene ring radius
  const bondLength = 30; // Same as hexRadius for perfect hexagonal grid structure

  // Center positioning
  const centerX = width * 0.4;
  const centerY = height * 0.45;

  // Hexagon CORNER angles (vertices) - rotated 30° so flat edges face top/bottom
  // Starting from upper-right, going clockwise
  const CORNER_ANGLES = [
    -Math.PI / 3,         // 0: upper-right
    0,                    // 1: right
    Math.PI / 3,          // 2: lower-right
    Math.PI * 2 / 3,      // 3: lower-left
    Math.PI,              // 4: left
    -Math.PI * 2 / 3,     // 5: upper-left
  ];

  // Get position at uniform distance from hexagon corner
  // This ensures all visual bond lines have the same length
  const getCornerPosition = (cx: number, cy: number, cornerIndex: number) => {
    const angle = CORNER_ANGLES[cornerIndex % 6];
    // First, get the hexagon corner position
    const cornerX = cx + Math.cos(angle) * hexRadius;
    const cornerY = cy + Math.sin(angle) * hexRadius;
    // Then place ingredient at bondLength distance from the corner (same direction)
    return {
      x: cornerX + Math.cos(angle) * bondLength,
      y: cornerY + Math.sin(angle) * bondLength,
    };
  };

  // Separate spirits from other ingredients
  const spirits = ingredients.filter(i => i.type === 'spirit');
  const others = ingredients.filter(i => i.type !== 'spirit');

  const nodes: MoleculeNode[] = [];

  // Honeycomb grid spacing: distance between adjacent hex centers sharing an edge
  // For flat-top hexagons, this is radius * sqrt(3)
  const hexGridSpacing = hexRadius * Math.sqrt(3);

  // Edge normal angles for flat-top hexagon (directions to adjacent hex centers)
  // 30°, 90°, 150°, 210°, 270°, 330°
  const EDGE_ANGLES = [
    Math.PI / 6,        // 30° - upper-right neighbor
    Math.PI / 2,        // 90° - top neighbor
    Math.PI * 5 / 6,    // 150° - upper-left neighbor
    Math.PI * 7 / 6,    // 210° - lower-left neighbor
    Math.PI * 3 / 2,    // 270° - bottom neighbor
    Math.PI * 11 / 6,   // 330° - lower-right neighbor
  ];

  // Check if all spirits share the same base spirit type (e.g., all rums, all whiskeys)
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

  const firstSpiritBase = spirits.length > 0 ? getBaseSpiritType(spirits[0].name) : null;
  const allSameSpiritType = spirits.length > 1 && firstSpiritBase !== null &&
    spirits.every(s => getBaseSpiritType(s.name) === firstSpiritBase);

  if (spirits.length === 1) {
    nodes.push(createNode(spirits[0], nodes.length, centerX, centerY, opts));
  } else if (spirits.length === 2) {
    // Two spirits: place vertically adjacent on honeycomb grid
    // For vertical stack with edge sharing: use 90° (top) and 270° (bottom)
    nodes.push(createNode(spirits[0], nodes.length, centerX, centerY - hexGridSpacing / 2, opts));
    nodes.push(createNode(spirits[1], nodes.length, centerX, centerY + hexGridSpacing / 2, opts));
  } else if (spirits.length === 3) {
    if (allSameSpiritType) {
      // Same spirit type: compact triangle where all three hexagons touch each other
      // For flat-top hexagons on honeycomb grid (SVG coords where Y+ is down):
      // - Spirit 0: left position (anchor)
      // - Spirit 1: 30° from Spirit 0 → cos(30°)=+0.866, sin(30°)=+0.5 → lower-right in SVG
      // - Spirit 2: 330° from Spirit 0 → cos(330°)=+0.866, sin(330°)=-0.5 → upper-right in SVG
      // Spirit 1 and Spirit 2 share a vertical edge (Spirit 2 above Spirit 1)

      const angle30 = Math.PI / 6;    // 30° - lower-right direction in SVG
      const angle330 = Math.PI * 11 / 6; // 330° - upper-right direction in SVG

      // Left spirit (anchor)
      nodes.push(createNode(spirits[0], nodes.length, centerX, centerY, opts));

      // Lower-right spirit (30° from left spirit in SVG coords)
      nodes.push(createNode(spirits[1], nodes.length,
        centerX + Math.cos(angle30) * hexGridSpacing,
        centerY + Math.sin(angle30) * hexGridSpacing,
        opts));

      // Upper-right spirit (330° from left spirit in SVG coords)
      // This will also be at 90° (directly above) from lower-right spirit
      nodes.push(createNode(spirits[2], nodes.length,
        centerX + Math.cos(angle330) * hexGridSpacing,
        centerY + Math.sin(angle330) * hexGridSpacing,
        opts));
    } else {
      // Different spirit types: V-shape where they connect through a central point
      // Top spirit at center, bottom two offset by hexGridSpacing in 210° and 330° directions
      nodes.push(createNode(spirits[0], nodes.length, centerX, centerY, opts));
      // Bottom-left: 210° from top spirit
      const angle1 = Math.PI * 7 / 6; // 210°
      nodes.push(createNode(spirits[1], nodes.length,
        centerX + Math.cos(angle1) * hexGridSpacing,
        centerY + Math.sin(angle1) * hexGridSpacing,
        opts));
      // Bottom-right: 330° from top spirit
      const angle2 = Math.PI * 11 / 6; // 330°
      nodes.push(createNode(spirits[2], nodes.length,
        centerX + Math.cos(angle2) * hexGridSpacing,
        centerY + Math.sin(angle2) * hexGridSpacing,
        opts));
    }
  } else {
    // 4+ spirits: vertical stack with proper honeycomb spacing
    const startY = centerY - ((spirits.length - 1) * hexGridSpacing) / 2;
    spirits.forEach((spirit, i) => {
      nodes.push(createNode(spirit, nodes.length, centerX, startY + i * hexGridSpacing, opts));
    });
  }

  if (spirits.length === 0) return nodes;

  // Categorize other ingredients
  const acids = others.filter(i => i.type === 'acid');
  const sweets = others.filter(i => i.type === 'sweet');
  const bitters = others.filter(i => i.type === 'bitter');
  const garnishes = others.filter(i => i.type === 'garnish');
  const remaining = others.filter(i =>
    !['acid', 'sweet', 'bitter', 'garnish'].includes(i.type)
  );

  // Track used corners per spirit: [spiritIndex][cornerIndex] = true if used
  const usedCorners: boolean[][] = spirits.map(() => Array(6).fill(false));

  // Get available corners for a spirit (avoid corners pointing to other spirits)
  // With rotated hexagon: 0=upper-right, 1=right, 2=lower-right, 3=lower-left, 4=left, 5=upper-left
  // Edge directions (to adjacent hexes): 30°, 90°, 150°, 210°, 270°, 330°
  const getAvailableCorners = (spiritIdx: number): number[] => {
    if (spirits.length === 1) {
      return [0, 1, 2, 3, 4, 5];
    }
    if (spirits.length === 2) {
      // Vertical stack: spirit 0 on top, spirit 1 on bottom
      // Top spirit avoids lower corners (2, 3), bottom spirit avoids upper corners (0, 5)
      if (spiritIdx === 0) return [0, 1, 5, 4]; // top spirit: upper-right, right, upper-left, left
      return [1, 2, 3, 4]; // bottom spirit: right, lower-right, lower-left, left
    }
    if (spirits.length === 3) {
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
        //   - Available: 0, 3, 4, 5 (away from Spirit 0)
        //
        // Spirit 2 (upper-right): neighbor at 150° (Spirit 0 below-left)
        //   - 150° edge: corners 3-4
        //   - Available: 0, 1, 2, 5 (away from Spirit 0)
        if (spiritIdx === 0) return [2, 3]; // bottom spirit
        if (spiritIdx === 1) return [0, 3, 4, 5]; // upper-left spirit
        return [0, 1, 2, 5]; // upper-right spirit
      }
    }
    // 4+ vertical
    if (spiritIdx === 0) return [0, 1, 4, 5];
    if (spiritIdx === spirits.length - 1) return [1, 2, 3, 4];
    return [1, 4]; // middle spirits only use left and right
  };

  // Track the last placed node and position for each corner (for chaining)
  const lastNodeAtCorner: Record<string, { id: string; x: number; y: number; chainStep: number }> = {};

  // Place ingredient at a spirit's hexagon corner
  // When chaining (chainOffset > 0), follow hexagon edge directions in zig-zag pattern to stay on honeycomb vertices
  const placeAtCorner = (
    ing: ClassifiedIngredient,
    spiritIdx: number,
    cornerIdx: number,
    chainOffset: number = 0
  ): boolean => {
    const spirit = nodes[spiritIdx];
    const cornerKey = `${spiritIdx}-${cornerIdx}`;
    let parentId: string | undefined;
    let finalX: number;
    let finalY: number;

    const radialAngle = CORNER_ANGLES[cornerIdx];

    if (chainOffset === 0) {
      // First ingredient at this corner: place at the corner position
      const basePos = getCornerPosition(spirit.x, spirit.y, cornerIdx);
      finalX = basePos.x;
      finalY = basePos.y;
      parentId = spirit.id;
    } else {
      // Chained ingredient: start from previous node and follow hex edge
      const lastNode = lastNodeAtCorner[cornerKey];
      if (lastNode) {
        // For zig-zag chain on honeycomb, alternate between two directions
        // that are 60° apart and both go generally outward
        //
        // The first step goes at radialAngle + 60° (clockwise outward edge)
        // The second step goes at radialAngle (straight out along radial)
        // The third step goes at radialAngle + 60° again
        // This creates a zig-zag: right-down, right, right-down, right, etc.

        const stepNum = lastNode.chainStep;
        const edgeAngle = stepNum % 2 === 0
          ? radialAngle + Math.PI / 3  // First, third, fifth steps: +60°
          : radialAngle;                // Second, fourth steps: radial direction

        finalX = lastNode.x + Math.cos(edgeAngle) * bondLength;
        finalY = lastNode.y + Math.sin(edgeAngle) * bondLength;
        parentId = lastNode.id;
      } else {
        // Fallback: shouldn't happen, but place at corner
        const basePos = getCornerPosition(spirit.x, spirit.y, cornerIdx);
        finalX = basePos.x;
        finalY = basePos.y;
        parentId = spirit.id;
      }
    }

    // Clamp to bounds (don't skip ingredients, just keep them on canvas)
    const padding = 30;
    finalX = Math.max(padding, Math.min(width - padding, finalX));
    finalY = Math.max(padding, Math.min(height - padding, finalY));

    const node = createNode(ing, nodes.length, finalX, finalY, opts, parentId);
    nodes.push(node);

    // Update the last node at this corner for future chaining
    const prevChainStep = lastNodeAtCorner[cornerKey]?.chainStep ?? -1;
    lastNodeAtCorner[cornerKey] = { id: node.id, x: finalX, y: finalY, chainStep: prevChainStep + 1 };

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

  // Place acids at upper-right (corner 0), chain outward
  acids.forEach((ing, i) => {
    const spiritIdx = i % spirits.length;

    if (typeCornerMap.acid[spiritIdx] === undefined) {
      // First acid for this spirit - find a corner
      const corner = findBestCorner(spiritIdx, [0, 5, 1]);
      if (corner !== null) {
        typeCornerMap.acid[spiritIdx] = corner;
        usedCorners[spiritIdx][corner] = true;
        placeAtCorner(ing, spiritIdx, corner, 0);
      } else {
        // No corners available, chain from any corner
        const corners = getAvailableCorners(spiritIdx);
        placeAtCorner(ing, spiritIdx, corners[0], 1);
      }
    } else {
      // Chain from previous acid
      const corner = typeCornerMap.acid[spiritIdx];
      placeAtCorner(ing, spiritIdx, corner, Math.floor(i / spirits.length));
    }
  });

  // Place sweets at right (corner 1)
  sweets.forEach((ing, i) => {
    const spiritIdx = i % spirits.length;

    if (typeCornerMap.sweet[spiritIdx] === undefined) {
      const corner = findBestCorner(spiritIdx, [1, 2, 0]);
      if (corner !== null) {
        typeCornerMap.sweet[spiritIdx] = corner;
        usedCorners[spiritIdx][corner] = true;
        placeAtCorner(ing, spiritIdx, corner, 0);
      } else {
        const corners = getAvailableCorners(spiritIdx);
        placeAtCorner(ing, spiritIdx, corners[0], 1);
      }
    } else {
      const corner = typeCornerMap.sweet[spiritIdx];
      placeAtCorner(ing, spiritIdx, corner, Math.floor(i / spirits.length));
    }
  });

  // Place garnishes at upper-left (corner 5)
  garnishes.forEach((ing, i) => {
    const spiritIdx = i % spirits.length;

    if (typeCornerMap.garnish[spiritIdx] === undefined) {
      const corner = findBestCorner(spiritIdx, [5, 4, 0]);
      if (corner !== null) {
        typeCornerMap.garnish[spiritIdx] = corner;
        usedCorners[spiritIdx][corner] = true;
        placeAtCorner(ing, spiritIdx, corner, 0);
      } else {
        const corners = getAvailableCorners(spiritIdx);
        placeAtCorner(ing, spiritIdx, corners[0], 1);
      }
    } else {
      const corner = typeCornerMap.garnish[spiritIdx];
      placeAtCorner(ing, spiritIdx, corner, Math.floor(i / spirits.length));
    }
  });

  // Place bitters at left (corner 4)
  bitters.forEach((ing, i) => {
    const spiritIdx = i % spirits.length;

    if (typeCornerMap.bitter[spiritIdx] === undefined) {
      const corner = findBestCorner(spiritIdx, [4, 3, 5]);
      if (corner !== null) {
        typeCornerMap.bitter[spiritIdx] = corner;
        usedCorners[spiritIdx][corner] = true;
        placeAtCorner(ing, spiritIdx, corner, 0);
      } else {
        const corners = getAvailableCorners(spiritIdx);
        placeAtCorner(ing, spiritIdx, corners[0], 1);
      }
    } else {
      const corner = typeCornerMap.bitter[spiritIdx];
      placeAtCorner(ing, spiritIdx, corner, Math.floor(i / spirits.length));
    }
  });

  // Place remaining at any available corner
  remaining.forEach((ing, i) => {
    const spiritIdx = i % spirits.length;
    const corner = findBestCorner(spiritIdx, [2, 3, 1, 0, 4, 5]);

    if (corner !== null) {
      usedCorners[spiritIdx][corner] = true;
      placeAtCorner(ing, spiritIdx, corner, 0);
    } else {
      // All corners used, chain from first available
      const corners = getAvailableCorners(spiritIdx);
      placeAtCorner(ing, spiritIdx, corners[0], 1 + Math.floor(i / corners.length));
    }
  });

  // Ensure all nodes are within bounds
  const padding = 40;
  nodes.forEach(node => {
    node.x = Math.max(padding, Math.min(width - padding, node.x));
    node.y = Math.max(padding, Math.min(height - padding, node.y));
  });

  return nodes;
}

// ═══════════════════════════════════════════════════════════════
// NODE CREATION
// ═══════════════════════════════════════════════════════════════

function createNode(
  ingredient: ClassifiedIngredient,
  index: number,
  x: number,
  y: number,
  options: LayoutOptions,
  parentId?: string
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
  };
}

// ═══════════════════════════════════════════════════════════════
// BACKBONE GENERATION
// ═══════════════════════════════════════════════════════════════

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

function calculateRadius(
  ingredient: ClassifiedIngredient,
  options: LayoutOptions
): number {
  // Spirits get larger radius, other ingredients use baseRadius
  if (ingredient.type === 'spirit') {
    return 18; // Larger spirit nodes
  }
  return options.baseRadius;
}

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

export function seededRandom(seed: number): () => number {
  return () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
}
