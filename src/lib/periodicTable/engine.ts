/**
 * Periodic Table of Mixology - Classification Engine
 *
 * Core functions for classifying and matching inventory items.
 */

import type { InventoryItem, PeriodicGroup, PeriodicPeriod } from '@/types';
import type {
  MixologyGroup,
  MixologyPeriod,
  Classification,
  CellPosition,
  ClassifiedItem,
  CellData,
  ElementType,
  ElementCellData,
  CellDisplayData,
} from './types';
import { GROUPS, PERIODS, GROUP_NUMBERS, PERIOD_NUMBERS } from './constants';
import { ELEMENTS } from './elements';
import { CLASSIFICATION_MAP, CATEGORY_FALLBACKS } from './classificationMap';

/**
 * Normalize text for matching
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['']/g, "'");
}

/**
 * Extract searchable keywords from an inventory item
 */
function extractKeywords(item: InventoryItem): string[] {
  const keywords: string[] = [];

  if (item.name) {
    keywords.push(normalizeText(item.name));
    normalizeText(item.name).split(/\s+/).forEach(word => {
      if (word.length > 2) keywords.push(word);
    });
  }

  if (item.type) {
    keywords.push(normalizeText(item.type));
    normalizeText(item.type).split(/\s+/).forEach(word => {
      if (word.length > 2) keywords.push(word);
    });
  }

  return [...new Set(keywords)];
}

/**
 * Classify an inventory item into Group/Period
 */
export function classifyInventoryItem(
  item: InventoryItem,
  userOverride?: CellPosition | null
): Classification {
  if (userOverride) {
    return {
      group: userOverride.group,
      period: userOverride.period,
      confidence: 'manual',
      reasoning: 'User override',
    };
  }

  const keywords = extractKeywords(item);

  // Try exact match
  for (const keyword of keywords) {
    if (CLASSIFICATION_MAP[keyword]) {
      const match = CLASSIFICATION_MAP[keyword];
      return {
        group: match.group as MixologyGroup,
        period: match.period as MixologyPeriod,
        confidence: 'high',
        reasoning: `Matched keyword: "${keyword}"`,
      };
    }
  }

  // Try partial match
  for (const keyword of keywords) {
    for (const [mapKey, position] of Object.entries(CLASSIFICATION_MAP)) {
      if (keyword.includes(mapKey) || mapKey.includes(keyword)) {
        return {
          group: position.group as MixologyGroup,
          period: position.period as MixologyPeriod,
          confidence: 'medium',
          reasoning: `Partial match: "${keyword}" ~ "${mapKey}"`,
        };
      }
    }
  }

  // Category fallback
  if (item.category && CATEGORY_FALLBACKS[item.category]) {
    const fallback = CATEGORY_FALLBACKS[item.category];
    return {
      group: fallback.group as MixologyGroup,
      period: fallback.period as MixologyPeriod,
      confidence: 'low',
      reasoning: `Category fallback: ${item.category}`,
    };
  }

  // Ultimate fallback
  return {
    group: 3,
    period: 6,
    confidence: 'low',
    reasoning: 'Default fallback',
  };
}

/**
 * Classify multiple inventory items and group by cell
 */
export function classifyAndGroupItems(
  items: InventoryItem[],
  userOverrides?: Map<number, CellPosition>
): Map<string, ClassifiedItem[]> {
  const grouped = new Map<string, ClassifiedItem[]>();

  for (const group of GROUP_NUMBERS) {
    for (const period of PERIOD_NUMBERS) {
      grouped.set(`${group}-${period}`, []);
    }
  }

  for (const item of items) {
    const override = userOverrides?.get(item.id);
    const classification = classifyInventoryItem(item, override);
    const key = `${classification.group}-${classification.period}`;

    const cell = grouped.get(key) || [];
    cell.push({ item, classification });
    grouped.set(key, cell);
  }

  return grouped;
}

/**
 * Build cell data for rendering the grid
 */
export function buildGridData(
  items: InventoryItem[],
  userOverrides?: Map<number, CellPosition>
): CellData[][] {
  const grouped = classifyAndGroupItems(items, userOverrides);
  const grid: CellData[][] = [];

  for (const period of PERIOD_NUMBERS) {
    const row: CellData[] = [];
    for (const group of GROUP_NUMBERS) {
      const key = `${group}-${period}`;
      const cellItems = grouped.get(key) || [];

      row.push({
        group,
        period,
        items: cellItems,
        hasInventory: cellItems.length > 0,
        count: cellItems.length,
      });
    }
    grid.push(row);
  }

  return grid;
}

/**
 * Get cell key string
 */
export function getCellKey(group: MixologyGroup, period: MixologyPeriod): string {
  return `${group}-${period}`;
}

/**
 * Parse cell key string
 */
export function parseCellKey(key: string): CellPosition | null {
  const [groupStr, periodStr] = key.split('-');
  const group = parseInt(groupStr, 10) as MixologyGroup;
  const period = parseInt(periodStr, 10) as MixologyPeriod;

  if (group >= 1 && group <= 6 && period >= 1 && period <= 6) {
    return { group, period };
  }
  return null;
}

/**
 * Get human-readable cell name
 */
