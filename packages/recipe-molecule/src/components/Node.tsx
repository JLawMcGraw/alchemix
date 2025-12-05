/**
 * Node Component
 *
 * Renders a single ingredient as a text label (academic/monochrome style)
 * Pure black text - no colored circles, like real organic chemistry structures
 */

import type { MoleculeNode } from '../core/types';
import styles from '../styles/molecule.module.css';

// Monochrome black for all text labels
const TEXT_COLOR = '#333';

interface NodeProps {
  node: MoleculeNode;
  onMouseEnter?: (event: React.MouseEvent, node: MoleculeNode) => void;
  onMouseMove?: (event: React.MouseEvent, node: MoleculeNode) => void;
  onMouseLeave?: () => void;
}

export function Node({
  node,
  onMouseEnter,
  onMouseMove,
  onMouseLeave,
}: NodeProps) {
  const { x, y, label, sublabel, type } = node;

  // Junction nodes are invisible - render nothing
  if (type === 'junction') {
    return null;
  }

  // Spirit nodes render label at center of benzene ring
  if (type === 'spirit') {
    return (
      <g
        className={styles.nodeGroup}
        onMouseEnter={(e) => onMouseEnter?.(e, node)}
        onMouseMove={(e) => onMouseMove?.(e, node)}
        onMouseLeave={onMouseLeave}
      >
        {/* Invisible hit area for hover - covers the benzene ring */}
        <circle
          cx={x}
          cy={y}
          r={30}
          fill="transparent"
          className={styles.nodeHitArea}
        />
        {/* Spirit label (RUM, GIN, etc.) at center - smaller font to fit hexagon */}
        <text
          x={x}
          y={y + 3}
          fill={TEXT_COLOR}
          className={styles.spiritLabel}
        >
          {label}
        </text>
      </g>
    );
  }

  // Position label at node center, sublabel below
  const labelY = sublabel ? y + 4 : y + 5;
  const sublabelY = y + 16;

  return (
    <g
      className={styles.nodeGroup}
      onMouseEnter={(e) => onMouseEnter?.(e, node)}
      onMouseMove={(e) => onMouseMove?.(e, node)}
      onMouseLeave={onMouseLeave}
    >
      {/* Invisible hit area for hover */}
      <circle
        cx={x}
        cy={y}
        r={14}
        fill="transparent"
        className={styles.nodeHitArea}
      />

      {/* Text label (abbreviated type: Ac, Sw, Bt, etc.) */}
      <text
        x={x}
        y={labelY}
        fill={TEXT_COLOR}
        className={styles.nodeLabel}
      >
        {label}
      </text>

      {/* Optional sublabel */}
      {sublabel && (
        <text
          x={x}
          y={sublabelY}
          fill={TEXT_COLOR}
          className={styles.nodeSublabel}
        >
          {sublabel}
        </text>
      )}
    </g>
  );
}
