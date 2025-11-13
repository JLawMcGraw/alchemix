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

// Recipe
export interface Recipe {
  id?: number;
  user_id?: number;
  name: string;
  ingredients: string;  // JSON string or array
  instructions?: string;
  glass?: string;
  category?: string;
  compatibility?: number;
  missing?: string[];
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
  favorites: Favorite[];
  chatHistory: ChatMessage[];

  // UI State
  isLoading: boolean;
  error: string | null;

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

  fetchRecipes: () => Promise<void>;
  addRecipe: (recipe: Recipe) => Promise<void>;

  fetchFavorites: () => Promise<void>;
  addFavorite: (recipeName: string) => Promise<void>;
  removeFavorite: (id: number) => Promise<void>;

  sendMessage: (message: string) => Promise<string>;
  clearChat: () => void;

  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
}
