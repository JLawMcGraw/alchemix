/**
 * Bond Component
 *
 * Renders connections between ingredient nodes (skeletal formula style)
 * Bond types:
 *   - single: solid line (combined ingredients)
 *   - double: parallel lines (technique relationship)
 *   - dashed: dotted line (garnish/optional)
 *   - wedge: solid wedge for garnishes (3D stereochemistry style)
 *
 * Spirit-to-spirit bonds connect at hexagon edges
 * Other ingredients connect at text label positions
 */

import type { MoleculeNode, BondType } from '../core/types';
import { getDoubleBondLines, shortenBondToEdge } from '../core/bonds';
import styles from '../styles/molecule.module.css';

// Benzene ring radius - must match Molecule.tsx
const BENZENE_RADIUS = 22;

// Text label "radius" - distance to stop before text center
const TEXT_RADIUS = 8;

// Hexagon corner angles (vertices) - rotated 30° so flat edges face top/bottom
const CORNER_ANGLES = [
  -Math.PI / 3,         // 0: upper-right
  0,                    // 1: right
  Math.PI / 3,          // 2: lower-right
  Math.PI * 2 / 3,      // 3: lower-left
  Math.PI,              // 4: left
  -Math.PI * 2 / 3,     // 5: upper-left
];

/**
 * Find the hexagon corner closest to a target point
 */
function getNearestHexCorner(
  cx: number,
  cy: number,
  targetX: number,
  targetY: number
): { x: number; y: number } {
  const angle = Math.atan2(targetY - cy, targetX - cx);

  let bestCorner = 0;
  let bestDiff = Infinity;

  CORNER_ANGLES.forEach((cornerAngle, i) => {
    let diff = Math.abs(angle - cornerAngle);
    if (diff > Math.PI) diff = 2 * Math.PI - diff;
    if (diff < bestDiff) {
      bestDiff = diff;
      bestCorner = i;
    }
  });

  const cornerAngle = CORNER_ANGLES[bestCorner];
  return {
    x: cx + BENZENE_RADIUS * Math.cos(cornerAngle),
    y: cy + BENZENE_RADIUS * Math.sin(cornerAngle),
  };
}

interface BondProps {
  from: MoleculeNode;
  to: MoleculeNode;
  type: BondType;
}

export function Bond({ from, to, type }: BondProps) {
  const isFromSpirit = from.type === 'spirit';
  const isToSpirit = to.type === 'spirit';
  const isFromJunction = from.type === 'junction';
  const isToJunction = to.type === 'junction';
  const isSpiritToSpirit = isFromSpirit && isToSpirit;

  let x1: number, y1: number, x2: number, y2: number;

  // Determine "from" radius based on node type
  const getFromRadius = (): number => {
    if (isFromJunction) return 0; // Junction nodes have no visible element
    if (isFromSpirit) return BENZENE_RADIUS;
    return TEXT_RADIUS;
  };

  // Determine "to" radius based on node type
  const getToRadius = (): number => {
    if (isToJunction) return 0; // Junction nodes have no visible element
    if (isToSpirit) return BENZENE_RADIUS;
    return TEXT_RADIUS;
  };

  if (isSpiritToSpirit) {
    // Spirit-to-spirit: connect center-to-center, stopping at benzene ring edges
    const shortened = shortenBondToEdge(from.x, from.y, to.x, to.y, BENZENE_RADIUS, BENZENE_RADIUS);
    x1 = shortened.x1;
    y1 = shortened.y1;
    x2 = shortened.x2;
    y2 = shortened.y2;

    // Use double bond for spirit-to-spirit
    return <DoubleBond x1={x1} y1={y1} x2={x2} y2={y2} />;
  } else if (isFromSpirit && !isToJunction) {
    // From spirit to non-junction: start at hexagon corner, end near text
    const corner = getNearestHexCorner(from.x, from.y, to.x, to.y);
    const shortened = shortenBondToEdge(corner.x, corner.y, to.x, to.y, 0, getToRadius());
    x1 = shortened.x1;
    y1 = shortened.y1;
    x2 = shortened.x2;
    y2 = shortened.y2;
  } else if (isFromSpirit && isToJunction) {
    // From spirit to junction: start at hexagon corner, end at junction center
    const corner = getNearestHexCorner(from.x, from.y, to.x, to.y);
    x1 = corner.x;
    y1 = corner.y;
    x2 = to.x;
    y2 = to.y;
  } else if (isToSpirit && !isFromJunction) {
    // From non-junction to spirit: start near text, end at hexagon corner
    const corner = getNearestHexCorner(to.x, to.y, from.x, from.y);
    const shortened = shortenBondToEdge(from.x, from.y, corner.x, corner.y, getFromRadius(), 0);
    x1 = shortened.x1;
    y1 = shortened.y1;
    x2 = shortened.x2;
    y2 = shortened.y2;
  } else if (isToSpirit && isFromJunction) {
    // From junction to spirit: start at junction center, end at hexagon corner
    const corner = getNearestHexCorner(to.x, to.y, from.x, from.y);
    x1 = from.x;
    y1 = from.y;
    x2 = corner.x;
    y2 = corner.y;
  } else {
    // Non-spirit connections (including junctions): center to center with appropriate radii
    const shortened = shortenBondToEdge(from.x, from.y, to.x, to.y, getFromRadius(), getToRadius());
    x1 = shortened.x1;
    y1 = shortened.y1;
    x2 = shortened.x2;
    y2 = shortened.y2;
  }

  if (type === 'double') {
    return <DoubleBond x1={x1} y1={y1} x2={x2} y2={y2} />;
  }

  if (type === 'dashed') {
    return <DashedBond x1={x1} y1={y1} x2={x2} y2={y2} />;
  }

  if (type === 'wedge') {
    return <WedgeBond x1={x1} y1={y1} x2={x2} y2={y2} />;
  }

  if (type === 'dashedWedge') {
    return <DashedWedgeBond x1={x1} y1={y1} x2={x2} y2={y2} />;
  }

  return <SingleBond x1={x1} y1={y1} x2={x2} y2={y2} />;
}

