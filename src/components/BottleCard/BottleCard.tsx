'use client';

import type { InventoryItem } from '@/types';
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

        {/* Category Badge */}
        <span
          className={styles.categoryBadge}
          style={{
            color: color,
            borderColor: color,
            backgroundColor: `${color}08`,
          }}
        >
          {item.category}
        </span>
      </div>

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
