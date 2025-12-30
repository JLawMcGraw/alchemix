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
  /** User's inventory items for counts (should be ALL items for accurate counts) */
  inventoryItems?: Array<{ name: string; type?: string; stock_number?: number }>;
  /** Filtered items for highlighting - if provided, only elements matching these items are highlighted */
  filteredItems?: Array<{ name: string; type?: string; stock_number?: number }>;
  /** Currently selected element */
  selectedElement?: PeriodicElement | null;
  /** Callback when element is clicked (typically for filtering) */
  onElementClick?: (element: PeriodicElement) => void;
  /** Callback when user wants to add a new item for this element */
  onElementAdd?: (element: PeriodicElement) => void;
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
  { group: 'garnish', label: 'Garnish' },
];

export function PeriodicTable({
  inventoryItems = [],
  filteredItems,
  selectedElement,
  onElementClick,
  onElementAdd,
  onClearSelection,
  showLegend = true,
  compact = false,
  className,
}: PeriodicTableProps) {
  // Calculate inventory counts for each element (from ALL items)
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

  // Calculate which elements are highlighted (from filtered items, if provided)
  // If no filteredItems provided, use inventoryItems (no filter active)
  const highlightedElements = useMemo(() => {
    const itemsToCheck = filteredItems ?? inventoryItems;
    const highlighted = new Set<string>();
    PERIODIC_SECTIONS.forEach((section) => {
      section.elements.forEach((element) => {
        const count = countInventoryForElement(element, itemsToCheck);
        if (count > 0) {
          highlighted.add(element.symbol);
        }
      });
    });
    return highlighted;
  }, [filteredItems, inventoryItems]);

  // Filter sections to only show sections with visible elements
  const visibleSections = useMemo(() => {
    return PERIODIC_SECTIONS.map((section) => {
      // Filter elements: show if NOT hidden, OR if user has matching inventory
      const visibleElements = section.elements.filter((element) => {
        const count = elementCounts.get(element.symbol) || 0;
        return !element.hidden || count > 0;
      });
      return { ...section, elements: visibleElements };
    }).filter((section) => section.elements.length > 0);
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
      {visibleSections.map((section) => (
        <div key={section.title} className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>{section.title}</h3>
            <div className={styles.sectionDivider} />
          </div>
          <div className={styles.elementGrid}>
            {section.elements.map((element) => {
              const count = elementCounts.get(element.symbol) || 0;
              const isHighlighted = highlightedElements.has(element.symbol);
              return (
                <ElementCard
                  key={element.symbol}
                  element={element}
                  hasInventory={isHighlighted}
                  inventoryCount={count}
                  isActive={selectedElement?.symbol === element.symbol}
                  size={compact ? 'sm' : 'md'}
                  onClick={onElementClick}
                  onAdd={onElementAdd}
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
