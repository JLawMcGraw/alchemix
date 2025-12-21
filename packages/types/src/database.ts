/**
 * Database Types - Database row types and backend-specific types
 *
 * These types represent the exact shape of database rows and
 * backend-specific structures. They may differ from domain types
 * due to database constraints (e.g., nullable columns, JSON strings).
 */

import type { InventoryCategory, PeriodicGroup, PeriodicPeriod } from './domain';

// ═══════════════════════════════════════════════════════════════════════════
// DATABASE ROW TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Users table row
 */
export interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  is_verified: number; // SQLite boolean (0/1)
  verification_token: string | null;
  verification_token_expires: string | null;
  reset_token: string | null;
  reset_token_expires: string | null;
  token_version: number;
  has_seeded_classics: boolean; // Onboarding flag
  created_at: string;
}

/**
 * Inventory table row
 */
export interface InventoryRow {
  id: number;
  user_id: number;
  name: string;
  category: InventoryCategory;
  type: string | null;
  abv: string | null;
  stock_number: number | null;
  spirit_classification: string | null;
  distillation_method: string | null;
  distillery_location: string | null;
  age_statement: string | null;
  additional_notes: string | null;
  profile_nose: string | null;
  palate: string | null;
  finish: string | null;
  tasting_notes: string | null;
  periodic_group: PeriodicGroup | null;
  periodic_period: PeriodicPeriod | null;
  created_at: string;
}

/**
 * Recipes table row
 */
export interface RecipeRow {
  id: number;
  user_id: number;
  collection_id: number | null;
  name: string;
  ingredients: string; // JSON string in database
  instructions: string | null;
  glass: string | null;
  category: string | null;
  spirit_type: string | null;
  formula: string | null;
  memmachine_uid: string | null;
  created_at: string;
}

/**
 * Collections table row
 */
export interface CollectionRow {
  id: number;
  user_id: number;
  name: string;
  description: string | null;
  created_at: string;
}

/**
 * Favorites table row
 */
export interface FavoriteRow {
  id: number;
  user_id: number;
  recipe_name: string;
  recipe_id: number | null;
  created_at: string;
}

/**
 * Shopping list items table row
 */
export interface ShoppingListItemRow {
  id: number;
  user_id: number;
  name: string;
  checked: number; // SQLite boolean (0/1)
  created_at: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTHENTICATION TYPES (Backend-only)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * JWT Payload Interface
 *
 * Structure of data encoded in JWT tokens for user authentication.
 */
export interface JWTPayload {
  userId: number;
  email: string;
  tokenVersion?: number;
  jti?: string;
  iat?: number;
  exp?: number;
}

/**
 * Extended Express Request with authenticated user
 */
export interface AuthenticatedRequest {
  user?: JWTPayload;
}

// ═══════════════════════════════════════════════════════════════════════════
// DATABASE CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Database connection configuration
 */
export interface DatabaseConfig {
  filename: string;
  verbose?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// QUERY RESULT TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Collection with recipe count (from JOIN query)
 */
export interface CollectionWithCount extends CollectionRow {
  recipe_count: number;
}

/**
 * Recipe with collection name (from JOIN query)
 */
export interface RecipeWithCollection extends RecipeRow {
  collection_name: string | null;
}
