'use client';

import { useMemo } from 'react';
import type { InventoryItem } from '@/types';
import { getPeriodicTags } from '@/lib/periodicTableV2';
import {
  CATEGORY_COLORS,
  GROUP_COLORS,
  GROUP_COLORS_DARK,
  PERIOD_COLORS,
  PERIOD_COLORS_DARK,
} from '@/lib/colors';
import { useTheme } from '@/hooks/useTheme';
import styles from './BottleCard.module.css';

interface BottleCardProps {
  item: InventoryItem;
  isSelected?: boolean;
  onSelect?: (id: number) => void;
  onClick?: (item: InventoryItem) => void;
}

export function BottleCard({ item, isSelected = false, onSelect, onClick }: BottleCardProps) {
  const color = CATEGORY_COLORS[item.category] || '#94A3B8';
  const isOutOfStock = (item.stock_number ?? 0) === 0;
  const stockCount = item.stock_number ?? 0;

  const { isDarkMode } = useTheme();

  // Select color palette based on theme
  const groupColors = isDarkMode ? GROUP_COLORS_DARK : GROUP_COLORS;
  const periodColors = isDarkMode ? PERIOD_COLORS_DARK : PERIOD_COLORS;

  // Always re-detect periodic tags based on current classification logic
  const periodicTags = useMemo(() => getPeriodicTags(item), [item]);

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onSelect && item.id) {
      onSelect(item.id);
    }
  };

  const handleCheckboxKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (onSelect && item.id) {
        onSelect(item.id);
      }
    }
  };

  const handleCardClick = () => {
    if (onClick) {
      onClick(item);
    }
  };

  return (
    <div
      className={`${styles.card} ${isOutOfStock ? styles.outOfStock : ''} ${isSelected ? styles.selected : ''}`}
      onClick={handleCardClick}
    >
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div
            className={`${styles.checkbox} ${isSelected ? styles.checkboxChecked : ''}`}
            onClick={handleCheckboxClick}
            onKeyDown={handleCheckboxKeyDown}
            role="checkbox"
            aria-checked={isSelected}
            tabIndex={0}
          >
            {isSelected && (
              <svg className={styles.checkIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
          <h3 className={styles.name}>
            {item.name}{stockCount > 0 && ` (${stockCount})`}
          </h3>
        </div>
      </div>

      {/* Periodic Tags Row - Below Name */}
      {(periodicTags.group || periodicTags.period) && (
        <div className={styles.periodicTags}>
          {periodicTags.group && (
            <span
              className={styles.periodicBadge}
              style={{
                color: groupColors[periodicTags.group],
                backgroundColor: `${groupColors[periodicTags.group]}15`,
              }}
            >
              {periodicTags.group}
            </span>
          )}
          {periodicTags.period && (
            <span
              className={styles.periodicBadge}
              style={{
                color: periodColors[periodicTags.period],
                backgroundColor: `${periodColors[periodicTags.period]}15`,
              }}
            >
              {periodicTags.period}
            </span>
          )}
        </div>
      )}

      {/* Details */}
      <div className={styles.details}>
        {item.type && (
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>Type:</span>
            <span className={styles.detailValue}>{item.type}</span>
          </div>
        )}

        {item.abv && (
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>ABV:</span>
            <span className={styles.detailValue}>
              {String(item.abv).replace(/%/g, '')}%
            </span>
          </div>
        )}

        {item.distillery_location && (
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>Location:</span>
            <span className={styles.detailValue} title={item.distillery_location}>
              {item.distillery_location}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
