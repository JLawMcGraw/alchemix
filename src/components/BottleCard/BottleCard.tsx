'use client';

import type { InventoryItem } from '@/types';
import styles from './BottleCard.module.css';

interface BottleCardProps {
  item: InventoryItem;
  isSelected?: boolean;
  onSelect?: (id: number) => void;
  onClick?: (item: InventoryItem) => void;
}

export function BottleCard({ item, isSelected = false, onSelect, onClick }: BottleCardProps) {
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

  const handleCardKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleCardClick();
    }
  };

  return (
    <div
      className={`${styles.card} ${isOutOfStock ? styles.outOfStock : ''} ${isSelected ? styles.selected : ''}`}
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`${item.name}${item.type ? `, ${item.type}` : ''}, ${stockCount} in stock`}
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
          <div className={styles.nameBlock}>
            <h3 className={styles.name}>
              {item.name} ({stockCount})
            </h3>
            {item.distillery_location && (
              <span className={styles.location}>{item.distillery_location}</span>
            )}
          </div>
        </div>
      </div>

      {/* Body - Two column layout */}
      <div className={styles.body}>
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
        </div>

        {item.image_path && (
          <div className={styles.imageColumn}>
            <img
              src={`/${item.image_path}`}
              alt={item.name}
              className={styles.bottleImage}
            />
          </div>
        )}
      </div>
    </div>
  );
}
