/**
 * Node Component
 *
 * Renders a single ingredient as a colored circle with label
 * Three layers:
 *   1. Circle (pastel background)
 *   2. Label (ingredient name)
 *   3. Sublabel (optional: variant/modifier)
 */

import type { MoleculeNode } from '../core/types';
import styles from '../styles/molecule.module.css';

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
  const { x, y, radius, color, label, sublabel } = node;

  // Adjust text position based on whether we have a sublabel
  const labelY = sublabel ? y - 4 : y + 4;
  const sublabelY = y + 10;

  return (
    <g
      className={styles.nodeGroup}
      onMouseEnter={(e) => onMouseEnter?.(e, node)}
      onMouseMove={(e) => onMouseMove?.(e, node)}
      onMouseLeave={onMouseLeave}
    >
      {/* Pastel circle background */}
      <circle
        cx={x}
        cy={y}
        r={radius}
        fill={color}
        className={styles.nodeCircle}
      />

      {/* Main label */}
      <text
        x={x}
        y={labelY}
        className={styles.nodeLabel}
      >
        {label}
      </text>

      {/* Optional sublabel */}
      {sublabel && (
        <text
          x={x}
          y={sublabelY}
          className={styles.nodeSublabel}
        >
          {sublabel}
        </text>
      )}
    </g>
  );
}
