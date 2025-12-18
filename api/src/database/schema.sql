-- AlcheMix PostgreSQL Schema
--
-- This schema creates all tables required for the AlcheMix application.
-- Safe to run multiple times (uses IF NOT EXISTS).
--
-- Tables:
--   users                    - User authentication and accounts
--   inventory_items          - User's bar inventory
--   collections              - Recipe organization/grouping
--   recipes                  - Cocktail recipe library
--   favorites                - User's saved favorite recipes
--   shopping_list_items      - Shopping list
--   custom_glasses           - User-defined glassware types
--   inventory_classifications - Periodic table manual overrides
--   token_blacklist          - Revoked JWT tokens

-- ============================================================================
-- USERS TABLE
-- ============================================================================
-- Stores user authentication credentials and profile data.
--
-- Security Notes:
-- - Passwords are hashed with bcrypt (10 rounds)
-- - token_version increments on password change (invalidates all tokens)
-- - Email verification required before full access

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),

  -- Token versioning (for logout all devices, password changes)
  token_version INTEGER NOT NULL DEFAULT 0,

  -- Email verification
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  verification_token TEXT,
  verification_token_expires TIMESTAMP,

  -- Password reset
  reset_token TEXT,
  reset_token_expires TIMESTAMP
);

-- ============================================================================
-- INVENTORY ITEMS TABLE
-- ============================================================================
-- Stores user's bar inventory including spirits, mixers, garnishes, etc.
--
-- Categories: spirit, liqueur, mixer, garnish, syrup, wine, beer, other

CREATE TABLE IF NOT EXISTS inventory_items (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Required fields
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('spirit', 'liqueur', 'mixer', 'garnish', 'syrup', 'wine', 'beer', 'other')),

  -- Item details
  type TEXT,
  abv TEXT,
  stock_number INTEGER,
  spirit_classification TEXT,
  distillation_method TEXT,
  distillery_location TEXT,
  age_statement TEXT,
  additional_notes TEXT,

  -- Tasting notes
  profile_nose TEXT,
  palate TEXT,
  finish TEXT,
  tasting_notes TEXT,

  -- Periodic Table of Mixology tags
  periodic_group TEXT CHECK (periodic_group IN ('Base', 'Bridge', 'Modifier', 'Sweetener', 'Reagent', 'Catalyst')),
  periodic_period TEXT CHECK (periodic_period IN ('Agave', 'Cane', 'Grain', 'Grape', 'Fruit', 'Botanic')),

  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- COLLECTIONS TABLE
-- ============================================================================
-- Stores user's recipe collections (books/groups for organizing recipes).

CREATE TABLE IF NOT EXISTS collections (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- RECIPES TABLE
-- ============================================================================
-- Stores user's cocktail recipe collection.
--
-- Ingredients are stored as JSON string for flexibility.
-- memmachine_uid tracks the recipe in MemMachine for semantic search.

CREATE TABLE IF NOT EXISTS recipes (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  collection_id INTEGER REFERENCES collections(id) ON DELETE SET NULL,

  -- Recipe details
  name TEXT NOT NULL,
  ingredients TEXT NOT NULL,  -- JSON string array
  instructions TEXT,
  glass TEXT,
  category TEXT,

  -- MemMachine integration (semantic search)
  memmachine_uid TEXT,

  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- FAVORITES TABLE
-- ============================================================================
-- Stores user's favorited recipes (bookmarks).
--
-- Both recipe_name (denormalized) and recipe_id (reference) stored.
-- If recipe is deleted, favorite remains but recipe_id becomes NULL.

CREATE TABLE IF NOT EXISTS favorites (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipe_name TEXT NOT NULL,
  recipe_id INTEGER REFERENCES recipes(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- SHOPPING LIST ITEMS TABLE
-- ============================================================================
-- Stores user's shopping list items (ingredients to buy).

CREATE TABLE IF NOT EXISTS shopping_list_items (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  checked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- CUSTOM GLASSES TABLE
-- ============================================================================
-- Stores user-defined glassware types beyond the default set.

CREATE TABLE IF NOT EXISTS custom_glasses (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (user_id, name)
);

-- ============================================================================
-- INVENTORY CLASSIFICATIONS TABLE
-- ============================================================================
-- Stores user manual overrides for Periodic Table classifications.
-- Auto-classification handles most items; this stores exceptions only.
--
-- group_num: 1=Base, 2=Bridge, 3=Modifier, 4=Sweetener, 5=Reagent, 6=Catalyst
-- period_num: 1=Agave, 2=Cane, 3=Grain, 4=Grape, 5=Fruit, 6=Botanic

CREATE TABLE IF NOT EXISTS inventory_classifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  inventory_item_id INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  group_num INTEGER NOT NULL CHECK (group_num BETWEEN 1 AND 6),
  period_num INTEGER NOT NULL CHECK (period_num BETWEEN 1 AND 6),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (user_id, inventory_item_id)
);

-- ============================================================================
-- TOKEN BLACKLIST TABLE
-- ============================================================================
-- Persists revoked JWT tokens so revocations survive restarts.
-- Tokens are cleaned up after expiry by background job.

CREATE TABLE IF NOT EXISTS token_blacklist (
  token TEXT PRIMARY KEY,
  expires_at BIGINT NOT NULL  -- Unix timestamp (seconds)
);

-- ============================================================================
-- INDEXES
-- ============================================================================
-- Performance indexes for common query patterns.

-- Core lookup indexes (user data isolation)
CREATE INDEX IF NOT EXISTS idx_inventory_items_user_id ON inventory_items(user_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_category ON inventory_items(category);
CREATE INDEX IF NOT EXISTS idx_collections_user_id ON collections(user_id);
CREATE INDEX IF NOT EXISTS idx_recipes_user_id ON recipes(user_id);
CREATE INDEX IF NOT EXISTS idx_recipes_collection_id ON recipes(collection_id);
CREATE INDEX IF NOT EXISTS idx_recipes_memmachine_uid ON recipes(memmachine_uid);
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_recipe_id ON favorites(recipe_id);
CREATE INDEX IF NOT EXISTS idx_shopping_list_items_user_id ON shopping_list_items(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_glasses_user_id ON custom_glasses(user_id);

-- Inventory classifications indexes (Periodic Table V2)
CREATE INDEX IF NOT EXISTS idx_inventory_classifications_user ON inventory_classifications(user_id);
CREATE INDEX IF NOT EXISTS idx_inventory_classifications_item ON inventory_classifications(inventory_item_id);

-- Token blacklist index (fast expiry lookups for cleanup)
CREATE INDEX IF NOT EXISTS idx_token_blacklist_expires ON token_blacklist(expires_at);

-- User verification/reset token indexes (fast token lookups)
CREATE INDEX IF NOT EXISTS idx_users_verification_token ON users(verification_token);
CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_recipes_user_category ON recipes(user_id, category);
CREATE INDEX IF NOT EXISTS idx_inventory_user_category ON inventory_items(user_id, category);

-- Unique composite index to prevent duplicate favorites
CREATE UNIQUE INDEX IF NOT EXISTS idx_favorites_user_recipe ON favorites(user_id, recipe_id) WHERE recipe_id IS NOT NULL;
