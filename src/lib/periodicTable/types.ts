/**
 * Periodic Table of Mixology - Type Definitions
 *
 * Core types for the 6×6 classification system.
 */

import type { InventoryItem } from '@/types';

/** Group = Column (Function/Role) */
export type MixologyGroup = 1 | 2 | 3 | 4 | 5 | 6;

/** Period = Row (Origin/Source) */
export type MixologyPeriod = 1 | 2 | 3 | 4 | 5 | 6;

/** Classification confidence level */
export type ClassificationConfidence = 'high' | 'medium' | 'low' | 'manual';

/** Classification result */
export interface Classification {
  group: MixologyGroup;
  period: MixologyPeriod;
  confidence: ClassificationConfidence;
  reasoning?: string;
}

/** Cell position on the grid */
export interface CellPosition {
  group: MixologyGroup;
  period: MixologyPeriod;
}

/** Group metadata */
export interface GroupInfo {
  numeral: string;
  name: string;
  desc: string;
  color: string;
  colorDark: string;
}

/** Period metadata */
export interface PeriodInfo {
  name: string;
  profile: string;
  color: string;
  colorDark: string;
}

/** Inventory item with its classification */
export interface ClassifiedItem {
  item: InventoryItem;
  classification: Classification;
}

/** Cell data for rendering */
export interface CellData {
  group: MixologyGroup;
  period: MixologyPeriod;
  items: ClassifiedItem[];
  hasInventory: boolean;
  count: number;
}

/** Predefined element type for the periodic table */
export interface ElementType {
  symbol: string;
  name: string;
  group: MixologyGroup;
  period: MixologyPeriod;
  abv?: string;
  brix?: string;
  ph?: string;
  usage?: string;
  primary?: boolean;
  empty?: boolean;
  keywords: string[];
}

/** Element cell with matched inventory items */
export interface ElementCellData {
  element: ElementType;
  matchedItems: InventoryItem[];
  count: number;
}

/** Return type for getCellDisplayData */
export interface CellDisplayData {
  element: ElementType | null;
  displayElement: ElementType | null;
  matchedItems: InventoryItem[];
  count: number;
  isEmpty: boolean;
  ownedElementSymbols: Set<string>;
}
