'use client';

import React from 'react';
import { Upload } from 'lucide-react';
import styles from './recipes.module.css';

interface PageHeaderProps {
  totalCount: number;
  craftableCount: number;
  onImportCSV: () => void;
  onNewRecipe: () => void;
}

export function PageHeader({
  totalCount,
  craftableCount,
  onImportCSV,
  onNewRecipe,
}: PageHeaderProps) {
  return (
    <div className={styles.header}>
      <div className={styles.headerLeft}>
        <h1 className={styles.title}>Recipes</h1>
        <p className={styles.subtitle}>
          {totalCount} total · <span className={styles.subtitleHighlight}>{craftableCount} craftable tonight</span>
        </p>
      </div>
      <div className={styles.headerActions}>
        <button
          className={`${styles.actionBtn} ${styles.actionBtnOutline}`}
          onClick={onImportCSV}
          aria-label="Import CSV"
        >
          <Upload size={16} />
        </button>
        <button
          className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
          onClick={onNewRecipe}
        >
          + New Recipe
        </button>
      </div>
    </div>
  );
}

interface BulkActionsBarProps {
  selectedCount: number;
  onMove: () => void;
  onDelete: () => void;
  onClear: () => void;
}

export function BulkActionsBar({
  selectedCount,
  onMove,
  onDelete,
  onClear,
}: BulkActionsBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className={styles.bulkBar}>
      <span className={styles.bulkCount}>{selectedCount} selected</span>
      <div className={styles.bulkDivider} />
      <button className={styles.bulkAction} onClick={onMove}>
        Move to Collection
      </button>
      <button className={`${styles.bulkAction} ${styles.bulkActionDanger}`} onClick={onDelete}>
        Delete
      </button>
      <button className={`${styles.bulkAction} ${styles.bulkActionMuted}`} onClick={onClear}>
        Clear
      </button>
    </div>
  );
}

interface UncategorizedSectionHeaderProps {
  count: number;
  onSelectAll?: () => void;
}

export function UncategorizedSectionHeader({ count, onSelectAll }: UncategorizedSectionHeaderProps) {
  return (
    <div className={styles.sectionHeader}>
      <div className={styles.sectionHeaderLeft}>
        <h2 className={styles.sectionTitle}>Uncategorized</h2>
        <span className={styles.sectionCount}>{count} recipes</span>
      </div>
      {onSelectAll && count > 0 && (
        <button className={styles.selectAllBtn} onClick={onSelectAll}>
          Select All
        </button>
      )}
    </div>
  );
}
