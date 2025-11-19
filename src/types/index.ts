// AlcheMix TypeScript Types

// User & Authentication
export interface User {
  id: number;
  email: string;
  created_at?: string;
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

// Inventory Item
export interface InventoryItem {
  id?: number;
  user_id?: number;
  name: string;
  category: InventoryCategory;  // Required categories enforced by union
  type?: string;  // Formerly "Liquor Type" - item classification (e.g., "Bourbon", "Gin", "Citrus")
  abv?: string | number;  // Formerly "ABV (%)" - alcohol by volume
  'Stock Number'?: number;
  'Detailed Spirit Classification'?: string;
  'Distillation Method'?: string;
  'Distillery Location'?: string;
  'Age Statement or Barrel Finish'?: string;
  'Additional Notes'?: string;
  'Profile (Nose)'?: string;
  'Palate'?: string;
  'Finish'?: string;
  created_at?: string;
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

export interface ShoppingListResponse {
  data: ShoppingListSuggestion[];
  stats: ShoppingListStats;
  craftableRecipes: CraftableRecipe[];
  nearMissRecipes: NearMissRecipe[];
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
  recipes: Recipe[];
  collections: Collection[];
  favorites: Favorite[];
  chatHistory: ChatMessage[];
  shoppingListSuggestions: ShoppingListSuggestion[];
  shoppingListStats: ShoppingListStats | null;
  craftableRecipes: CraftableRecipe[];
  nearMissRecipes: NearMissRecipe[];

  // UI State
  isLoading: boolean;
  isLoadingShoppingList: boolean;
  error: string | null;
  _hasHydrated: boolean;

  // Actions
  login: (credentials: LoginCredentials) => Promise<void>;
  signup: (credentials: SignupCredentials) => Promise<void>;
  logout: () => void;
  setUser: (user: User, token: string) => void;
  validateToken: () => Promise<boolean>;

  fetchItems: () => Promise<void>;
  addItem: (item: InventoryItem) => Promise<void>;
  updateItem: (id: number, item: Partial<InventoryItem>) => Promise<void>;
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

  sendMessage: (message: string) => Promise<string>;
  clearChat: () => void;

  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
}
