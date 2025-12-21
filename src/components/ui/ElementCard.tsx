'use client';

import React from 'react';
import { Plus } from 'lucide-react';
import type { PeriodicElement } from '@/lib/periodicTable';
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
  /** Click handler (typically for filtering) */
  onClick?: (element: PeriodicElement) => void;
  /** Callback for adding a new item of this type */
  onAdd?: (element: PeriodicElement) => void;
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
  onAdd,
  className,
}: ElementCardProps) {
  const colorVar = GROUP_COLORS[element.group];

  const cardClasses = [
    styles.elementCard,
    size !== 'md' && styles[size],
    isActive && styles.active,
    hasInventory && styles.hasInventory,
    !hasInventory && styles.empty,
    onAdd && styles.hasAddButton,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const handleAddClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAdd?.(element);
  };

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
      <span className={styles.nameWrapper}>
        <span className={styles.name}>{element.name}</span>
      </span>

      {onAdd && (
        <span
          className={styles.addButton}
          onClick={handleAddClick}
          title={`Add ${element.name} to your bar`}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.stopPropagation();
              onAdd?.(element);
            }
          }}
        >
          <Plus size={12} strokeWidth={2.5} />
        </span>
      )}
    </button>
  );
}

export default ElementCard;
