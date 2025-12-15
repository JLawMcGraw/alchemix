/**
 * Periodic Table of Mixology - Main Export
 *
 * Re-exports all types, constants, and functions from the modular structure.
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
} from './types';

// Constants
export {
  GROUPS,
  PERIODS,
  GROUP_NUMBERS,
  PERIOD_NUMBERS,
  PERIODIC_GROUPS,
  PERIODIC_PERIODS,
  GROUP_COLORS,
  PERIOD_COLORS,
} from './constants';

// Elements
export { ELEMENTS } from './elements';

// Classification Map
export { CLASSIFICATION_MAP, CATEGORY_FALLBACKS } from './classificationMap';

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
} from './engine';
