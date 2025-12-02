// AlcheMix TypeScript Types

// User & Authentication
export interface User {
  id: number;
  email: string;
  created_at?: string;
  is_verified?: boolean;  // Email verification status (false = soft block)
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupCredentials {
  email: string;
  password: string;
}

export type InventoryCategory =
  | 'spirit'
  | 'liqueur'
  | 'mixer'
  | 'garnish'
  | 'syrup'
  | 'wine'
  | 'beer'
  | 'other';

// Base inventory item fields (for creating/updating)
export interface InventoryItemInput {
  name: string;
  category: InventoryCategory;  // Required categories enforced by union
  type?: string;  // Item classification (e.g., "Bourbon", "Gin", "Citrus")
  abv?: string | number;  // Alcohol by volume
  stock_number?: number;
  spirit_classification?: string;
  distillation_method?: string;
  distillery_location?: string;
  age_statement?: string;
  additional_notes?: string;
  profile_nose?: string;
  palate?: string;
  finish?: string;
  tasting_notes?: string;  // User's personal tasting notes for enriched AI recommendations
}

// Full inventory item (from database - always has id, user_id, created_at)
export interface InventoryItem extends InventoryItemInput {
  id: number;
  user_id: number;
  created_at: string;
}

// Backwards compatibility alias
export type Bottle = InventoryItem;

// Collection
export interface Collection {
  id?: number;
  user_id?: number;
  name: string;
  description?: string;
  recipe_count?: number;
  created_at?: string;
}

// Recipe
export interface Recipe {
  id?: number;
  user_id?: number;
  collection_id?: number;
  name: string;
  ingredients: string | string[];  // JSON string or array
  instructions?: string;
  glass?: string;
  category?: string;
  spirit_type?: string;
  compatibility?: number;
  missing?: string[];
  created_at?: string;
}

// Favorite
export interface Favorite {
  id?: number;
  user_id?: number;
  recipe_name: string;
  recipe_id?: number;
  created_at?: string;
}

// History/Chat
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  created_at: string;
}

// Shopping List
export interface ShoppingListSuggestion {
  ingredient: string;
  unlocks: number;
}

export interface ShoppingListStats {
  totalRecipes: number;
  craftable: number;
  nearMisses: number;
  inventoryItems: number;
  missing2to3?: number;
  missing4plus?: number;
}

export interface CraftableRecipe {
  id: number;
  name: string;
  ingredients: string[];
}

export interface NearMissRecipe {
  id: number;
  name: string;
  ingredients: string[];
  missingIngredient: string;
}

export interface NeedFewRecipe {
  id: number;
  name: string;
  ingredients: string[];
  missingCount: number;
}

export interface MajorGapsRecipe {
  id: number;
  name: string;
  ingredients: string[];
  missingCount: number;
}

export interface ShoppingListResponse {
  data: ShoppingListSuggestion[];
  stats: ShoppingListStats;
  craftableRecipes: CraftableRecipe[];
  nearMissRecipes: NearMissRecipe[];
  needFewRecipes: NeedFewRecipe[];
  majorGapsRecipes: MajorGapsRecipe[];
}

// Pagination Types
export interface PaginationMetadata {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// State Types (for Zustand)
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
