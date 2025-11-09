// AlcheMix Backend Types

// Re-export frontend types for consistency
export interface User {
  id: number;
  email: string;
  password_hash?: string;  // Only on backend
  created_at?: string;
}

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

export interface Recipe {
  id?: number;
  user_id?: number;
  name: string;
  ingredients: string;  // JSON string
  instructions?: string;
  glass?: string;
  category?: string;
  compatibility?: number;
  missing?: string[];
}

export interface Favorite {
  id?: number;
  user_id?: number;
  recipe_name: string;
  recipe_id?: number;
  created_at?: string;
}

// Backend-specific types

export interface JWTPayload {
  userId: number;
  email: string;
}

export interface AuthRequest extends Request {
  user?: JWTPayload;
}

export interface DatabaseConfig {
  filename: string;
  verbose?: boolean;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
