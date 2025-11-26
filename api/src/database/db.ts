/**
 * Database Configuration and Initialization
 *
 * This module sets up the SQLite database connection and schema for AlcheMix.
 *
 * Database Choice: SQLite
 * - Embedded database (no separate server process)
 * - Single file storage (easy backup and migration)
 * - ACID compliant (transactions ensure data integrity)
 * - Fast for read-heavy workloads (perfect for this app)
 * - Low memory footprint (<1MB)
 *
 * Library: better-sqlite3
 * - Synchronous API (simpler error handling)
 * - 3-6x faster than node-sqlite3
 * - Prepared statements prevent SQL injection
 * - Type-safe with TypeScript
 *
 * Schema Overview:
 * - users: Authentication and user accounts
 * - bottles: User's bottle inventory (12 fields)
 * - recipes: Cocktail recipe library
 * - favorites: User's saved favorite recipes
 *
 * Foreign Key Relationships:
 * - bottles.user_id → users.id (CASCADE on delete)
 * - recipes.user_id → users.id (CASCADE on delete)
 * - favorites.user_id → users.id (CASCADE on delete)
 * - favorites.recipe_id → recipes.id (SET NULL on delete)
 *
 * Performance Optimizations:
 * - Indexes on user_id columns (10x faster queries)
 * - Foreign keys enforce data integrity
 * - Pragma foreign_keys enabled
 * - WAL mode for concurrent access (future enhancement)
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

/**
 * Database Path Configuration
 *
 * Determines where the SQLite database file is stored.
 *
 * Priority:
 * 1. DATABASE_PATH env var (custom location)
 * 2. Default: api/data/alchemix.db
 *
 * Why configurable?
 * - Development: Local data directory
 * - Testing: Separate test database
 * - Production: Persistent storage volume
 *
 * Directory Structure:
 * - Development: api/data/alchemix.db
 * - Production: /var/lib/alchemix/alchemix.db (or similar)
 *
 * Example Environment Variables:
 * - Development: DATABASE_PATH=./data/alchemix.db
 * - Production: DATABASE_PATH=/var/lib/alchemix/alchemix.db
 * - Testing: DATABASE_PATH=:memory: (in-memory database)
 */
const DB_DIR = process.env.DATABASE_PATH
  ? path.dirname(process.env.DATABASE_PATH)
  : path.join(__dirname, '../../data');

const DB_FILE = process.env.DATABASE_PATH
  || path.join(DB_DIR, 'alchemix.db');

/**
 * Ensure Data Directory Exists
 *
 * Creates the data directory if it doesn't exist.
 * Uses recursive: true to create parent directories.
 *
 * Example:
 * - Path: /var/lib/alchemix/alchemix.db
 * - Creates: /var, /var/lib, /var/lib/alchemix (if needed)
 *
 * Error Handling:
 * - If directory creation fails, app will crash on database init
 * - This is intentional (fail fast principle)
 * - Better than running with broken database
 */
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
  console.log(`📁 Created database directory: ${DB_DIR}`);
}

/**
 * Initialize Database Connection
 *
 * Creates a new SQLite database connection using better-sqlite3.
 *
 * Configuration:
 * - DB_FILE: Path to database file
 * - verbose: Log SQL queries in development mode
 *
 * Verbose Mode (Development Only):
 * - Logs every SQL query to console
 * - Helps debug query performance
 * - Disabled in production (security + performance)
 *
 * Connection Pooling:
 * - better-sqlite3 uses a single connection (SQLite limitation)
 * - This is fine for our use case (<1000 concurrent users)
 * - For high concurrency, consider PostgreSQL + pgpool
 *
 * Database Features Enabled:
 * - Synchronous API (simpler error handling)
 * - Prepared statements (SQL injection prevention)
 * - Transactions (ACID compliance)
 * - Foreign keys (referential integrity)
 *
 * Memory Usage:
 * - Database file: <100MB for typical usage
 * - Memory overhead: <1MB per connection
 */
