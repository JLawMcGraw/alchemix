// AlcheMix Frontend Types
// Re-exports shared types and defines frontend-specific types

// Re-export all shared types from @alchemix/types
export type {
  // User & Auth
  User,
  LoginCredentials,
  SignupCredentials,

  // Inventory
  InventoryCategory,
  PeriodicGroup,
  PeriodicPeriod,
  InventoryItemInput,
  InventoryItem,
  Bottle,

  // Recipes & Collections
  Collection,
  Recipe,
  Favorite,

  // Chat
  ChatMessage,
  ChatSession,

  // Shopping List
  ShoppingListItem,
  ShoppingListSuggestion,
  ShoppingListStats,
  CraftableRecipe,
  NearMissRecipe,
  NeedFewRecipe,
  MajorGapsRecipe,
} from '@alchemix/types';

export type {
  // API types
  ApiResponse,
  PaginationMetadata,
  AuthResponse,
  ShoppingListResponse,
} from '@alchemix/types';

// ═══════════════════════════════════════════════════════════════════════════
// FRONTEND-SPECIFIC TYPES
// ═══════════════════════════════════════════════════════════════════════════

import type {
  User,
  InventoryCategory,
  InventoryItemInput,
  InventoryItem,
  Recipe,
  Collection,
  Favorite,
  ChatMessage,
  LoginCredentials,
  SignupCredentials,
  ShoppingListSuggestion,
  ShoppingListStats,
  CraftableRecipe,
  NearMissRecipe,
  NeedFewRecipe,
  MajorGapsRecipe,
  PaginationMetadata,
} from '@alchemix/types';

/**
 * Zustand Store State Interface
 *
 * Defines the complete state shape and actions for the AlcheMix frontend store.
 * This is frontend-specific and not shared with the backend.
 */
export interface AppState {
  // Auth
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;

  // Data
  inventoryItems: InventoryItem[];
  inventoryPagination: PaginationMetadata | null;
  recipes: Recipe[];
  collections: Collection[];
  favorites: Favorite[];
  chatHistory: ChatMessage[];
  shoppingListSuggestions: ShoppingListSuggestion[];
  shoppingListStats: ShoppingListStats | null;
  craftableRecipes: CraftableRecipe[];
  nearMissRecipes: NearMissRecipe[];
  needFewRecipes: NeedFewRecipe[];
  majorGapsRecipes: MajorGapsRecipe[];
  dashboardGreeting: string;
  dashboardInsight: string;

  // UI State
  isLoading: boolean;
  isLoadingShoppingList: boolean;
  isDashboardInsightLoading: boolean;
  error: string | null;
  _hasHydrated: boolean;

  // Actions
  login: (credentials: LoginCredentials) => Promise<void>;
  signup: (credentials: SignupCredentials) => Promise<void>;
  logout: () => void;
  setUser: (user: User, token: string) => void;
  validateToken: () => Promise<boolean>;

  fetchItems: (page?: number, limit?: number, category?: InventoryCategory | 'all') => Promise<void>;
  addItem: (item: InventoryItemInput) => Promise<void>;
  updateItem: (id: number, item: Partial<InventoryItemInput>) => Promise<void>;
  deleteItem: (id: number) => Promise<void>;

  fetchRecipes: (page?: number, limit?: number) => Promise<Recipe[]>;
  addRecipe: (recipe: Recipe) => Promise<void>;
  updateRecipe: (id: number, recipe: Partial<Recipe>) => Promise<void>;
  deleteRecipe: (id: number) => Promise<void>;
  bulkDeleteRecipes: (ids: number[]) => Promise<number>;

  fetchCollections: () => Promise<void>;
  addCollection: (collection: Collection) => Promise<void>;
  updateCollection: (id: number, collection: Partial<Collection>) => Promise<void>;
  deleteCollection: (id: number) => Promise<void>;

  fetchFavorites: () => Promise<void>;
  addFavorite: (recipeName: string, recipeId?: number) => Promise<void>;
  removeFavorite: (id: number) => Promise<void>;

  fetchShoppingList: () => Promise<void>;
  fetchDashboardInsight: () => Promise<void>;

  sendMessage: (message: string) => Promise<string>;
  clearChat: () => void;

  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
}
