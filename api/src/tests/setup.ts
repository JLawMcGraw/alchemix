import { beforeAll, afterAll, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

// Test database path
export const TEST_DB_PATH = path.join(__dirname, '../../test-data/test.db');

// Ensure test database directory exists
beforeAll(() => {
  const testDataDir = path.dirname(TEST_DB_PATH);
  if (!fs.existsSync(testDataDir)) {
    fs.mkdirSync(testDataDir, { recursive: true });
  }
});

// Clean up test database after each test
afterEach(() => {
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
});

// Clean up after all tests
afterAll(() => {
  const testDataDir = path.dirname(TEST_DB_PATH);
  if (fs.existsSync(testDataDir)) {
    fs.rmSync(testDataDir, { recursive: true, force: true });
  }
});

/**
 * Create a test database with schema
 */
export function createTestDatabase(): Database.Database {
  const db = new Database(TEST_DB_PATH);

  // Create users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create bottles table
  db.exec(`
    CREATE TABLE IF NOT EXISTS bottles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      subcategory TEXT,
      quantity REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Create recipes table
  db.exec(`
    CREATE TABLE IF NOT EXISTS recipes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      ingredients TEXT NOT NULL,
      instructions TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Create favorites table
  db.exec(`
    CREATE TABLE IF NOT EXISTS favorites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      recipe_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
      UNIQUE(user_id, recipe_id)
    )
  `);

  // Create indices
  db.exec('CREATE INDEX IF NOT EXISTS idx_bottles_user_id ON bottles(user_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_recipes_user_id ON recipes(user_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_favorites_recipe_id ON favorites(recipe_id)');

  return db;
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
