'use client';

/**
 * Periodic Table of Mixology V2
 *
 * A 6×6 grid visualizing ingredient TYPES by function (group) and origin (period).
 * Groups (columns): Base, Bridge, Modifier, Sweetener, Reagent, Catalyst
 * Periods (rows): Agave, Cane, Grain, Grape, Fruit, Botanic
 *
 * Each cell shows a predefined element TYPE (e.g., "Gin", "Rum", "Whiskey")
 * with the user's inventory items counted against these types.
 */

import React, { useState, useMemo, useCallback } from 'react';
import type { InventoryItem } from '@/types';
import {
  GROUPS,
  PERIODS,
  getCellDisplayData,
  type MixologyGroup,
  type MixologyPeriod,
  type CellPosition,
  type ElementType,
} from '@/lib/periodicTableV2';
import ElementCell from './ElementCell';
import styles from './PeriodicTable.module.css';

// ============================================================================
// Types
// ============================================================================

interface PeriodicTableProps {
  /** Inventory items to display */
  inventoryItems: InventoryItem[];
  /** User classification overrides (from API) */
  userOverrides?: Map<number, CellPosition>;
  /** Callback when an element type is selected from dropdown */
  onElementSelect?: (element: ElementType) => void;
  /** Additional CSS class */
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export default function PeriodicTable({
  inventoryItems,
  userOverrides,
  onElementSelect,
  className,
}: PeriodicTableProps) {
  // State for expanded cell
  const [expandedCell, setExpandedCell] = useState<CellPosition | null>(null);

  // Build cell display data from inventory items
  const cellDisplayData = useMemo(() => {
    const data: Map<string, ReturnType<typeof getCellDisplayData>> = new Map();

    for (let period = 1; period <= 6; period++) {
      for (let group = 1; group <= 6; group++) {
        const key = `${group}-${period}`;
        data.set(key, getCellDisplayData(
          group as MixologyGroup,
          period as MixologyPeriod,
          inventoryItems
        ));
      }
    }

    return data;
  }, [inventoryItems]);

  // Count total categories with inventory
  const categoriesInBar = useMemo(() => {
    let count = 0;
    cellDisplayData.forEach((data) => {
      if (data.count > 0) count++;
    });
    return count;
  }, [cellDisplayData]);

  // Handle cell expansion toggle
  const handleCellClick = useCallback((group: MixologyGroup, period: MixologyPeriod) => {
    setExpandedCell((current) => {
      if (current?.group === group && current?.period === period) {
        return null; // Collapse if already expanded
      }
      return { group, period };
    });
  }, []);

  // Handle element type selection from dropdown
  const handleElementSelect = useCallback((element: ElementType) => {
    setExpandedCell(null); // Close dropdown when element selected
    onElementSelect?.(element);
  }, [onElementSelect]);

  // Close expanded cell when clicking outside
  const handleContainerClick = useCallback(() => {
    setExpandedCell(null);
  }, []);

  return (
    <div
      className={`${styles.container} ${className || ''}`}
      onClick={handleContainerClick}
    >
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <h2>Periodic Table of Mixology</h2>
          <div className={styles.subtitle}>
            {categoriesInBar} categories in bar
          </div>
        </div>
      </div>

      {/* Group Labels Row */}
      <div className={styles.groupLabelsRow}>
        <div className={styles.cornerCell} />
        {Object.entries(GROUPS).map(([groupNum, groupInfo]) => (
          <div
            key={groupNum}
            className={styles.groupHeader}
            style={{ '--group-color': groupInfo.color } as React.CSSProperties}
          >
            <div className={styles.groupNumeral}>
              {groupInfo.numeral}. {groupInfo.name}
            </div>
            <div className={styles.groupName}>{groupInfo.desc}</div>
          </div>
        ))}
      </div>

      {/* Period Rows */}
      {Object.entries(PERIODS).map(([periodNum, periodInfo]) => {
        const period = Number(periodNum) as MixologyPeriod;

        return (
          <div key={period} className={styles.row}>
            {/* Period Label (Row Header) */}
            <div
              className={styles.periodLabel}
              style={{ '--period-color': periodInfo.color } as React.CSSProperties}
            >
              <div className={styles.periodNumber}>{period}</div>
              <div className={styles.periodName}>{periodInfo.name}</div>
              <div className={styles.periodProfile}>{periodInfo.profile}</div>
            </div>

            {/* Cells for each group */}
            {Object.keys(GROUPS).map((groupNum) => {
              const group = Number(groupNum) as MixologyGroup;
              const key = `${group}-${period}`;
              const displayData = cellDisplayData.get(key);
              const isExpanded = expandedCell?.group === group && expandedCell?.period === period;

              return (
                <ElementCell
                  key={key}
                  group={group}
                  period={period}
                  element={displayData?.displayElement || displayData?.element || null}
                  matchedItems={displayData?.matchedItems || []}
                  ownedElementSymbols={displayData?.ownedElementSymbols || new Set()}
                  isExpanded={isExpanded}
                  onExpand={() => handleCellClick(group, period)}
                  onElementSelect={handleElementSelect}
                />
              );
            })}
          </div>
        );
      })}

      {/* Legend */}
      <div className={styles.legend}>
        {Object.entries(PERIODS).map(([num, period]) => (
          <div key={num} className={styles.legendItem}>
            <div
              className={styles.legendDot}
              style={{ backgroundColor: period.color }}
            />
            <span className={styles.legendLabel}>{period.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
