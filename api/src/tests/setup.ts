import { beforeAll, afterAll, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { randomBytes } from 'crypto';

// Use a temp directory for test database to avoid path issues
const TEST_DIR = path.join(os.tmpdir(), 'alchemix-test');

// Generate unique database path for each test run to avoid conflicts
function generateTestDbPath(): string {
  const uniqueId = randomBytes(8).toString('hex');
  return path.join(TEST_DIR, `test-${uniqueId}.db`);
}

// Legacy path export for backwards compatibility (not used anymore)
export const TEST_DB_PATH = path.join(TEST_DIR, 'test.db');

// Ensure test database directory exists
// Note: We also check this in createTestDatabase() to handle parallel test execution
beforeAll(() => {
  if (!fs.existsSync(TEST_DIR)) {
    fs.mkdirSync(TEST_DIR, { recursive: true });
  }
});

// Note: We don't clean up the entire TEST_DIR in afterAll because:
// 1. Tests run in parallel and may still need the directory
// 2. Each test cleans up its own database file via cleanupTestDatabase()
// 3. The OS temp directory is cleaned up automatically by the system

/**
 * Create a test database with schema
 * Each call creates a unique database file to avoid test interference
 */
export function createTestDatabase(): Database.Database {
  // Ensure directory exists before creating database
  if (!fs.existsSync(TEST_DIR)) {
    fs.mkdirSync(TEST_DIR, { recursive: true });
  }

  const uniqueDbPath = generateTestDbPath();
  const db = new Database(uniqueDbPath);

  // Enable foreign keys
  db.pragma('foreign_keys = ON');

  // Create users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create inventory_items table (matches production schema)
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
      tasting_notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Create collections table (needed for recipes FK)
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

  // Create recipes table
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
      memmachine_uuid TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE SET NULL
    )
  `);

  // Create favorites table
  db.exec(`
    CREATE TABLE IF NOT EXISTS favorites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      recipe_name TEXT NOT NULL,
      recipe_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE SET NULL,
      UNIQUE(user_id, recipe_id)
    )
  `);

  // Token blacklist table for logout tests
  db.exec(`
    CREATE TABLE IF NOT EXISTS token_blacklist (
      token TEXT PRIMARY KEY,
      expires_at INTEGER NOT NULL
    )
  `);

  // Create indices
  db.exec('CREATE INDEX IF NOT EXISTS idx_inventory_items_user_id ON inventory_items(user_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_inventory_items_category ON inventory_items(category)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_collections_user_id ON collections(user_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_recipes_user_id ON recipes(user_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_recipes_collection_id ON recipes(collection_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_favorites_recipe_id ON favorites(recipe_id)');

  // Store the database path on the instance for cleanup
  (db as any).__testDbPath = uniqueDbPath;

  return db;
}

/**
 * Helper function to clean up a test database
 * Call this in your afterEach to delete the database file
 */
export function cleanupTestDatabase(db: Database.Database): void {
  const dbPath = (db as any).__testDbPath;

  // Close the database
  if (db && typeof db.close === 'function') {
    try {
      db.close();
    } catch (err) {
      // Database might already be closed
    }
  }

  // Delete the database file
  if (dbPath && fs.existsSync(dbPath)) {
    try {
      fs.unlinkSync(dbPath);
    } catch (err) {
      console.warn(`Failed to delete test database: ${dbPath}`, err);
    }
  }
}

/**
 * Test user fixtures
 */
export const testUsers = {
  validUser: {
    email: 'test@example.com',
    password: 'SecurePass123!',
  },
  invalidEmail: {
    email: 'invalid-email',
    password: 'SecurePass123!',
  },
  weakPassword: {
    email: 'test2@example.com',
    password: 'weak',
  },
};

/**
 * Test bottle fixtures
 */
export const testBottles = {
  validBottle: {
    name: 'Bombay Sapphire',
    category: 'Spirits',
    subcategory: 'Gin',
    quantity: 750,
  },
  validBottle2: {
    name: 'Grey Goose',
    category: 'Spirits',
    subcategory: 'Vodka',
    quantity: 1000,
  },
};

/**
 * Test recipe fixtures
 */
export const testRecipes = {
  validRecipe: {
    name: 'Martini',
    ingredients: '2 oz Gin, 1 oz Dry Vermouth',
    instructions: 'Stir with ice and strain into a chilled glass',
  },
  validRecipe2: {
    name: 'Negroni',
    ingredients: '1 oz Gin, 1 oz Campari, 1 oz Sweet Vermouth',
    instructions: 'Stir with ice and strain over ice',
  },
};
