'use client';

import React, { useMemo } from 'react';
import { X, FlaskConical } from 'lucide-react';
import { ElementCard } from '@/components/ui/ElementCard';
import {
  PERIODIC_SECTIONS,
  GROUP_COLORS,
  countInventoryForElement,
  type PeriodicElement,
  type ElementGroup,
} from '@/lib/periodicTable';
import styles from './PeriodicTable.module.css';

export interface PeriodicTableProps {
  /** User's inventory items for highlighting */
  inventoryItems?: Array<{ name: string; type?: string }>;
  /** Currently selected element */
  selectedElement?: PeriodicElement | null;
  /** Callback when element is clicked */
  onElementClick?: (element: PeriodicElement) => void;
  /** Callback to clear selection */
  onClearSelection?: () => void;
  /** Show legend */
  showLegend?: boolean;
  /** Compact mode for smaller displays */
  compact?: boolean;
  /** Optional className */
  className?: string;
}

// Legend items for group colors
const LEGEND_ITEMS: Array<{ group: ElementGroup; label: string }> = [
  { group: 'cane', label: 'Cane' },
  { group: 'grain', label: 'Grain' },
  { group: 'agave', label: 'Agave' },
  { group: 'grape', label: 'Grape' },
  { group: 'juniper', label: 'Juniper' },
  { group: 'neutral', label: 'Neutral' },
  { group: 'sugar', label: 'Liqueurs' },
  { group: 'acid', label: 'Citrus' },
  { group: 'botanical', label: 'Botanical' },
  { group: 'carbonation', label: 'Mixers' },
  { group: 'dairy', label: 'Dairy' },
];

export function PeriodicTable({
  inventoryItems = [],
  selectedElement,
  onElementClick,
  onClearSelection,
  showLegend = true,
  compact = false,
  className,
}: PeriodicTableProps) {
  // Calculate inventory counts for each element
  const elementCounts = useMemo(() => {
    const counts = new Map<string, number>();
    PERIODIC_SECTIONS.forEach((section) => {
      section.elements.forEach((element) => {
        const count = countInventoryForElement(element, inventoryItems);
        counts.set(element.symbol, count);
      });
    });
    return counts;
  }, [inventoryItems]);

  // Calculate total elements with inventory
  const totalWithInventory = useMemo(() => {
    let count = 0;
    elementCounts.forEach((value) => {
      if (value > 0) count++;
    });
    return count;
  }, [elementCounts]);

  const containerClasses = [
    styles.periodicTable,
    compact && styles.compact,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={containerClasses}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <FlaskConical size={16} />
          <h2 className={styles.title}>Periodic Table of Mixology</h2>
          <span className={styles.elementCount}>
            {totalWithInventory} categories in bar
          </span>
        </div>
      </div>

      {/* Active filter display */}
      {selectedElement && (
        <div className={styles.activeFilter}>
          <span className={styles.activeFilterLabel}>
            Filtering: {selectedElement.name}
          </span>
          <button
            type="button"
            className={styles.clearFilterBtn}
            onClick={onClearSelection}
            title="Clear filter"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* Element sections */}
      {PERIODIC_SECTIONS.map((section) => (
        <div key={section.title} className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>{section.title}</h3>
            <div className={styles.sectionDivider} />
          </div>
          <div className={styles.elementGrid}>
            {section.elements.map((element) => {
              const count = elementCounts.get(element.symbol) || 0;
              return (
                <ElementCard
                  key={element.symbol}
                  element={element}
                  hasInventory={count > 0}
                  inventoryCount={count}
                  isActive={selectedElement?.symbol === element.symbol}
                  size={compact ? 'sm' : 'md'}
                  onClick={onElementClick}
                />
              );
            })}
          </div>
        </div>
      ))}

      {/* Legend */}
      {showLegend && (
        <div className={styles.legend}>
          {LEGEND_ITEMS.map((item) => (
            <div key={item.group} className={styles.legendItem}>
              <div
                className={styles.legendColor}
                style={{ backgroundColor: GROUP_COLORS[item.group] }}
              />
              <span className={styles.legendLabel}>{item.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default PeriodicTable;
