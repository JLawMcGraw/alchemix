'use client';

import type { InventoryItem, PeriodicGroup, PeriodicPeriod } from '@/types';
import styles from './BottleCard.module.css';

interface BottleCardProps {
  item: InventoryItem;
  isSelected?: boolean;
  onSelect?: (id: number) => void;
  onClick?: (item: InventoryItem) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  spirit: '#D97706',
  liqueur: '#8B5CF6',
  mixer: '#0EA5E9',
  syrup: '#6366F1',
  garnish: '#10B981',
  wine: '#BE185D',
  beer: '#CA8A04',
  other: '#94A3B8',
};

/**
 * Color mapping for periodic groups (function/role)
 */
const GROUP_COLORS: Record<PeriodicGroup, string> = {
  Base: '#1E293B',      // dark slate
  Bridge: '#7C3AED',    // violet
  Modifier: '#EC4899',  // pink
  Sweetener: '#6366F1', // indigo
  Reagent: '#F59E0B',   // yellow
  Catalyst: '#EF4444',  // red
};

/**
 * Color mapping for periodic periods (origin/source)
 */
const PERIOD_COLORS: Record<PeriodicPeriod, string> = {
  Agave: '#0D9488',   // teal
  Cane: '#65A30D',    // green
  Grain: '#D97706',   // amber
  Grape: '#8B5CF6',   // violet
  Fruit: '#F43F5E',   // rose
  Botanic: '#0EA5E9', // sky
};

export function BottleCard({ item, isSelected = false, onSelect, onClick }: BottleCardProps) {
  const color = CATEGORY_COLORS[item.category] || '#94A3B8';
  const isOutOfStock = (item.stock_number ?? 0) === 0;
  const stockCount = item.stock_number ?? 0;

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
          <h3 className={styles.name} onClick={handleCardClick}>
            {item.name}
          </h3>
        </div>
      </div>

      {/* Periodic Tags Row - Below Name */}
      {(item.periodic_group || item.periodic_period) && (
        <div className={styles.periodicTags}>
          {item.periodic_group && (
            <span
              className={styles.periodicBadge}
              style={{
                color: GROUP_COLORS[item.periodic_group],
                borderColor: GROUP_COLORS[item.periodic_group],
                backgroundColor: `${GROUP_COLORS[item.periodic_group]}15`,
              }}
            >
              {item.periodic_group}
            </span>
          )}
          {item.periodic_period && (
            <span
              className={styles.periodicBadge}
              style={{
                color: PERIOD_COLORS[item.periodic_period],
                borderColor: PERIOD_COLORS[item.periodic_period],
                backgroundColor: `${PERIOD_COLORS[item.periodic_period]}15`,
              }}
            >
              {item.periodic_period}
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
              {item.abv}{item.abv.toString().includes('%') ? '' : '%'}
            </span>
          </div>
        )}

        {item.tasting_notes && (
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>Profile:</span>
            <span className={styles.detailValue} title={item.tasting_notes}>
              {item.tasting_notes}
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

      {/* Footer */}
      <div className={styles.footer}>
        <span className={styles.viewLink} onClick={handleCardClick}>
          Click to view details
        </span>
        <span className={`${styles.stockLabel} ${isOutOfStock ? styles.stockEmpty : ''}`}>
          Stock: <strong>{stockCount}</strong>
        </span>
      </div>
    </div>
  );
}
