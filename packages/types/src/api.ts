/**
 * API Types - Request/Response types for API communication
 *
 * These types define the contract between frontend and backend.
 */

import type {
  User,
  ShoppingListSuggestion,
  ShoppingListStats,
  CraftableRecipe,
  NearMissRecipe,
  NeedFewRecipe,
  MajorGapsRecipe,
} from './domain';

// ═══════════════════════════════════════════════════════════════════════════
// GENERIC API RESPONSE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Paginated API response
 */
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: PaginationMetadata;
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGINATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Pagination metadata returned with list endpoints
 */
export interface PaginationMetadata {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * Pagination request parameters
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTHENTICATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Successful authentication response
 */
export interface AuthResponse {
  token: string;
  user: User;
}

/**
 * Token validation response
 */
export interface TokenValidationResponse {
  valid: boolean;
  user?: User;
}

/**
 * Password reset request
 */
export interface PasswordResetRequest {
  email: string;
}

/**
 * Password reset confirmation
 */
export interface PasswordResetConfirm {
  token: string;
  newPassword: string;
}

/**
 * Change password request (authenticated)
 */
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// SHOPPING LIST API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Smart shopping list response
 */
export interface ShoppingListResponse {
  data: ShoppingListSuggestion[];
  stats: ShoppingListStats;
  craftableRecipes: CraftableRecipe[];
  nearMissRecipes: NearMissRecipe[];
  needFewRecipes: NeedFewRecipe[];
  majorGapsRecipes: MajorGapsRecipe[];
}

// ═══════════════════════════════════════════════════════════════════════════
// CSV IMPORT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * CSV import result
 */
export interface CSVImportResult {
  imported: number;
  failed: number;
  errors?: string[];
}

// ═══════════════════════════════════════════════════════════════════════════
// AI/CHAT API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Chat message request
 */
export interface ChatRequest {
  message: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

/**
 * Chat message response
 */
export interface ChatResponse {
  response: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
}

/**
 * Dashboard insight response
 */
export interface DashboardInsightResponse {
  greeting: string;
  insight: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// DATA EXPORT/IMPORT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * User data export format
 */
export interface UserDataExport {
  exportedAt: string;
  version: string;
  user: {
    email: string;
  };
  inventory: Array<Record<string, unknown>>;
  recipes: Array<Record<string, unknown>>;
  favorites: Array<Record<string, unknown>>;
  collections: Array<Record<string, unknown>>;
}

/**
 * User data import request
 */
export interface UserDataImportRequest {
  data: UserDataExport;
  overwrite?: boolean;
}

/**
 * User data import result
 */
export interface UserDataImportResult {
  inventory: number;
  recipes: number;
  favorites: number;
  collections: number;
}
