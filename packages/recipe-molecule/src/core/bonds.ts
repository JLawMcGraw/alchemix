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

  // Spirit-to-spirit connections: No bonds needed - benzene rings already share edges visually
  // The fused ring structure creates the connection implicitly

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

  // Generate ring bonds first
  // Group ring nodes by ringId
  const ringNodes = new Map<string, MoleculeNode[]>();
  others.forEach(node => {
    if (node.ringId) {
      if (!ringNodes.has(node.ringId)) {
        ringNodes.set(node.ringId, []);
      }
      ringNodes.get(node.ringId)!.push(node);
    }
  });

  // For each ring, create bonds between adjacent vertices
  ringNodes.forEach((ringMembers, ringId) => {
    // Sort by ringIndex to ensure correct order
    ringMembers.sort((a, b) => (a.ringIndex ?? 0) - (b.ringIndex ?? 0));
    
    const ringSize = ringMembers.length;
    for (let i = 0; i < ringSize; i++) {
      const current = ringMembers[i];
      const next = ringMembers[(i + 1) % ringSize];
      
      // Use single bonds for ring edges (like cycloalkanes)
      addBond(current.id, next.id, 'single');
    }
    
    // Connect attachment vertex (ringIndex 0) to its parent
    const attachmentNode = ringMembers.find(n => n.ringIndex === 0);
    if (attachmentNode?.parentId) {
      const parent = nodeMap.get(attachmentNode.parentId);
      if (parent) {
        addBond(attachmentNode.parentId, attachmentNode.id, determineBondType(parent, attachmentNode));
      }
    }
  });

  // For each non-spirit, non-ring node, connect to its parent (set during layout)
  // This ensures proper chaining along hex edges
  others.forEach(node => {
    // Skip ring nodes - they're handled above
    if (node.ringId) return;
    
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

/**
 * Mixer keywords that get dashed bonds
 * These are carbonated/fizzy additions to cocktails
 * Note: Ice/water are assumed and rarely appear in recipes
 */
const MIXER_KEYWORDS = [
  'ginger beer', 'ginger ale', 'tonic', 'tonic water',
  'seltzer', 'club soda', 'soda water', 'sparkling',
  'cola', 'coke', 'sprite', '7up', 'seven up', 'lemonade',
];

/**
 * Check if ingredient is a mixer (gets dashed bond)
 */
function isMixer(node: MoleculeNode): boolean {
  const raw = node.raw?.toLowerCase() || '';
  const name = node.name?.toLowerCase() || '';
  return MIXER_KEYWORDS.some(keyword => raw.includes(keyword) || name.includes(keyword));
}

/**
 * Check if ingredient is marked as optional
 */
function isOptional(node: MoleculeNode): boolean {
  const raw = node.raw?.toLowerCase() || '';
  const modifiers = node.modifiers || [];
  return modifiers.some(m => m.toLowerCase() === 'optional') ||
         raw.includes('optional') ||
         raw.includes('if desired') ||
         raw.includes('to taste');
}

/**
 * Check if ingredient has no specified amount (undefined quantity)
 */
function hasNoAmount(node: MoleculeNode): boolean {
  return node.amount === null;
}

function determineBondType(from: MoleculeNode, to: MoleculeNode): BondType {
  // Get the "real" node (non-junction) for type checks
  const realFrom = from.type === 'junction' ? null : from;
  const realTo = to.type === 'junction' ? null : to;
  const targetNode = realTo || realFrom;
  
  // Optional ingredients get hydrogen bonds (light dotted)
  // Check this early as it overrides other bond types
  if ((realTo && isOptional(realTo)) || (realFrom && isOptional(realFrom))) {
    return 'hydrogen';
  }
  
  // Ingredients with no amount get wavy bonds (undefined quantity)
  // Only apply to the "to" node to avoid double-applying
  if (realTo && hasNoAmount(realTo) && realTo.type !== 'spirit') {
    return 'wavy';
  }
  
  // Junction nodes: determine bond type based on what's NOT a junction
  if (from.type === 'junction' || to.type === 'junction') {
    // Find the non-junction node to determine bond style
    const realNode = from.type === 'junction' ? to : from;

    // Garnish chains get solid wedge (stereochemistry "in front of plane")
    if (realNode.type === 'garnish') {
      return 'wedge';
    }
    // Bitter chains get dashed wedge (stereochemistry "behind plane")
    if (realNode.type === 'bitter') {
      return 'dashedWedge';
    }
    // Check for dash/drop in raw text - these are bitters-like
    const rawText = realNode.raw?.toLowerCase() || '';
    if (rawText.includes('dash') || rawText.includes('drop')) {
      return 'dashedWedge';
    }
    // Mixers get straight dashed bonds
    if (isMixer(realNode)) {
      return 'dashed';
    }
    // Default junction bonds are single
    return 'single';
  }

  // Garnishes get solid wedge bonds (stereochemistry "in front of plane")
  if (to.type === 'garnish' || from.type === 'garnish') {
    return 'wedge';
  }

  // Bitters get dashed wedge bonds (stereochemistry "behind plane")
  // Also check for "dash" or "drop" in the raw ingredient text
  if (to.type === 'bitter' || from.type === 'bitter') {
    return 'dashedWedge';
  }

  // Check for dash/drop quantities (bitters-like usage)
  const toRaw = to.raw?.toLowerCase() || '';
  const fromRaw = from.raw?.toLowerCase() || '';
  if (toRaw.includes('dash') || toRaw.includes('drop') ||
      fromRaw.includes('dash') || fromRaw.includes('drop')) {
    return 'dashedWedge';
  }

  // Acid ↔ Sweet connection gets double bond (classic "sour" balance)
  if ((from.type === 'acid' && to.type === 'sweet') ||
      (from.type === 'sweet' && to.type === 'acid')) {
    return 'double';
  }

  // Mixers get straight dashed bonds (carbonated additions)
  if (isMixer(from) || isMixer(to)) {
    return 'dashed';
  }

  // Everything else is single (standard ingredients)
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
 * No extra padding - layout.ts already accounts for exact distances
 */
export function shortenBondToEdge(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  r1: number,
  r2: number
): { x1: number; y1: number; x2: number; y2: number } {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);

  if (len === 0) return { x1, y1, x2, y2 };

  const ux = dx / len;
  const uy = dy / len;

  return {
    x1: x1 + ux * r1,
    y1: y1 + uy * r1,
    x2: x2 - ux * r2,
    y2: y2 - uy * r2,
  };
}
