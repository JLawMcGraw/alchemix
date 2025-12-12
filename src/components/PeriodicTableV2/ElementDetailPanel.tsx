'use client';

/**
 * ElementDetailPanel Component
 *
 * Slide-out panel showing detailed information about a selected inventory item.
 * Allows user to view classification details and optionally reclassify the item.
 */

import React, { useState, useCallback } from 'react';
import type { InventoryItem } from '@/types';
import {
  GROUPS,
  PERIODS,
  classifyInventoryItem,
  type MixologyGroup,
  type MixologyPeriod,
} from '@/lib/periodicTableV2';
import styles from './ElementDetailPanel.module.css';

// ============================================================================
// Types
// ============================================================================

interface ElementDetailPanelProps {
  /** The selected inventory item */
  item: InventoryItem;
  /** Callback to close the panel */
  onClose: () => void;
  /** Callback when user reclassifies (optional - if not provided, reclassify UI is hidden) */
  onReclassify?: (group: MixologyGroup, period: MixologyPeriod) => void;
}

// ============================================================================
// Component
// ============================================================================

export default function ElementDetailPanel({
  item,
  onClose,
  onReclassify,
}: ElementDetailPanelProps) {
  // Get current classification
  const classification = classifyInventoryItem(item);
  const currentGroup = GROUPS[classification.group];
  const currentPeriod = PERIODS[classification.period];

  // State for reclassification mode
  const [isReclassifying, setIsReclassifying] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<MixologyGroup>(classification.group);
  const [selectedPeriod, setSelectedPeriod] = useState<MixologyPeriod>(classification.period);

  // Handle reclassify save
  const handleSaveReclassification = useCallback(() => {
    if (onReclassify) {
      onReclassify(selectedGroup, selectedPeriod);
    }
    setIsReclassifying(false);
  }, [onReclassify, selectedGroup, selectedPeriod]);

  // Handle cancel reclassification
  const handleCancelReclassification = useCallback(() => {
    setSelectedGroup(classification.group);
    setSelectedPeriod(classification.period);
    setIsReclassifying(false);
  }, [classification]);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.title}>{item.name}</h2>
          <button
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close panel"
          >
            &times;
          </button>
        </div>

        {/* Classification Info */}
        <div className={styles.classificationInfo}>
          <div
            className={styles.classificationBadge}
            style={{
              '--group-color': currentGroup.color,
              '--period-color': currentPeriod.color,
            } as React.CSSProperties}
          >
            <span className={styles.groupLabel}>
              {currentGroup.numeral}. {currentGroup.name}
            </span>
            <span className={styles.separator}>/</span>
            <span className={styles.periodLabel}>
              {currentPeriod.name}
            </span>
          </div>

          <div className={styles.confidenceLabel}>
            Classification: <span className={styles.confidence}>{classification.confidence}</span>
          </div>

          {classification.reasoning && (
            <p className={styles.reasoning}>{classification.reasoning}</p>
          )}
        </div>

        {/* Item Details */}
        <div className={styles.details}>
          {item.type && (
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Type</span>
              <span className={styles.detailValue}>{item.type}</span>
            </div>
          )}
          {item.category && (
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Category</span>
              <span className={styles.detailValue}>{item.category}</span>
            </div>
          )}
          {item.abv && (
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>ABV</span>
              <span className={styles.detailValue}>{item.abv}%</span>
            </div>
          )}
          {item.distillery_location && (
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Origin</span>
              <span className={styles.detailValue}>{item.distillery_location}</span>
            </div>
          )}
        </div>

        {/* Reclassify Section */}
        {onReclassify && (
          <div className={styles.reclassifySection}>
            {!isReclassifying ? (
              <button
                className={styles.reclassifyButton}
                onClick={() => setIsReclassifying(true)}
              >
                Reclassify
              </button>
            ) : (
              <div className={styles.reclassifyForm}>
                <h3 className={styles.reclassifyTitle}>Reclassify Item</h3>

                {/* Group Selection */}
                <div className={styles.selectGroup}>
                  <label className={styles.selectLabel}>Function (Group)</label>
                  <div className={styles.selectGrid}>
                    {Object.entries(GROUPS).map(([num, info]) => {
                      const groupNum = Number(num) as MixologyGroup;
                      return (
                        <button
                          key={num}
                          className={`${styles.selectOption} ${selectedGroup === groupNum ? styles.selected : ''}`}
                          style={{ '--option-color': info.color } as React.CSSProperties}
                          onClick={() => setSelectedGroup(groupNum)}
                        >
                          <span className={styles.optionNumeral}>{info.numeral}</span>
                          <span className={styles.optionName}>{info.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Period Selection */}
                <div className={styles.selectGroup}>
                  <label className={styles.selectLabel}>Origin (Period)</label>
                  <div className={styles.selectGrid}>
                    {Object.entries(PERIODS).map(([num, info]) => {
                      const periodNum = Number(num) as MixologyPeriod;
                      return (
                        <button
                          key={num}
                          className={`${styles.selectOption} ${selectedPeriod === periodNum ? styles.selected : ''}`}
                          style={{ '--option-color': info.color } as React.CSSProperties}
                          onClick={() => setSelectedPeriod(periodNum)}
                        >
                          <span className={styles.optionNumeral}>{periodNum}</span>
                          <span className={styles.optionName}>{info.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Actions */}
                <div className={styles.reclassifyActions}>
                  <button
                    className={styles.cancelButton}
                    onClick={handleCancelReclassification}
                  >
                    Cancel
                  </button>
                  <button
                    className={styles.saveButton}
                    onClick={handleSaveReclassification}
                  >
                    Save
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
