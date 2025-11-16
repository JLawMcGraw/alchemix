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

// Bottle & Inventory
export interface Bottle {
  id?: number;
  user_id?: number;
  name: string;
  'Stock Number'?: number;
  'Liquor Type'?: string;
  'Detailed Spirit Classification'?: string;
  'Distillation Method'?: string;
  'ABV (%)'?: string | number;
  'Distillery Location'?: string;
  'Age Statement or Barrel Finish'?: string;
  'Additional Notes'?: string;
  'Profile (Nose)'?: string;
  'Palate'?: string;
  'Finish'?: string;
}

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
  bottles: Bottle[];
  recipes: Recipe[];
  collections: Collection[];
  favorites: Favorite[];
  chatHistory: ChatMessage[];

  // UI State
  isLoading: boolean;
  error: string | null;
  _hasHydrated: boolean;

  // Actions
  login: (credentials: LoginCredentials) => Promise<void>;
  signup: (credentials: SignupCredentials) => Promise<void>;
  logout: () => void;
  setUser: (user: User, token: string) => void;
  validateToken: () => Promise<boolean>;

  fetchBottles: () => Promise<void>;
  addBottle: (bottle: Bottle) => Promise<void>;
  updateBottle: (id: number, bottle: Partial<Bottle>) => Promise<void>;
  deleteBottle: (id: number) => Promise<void>;

  fetchRecipes: (page?: number, limit?: number) => Promise<Recipe[]>;
  addRecipe: (recipe: Recipe) => Promise<void>;
  updateRecipe: (id: number, recipe: Partial<Recipe>) => Promise<void>;
  deleteRecipe: (id: number) => Promise<void>;

  fetchCollections: () => Promise<void>;
  addCollection: (collection: Collection) => Promise<void>;
  updateCollection: (id: number, collection: Partial<Collection>) => Promise<void>;
  deleteCollection: (id: number) => Promise<void>;

  fetchFavorites: () => Promise<void>;
  addFavorite: (recipeName: string, recipeId?: number) => Promise<void>;
  removeFavorite: (id: number) => Promise<void>;

  sendMessage: (message: string) => Promise<string>;
  clearChat: () => void;

  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
}
