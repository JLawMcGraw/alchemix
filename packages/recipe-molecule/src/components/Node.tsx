/**
 * Node Component
 *
 * Renders a single ingredient as a text label (academic/monochrome style)
 * Pure black text - no colored circles, like real organic chemistry structures
 * Dark mode support via CSS classes
 */

import type { MoleculeNode } from '../core/types';
import styles from '../styles/molecule.module.css';

interface NodeProps {
  node: MoleculeNode;
  rotation?: number;  // Molecule rotation to counter-rotate text
  onMouseEnter?: (event: React.MouseEvent, node: MoleculeNode) => void;
  onMouseMove?: (event: React.MouseEvent, node: MoleculeNode) => void;
  onMouseLeave?: () => void;
}

export function Node({
  node,
  rotation = 0,
  onMouseEnter,
  onMouseMove,
  onMouseLeave,
}: NodeProps) {
  const { x, y, label, sublabel, type } = node;
  
  // Counter-rotation transform to keep text upright
  const counterRotation = rotation ? `rotate(${-rotation}, ${x}, ${y})` : undefined;

  // Junction nodes are invisible - render nothing
  if (type === 'junction') {
    return null;
  }

  // Spirit nodes render label at center of benzene ring
  if (type === 'spirit') {
    // Use smaller font for longer labels (e.g., VODKA, WHISKEY, TEQUILA)
    // Threshold lowered for Inter font which is wider than monospace
    const isLongLabel = label.length > 4;
    const labelClass = isLongLabel ? styles.spiritLabelSmall : styles.spiritLabel;

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
        {/* Counter-rotate to keep text upright when molecule is rotated */}
        <text
          x={x}
          y={y + 3}
          className={labelClass}
          transform={counterRotation}
        >
          {label}
        </text>
      </g>
    );
  }

  // Position label at node center (dominant-baseline: central handles vertical centering)
  // Sublabel goes below the main label
  const labelY = sublabel ? y - 2 : y;
  const sublabelY = y + 10;

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
      {/* Counter-rotate to keep text upright when molecule is rotated */}
      <text
        x={x}
        y={labelY}
        className={styles.nodeLabel}
        transform={counterRotation}
      >
        {label}
      </text>

      {/* Optional sublabel */}
      {sublabel && (
        <text
          x={x}
          y={sublabelY}
          className={styles.nodeSublabel}
          transform={counterRotation}
        >
          {sublabel}
        </text>
      )}
    </g>
  );
}
