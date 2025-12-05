/**
 * Legend Component
 *
 * Displays color key for ingredient types used in the molecule
 * Only shows types that appear in the current recipe
 */

import type { MoleculeNode, IngredientType } from '../core/types';
import { TYPE_COLORS } from '../core/types';
import styles from '../styles/molecule.module.css';

interface LegendProps {
  nodes: MoleculeNode[];
}

export function Legend({ nodes }: LegendProps) {
  // Get unique types from nodes
  const usedTypes = [...new Set(nodes.map(n => n.type))] as IngredientType[];

  // Sort by a logical order
  const typeOrder: IngredientType[] = [
    'spirit',
    'acid',
    'sweet',
    'bitter',
    'salt',
    'dilution',
    'dairy',
    'egg',
    'garnish',
  ];

  const sortedTypes = usedTypes.sort(
    (a, b) => typeOrder.indexOf(a) - typeOrder.indexOf(b)
  );

  return (
    <div className={styles.legend}>
      {sortedTypes.map(type => (
        <div key={type} className={styles.legendItem}>
          <div
            className={styles.legendDot}
            style={{ backgroundColor: TYPE_COLORS[type].fill }}
          />
          <span>{TYPE_COLORS[type].legend}</span>
        </div>
      ))}
    </div>
  );
}
