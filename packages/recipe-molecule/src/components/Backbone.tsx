/**
 * Backbone Component
 *
 * Renders the central molecular structure (hexagon or triangle)
 * Represents the recipe's foundation
 */

import type { MoleculeBackbone } from '../core/types';
import { hexagonPoints, trianglePoints } from '../core/layout';
import styles from '../styles/molecule.module.css';

interface BackboneProps {
  backbone: MoleculeBackbone;
}

export function Backbone({ backbone }: BackboneProps) {
  const { type, cx, cy, radius } = backbone;

  const points =
    type === 'hexagon'
      ? hexagonPoints(cx, cy, radius)
      : trianglePoints(cx, cy, radius);

  return (
    <polygon
      points={points}
      className={styles.backbone}
    />
  );
}
