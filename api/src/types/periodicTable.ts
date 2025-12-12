/**
 * Periodic Table of Mixology V2 - Shared Types
 *
 * These types are shared between frontend and backend.
 * Duplicated from src/lib/periodicTableV2.ts to avoid cross-project imports.
 *
 * Keep these in sync with the frontend types.
 */

// ============================================================================
// Core Types
// ============================================================================

/**
 * Group = Column (1-6) - Functional Role
 * I: Base, II: Bridge, III: Modifier, IV: Sweetener, V: Reagent, VI: Catalyst
 */
export type MixologyGroup = 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Period = Row (1-6) - Origin/Source
 * 1: Agave, 2: Cane, 3: Grain, 4: Grape, 5: Fruit, 6: Botanic
 */
export type MixologyPeriod = 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Cell position in the 6x6 grid
 */
export interface CellPosition {
  group: MixologyGroup;
  period: MixologyPeriod;
}

/**
 * Classification result with confidence level
 */
export interface Classification extends CellPosition {
  confidence: 'high' | 'medium' | 'low' | 'manual';
  reasoning?: string;
}
