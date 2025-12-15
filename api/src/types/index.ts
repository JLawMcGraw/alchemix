// AlcheMix Backend Types
// Re-exports shared types and defines backend-specific types

import type { Request } from 'express';

// Re-export domain types
export type {
  User,
  InventoryCategory,
  PeriodicGroup,
  PeriodicPeriod,
  InventoryItemInput,
  InventoryItem,
  Bottle,
  Collection,
  Recipe,
  Favorite,
  ChatMessage,
  ChatSession,
  ShoppingListItem,
  ShoppingListSuggestion,
  ShoppingListStats,
  CraftableRecipe,
  NearMissRecipe,
  NeedFewRecipe,
  MajorGapsRecipe,
} from '@alchemix/types';

// Re-export API types
export type {
  ApiResponse,
  PaginationMetadata,
  PaginatedResponse,
  AuthResponse,
  ShoppingListResponse,
  ChatRequest,
  ChatResponse,
  DashboardInsightResponse,
  CSVImportResult,
  UserDataExport,
  UserDataImportRequest,
  UserDataImportResult,
} from '@alchemix/types';

// Re-export database types
export type {
  UserRow,
  InventoryRow,
  RecipeRow,
  CollectionRow,
  FavoriteRow,
  ShoppingListItemRow,
  JWTPayload,
  DatabaseConfig,
  CollectionWithCount,
  RecipeWithCollection,
} from '@alchemix/types';

// ═══════════════════════════════════════════════════════════════════════════
// BACKEND-SPECIFIC TYPES
// ═══════════════════════════════════════════════════════════════════════════

import type { JWTPayload } from '@alchemix/types';

/**
 * Extended Express Request with authenticated user
 *
 * This extends Express.Request with the JWT payload from authentication.
 * Backend-specific because it depends on Express types.
 */
export interface AuthRequest extends Request {
  user?: JWTPayload;
}
