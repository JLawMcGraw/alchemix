/**
 * Legend Component
 *
 * Displays abbreviation key for ingredient types used in the molecule
 * Academic/monochrome style - shows "Ac = Acid" format
 * Only shows types that appear in the current recipe
 */

import type { MoleculeNode, IngredientType } from '../core/types';
import styles from '../styles/molecule.module.css';

// Type abbreviations matching classifier.ts
const TYPE_ABBREVIATIONS: Record<IngredientType, string> = {
  spirit: '',      // Spirits show actual name, no legend needed
  acid: 'Ac',
  sweet: 'Sw',
  bitter: 'Bt',
  salt: 'Na',
  dilution: 'Mx',
  garnish: 'Ga',
  dairy: 'Da',
  egg: 'Eg',
  junction: '',
};

const TYPE_FULL_NAMES: Record<IngredientType, string> = {
  spirit: 'Spirit',
  acid: 'Acid',
  sweet: 'Sweet',
  bitter: 'Bitter',
  salt: 'Salt',
  dilution: 'Mixer',
  garnish: 'Garnish',
  dairy: 'Dairy',
  egg: 'Egg',
  junction: '',
};

interface LegendProps {
  nodes: MoleculeNode[];
}

export function Legend({ nodes }: LegendProps) {
  // Get unique types from nodes (exclude spirits and junctions - they don't need legend)
  const usedTypes = [...new Set(nodes.map(n => n.type))]
    .filter(t => t !== 'spirit' && t !== 'junction') as IngredientType[];

  // Sort by a logical order
  const typeOrder: IngredientType[] = [
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

  if (sortedTypes.length === 0) return null;

  return (
    <div className={styles.legendContainer}>
      <div className={styles.legendTitle}>Recipe Chemical Structure</div>
      <div className={styles.legend}>
        {sortedTypes.map(type => (
          <div key={type} className={styles.legendItem}>
            <span className={styles.legendAbbr}>{TYPE_ABBREVIATIONS[type]}</span>
            <span className={styles.legendEquals}>=</span>
            <span className={styles.legendName}>{TYPE_FULL_NAMES[type]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