export const db = new Database(DB_FILE, {
  verbose: process.env.NODE_ENV === 'development' ? console.log : undefined
});

/**
 * Enable Foreign Key Constraints
 *
 * SQLite requires explicit enablement of foreign keys.
 * Without this pragma, foreign key constraints are ignored.
 *
 * What this enables:
 * - Referential integrity (can't reference non-existent rows)
 * - CASCADE deletes (delete user → delete their bottles/recipes)
 * - SET NULL on delete (delete recipe → set favorites.recipe_id to null)
 *
 * Example:
 * - DELETE FROM users WHERE id = 1
 * - Automatically deletes all bottles WHERE user_id = 1
 * - Automatically deletes all recipes WHERE user_id = 1
 * - Automatically deletes all favorites WHERE user_id = 1
 *
 * Security Impact:
 * - Prevents orphaned data (bottles without owners)
 * - Ensures data privacy (no leftover user data after deletion)
 * - Maintains database integrity
 */
db.pragma('foreign_keys = ON');

/**
 * Initialize Database Schema
 *
 * Creates all required tables if they don't exist.
 * Safe to run multiple times (idempotent operation).
 *
 * Called once on server startup (see server.ts).
 * If tables already exist, this is a no-op.
 *
 * Tables Created:
 * 1. users: Authentication and user accounts
 * 2. bottles: User's bottle inventory
 * 3. recipes: Cocktail recipe library
 * 4. favorites: User's saved favorites
 *
 * Indexes Created:
 * - idx_bottles_user_id: Fast lookup of user's bottles
 * - idx_recipes_user_id: Fast lookup of user's recipes
 * - idx_favorites_user_id: Fast lookup of user's favorites
 *
 * Migration Strategy (Future):
 * - Phase 3+: Add schema versioning
 * - Track version in database metadata
 * - Run migrations on startup if needed
 * - Example: ALTER TABLE bottles ADD COLUMN updated_at
 */
