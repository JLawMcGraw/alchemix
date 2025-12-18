'use client';

import { useMemo, useState, useEffect } from 'react';
import type { InventoryItem, PeriodicGroup, PeriodicPeriod } from '@/types';
import { getPeriodicTags } from '@/lib/periodicTableV2';
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
 * Color mapping for periodic groups (function/role) - Light mode
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
 * Color mapping for periodic groups - Dark mode (lighter variants)
 */
const GROUP_COLORS_DARK: Record<PeriodicGroup, string> = {
  Base: '#94A3B8',      // lightened slate for visibility
  Bridge: '#A78BFA',    // lighter violet
  Modifier: '#F472B6',  // lighter pink
  Sweetener: '#818CF8', // lighter indigo
  Reagent: '#FBBF24',   // lighter yellow
  Catalyst: '#F87171',  // lighter red
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

/**
 * Color mapping for periodic periods - Dark mode
 */
const PERIOD_COLORS_DARK: Record<PeriodicPeriod, string> = {
  Agave: '#14B8A6',   // lighter teal
  Cane: '#84CC16',    // lighter green
  Grain: '#FBBF24',   // lighter amber
  Grape: '#A78BFA',   // lighter violet
  Fruit: '#FB7185',   // lighter rose
  Botanic: '#38BDF8', // lighter sky
};

export function BottleCard({ item, isSelected = false, onSelect, onClick }: BottleCardProps) {
  const color = CATEGORY_COLORS[item.category] || '#94A3B8';
  const isOutOfStock = (item.stock_number ?? 0) === 0;
  const stockCount = item.stock_number ?? 0;

  // Track dark mode state
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    // Check initial theme
    const checkTheme = () => {
      const theme = document.documentElement.getAttribute('data-theme');
      setIsDarkMode(theme === 'dark');
    };
    checkTheme();

    // Watch for theme changes
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

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
      {(periodicTags.group || periodicTags.period) && (
        <div className={styles.periodicTags}>
          {periodicTags.group && (
            <span
              className={styles.periodicBadge}
              style={{
                color: groupColors[periodicTags.group],
                borderColor: groupColors[periodicTags.group],
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
                borderColor: periodColors[periodicTags.period],
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