export function getCellName(group: MixologyGroup, period: MixologyPeriod): string {
  return `${PERIODS[period].name} ${GROUPS[group].name}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// ELEMENT MATCHING ENGINE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Check if a word is a valid word boundary match
 */
function isWordBoundaryMatch(text: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`\\b${escaped}\\b`, 'i');
  return regex.test(text);
}

/**
 * Match an inventory item against predefined elements
 */
export function matchItemToElements(item: InventoryItem): ElementType[] {
  const itemText = normalizeText(`${item.name} ${item.type || ''}`);
  const matches: { element: ElementType; score: number }[] = [];

  for (const element of ELEMENTS) {
    if (element.empty) continue;

    let score = 0;

    for (const keyword of element.keywords) {
      const normalizedKeyword = normalizeText(keyword);

      if (normalizedKeyword.includes(' ')) {
        if (itemText.includes(normalizedKeyword)) {
          score += 20;
        }
      } else {
        if (isWordBoundaryMatch(itemText, normalizedKeyword)) {
          score += 10;
        }
      }
    }

    if (score > 0) {
      matches.push({ element, score });
    }
  }

  matches.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.element.primary && !b.element.primary) return -1;
    if (!a.element.primary && b.element.primary) return 1;
    return 0;
  });

  return matches.map(m => m.element);
}

/**
 * Get primary element for a cell
 */
export function getPrimaryElement(group: MixologyGroup, period: MixologyPeriod): ElementType | null {
  return ELEMENTS.find(e => e.group === group && e.period === period && e.primary) || null;
}

/**
 * Get all elements for a cell
 */
export function getElementsForCell(group: MixologyGroup, period: MixologyPeriod): ElementType[] {
  return ELEMENTS.filter(e => e.group === group && e.period === period);
}

/**
 * Build element cell data with matched inventory items
 */
export function buildElementCellData(
  inventoryItems: InventoryItem[]
): Map<string, ElementCellData[]> {
  const cellData = new Map<string, ElementCellData[]>();

  for (const group of GROUP_NUMBERS) {
    for (const period of PERIOD_NUMBERS) {
      const key = getCellKey(group, period);
      const elements = getElementsForCell(group, period);

      cellData.set(key, elements.map(element => ({
        element,
        matchedItems: [],
        count: 0,
      })));
    }
  }

  for (const item of inventoryItems) {
    const matchedElements = matchItemToElements(item);

    if (matchedElements.length > 0) {
      const bestMatch = matchedElements[0];
      const key = getCellKey(bestMatch.group, bestMatch.period);
      const cellElements = cellData.get(key);

      if (cellElements) {
        const elementData = cellElements.find(e => e.element.symbol === bestMatch.symbol);
        if (elementData) {
          elementData.matchedItems.push(item);
          elementData.count = elementData.matchedItems.length;
        }
      }
    }
  }

  return cellData;
}

/**
 * Get display data for a single cell
 */
export function getCellDisplayData(
  group: MixologyGroup,
  period: MixologyPeriod,
  inventoryItems: InventoryItem[]
): CellDisplayData {
  const elements = getElementsForCell(group, period);
  const primaryElement = getPrimaryElement(group, period);

  if (elements.length === 0) {
    return { element: null, displayElement: null, matchedItems: [], count: 0, isEmpty: true, ownedElementSymbols: new Set() };
  }

  const elementMatchMap = new Map<string, InventoryItem[]>();
  elements.forEach(el => elementMatchMap.set(el.symbol, []));

  const classificationMatchedItems: InventoryItem[] = [];

  for (const item of inventoryItems) {
    const matchedElements = matchItemToElements(item);
    const cellMatch = matchedElements.find(e => e.group === group && e.period === period);

    if (cellMatch) {
      const items = elementMatchMap.get(cellMatch.symbol) || [];
      items.push(item);
      elementMatchMap.set(cellMatch.symbol, items);
    } else {
      const classification = classifyInventoryItem(item);
      if (classification.group === group && classification.period === period) {
        classificationMatchedItems.push(item);
      }
    }
  }

  const allMatchedItems: InventoryItem[] = [];
  const ownedElementSymbols = new Set<string>();

  // Helper to check if item is in stock
  const isInStock = (item: InventoryItem) =>
    item.stock_number !== null && item.stock_number !== undefined && item.stock_number > 0;

  elementMatchMap.forEach((items, symbol) => {
    allMatchedItems.push(...items);
    // Only mark as owned if at least one item is in stock
    if (items.some(isInStock)) {
      ownedElementSymbols.add(symbol);
    }
  });
  allMatchedItems.push(...classificationMatchedItems);

  let displayElement: ElementType | null = null;

  if (primaryElement && !primaryElement.empty) {
    const primaryMatches = elementMatchMap.get(primaryElement.symbol) || [];
    if (primaryMatches.length > 0) {
      displayElement = primaryElement;
    }
  }

  if (!displayElement) {
    for (const el of elements) {
      if (el.empty) continue;
      const matches = elementMatchMap.get(el.symbol) || [];
      if (matches.length > 0) {
        displayElement = el;
        break;
      }
    }
  }

  if (!displayElement && classificationMatchedItems.length > 0) {
    displayElement = primaryElement;
  }

  if (!displayElement) {
    displayElement = primaryElement || elements[0];
  }

  return {
    element: primaryElement || elements[0],
    displayElement,
    matchedItems: allMatchedItems,
    count: allMatchedItems.length,
    isEmpty: allMatchedItems.length === 0,
    ownedElementSymbols,
  };
}

/**
 * Auto-detect periodic tags for an item
 */
export function getPeriodicTags(item: Partial<InventoryItem>): {
  group: PeriodicGroup;
  period: PeriodicPeriod;
} {
  const classification = classifyInventoryItem(item as InventoryItem);

  const groupName = GROUPS[classification.group].name as PeriodicGroup;
  const periodName = PERIODS[classification.period].name as PeriodicPeriod;

  return {
    group: groupName,
    period: periodName,
  };
}
