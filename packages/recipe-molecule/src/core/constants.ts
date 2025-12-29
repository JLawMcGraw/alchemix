/**
 * Shared Layout Constants
 *
 * Single source of truth for all geometric constants used across
 * layout.ts, bonds.ts, and component files.
 */

// ═══════════════════════════════════════════════════════════════
// HEXAGON GEOMETRY
// ═══════════════════════════════════════════════════════════════

/**
 * Radius of the benzene-style hexagon ring around spirit nodes.
 * This determines the size of the central backbone structure.
 */
export const HEX_RADIUS = 22;

/**
 * Rotation angle applied to hexagons so flat edges face top/bottom.
 * Without this, vertices would point up/down instead of edges.
 */
export const HEX_ROTATION = Math.PI / 6; // 30 degrees

/**
 * Hexagon corner angles (vertices) - rotated so flat edges face top/bottom.
 * Starting from upper-right, going clockwise:
 *   0: upper-right (-60°)
 *   1: right (0°)
 *   2: lower-right (60°)
 *   3: lower-left (120°)
 *   4: left (180°)
 *   5: upper-left (-120°)
 */
export const CORNER_ANGLES = [
  -Math.PI / 3,         // 0: upper-right
  0,                    // 1: right
  Math.PI / 3,          // 2: lower-right
  Math.PI * 2 / 3,      // 3: lower-left
  Math.PI,              // 4: left
  -Math.PI * 2 / 3,     // 5: upper-left
] as const;

/**
 * Edge normal angles for flat-top hexagon (directions to adjacent hex centers).
 * Used for honeycomb grid positioning.
 */
export const EDGE_ANGLES = [
  Math.PI / 6,          // 30° - upper-right neighbor
  Math.PI / 2,          // 90° - top neighbor
  Math.PI * 5 / 6,      // 150° - upper-left neighbor
  Math.PI * 7 / 6,      // 210° - lower-left neighbor
  Math.PI * 3 / 2,      // 270° - bottom neighbor
  Math.PI * 11 / 6,     // 330° - lower-right neighbor
] as const;

// ═══════════════════════════════════════════════════════════════
// TEXT & BOND DIMENSIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Visual "radius" of text labels for bond shortening calculations.
 * Bonds are shortened by this amount to not overlap text.
 */
export const TEXT_RADIUS = 8;

/**
 * Target visual bond length (the line you actually see after shortening).
 * Proportional to HEX_RADIUS for balanced aesthetics.
 */
export const TARGET_BOND_LENGTH = 18;

/**
 * Center-to-center distance for chained text ingredients.
 * Calculated as: TARGET_BOND_LENGTH + 2 * TEXT_RADIUS
 * This ensures uniform visual bond lengths between text labels.
 */
export const CHAIN_BOND_LENGTH = TARGET_BOND_LENGTH + TEXT_RADIUS * 2; // 34px

/**
 * Distance between adjacent hexagon centers in the honeycomb grid.
 * For flat-top hexagons: radius * sqrt(3)
 */
export const HEX_GRID_SPACING = HEX_RADIUS * Math.sqrt(3); // ~38.1px

// ═══════════════════════════════════════════════════════════════
// LAYOUT LIMITS
// ═══════════════════════════════════════════════════════════════

/**
 * Maximum number of ingredients in a single chain from a hexagon corner.
 * After this limit, ingredients will use a new corner.
 */
export const MAX_CHAIN_LENGTH = 4;

/**
 * Minimum distance between nodes to prevent overlap.
 * Based on chain bond length with safety margin.
 */
export const MIN_NODE_DISTANCE = CHAIN_BOND_LENGTH * 0.8; // ~27px

/**
 * Padding from canvas edge to prevent clipping.
 */
export const CANVAS_PADDING = 40;
