'use client';

/**
 * ElementCell Component
 *
 * Displays a predefined element type (e.g., "Gin", "Rum", "Whiskey") with:
 * - 2-letter symbol (Capital + lowercase, e.g., "Gn", "Rm", "Wh")
 * - Element name (the type, not individual bottle names)
 * - ABV/Brix/pH spec
 * - Count badge showing how many user inventory items match this cell
 * - Dropdown showing all ELEMENT TYPES for this cell (not user bottles)
 * - Elements user doesn't own are grayed out
 * - Clicking an element in dropdown swaps it to the front
 */

import React, { useState, useEffect } from 'react';
import type { InventoryItem } from '@/types';
import { GROUPS, PERIODS, getElementsForCell, type MixologyGroup, type MixologyPeriod, type ElementType } from '@/lib/periodicTableV2';
import styles from './ElementCell.module.css';

// ============================================================================
// Hook for dark mode detection
// ============================================================================

function useIsDarkMode(): boolean {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const checkTheme = () => {
      const theme = document.documentElement.getAttribute('data-theme');
      setIsDarkMode(theme === 'dark');
    };
    checkTheme();
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  return isDarkMode;
}

// ============================================================================
// Types
// ============================================================================

interface ElementCellProps {
  /** Group (column) number 1-6 */
  group: MixologyGroup;
  /** Period (row) number 1-6 */
  period: MixologyPeriod;
  /** Predefined element type to display in the cell */
  element: ElementType | null;
  /** Inventory items that match this cell (for count badge) */
  matchedItems: InventoryItem[];
  /** Set of element symbols the user owns in this cell */
  ownedElementSymbols: Set<string>;
  /** Whether cell is currently expanded */
  isExpanded: boolean;
  /** Callback to expand/collapse cell */
  onExpand: () => void;
  /** Callback when an element type is selected */
  onElementSelect?: (element: ElementType) => void;
}

// ============================================================================
// Helper function
// ============================================================================

function getElementSpec(el: ElementType): string | null {
  if (!el || el.empty) return null;
  if (el.abv) return el.abv;
  if (el.brix) return `${el.brix}° Bx`;
  if (el.ph) return `pH ${el.ph}`;
  if (el.usage) return el.usage;
  return null;
}

// ============================================================================
// Component
// ============================================================================

export default function ElementCell({
  group,
  period,
  element,
  matchedItems,
  ownedElementSymbols,
  isExpanded,
  onExpand,
  onElementSelect,
}: ElementCellProps) {
  const isDarkMode = useIsDarkMode();
  const groupInfo = GROUPS[group];
  const periodInfo = PERIODS[period];
  const groupColor = isDarkMode ? groupInfo.colorDark : groupInfo.color;
  const periodColor = isDarkMode ? periodInfo.colorDark : periodInfo.color;
  const hasItems = matchedItems.length > 0;
  const isEmptyCell = !element || element.empty === true;

  // Local state to track which element is currently displayed (can be swapped by user)
  const [selectedElement, setSelectedElement] = useState<ElementType | null>(element);

  // Reset selected element when the prop changes
  useEffect(() => {
    setSelectedElement(element);
  }, [element]);

  // Get all element types for this cell (for dropdown)
  const cellElements = getElementsForCell(group, period).filter(el => !el.empty);

  // Handle clicking an element in the dropdown - swap it to front
  const handleElementClick = (el: ElementType) => {
    setSelectedElement(el);
    onElementSelect?.(el);
  };

  const displayedElement = selectedElement || element;
  const spec = getElementSpec(displayedElement!);

  // Check if the displayed element is owned by user
  const isDisplayedOwned = displayedElement && ownedElementSymbols.has(displayedElement.symbol);

  return (
    <div
      className={`${styles.cell} ${isEmptyCell ? styles.empty : ''} ${hasItems ? styles.hasItems : ''} ${!isDisplayedOwned && !isEmptyCell ? styles.notOwned : ''} ${isExpanded ? styles.expanded : ''}`}
      style={{
        '--group-color': groupColor,
        '--period-color': periodColor,
      } as React.CSSProperties}
      onClick={(e) => {
        e.stopPropagation();
        // Allow expanding if cell has element types (not empty)
        if (!isEmptyCell) onExpand();
      }}
      role="button"
      tabIndex={isEmptyCell ? -1 : 0}
      aria-label={`${displayedElement?.name || groupInfo.name}: ${matchedItems.length} items in bar`}
      aria-expanded={isExpanded}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (!isEmptyCell) onExpand();
        }
      }}
    >
      {/* Period indicator dot */}
      <div
        className={styles.periodDot}
        style={{ backgroundColor: periodColor }}
        title={periodInfo.name}
      />

      {/* Count badge - shows how many bottles user has in this category */}
      {hasItems && (
        <div className={styles.countBadge}>
          {matchedItems.length}
        </div>
      )}

      {/* Symbol - Capital + lowercase */}
      <div className={styles.symbol}>
        {displayedElement?.symbol || groupInfo.name.slice(0, 2)}
      </div>

      {/* Name - The element type (e.g., "Gin", "Rum") */}
      <div className={styles.name}>
        {displayedElement?.name || groupInfo.name}
      </div>

      {/* Spec (ABV, Brix, pH) */}
      {spec && (
        <div className={styles.spec}>
          {spec}
        </div>
      )}

      {/* Expanded dropdown showing all ELEMENT TYPES for this cell */}
      {isExpanded && cellElements.length > 0 && (
        <div className={styles.dropdown} onClick={(e) => e.stopPropagation()}>
          <div className={styles.dropdownHeader}>
            <div className={styles.dropdownTitle}>
              {groupInfo.name}
              <span className={styles.dropdownCount}>{matchedItems.length} in bar</span>
            </div>
            <div className={styles.dropdownBadges}>
              <span
                className={styles.groupBadge}
                style={{ '--badge-color': groupColor } as React.CSSProperties}
              >
                {groupInfo.name}
              </span>
              <span
                className={styles.periodBadge}
                style={{ '--badge-color': periodColor } as React.CSSProperties}
              >
                {periodInfo.name}
              </span>
            </div>
          </div>
          <ul className={styles.itemList}>
            {cellElements.map((el) => {
              const isOwned = ownedElementSymbols.has(el.symbol);
              const isSelected = displayedElement?.symbol === el.symbol;

              return (
                <li
                  key={el.symbol}
                  className={`${styles.item} ${!isOwned ? styles.itemNotOwned : ''} ${isSelected ? styles.itemSelected : ''}`}
                  onClick={() => handleElementClick(el)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleElementClick(el);
                    }
                  }}
                >
                  <div>
                    <span className={styles.itemSymbol}>{el.symbol}</span>
                    <span className={styles.itemName}>{el.name}</span>
                  </div>
                  {getElementSpec(el) && (
                    <div className={styles.itemSpec}>{getElementSpec(el)}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
