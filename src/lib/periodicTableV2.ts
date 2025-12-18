/**
 * Periodic Table of Mixology V2
 *
 * A 6×6 classification system for cocktail ingredients:
 * - Groups (Columns) = Functional role (what it DOES)
 * - Periods (Rows) = Source origin (where it COMES FROM)
 *
 * This file re-exports from the modular structure for backward compatibility.
 * Import from '@/lib/periodicTable' for new code.
 *
 * @version 2.0.0
 * @date December 2025
 */

// Types
export type {
  MixologyGroup,
  MixologyPeriod,
  ClassificationConfidence,
  Classification,
  CellPosition,
  GroupInfo,
  PeriodInfo,
  ClassifiedItem,
  CellData,
  ElementType,
  ElementCellData,
  CellDisplayData,
} from './periodicTable/index';

// Constants
export {
  GROUPS,
  PERIODS,
  GROUP_NUMBERS,
  PERIOD_NUMBERS,
  PERIODIC_GROUPS,
  PERIODIC_PERIODS,
  GROUP_COLORS,
  GROUP_COLORS_DARK,
  PERIOD_COLORS,
} from './periodicTable/index';

// Elements
export { ELEMENTS } from './periodicTable/index';

// Classification Map
export { CLASSIFICATION_MAP, CATEGORY_FALLBACKS } from './periodicTable/index';

// Engine Functions
export {
  classifyInventoryItem,
  classifyAndGroupItems,
  buildGridData,
  getCellKey,
  parseCellKey,
  getCellName,
  matchItemToElements,
  getPrimaryElement,
  getElementsForCell,
  buildElementCellData,
  getCellDisplayData,
  getPeriodicTags,
} from './periodicTable/index';
