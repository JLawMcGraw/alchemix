/**
 * Domain Types - Core business entities shared across frontend and backend
 *
 * These types represent the core domain model of AlcheMix.
 * They are intentionally database-agnostic and focus on business logic.
 */

// ═══════════════════════════════════════════════════════════════════════════
// USER & AUTHENTICATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * User entity (public-facing fields only)
 * Backend may extend this with password_hash, tokens, etc.
 */
export interface User {
  id: number;
  email: string;
  is_verified?: boolean;
  has_seeded_classics?: boolean;
  password_changed_at?: string | null;
  created_at?: string;
}

/**
 * Login credentials for authentication
 */
export interface LoginCredentials {
  email: string;
  password: string;
}

/**
 * Signup credentials for registration
 */
export interface SignupCredentials {
  email: string;
  password: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// INVENTORY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Inventory item categories
 */
export type InventoryCategory =
  | 'spirit'
  | 'liqueur'
  | 'wine'
  | 'beer'
  | 'bitters'
  | 'mixer'
  | 'syrup'
  | 'garnish'
  | 'pantry';

/**
 * Periodic Table Group (Column) - What the ingredient DOES
 */
export type PeriodicGroup = 'Base' | 'Bridge' | 'Modifier' | 'Sweetener' | 'Reagent' | 'Catalyst';

/**
 * Periodic Table Period (Row) - Where the ingredient COMES FROM
 */
export type PeriodicPeriod = 'Agave' | 'Cane' | 'Grain' | 'Grape' | 'Fruit' | 'Botanic';

/**
 * Base inventory item fields (for creating/updating)
 */
export interface InventoryItemInput {
  name: string;
  category: InventoryCategory;
  type?: string;
  abv?: string | number;
  stock_number?: number;
  spirit_classification?: string;
  distillation_method?: string;
  distillery_location?: string;
  age_statement?: string;
  additional_notes?: string;
  profile_nose?: string;
  palate?: string;
  finish?: string;
  tasting_notes?: string;
  periodic_group?: PeriodicGroup | null;
  periodic_period?: PeriodicPeriod | null;
}

/**
 * Full inventory item (from database)
 */
export interface InventoryItem extends InventoryItemInput {
  id: number;
  user_id: number;
  created_at: string;
}

/**
 * Backwards compatibility alias
 */
export type Bottle = InventoryItem;

// ═══════════════════════════════════════════════════════════════════════════
// RECIPES & COLLECTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Recipe collection for organizing recipes
 */
export interface Collection {
  id?: number;
  user_id?: number;
  name: string;
  description?: string;
  recipe_count?: number;
  created_at?: string;
}

/**
 * Recipe entity
 */
export interface Recipe {
  id?: number;
  user_id?: number;
  collection_id?: number;
  name: string;
  ingredients: string | string[];
  instructions?: string;
  glass?: string;
  category?: string;
  spirit_type?: string;
  compatibility?: number;
  missing?: string[];
  formula?: string;
  created_at?: string;
}

/**
 * Favorite recipe reference
 */
export interface Favorite {
  id?: number;
  user_id?: number;
  recipe_name: string;
  recipe_id?: number;
  created_at?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// CHAT & MESSAGING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Chat message in AI conversation
 */
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

/**
 * Chat session containing message history
 */
export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  created_at: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// SHOPPING LIST
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Shopping list item
 */
export interface ShoppingListItem {
  id: number;
  name: string;
  checked: boolean;
  createdAt: string;
}

/**
 * Ingredient suggestion for shopping
 */
export interface ShoppingListSuggestion {
  ingredient: string;
  unlocks: number;
}

/**
 * Shopping list statistics
 */
export interface ShoppingListStats {
  totalRecipes: number;
  craftable: number;
  nearMisses: number;
  inventoryItems: number;
  missing2to3?: number;
  missing4plus?: number;
}

/**
 * Recipe that can be crafted with current inventory
 */
export interface CraftableRecipe {
  id: number;
  name: string;
  ingredients: string[];
}

/**
 * Recipe missing one ingredient
 */
export interface NearMissRecipe {
  id: number;
  name: string;
  ingredients: string[];
  missingIngredient: string;
}

/**
 * Recipe missing 2-3 ingredients
 */
export interface NeedFewRecipe {
  id: number;
  name: string;
  ingredients: string[];
  missingCount: number;
}

/**
 * Recipe missing 4+ ingredients
 */
export interface MajorGapsRecipe {
  id: number;
  name: string;
  ingredients: string[];
  missingCount: number;
}
