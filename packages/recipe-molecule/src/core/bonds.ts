/**
 * Bond Generation for Hexagonal Backbone
 *
 * Creates bonds that connect through the hexagonal backbone structure:
 * - Spirit at center connects to the hexagon
 * - Other ingredients connect from hexagon vertices
 * - Chain bonds for extended groups
 */

import type { MoleculeNode, MoleculeBond, BondType } from './types';

// ═══════════════════════════════════════════════════════════════
// BOND GENERATION
// ═══════════════════════════════════════════════════════════════

/**
 * Generate bonds connecting ingredients
 * Uses parentId from layout when available, falls back to nearest-neighbor
 * This ensures chained ingredients connect properly along hex edges
 */
export function generateBonds(nodes: MoleculeNode[]): MoleculeBond[] {
  const bonds: MoleculeBond[] = [];

  if (nodes.length < 2) return bonds;

  // Find spirits and others
  const spirits = nodes.filter(n => n.type === 'spirit');
  const others = nodes.filter(n => n.type !== 'spirit');

  // Connect spirits together - only if they actually touch (share an edge)
  // hexGridSpacing = radius * sqrt(3) ≈ 51.96 for radius 30
  // Spirits touching have distance = hexGridSpacing
  // Allow some tolerance for floating point
  const hexGridSpacing = 30 * Math.sqrt(3); // ~51.96
  const touchThreshold = hexGridSpacing * 1.1; // Allow 10% tolerance

  if (spirits.length > 1) {
    if (spirits.length === 2) {
      // Two spirits: connect if they touch
      if (getDistance(spirits[0], spirits[1]) <= touchThreshold) {
        bonds.push({ from: spirits[0].id, to: spirits[1].id, type: 'double' });
      }
    } else if (spirits.length === 3) {
      // Three spirits: only connect pairs that actually touch
      // In same-type triangle, all 3 touch. In V-shape, only 0-1 and 0-2 touch.
      if (getDistance(spirits[0], spirits[1]) <= touchThreshold) {
        bonds.push({ from: spirits[0].id, to: spirits[1].id, type: 'double' });
      }
      if (getDistance(spirits[1], spirits[2]) <= touchThreshold) {
        bonds.push({ from: spirits[1].id, to: spirits[2].id, type: 'double' });
      }
      if (getDistance(spirits[2], spirits[0]) <= touchThreshold) {
        bonds.push({ from: spirits[2].id, to: spirits[0].id, type: 'double' });
      }
    } else {
      // 4+: connect in sequence by Y position (only adjacent ones)
      const sortedSpirits = [...spirits].sort((a, b) => a.y - b.y);
      for (let i = 0; i < sortedSpirits.length - 1; i++) {
        if (getDistance(sortedSpirits[i], sortedSpirits[i + 1]) <= touchThreshold) {
          bonds.push({
            from: sortedSpirits[i].id,
            to: sortedSpirits[i + 1].id,
            type: 'double',
          });
        }
      }
    }
  }

  const bondSet = new Set<string>();

  const addBond = (fromId: string, toId: string, type: BondType) => {
    const key = [fromId, toId].sort().join('-');
    if (!bondSet.has(key)) {
      bondSet.add(key);
      bonds.push({ from: fromId, to: toId, type });
    }
  };

  // Create node lookup map
  const nodeMap = new Map<string, MoleculeNode>();
  nodes.forEach(n => nodeMap.set(n.id, n));

  // For each non-spirit node, connect to its parent (set during layout)
  // This ensures proper chaining along hex edges
  others.forEach(node => {
    if (node.parentId) {
      const parent = nodeMap.get(node.parentId);
      if (parent) {
        addBond(node.parentId, node.id, determineBondType(parent, node));
      }
    }
  });

  return bonds;
}

// ═══════════════════════════════════════════════════════════════
// BOND TYPE DETERMINATION
// ═══════════════════════════════════════════════════════════════

function determineBondType(from: MoleculeNode, to: MoleculeNode): BondType {
  // Garnishes get dashed bonds
  if (to.type === 'garnish' || from.type === 'garnish') {
    return 'dashed';
  }

  // Dilution gets dashed
  if (to.type === 'dilution' || from.type === 'dilution') {
    return 'dashed';
  }

  // Egg white gets double bond (dry shake technique)
  if (to.type === 'egg' || from.type === 'egg') {
    return 'double';
  }

  // Bitter with spirit gets double bond
  if ((from.type === 'spirit' && to.type === 'bitter') ||
      (to.type === 'spirit' && from.type === 'bitter')) {
    return 'double';
  }

  return 'single';
}

/**
 * Generate secondary bonds for special relationships
 */
function generateSecondaryBonds(
  nodes: MoleculeNode[],
  existingBonds: MoleculeBond[]
): MoleculeBond[] {
  const secondary: MoleculeBond[] = [];

  const bondSet = new Set(
    existingBonds.map(b => `${b.from}-${b.to}`).concat(
      existingBonds.map(b => `${b.to}-${b.from}`)
    )
  );

  const hasExistingBond = (a: string, b: string) =>
    bondSet.has(`${a}-${b}`) || bondSet.has(`${b}-${a}`);

  // Acid + Salt relationship (rim)
  const acid = nodes.find(n => n.type === 'acid');
  const salt = nodes.find(n => n.type === 'salt');
  if (acid && salt && !hasExistingBond(acid.id, salt.id)) {
    secondary.push({
      from: acid.id,
      to: salt.id,
      type: 'double',
    });
  }

  return secondary;
}

// ═══════════════════════════════════════════════════════════════
// GEOMETRY HELPERS
// ═══════════════════════════════════════════════════════════════

function getDistance(a: MoleculeNode, b: MoleculeNode): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// ═══════════════════════════════════════════════════════════════
// BOND RENDERING HELPERS
// ═══════════════════════════════════════════════════════════════

/**
 * Calculate offset for double bonds
 */
export function getDoubleBondLines(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  offset: number = 3
): { line1: [number, number, number, number]; line2: [number, number, number, number] } {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);

  if (len === 0) {
    return {
      line1: [x1, y1, x2, y2],
      line2: [x1, y1, x2, y2],
    };
  }

  const px = -dy / len;
  const py = dx / len;

  return {
    line1: [
      x1 + px * offset,
      y1 + py * offset,
      x2 + px * offset,
      y2 + py * offset,
    ],
    line2: [
      x1 - px * offset,
      y1 - py * offset,
      x2 - px * offset,
      y2 - py * offset,
    ],
  };
}

/**
 * Shorten bond line to stop at node edge
 */
export function shortenBondToEdge(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  r1: number,
  r2: number,
  padding: number = 2
): { x1: number; y1: number; x2: number; y2: number } {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);

  if (len === 0) return { x1, y1, x2, y2 };

  const ux = dx / len;
  const uy = dy / len;

  return {
    x1: x1 + ux * (r1 + padding),
    y1: y1 + uy * (r1 + padding),
    x2: x2 - ux * (r2 + padding),
    y2: y2 - uy * (r2 + padding),
  };
}
