/**
 * Tooltip Component
 *
 * Displays ingredient details on hover
 * Shows the full ingredient specification (e.g., "2 oz Fresh Lime Juice")
 * Uses React Portal to escape parent overflow/transform constraints
 */

import { createPortal } from 'react-dom';
import type { MoleculeNode } from '../core/types';
import styles from '../styles/molecule.module.css';

interface TooltipProps {
  node: MoleculeNode | null;
  x: number;
  y: number;
  visible: boolean;
}

export function Tooltip({ node, x, y, visible }: TooltipProps) {
  if (!node || !visible) return null;

  // Check if we're in browser environment
  if (typeof document === 'undefined') return null;

  // Format the tooltip content
  const content = formatTooltipContent(node);

  // Position above cursor, clamped to viewport
  const padding = 10;
  const safeX = Math.max(padding, Math.min(x, window.innerWidth - padding));
  const safeY = Math.max(padding + 30, y);

  const tooltipElement = (
    <div
      className={`${styles.tooltip} ${styles.tooltipVisible}`}
      style={{
        left: safeX,
        top: safeY,
        transform: 'translate(-50%, -100%)',
        marginTop: -8,
      }}
    >
      {content}
    </div>
  );

  // Use portal to render at document body, escaping overflow/transform constraints
  return createPortal(tooltipElement, document.body);
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
