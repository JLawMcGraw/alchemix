'use client';

import React from 'react';
import type { PeriodicElement, ElementGroup } from '@/lib/periodicTable';
import { GROUP_COLORS } from '@/lib/periodicTable';
import styles from './ElementCard.module.css';

export interface ElementCardProps {
  element: PeriodicElement;
  /** Whether user has items in this category */
  hasInventory?: boolean;
  /** Number of items user has in this category */
  inventoryCount?: number;
  /** Currently selected/active */
  isActive?: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Click handler */
  onClick?: (element: PeriodicElement) => void;
  /** Optional className */
  className?: string;
}

export function ElementCard({
  element,
  hasInventory = false,
  inventoryCount,
  isActive = false,
  size = 'md',
  onClick,
  className,
}: ElementCardProps) {
  const colorVar = GROUP_COLORS[element.group];

  const cardClasses = [
    styles.elementCard,
    size !== 'md' && styles[size],
    isActive && styles.active,
    hasInventory && styles.hasInventory,
    !hasInventory && styles.empty,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={cardClasses}
      onClick={() => onClick?.(element)}
      style={{ '--element-color': colorVar } as React.CSSProperties}
      title={`${element.name}${inventoryCount ? ` (${inventoryCount} items)` : ''}`}
    >
      <span className={styles.atomicNumber}>{element.atomicNumber.toString().padStart(2, '0')}</span>

      {inventoryCount !== undefined && inventoryCount > 0 && (
        <span className={styles.count}>{inventoryCount}</span>
      )}

      <span className={styles.symbol}>{element.symbol}</span>
      <span className={styles.name}>{element.name}</span>
    </button>
  );
}

export default ElementCard;
