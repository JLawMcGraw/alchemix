/**
 * Bond Component
 *
 * Renders connections between ingredient nodes
 * Bond types:
 *   - single: solid line (combined ingredients)
 *   - double: parallel lines (technique relationship)
 *   - dashed: dotted line (garnish/optional)
 *
 * Spirit-to-spirit bonds connect center-to-center (through both nodes centrally)
 * Other ingredients connect at hexagon corners
 */

import type { MoleculeNode, BondType } from '../core/types';
import { getDoubleBondLines, shortenBondToEdge } from '../core/bonds';
import styles from '../styles/molecule.module.css';

// Benzene ring radius - must match Molecule.tsx
const BENZENE_RADIUS = 30;

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
  const isSpiritToSpirit = isFromSpirit && isToSpirit;

  let x1: number, y1: number, x2: number, y2: number;

  if (isSpiritToSpirit) {
    // Spirit-to-spirit: connect center-to-center (through both nodes centrally)
    // Use node radius to stop at node edge, not hexagon edge
    const shortened = shortenBondToEdge(from.x, from.y, to.x, to.y, from.radius, to.radius);
    x1 = shortened.x1;
    y1 = shortened.y1;
    x2 = shortened.x2;
    y2 = shortened.y2;
  } else if (isFromSpirit) {
    // From spirit to non-spirit: start at hexagon corner
    const corner = getNearestHexCorner(from.x, from.y, to.x, to.y);
    const shortened = shortenBondToEdge(corner.x, corner.y, to.x, to.y, 0, to.radius);
    x1 = shortened.x1;
    y1 = shortened.y1;
    x2 = shortened.x2;
    y2 = shortened.y2;
  } else if (isToSpirit) {
    // From non-spirit to spirit: end at hexagon corner
    const corner = getNearestHexCorner(to.x, to.y, from.x, from.y);
    const shortened = shortenBondToEdge(from.x, from.y, corner.x, corner.y, from.radius, 0);
    x1 = shortened.x1;
    y1 = shortened.y1;
    x2 = shortened.x2;
    y2 = shortened.y2;
  } else {
    // Non-spirit to non-spirit: normal center-to-center
    const shortened = shortenBondToEdge(from.x, from.y, to.x, to.y, from.radius, to.radius);
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
  const { line1, line2 } = getDoubleBondLines(x1, y1, x2, y2, 3);

  return (
    <g>
      <line
        x1={line1[0]}
        y1={line1[1]}
        x2={line1[2]}
        y2={line1[3]}
        className={styles.bond}
      />
      <line
        x1={line2[0]}
        y1={line2[1]}
        x2={line2[2]}
        y2={line2[3]}
        className={styles.bond}
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
