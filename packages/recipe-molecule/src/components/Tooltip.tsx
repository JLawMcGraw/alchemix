/**
 * Tooltip Component
 *
 * Displays ingredient details on hover
 * Shows the full ingredient specification (e.g., "2 oz Fresh Lime Juice")
 */

import type { MoleculeNode } from '../core/types';
import styles from '../styles/molecule.module.css';

interface TooltipProps {
  node: MoleculeNode | null;
  x: number;
  y: number;
  visible: boolean;
}

export function Tooltip({ node, x, y, visible }: TooltipProps) {
  if (!node) return null;

  // Format the tooltip content
  const content = formatTooltipContent(node);

  return (
    <div
      className={`${styles.tooltip} ${visible ? styles.tooltipVisible : ''}`}
      style={{
        left: x,
        top: y,
      }}
    >
      {content}
    </div>
  );
}

/**
 * Format tooltip content from node data
 */
function formatTooltipContent(node: MoleculeNode): string {
  // If we have the raw ingredient string, use it
  if (node.raw && node.raw.trim()) {
    return capitalizeFirst(node.raw);
  }

  // Otherwise construct from parts
  const parts: string[] = [];

  if (node.amount !== null) {
    parts.push(String(node.amount));
  }

  if (node.unit) {
    parts.push(node.unit);
  }

  if (node.modifiers && node.modifiers.length > 0) {
    parts.push(...node.modifiers.map(capitalizeFirst));
  }

  parts.push(capitalizeFirst(node.name));

  return parts.join(' ');
}

function capitalizeFirst(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}
