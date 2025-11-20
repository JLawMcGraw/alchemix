// AlcheMix Backend Types

// Re-export frontend types for consistency
export interface User {
  id: number;
  email: string;
  password_hash?: string;  // Only on backend
  created_at?: string;
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
  tasting_notes?: string;  // User's personal tasting notes for enriched AI recommendations
  created_at?: string;
}

// Backwards compatibility alias
export type Bottle = InventoryItem;

export interface Recipe {
  id?: number;
  user_id?: number;
  collection_id?: number;
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

/**
 * JWT Payload Interface
 *
 * Structure of data encoded in JWT tokens for user authentication.
 *
 * Properties:
 * - userId: User's database ID (identifies who owns the token)
 * - email: User's email address (for display/verification)
 * - tokenVersion: Token version number (SECURITY FIX #10 - Session fixation protection)
 * - jti: JWT Token ID (SECURITY FIX #2 - Unique identifier for granular revocation)
 *
 * JWT Token ID (jti) - SECURITY FIX #2:
 * - Unique identifier for each individual token
 * - Allows revoking specific tokens without affecting others
 * - Reduces memory usage in blacklist (store jti instead of full token)
 * - Enables token usage auditing and tracking
 * - Optional for backward compatibility
 *
 * Token Version (SECURITY FIX #10):
 * - Each user has a token version number that increments on password change
 * - Enables immediate invalidation of all tokens on security events
 * - Optional for backward compatibility with existing tokens
 * - Defaults to 0 if not present
 *
 * Standard JWT Claims (added by jsonwebtoken library):
 * - iat: Issued at timestamp (Unix timestamp in seconds)
 * - exp: Expiration timestamp (Unix timestamp in seconds)
 *
 * Example Token Payload:
 * ```json
 * {
 *   "userId": 1,
 *   "email": "user@example.com",
 *   "tokenVersion": 0,
 *   "jti": "a1b2c3d4e5f6",
 *   "iat": 1699632000,
 *   "exp": 1700236800
 * }
 * ```
 *
 * Security Notes:
 * - Tokens are signed but not encrypted (readable by anyone)
 * - Don't include sensitive data (passwords, SSNs, etc.)
 * - tokenVersion enables "logout from all devices" functionality
 * - jti enables "logout this session" functionality
 * - iat/exp are automatically added by jwt.sign()
 *
 * Token Version Use Cases:
 * 1. Password Change:
 *    - User changes password → tokenVersion incremented
 *    - All old tokens (with old version) become invalid
 *    - User must login again to get token with new version
 *
 * 2. Logout from All Devices:
 *    - User clicks "logout everywhere" → tokenVersion incremented
 *    - All tokens on all devices become invalid
 *    - Forces re-login on all devices
 *
 * 3. Security Incident:
 *    - Admin detects compromise → tokenVersion incremented
 *    - Immediate revocation of all access
 *    - User notified to change password
 *
 * JWT ID (jti) Use Cases:
 * 1. Logout Single Session:
 *    - User logs out from specific device
 *    - Add token's jti to blacklist
 *    - Other sessions remain active
 *
 * 2. Token Auditing:
 *    - Track which tokens are active
 *    - Log token usage patterns
 *    - Identify suspicious activity
 *
 * 3. Memory Efficiency:
 *    - Blacklist stores jti (12 bytes) instead of full token (~200 bytes)
 *    - 10,000 tokens: 120KB vs 2MB
 *    - 16x memory reduction
 */
export interface JWTPayload {
  userId: number;
  email: string;
  tokenVersion?: number;  // SECURITY FIX #10: Session fixation protection
  jti?: string;           // SECURITY FIX #2: JWT Token ID for granular revocation
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
