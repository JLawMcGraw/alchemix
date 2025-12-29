'use client';

import React from 'react';
import { Search, X } from 'lucide-react';
import type { Collection } from '@/types';
import type { SpiritCategory } from '@/lib/spirits';
import { MASTERY_FILTERS, getMasteryCount } from './recipeUtils';
import styles from './recipes.module.css';

interface MasteryFilterBarProps {
  masteryFilter: string | null;
  shoppingListStats: { craftable?: number; almost?: number; needFew?: number; majorGaps?: number } | null;
  onFilterClick: (filterKey: string) => void;
  onClear: () => void;
}

export function MasteryFilterBar({
  masteryFilter,
  shoppingListStats,
  onFilterClick,
  onClear,
}: MasteryFilterBarProps) {
  return (
    <div className={styles.filterBar}>
      <span className={styles.filterLabel}>Filter:</span>
      {MASTERY_FILTERS.map((stat) => {
        const isActive = masteryFilter === stat.filter;
        const count = getMasteryCount(stat.key, shoppingListStats);
        return (
          <button
            key={stat.key}
            onClick={() => onFilterClick(stat.filter)}
            className={`${styles.masteryPill} ${isActive ? styles.active : ''}`}
          >
            <div className={styles.masteryDot} style={{ backgroundColor: stat.color }} />
            <span>{stat.label}</span>
            <span
              className={styles.pillCount}
              style={{
                backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : `${stat.color}15`,
                color: isActive ? 'white' : stat.color
              }}
            >
              {count}
            </span>
          </button>
        );
      })}
      {masteryFilter && (
        <button className={styles.clearFilterBtn} onClick={onClear}>
          Clear
        </button>
      )}
    </div>
  );
}

interface TabBarProps {
  activeTab: 'collections' | 'all' | 'favorites';
  masteryFilter: string | null;
  activeCollection: Collection | null;
  favoritesCount?: number;
  onTabChange: (tab: 'collections' | 'all' | 'favorites') => void;
  onCloseCollection: () => void;
}

export function TabBar({
  activeTab,
  masteryFilter,
  activeCollection,
  favoritesCount = 0,
  onTabChange,
  onCloseCollection,
}: TabBarProps) {
  return (
    <div className={styles.tabBar}>
      <button
        className={`${styles.tab} ${activeTab === 'all' || masteryFilter ? styles.active : ''}`}
        onClick={() => onTabChange('all')}
      >
        All Recipes
      </button>
      <button
        className={`${styles.tab} ${activeTab === 'collections' && !masteryFilter ? styles.active : ''}`}
        onClick={() => onTabChange('collections')}
      >
        Collections
      </button>
      <button
        className={`${styles.tab} ${activeTab === 'favorites' && !masteryFilter ? styles.active : ''}`}
        onClick={() => onTabChange('favorites')}
      >
        Favorites
        {favoritesCount > 0 && (
          <span className={styles.tabBadge}>{favoritesCount}</span>
        )}
      </button>
      {activeCollection && (
        <>
          <div className={styles.tabSpacer} />
          <div className={styles.activeCollectionIndicator}>
            <span>{activeCollection.name}</span>
            <button
              className={styles.closeCollectionBtn}
              onClick={onCloseCollection}
            >
              ✕
            </button>
          </div>
        </>
      )}
    </div>
  );
}

interface SearchControlsProps {
  searchQuery: string;
  filterSpirit: SpiritCategory | 'all';
  spiritTypes: Array<SpiritCategory | 'all'>;
  placeholder?: string;
  showCount?: boolean;
  count?: number;
  showBackButton?: boolean;
  onSearchChange: (value: string) => void;
  onSpiritChange: (value: SpiritCategory | 'all') => void;
  onBack?: () => void;
}

export function SearchControls({
  searchQuery,
  filterSpirit,
  spiritTypes,
  placeholder = 'Search recipes...',
  showCount = false,
  count = 0,
  showBackButton = false,
  onSearchChange,
  onSpiritChange,
  onBack,
}: SearchControlsProps) {
  return (
    <div className={styles.controls}>
      {showBackButton && onBack && (
        <button className={styles.backBtn} onClick={onBack}>
          ← Back
        </button>
      )}
      <div className={styles.searchWrapper}>
        <Search size={16} className={styles.searchIcon} />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={placeholder}
          className={styles.searchInput}
        />
        {searchQuery && (
          <button
            type="button"
            className={styles.searchClearBtn}
            onClick={() => onSearchChange('')}
            aria-label="Clear search"
          >
            <X size={14} />
          </button>
        )}
      </div>
      <select
        value={filterSpirit}
        onChange={(e) => onSpiritChange(e.target.value as SpiritCategory | 'all')}
        className={styles.filterSelect}
      >
        {spiritTypes.map((type) => (
          <option key={type} value={type}>
            {type === 'all' ? 'All Spirits' : type}
          </option>
        ))}
      </select>
      {showCount && (
        <span className={styles.recipeCount}>{count} recipes</span>
      )}
    </div>
  );
}