// ═══════════════════════════════════════════════════════════════
// BOND VARIANTS
// ═══════════════════════════════════════════════════════════════

interface LineProps {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

function SingleBond({ x1, y1, x2, y2 }: LineProps) {
  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      className={styles.bond}
    />
  );
}

function DoubleBond({ x1, y1, x2, y2 }: LineProps) {
  // Offset (2.5px each side = 5px apart total) - visible even when scaled
  const { line1, line2 } = getDoubleBondLines(x1, y1, x2, y2, 2.5);

  return (
    <g>
      <line
        x1={line1[0]}
        y1={line1[1]}
        x2={line1[2]}
        y2={line1[3]}
        stroke="#333"
        strokeWidth={1}
        fill="none"
      />
      <line
        x1={line2[0]}
        y1={line2[1]}
        x2={line2[2]}
        y2={line2[3]}
        stroke="#333"
        strokeWidth={1}
        fill="none"
      />
    </g>
  );
}

function DashedBond({ x1, y1, x2, y2 }: LineProps) {
  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      className={styles.bondDashed}
    />
  );
}

/**
 * Wedge bond for garnishes (stereochemistry "in front of plane")
 * Solid triangle pointing from spirit to the garnish
 */
function WedgeBond({ x1, y1, x2, y2 }: LineProps) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);

  if (len === 0) return null;

  // Perpendicular unit vector
  const px = -dy / len;
  const py = dx / len;

  // Wedge width at the end
  const wedgeWidth = 3;

  // Triangle: narrow at start, wide at end
  const points = [
    `${x1},${y1}`,
    `${x2 + px * wedgeWidth},${y2 + py * wedgeWidth}`,
    `${x2 - px * wedgeWidth},${y2 - py * wedgeWidth}`,
  ].join(' ');

  return (
    <polygon
      points={points}
      className={styles.bondWedge}
    />
  );
}

/**
 * Dashed wedge bond for bitters (stereochemistry "behind plane")
 * Exactly 3 dashes that taper (widen) from start to end
 */
function DashedWedgeBond({ x1, y1, x2, y2 }: LineProps) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);

  if (len === 0) return null;

  // Unit vectors
  const ux = dx / len;
  const uy = dy / len;
  const px = -dy / len; // Perpendicular
  const py = dx / len;

  // Exactly 3 dashes that taper (widen along the bond)
  const numDashes = 3;
  const dashLength = 3;
  const maxWidth = 3; // Maximum width at the end

  const dashes: JSX.Element[] = [];

  for (let i = 0; i < numDashes; i++) {
    // Evenly distribute dashes along the bond (at 25%, 50%, 75% of length)
    const centerT = (i + 1) / (numDashes + 1);
    const startT = centerT - (dashLength / 2) / len;
    const endT = centerT + (dashLength / 2) / len;

    // Position along the line
    const sx = x1 + ux * len * startT;
    const sy = y1 + uy * len * startT;
    const ex = x1 + ux * len * endT;
    const ey = y1 + uy * len * endT;

    // Width tapers: narrower at start, wider at end of each dash
    const startWidth = startT * maxWidth;
    const endWidth = endT * maxWidth;

    // Create a trapezoid (wider at end)
    const points = [
      `${sx + px * startWidth},${sy + py * startWidth}`,
      `${sx - px * startWidth},${sy - py * startWidth}`,
      `${ex - px * endWidth},${ey - py * endWidth}`,
      `${ex + px * endWidth},${ey + py * endWidth}`,
    ].join(' ');

    dashes.push(
      <polygon
        key={i}
        points={points}
        className={styles.bondWedge}
      />
    );
  }

  return <g>{dashes}</g>;
}