export function initializeDatabase() {
  console.log('🔧 Initializing database schema...');

  /**
   * Users Table
   *
   * Stores user authentication credentials and profile data.
   *
   * Columns:
   * - id: Auto-increment primary key
   * - email: Unique email address (used for login)
   * - password_hash: bcrypt hash (never store plaintext!)
   * - created_at: Account creation timestamp
   *
   * Constraints:
   * - email UNIQUE: Prevents duplicate accounts
   * - email NOT NULL: Required for authentication
   * - password_hash NOT NULL: Required for authentication
   *
   * Security Notes:
   * - Passwords are hashed with bcrypt (10 rounds)
   * - Email is case-sensitive (consider COLLATE NOCASE for production)
   * - No password recovery (Phase 3+: add email verification)
   *
   * Example Row:
   * {
   *   id: 1,
   *   email: "user@example.com",
   *   password_hash: "$2b$10$N9qo8uLOickgx2ZMRZoMye...",
   *   created_at: "2025-11-10 14:32:05"
   * }
   *
   * Future Enhancements (Phase 3+):
   * - Add email_verified BOOLEAN (for email verification)
   * - Add last_login DATETIME (for analytics)
   * - Add profile fields (name, avatar, preferences)
   */
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  /**
   * Inventory Items Table (formerly Bottles)
   *
   * Stores user's bar inventory including spirits, mixers, garnishes, etc.
   *
   * Columns (Metadata):
   * - id: Auto-increment primary key
   * - user_id: Foreign key to users table
   * - category: Item category (REQUIRED - spirit, liqueur, mixer, garnish, syrup, wine, beer, other)
   * - created_at: Item added timestamp
   *
   * Columns (Item Details):
   * - name: Item name (REQUIRED, e.g., "Maker's Mark", "Simple Syrup")
   * - type: Item type/classification (formerly "Liquor Type" - e.g., "Bourbon", "Gin", "Citrus")
   * - abv: Alcohol by volume (formerly "ABV (%)" - for alcoholic items only)
   * - Stock Number: Optional inventory tracking number
   * - Detailed Spirit Classification: Sub-category (e.g., "Kentucky Straight Bourbon")
   * - Distillation Method: Production method (e.g., "Pot Still", "Column Still")
   * - Distillery Location: Where it's made (e.g., "Loretto, KY")
   * - Age Statement or Barrel Finish: Aging info (e.g., "6 years", "Sherry Cask")
   * - Additional Notes: Free-form notes (max 2000 chars)
   * - Profile (Nose): Tasting notes - aroma (max 500 chars)
   * - Palate: Tasting notes - flavor (max 500 chars)
   * - Finish: Tasting notes - aftertaste (max 500 chars)
   *
   * Why quoted column names?
   * - Field names have spaces ("Stock Number", "ABV (%)")
   * - SQLite requires quotes for non-standard identifiers
   * - Alternative: Use underscores (stock_number, abv_percent)
   * - We use quoted names for compatibility with CSV imports
   *
   * Constraints:
   * - user_id NOT NULL: Every bottle belongs to a user
   * - name NOT NULL: Every bottle needs a name
   * - FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
   *   - If user is deleted, their bottles are deleted too
   *   - Ensures data privacy and prevents orphaned data
   *
   * Performance:
   * - Index on user_id (see indexes section below)
   * - Typical query: SELECT * WHERE user_id = ?
   * - With index: <1ms for 1000 bottles
   * - Without index: ~50ms for 1000 bottles
   *
   * Example Row:
   * {
   *   id: 42,
   *   user_id: 1,
   *   name: "Maker's Mark",
   *   "Stock Number": 123,
   *   "Liquor Type": "Bourbon",
   *   "Detailed Spirit Classification": "Kentucky Straight Bourbon Whisky",
   *   "Distillation Method": "Pot Still",
   *   "ABV (%)": "45",
   *   "Distillery Location": "Loretto, KY",
   *   "Age Statement or Barrel Finish": null,
   *   "Additional Notes": "Gift from friend",
   *   "Profile (Nose)": "Vanilla, caramel, oak",
   *   "Palate": "Sweet, smooth, wheat notes",
   *   "Finish": "Medium, slightly spicy",
   *   created_at: "2025-11-10 14:32:05"
   * }
   *
   * Future Enhancements (Phase 3+):
   * - Add updated_at DATETIME (track modifications)
   * - Add deleted_at DATETIME (soft delete for data recovery)
   * - Add photo_url TEXT (bottle photos)
   * - Add purchase_price REAL (cost tracking)
   * - Add purchase_date DATETIME (purchase tracking)
   * - Add quantity_ml INTEGER (remaining volume)
   */
  db.exec(`
    CREATE TABLE IF NOT EXISTS inventory_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL CHECK(category IN ('spirit', 'liqueur', 'mixer', 'garnish', 'syrup', 'wine', 'beer', 'other')),
      type TEXT,
      abv TEXT,
      "Stock Number" INTEGER,
      "Detailed Spirit Classification" TEXT,
      "Distillation Method" TEXT,
      "Distillery Location" TEXT,
      "Age Statement or Barrel Finish" TEXT,
      "Additional Notes" TEXT,
      "Profile (Nose)" TEXT,
      "Palate" TEXT,
      "Finish" TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  /**
   * Collections Table
   *
   * Stores user's recipe collections (books/groups for organizing recipes).
   *
   * Columns:
   * - id: Auto-increment primary key
   * - user_id: Foreign key to users table
   * - name: Collection name (REQUIRED, e.g., "Classic Cocktails", "Tiki Drinks")
   * - description: Optional description of the collection
   * - created_at: Collection creation timestamp
   *
   * Constraints:
   * - user_id NOT NULL: Every collection belongs to a user
   * - name NOT NULL: Every collection needs a name
   * - FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
   *   - If user is deleted, their collections are deleted too
   *
   * Example Row:
   * {
   *   id: 1,
   *   user_id: 1,
   *   name: "Classic Cocktails",
   *   description: "Traditional recipes from the golden age of cocktails",
   *   created_at: "2025-11-15 18:45:00"
   * }
   */
  db.exec(`
    CREATE TABLE IF NOT EXISTS collections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  /**
   * Recipes Table
   *
   * Stores user's cocktail recipe collection.
   *
   * Columns (Metadata):
   * - id: Auto-increment primary key
   * - user_id: Foreign key to users table
   * - collection_id: Foreign key to collections table (optional)
   * - created_at: Recipe added timestamp
   *
   * Columns (Recipe Details):
   * - name: Recipe name (REQUIRED, e.g., "Old Fashioned")
   * - ingredients: JSON string of ingredients (REQUIRED)
   * - instructions: Step-by-step directions (optional, max 2000 chars)
   * - glass: Glassware type (optional, e.g., "Rocks glass")
   * - category: Recipe category (optional, e.g., "Classic", "Sour")
   *
   * Ingredients Storage:
   * - Stored as JSON string (not native JSON type)
   * - Flexible format support:
   *   - Simple: ["2 oz Bourbon", "1 sugar cube"]
   *   - Structured: [{"name": "Bourbon", "amount": 2, "unit": "oz"}]
   * - Parsed to JavaScript on retrieval
   *
   * Why JSON string instead of separate table?
   * - Simplicity: No JOIN queries needed
   * - Flexibility: Supports any ingredient structure
   * - Performance: Single query for complete recipe
   * - Tradeoff: Can't easily search by ingredient (future enhancement)
   *
   * Constraints:
   * - user_id NOT NULL: Every recipe belongs to a user
   * - name NOT NULL: Every recipe needs a name
   * - ingredients NOT NULL: Must have at least empty array
   * - FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
   *   - If user is deleted, their recipes are deleted too
   *
   * Performance:
   * - Index on user_id (see indexes section below)
   * - Typical query: SELECT * WHERE user_id = ?
   * - With index: <1ms for 1000 recipes
   *
   * Example Row:
   * {
   *   id: 1,
   *   user_id: 1,
   *   name: "Old Fashioned",
   *   ingredients: '["2 oz Bourbon","1 sugar cube","2 dashes Angostura bitters","Orange peel"]',
   *   instructions: "Muddle sugar with bitters in rocks glass. Add ice and bourbon. Stir. Garnish with orange peel.",
   *   glass: "Rocks glass",
   *   category: "Classic",
   *   created_at: "2025-11-10 14:32:05"
   * }
   *
   * Future Enhancements (Phase 3+):
   * - Add ingredients_normalized table (for search by ingredient)
   * - Add photo_url TEXT (recipe photos)
   * - Add source TEXT (where recipe came from)
   * - Add rating INTEGER (user rating 1-5)
   * - Add updated_at DATETIME (track modifications)
   * - Add is_public BOOLEAN (share recipes between users)
   */
  db.exec(`
    CREATE TABLE IF NOT EXISTS recipes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      collection_id INTEGER,
      name TEXT NOT NULL,
      ingredients TEXT NOT NULL,
      instructions TEXT,
      glass TEXT,
      category TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE SET NULL
    )
  `);

  /**
   * Favorites Table
   *
   * Stores user's favorited recipes (bookmarks).
   *
   * Columns:
   * - id: Auto-increment primary key
   * - user_id: Foreign key to users table (who favorited)
   * - recipe_name: Name of favorited recipe
   * - recipe_id: Foreign key to recipes table (optional)
   * - created_at: Favorite added timestamp
   *
   * Design Decision: Why both recipe_name AND recipe_id?
   * - recipe_name: Always stored (denormalized for performance)
   * - recipe_id: Optional reference to recipes table
   *
   * Use Cases:
   * 1. User favorites their own recipe:
   *    - recipe_name: "Old Fashioned"
   *    - recipe_id: 42 (points to recipes table)
   *
   * 2. User favorites external recipe (future):
   *    - recipe_name: "Aviation"
   *    - recipe_id: null (not in recipes table)
   *
   * 3. User favorites recipe, then deletes original:
   *    - recipe_name: "Margarita" (kept)
   *    - recipe_id: null (set to null by ON DELETE SET NULL)
   *
   * Constraints:
   * - user_id NOT NULL: Every favorite belongs to a user
   * - recipe_name NOT NULL: Must have a name
   * - FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
   *   - If user is deleted, their favorites are deleted too
   * - FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE SET NULL
   *   - If recipe is deleted, favorite remains but recipe_id becomes null
   *   - This preserves favorite history
   *
   * Performance:
   * - Index on user_id (see indexes section below)
   * - Typical query: SELECT * WHERE user_id = ?
   *
   * Example Row:
   * {
   *   id: 1,
   *   user_id: 1,
   *   recipe_name: "Old Fashioned",
   *   recipe_id: 42,
   *   created_at: "2025-11-10 14:32:05"
   * }
   *
   * Future Enhancements (Phase 3+):
   * - Add notes TEXT (personal notes on favorite)
   * - Add tags TEXT (categorize favorites)
   * - Add UNIQUE constraint (user_id, recipe_id) to prevent duplicates
   */
  db.exec(`
    CREATE TABLE IF NOT EXISTS favorites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      recipe_name TEXT NOT NULL,
      recipe_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE SET NULL
    )
  `);

  /**
   * Token Blacklist Table
   *
   * Persists revoked JWT tokens so revocations survive restarts
   * and can be shared across multiple backend instances.
   *
   * Columns:
   * - token: Full JWT token string (PRIMARY KEY)
   * - expires_at: Unix timestamp (seconds) when token expires
   */
  db.exec(`
    CREATE TABLE IF NOT EXISTS token_blacklist (
      token TEXT PRIMARY KEY,
      expires_at INTEGER NOT NULL
    )
  `);

  /**
   * Performance Indexes
   *
   * Creates indexes on frequently queried columns for faster lookups.
   *
   * Why Indexes Matter:
   * - Without index: Full table scan (O(n) time)
   * - With index: B-tree lookup (O(log n) time)
   * - Example: Finding 1 row in 1000 rows
   *   - No index: ~500 comparisons (average)
   *   - With index: ~10 comparisons (log₂ 1000 ≈ 10)
   *
   * Index Strategy:
   * - Index columns used in WHERE clauses
   * - Index foreign key columns (user_id)
   * - Don't over-index (indexes slow down writes)
   *
   * Created Indexes:
   * 1. idx_bottles_user_id: Fast lookup of user's bottles
   *    - Query: SELECT * FROM bottles WHERE user_id = ?
   *    - Performance: <1ms instead of ~50ms for 1000 rows
   *
   * 2. idx_recipes_user_id: Fast lookup of user's recipes
   *    - Query: SELECT * FROM recipes WHERE user_id = ?
   *    - Performance: <1ms instead of ~50ms for 1000 rows
   *
   * 3. idx_favorites_user_id: Fast lookup of user's favorites
   *    - Query: SELECT * FROM favorites WHERE user_id = ?
   *    - Performance: <1ms instead of ~50ms for 1000 rows
   *
   * Index Overhead:
   * - Storage: ~10% of table size
   * - Write performance: Slightly slower (update index on insert/update)
   * - Read performance: 10-100x faster
   * - Tradeoff: Worth it for read-heavy workloads
   *
   * Future Indexes (Phase 3+):
   * - idx_bottles_name: Search bottles by name
   * - idx_recipes_name: Search recipes by name
   * - idx_recipes_category: Filter recipes by category
   * - idx_users_email: Faster login (if not already indexed by UNIQUE)
   */
  /**
   * Schema Migration: Add collection_id to existing recipes table
   *
   * For databases created before collections feature was added.
   * Safe to run multiple times (will fail silently if column exists).
   */
  try {
    db.exec(`ALTER TABLE recipes ADD COLUMN collection_id INTEGER REFERENCES collections(id) ON DELETE SET NULL`);
    console.log('✅ Added collection_id column to recipes table');
  } catch (error: any) {
    // Column already exists, ignore error
    if (!error.message?.includes('duplicate column name')) {
      console.error('Migration warning:', error.message);
    }
  }

  /**
   * Schema Migration: Migrate bottles table to inventory_items
   *
   * For databases created before inventory refactor.
   * Renames 'bottles' table to 'inventory_items' and adds category column.
   * Safe to run multiple times (will skip if already migrated).
   */
  try {
    // Check if old 'bottles' table exists
    const tableCheck = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='bottles'`).get();

    if (tableCheck) {
      console.log('🔄 Migrating bottles table to inventory_items...');

      // Rename bottles to inventory_items
      db.exec(`ALTER TABLE bottles RENAME TO inventory_items`);

      // Add category column with default value 'spirit' for existing rows
      db.exec(`ALTER TABLE inventory_items ADD COLUMN category TEXT NOT NULL DEFAULT 'spirit' CHECK(category IN ('spirit', 'liqueur', 'mixer', 'garnish', 'syrup', 'wine', 'beer', 'other'))`);

      // Rename "Liquor Type" to type (create new column, copy data, drop old)
      db.exec(`ALTER TABLE inventory_items ADD COLUMN type TEXT`);
      db.exec(`UPDATE inventory_items SET type = "Liquor Type"`);
      // Note: SQLite doesn't support DROP COLUMN until version 3.35.0, so we keep both for compatibility

      // Rename "ABV (%)" to abv (create new column, copy data, drop old)
      db.exec(`ALTER TABLE inventory_items ADD COLUMN abv TEXT`);
      db.exec(`UPDATE inventory_items SET abv = "ABV (%)"`);

      console.log('✅ Successfully migrated bottles to inventory_items');
    }
  } catch (error: any) {
    if (error.message?.includes('no such table: bottles')) {
      // Table already migrated or doesn't exist, ignore
    } else if (error.message?.includes('duplicate column name')) {
      // Column already exists, ignore
    } else {
      console.error('Migration warning:', error.message);
    }
  }

  /**
   * Schema Migration: Add tasting_notes to inventory_items
   *
   * Adds a tasting_notes column for users to provide detailed tasting notes
   * for their spirits and ingredients. This enriches the AI's ability to make
   * nuanced cocktail recommendations.
   *
   * Safe to run multiple times (will fail silently if column exists).
   */
  try {
    db.exec(`ALTER TABLE inventory_items ADD COLUMN tasting_notes TEXT`);
    console.log('✅ Added tasting_notes column to inventory_items table');
  } catch (error: any) {
    // Column already exists, ignore error
    if (!error.message?.includes('duplicate column name')) {
      console.error('Migration warning:', error.message);
    }
  }

  /**
   * Schema Migration: Add memmachine_uuid to recipes
   *
   * Tracks MemMachine episode UUIDs for recipe deletion (Option A).
   * Enables granular deletion of recipes from MemMachine memory system.
   *
   * Why Option A (UUID Tracking)?
   * - Precise deletion: Remove exact recipe from MemMachine when deleted from AlcheMix
   * - No stale data: User's AI context stays synchronized with their actual recipe library
   * - Better UX: AI won't recommend deleted recipes
   * - Data integrity: Historical memory doesn't pollute current recommendations
   *
   * How it works:
   * 1. Recipe created → MemMachine returns UUID → Store in this column
   * 2. Recipe deleted → Use UUID to delete from MemMachine → CASCADE cleanup
   * 3. Batch import → Store UUIDs during bulk upload → Enable mass deletion
   *
   * Safe to run multiple times (will fail silently if column exists).
   */
  try {
    db.exec(`ALTER TABLE recipes ADD COLUMN memmachine_uuid TEXT`);
    console.log('✅ Added memmachine_uuid column to recipes table');
  } catch (error: any) {
    // Column already exists, ignore error
    if (!error.message?.includes('duplicate column name')) {
      console.error('Migration warning:', error.message);
    }
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_inventory_items_user_id ON inventory_items(user_id);
    CREATE INDEX IF NOT EXISTS idx_inventory_items_category ON inventory_items(category);
    CREATE INDEX IF NOT EXISTS idx_collections_user_id ON collections(user_id);
    CREATE INDEX IF NOT EXISTS idx_recipes_user_id ON recipes(user_id);
    CREATE INDEX IF NOT EXISTS idx_recipes_collection_id ON recipes(collection_id);
    CREATE INDEX IF NOT EXISTS idx_recipes_memmachine_uuid ON recipes(memmachine_uuid);
    CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id);
  `);

  console.log('✅ Database schema initialized successfully!');
  console.log(`📍 Database location: ${DB_FILE}`);
}

/**
 * Graceful Shutdown on SIGINT (Ctrl+C)
 *
 * Handles manual server shutdown from terminal.
 *
 * Process:
 * 1. Receive SIGINT signal (user presses Ctrl+C)
 * 2. Close database connection gracefully
 * 3. Exit process with code 0 (clean shutdown)
 *
 * Why Close Database?
 * - Prevents database corruption
 * - Ensures pending writes are flushed
 * - Releases file locks
 * - SQLite is resilient but closure is best practice
 *
 * What Happens Without This?
 * - Database might remain locked
 * - Pending writes might be lost
 * - File handle remains open
 * - Process doesn't exit cleanly
 *
 * Testing:
 * 1. Start server: npm run dev
 * 2. Press Ctrl+C
 * 3. Should see: "Closing database connection..."
 * 4. Process exits cleanly
 */
process.on('SIGINT', () => {
  console.log('\n🛑 SIGINT received: Closing database connection...');
  db.close();
  console.log('✅ Database closed. Goodbye!');
  process.exit(0);
});

/**
 * Graceful Shutdown on SIGTERM (System Termination)
 *
 * Handles system-initiated shutdown.
 *
 * When SIGTERM is sent:
 * - Docker stop command
 * - Kubernetes pod termination
 * - System shutdown
 * - Process manager (PM2, systemd) restart
 *
 * Process:
 * 1. Receive SIGTERM signal
 * 2. Close database connection gracefully
 * 3. Exit process with code 0 (clean shutdown)
 *
 * Production Deployment:
 * - Docker: docker stop sends SIGTERM, waits 10s, then SIGKILL
 * - Kubernetes: Sends SIGTERM, waits 30s (terminationGracePeriodSeconds)
 * - PM2: Sends SIGTERM on reload
 *
 * Timeout Handling:
 * - If shutdown takes >10s, system sends SIGKILL (force kill)
 * - Our shutdown should complete in <1s (just close database)
 *
 * Testing:
 * 1. Start server: npm run dev
 * 2. Get PID: ps aux | grep node
 * 3. Send SIGTERM: kill -TERM <PID>
 * 4. Should see: "Closing database connection..."
 * 5. Process exits cleanly
 */
process.on('SIGTERM', () => {
  console.log('\n🛑 SIGTERM received: Closing database connection...');
  db.close();
  console.log('✅ Database closed. Goodbye!');
  process.exit(0);
});

/**
 * Export Database Connection
 *
 * Named export for use in routes and services.
 *
 * Usage:
 * ```typescript
 * import { db } from '../database/db';
 *
 * const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
 * ```
 *
 * Important Notes:
 * - db is a singleton (shared across entire app)
 * - All queries use prepared statements (SQL injection prevention)
 * - Queries are synchronous (await not needed)
 * - Transactions available via db.transaction()
 *
 * Performance Characteristics:
 * - Prepared statements are cached (faster repeated queries)
 * - Synchronous API avoids async overhead
 * - Single connection (SQLite limitation)
 * - Suitable for <1000 concurrent users
 *
 * Future Enhancements (Phase 3+):
 * - Add query logging middleware
 * - Add query performance monitoring
 * - Add connection pooling (if switching to PostgreSQL)
 * - Add read replicas for scaling reads
 */
