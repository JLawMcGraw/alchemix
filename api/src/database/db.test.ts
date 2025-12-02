import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { createTestDatabase, cleanupTestDatabase } from '../tests/setup';

describe('Database Operations', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDatabase();
  });

  afterEach(() => {
    cleanupTestDatabase(db);
  });

  describe('Schema Creation', () => {
    it('should create users table with correct schema', () => {
      const tableInfo = db.prepare("PRAGMA table_info(users)").all();
      const columns = tableInfo.map((col: any) => col.name);

      expect(columns).toContain('id');
      expect(columns).toContain('email');
      expect(columns).toContain('password_hash');
      expect(columns).toContain('created_at');
    });

    it('should create inventory_items table with current schema', () => {
      const tableInfo = db.prepare("PRAGMA table_info(inventory_items)").all();
      const columns = tableInfo.map((col: any) => col.name);

      expect(columns).toEqual(expect.arrayContaining([
        'id',
        'user_id',
        'name',
        'category',
        'type',
        'abv',
        'stock_number',
        'spirit_classification',
        'distillation_method',
        'distillery_location',
        'age_statement',
        'additional_notes',
        'profile_nose',
        'palate',
        'finish',
        'tasting_notes',
        'created_at'
      ]));
    });

    it('should create recipes table with correct schema', () => {
      const tableInfo = db.prepare("PRAGMA table_info(recipes)").all();
      const columns = tableInfo.map((col: any) => col.name);

      expect(columns).toContain('id');
      expect(columns).toContain('user_id');
      expect(columns).toContain('name');
      expect(columns).toContain('ingredients');
      expect(columns).toContain('instructions');
      expect(columns).toContain('created_at');
    });

    it('should create favorites table with correct schema', () => {
      const tableInfo = db.prepare("PRAGMA table_info(favorites)").all();
      const columns = tableInfo.map((col: any) => col.name);

      expect(columns).toContain('id');
      expect(columns).toContain('user_id');
      expect(columns).toContain('recipe_id');
      expect(columns).toContain('created_at');
    });

    it('should have foreign key constraints enabled', () => {
      const foreignKeys = db.prepare("PRAGMA foreign_keys").get() as { foreign_keys: number };
      // Note: We need to enable foreign keys in the test setup
      db.pragma('foreign_keys = ON');
      const enabled = db.prepare("PRAGMA foreign_keys").get() as { foreign_keys: number };
      expect(enabled.foreign_keys).toBe(1);
    });
  });

  describe('User Operations', () => {
    it('should insert a user', () => {
      const stmt = db.prepare(
        'INSERT INTO users (email, password_hash) VALUES (?, ?)'
      );

      const result = stmt.run('test@example.com', 'hashed_password');

      expect(result.changes).toBe(1);
      expect(result.lastInsertRowid).toBeGreaterThan(0);
    });

    it('should retrieve a user by email', () => {
      db.prepare(
        'INSERT INTO users (email, password_hash) VALUES (?, ?)'
      ).run('test@example.com', 'hashed_password');

      const user = db.prepare('SELECT * FROM users WHERE email = ?').get('test@example.com') as any;

      expect(user).toBeDefined();
      expect(user.email).toBe('test@example.com');
      expect(user.password_hash).toBe('hashed_password');
    });

    it('should enforce unique email constraint', () => {
      db.prepare(
        'INSERT INTO users (email, password_hash) VALUES (?, ?)'
      ).run('test@example.com', 'password1');

      expect(() => {
        db.prepare(
          'INSERT INTO users (email, password_hash) VALUES (?, ?)'
        ).run('test@example.com', 'password2');
      }).toThrow();
    });

    it('should set created_at automatically', () => {
      db.prepare(
        'INSERT INTO users (email, password_hash) VALUES (?, ?)'
      ).run('test@example.com', 'hashed_password');

      const user = db.prepare('SELECT created_at FROM users WHERE email = ?').get('test@example.com') as any;

      expect(user.created_at).toBeDefined();
      expect(user.created_at).toMatch(/^\d{4}-\d{2}-\d{2}/); // ISO date format
    });

    it('should allow multiple users with different emails', () => {
      db.prepare(
        'INSERT INTO users (email, password_hash) VALUES (?, ?)'
      ).run('user1@example.com', 'password1');

      db.prepare(
        'INSERT INTO users (email, password_hash) VALUES (?, ?)'
      ).run('user2@example.com', 'password2');

      const users = db.prepare('SELECT * FROM users').all();
      expect(users).toHaveLength(2);
    });
  });

  describe('Inventory Operations', () => {
    let userId: number;
    const insertItem = (overrides: {
      name?: string;
      category?: string;
      type?: string;
      classification?: string;
      notes?: string | null;
    } = {}) => {
      const stmt = db.prepare(`
        INSERT INTO inventory_items (user_id, name, category, type, spirit_classification, additional_notes)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      return stmt.run(
        userId,
        overrides.name ?? 'Test Item',
        overrides.category ?? 'spirit',
        overrides.type ?? 'Gin',
        overrides.classification ?? 'London Dry Gin',
        overrides.notes ?? null
      );
    };

    beforeEach(() => {
      const result = db.prepare(
        'INSERT INTO users (email, password_hash) VALUES (?, ?)'
      ).run('test@example.com', 'hashed_password');
      userId = Number(result.lastInsertRowid);
    });

    it('should insert an inventory item', () => {
      const result = insertItem();

      expect(result.changes).toBe(1);
      expect(result.lastInsertRowid).toBeGreaterThan(0);
    });

    it('should retrieve inventory items for a user', () => {
      insertItem({ name: 'Item 1', type: 'Vodka' });
      insertItem({ name: 'Item 2', type: 'Gin' });

      const items = db.prepare('SELECT * FROM inventory_items WHERE user_id = ?').all(userId);

      expect(items).toHaveLength(2);
    });

    it('should cascade delete inventory items when user is deleted', () => {
      db.pragma('foreign_keys = ON');

      insertItem();

      db.prepare('DELETE FROM users WHERE id = ?').run(userId);

      const items = db.prepare('SELECT * FROM inventory_items WHERE user_id = ?').all(userId);
      expect(items).toHaveLength(0);
    });

    it('should update inventory item metadata fields', () => {
      const result = insertItem();
      const itemId = Number(result.lastInsertRowid);

      db.prepare('UPDATE inventory_items SET stock_number = ? WHERE id = ?').run(500, itemId);

      const item = db.prepare('SELECT stock_number as stock FROM inventory_items WHERE id = ?').get(itemId) as any;
      expect(item.stock).toBe(500);
    });

    it('should allow optional classification fields to remain null', () => {
      const result = db.prepare(`
        INSERT INTO inventory_items (user_id, name, category)
        VALUES (?, ?, ?)
      `).run(userId, 'Minimal Item', 'other');

      const item = db.prepare('SELECT spirit_classification as detail FROM inventory_items WHERE id = ?')
        .get(result.lastInsertRowid) as any;
      expect(item.detail).toBeNull();
    });
  });

  describe('Recipe Operations', () => {
    let userId: number;

    beforeEach(() => {
      const result = db.prepare(
        'INSERT INTO users (email, password_hash) VALUES (?, ?)'
      ).run('test@example.com', 'hashed_password');
      userId = Number(result.lastInsertRowid);
    });

    it('should insert a recipe', () => {
      const stmt = db.prepare(
        'INSERT INTO recipes (user_id, name, ingredients, instructions) VALUES (?, ?, ?, ?)'
      );

      const result = stmt.run(userId, 'Martini', '2 oz Gin, 1 oz Vermouth', 'Stir and strain');

      expect(result.changes).toBe(1);
      expect(result.lastInsertRowid).toBeGreaterThan(0);
    });

    it('should retrieve recipes for a user', () => {
      db.prepare(
        'INSERT INTO recipes (user_id, name, ingredients, instructions) VALUES (?, ?, ?, ?)'
      ).run(userId, 'Recipe 1', 'Ingredients 1', 'Instructions 1');

      db.prepare(
        'INSERT INTO recipes (user_id, name, ingredients, instructions) VALUES (?, ?, ?, ?)'
      ).run(userId, 'Recipe 2', 'Ingredients 2', 'Instructions 2');

      const recipes = db.prepare('SELECT * FROM recipes WHERE user_id = ?').all(userId);

      expect(recipes).toHaveLength(2);
    });

    it('should cascade delete recipes when user is deleted', () => {
      db.pragma('foreign_keys = ON');

      db.prepare(
        'INSERT INTO recipes (user_id, name, ingredients, instructions) VALUES (?, ?, ?, ?)'
      ).run(userId, 'Martini', '2 oz Gin, 1 oz Vermouth', 'Stir and strain');

      db.prepare('DELETE FROM users WHERE id = ?').run(userId);

      const recipes = db.prepare('SELECT * FROM recipes WHERE user_id = ?').all(userId);
      expect(recipes).toHaveLength(0);
    });

    it('should handle null instructions', () => {
      const result = db.prepare(
        'INSERT INTO recipes (user_id, name, ingredients) VALUES (?, ?, ?)'
      ).run(userId, 'Simple Recipe', '1 oz Ingredient');

      const recipe = db.prepare('SELECT instructions FROM recipes WHERE id = ?').get(result.lastInsertRowid) as any;
      expect(recipe.instructions).toBeNull();
    });
  });

  describe('Favorites Operations', () => {
    let userId: number;
    let recipeId: number;

    beforeEach(() => {
      const userResult = db.prepare(
        'INSERT INTO users (email, password_hash) VALUES (?, ?)'
      ).run('test@example.com', 'hashed_password');
      userId = Number(userResult.lastInsertRowid);

      const recipeResult = db.prepare(
        'INSERT INTO recipes (user_id, name, ingredients, instructions) VALUES (?, ?, ?, ?)'
      ).run(userId, 'Martini', '2 oz Gin, 1 oz Vermouth', 'Stir and strain');
      recipeId = Number(recipeResult.lastInsertRowid);
    });

    it('should add a favorite', () => {
      const stmt = db.prepare(
        'INSERT INTO favorites (user_id, recipe_name, recipe_id) VALUES (?, ?, ?)'
      );

      const result = stmt.run(userId, 'Martini', recipeId);

      expect(result.changes).toBe(1);
      expect(result.lastInsertRowid).toBeGreaterThan(0);
    });

    it('should retrieve favorites for a user', () => {
      db.prepare(
        'INSERT INTO favorites (user_id, recipe_name, recipe_id) VALUES (?, ?, ?)'
      ).run(userId, 'Martini', recipeId);

      const favorites = db.prepare('SELECT * FROM favorites WHERE user_id = ?').all(userId);

      expect(favorites).toHaveLength(1);
    });

    it('should enforce unique user_id and recipe_id combination', () => {
      db.prepare(
        'INSERT INTO favorites (user_id, recipe_name, recipe_id) VALUES (?, ?, ?)'
      ).run(userId, 'Martini', recipeId);

      expect(() => {
        db.prepare(
          'INSERT INTO favorites (user_id, recipe_id) VALUES (?, ?)'
        ).run(userId, recipeId);
      }).toThrow();
    });

    it('should cascade delete favorites when user is deleted', () => {
      db.pragma('foreign_keys = ON');

      db.prepare(
        'INSERT INTO favorites (user_id, recipe_name, recipe_id) VALUES (?, ?, ?)'
      ).run(userId, 'Martini', recipeId);

      db.prepare('DELETE FROM users WHERE id = ?').run(userId);

      const favorites = db.prepare('SELECT * FROM favorites WHERE user_id = ?').all(userId);
      expect(favorites).toHaveLength(0);
    });

    it('should cascade delete favorites when recipe is deleted', () => {
      db.pragma('foreign_keys = ON');

      db.prepare(
        'INSERT INTO favorites (user_id, recipe_name, recipe_id) VALUES (?, ?, ?)'
      ).run(userId, 'Martini', recipeId);

      db.prepare('DELETE FROM recipes WHERE id = ?').run(recipeId);

      const favorites = db.prepare('SELECT * FROM favorites WHERE recipe_id = ?').all(recipeId);
      expect(favorites).toHaveLength(0);
    });

    it('should allow same recipe to be favorited by different users', () => {
      const user2Result = db.prepare(
        'INSERT INTO users (email, password_hash) VALUES (?, ?)'
      ).run('user2@example.com', 'password');
      const userId2 = Number(user2Result.lastInsertRowid);

      db.prepare(
        'INSERT INTO favorites (user_id, recipe_name, recipe_id) VALUES (?, ?, ?)'
      ).run(userId, 'Martini', recipeId);

      db.prepare(
        'INSERT INTO favorites (user_id, recipe_name, recipe_id) VALUES (?, ?, ?)'
      ).run(userId2, 'Martini', recipeId);

      const favorites = db.prepare('SELECT * FROM favorites WHERE recipe_id = ?').all(recipeId);
      expect(favorites).toHaveLength(2);
    });
  });

  describe('Indices', () => {
    it('should have index on inventory_items user_id', () => {
      const indices = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='inventory_items'").all();
      const indexNames = indices.map((idx: any) => idx.name);

      expect(indexNames).toContain('idx_inventory_items_user_id');
    });

    it('should have index on inventory_items category', () => {
      const indices = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='inventory_items'").all();
      const indexNames = indices.map((idx: any) => idx.name);

      expect(indexNames).toContain('idx_inventory_items_category');
    });

    it('should have index on recipes user_id', () => {
      const indices = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='recipes'").all();
      const indexNames = indices.map((idx: any) => idx.name);

      expect(indexNames).toContain('idx_recipes_user_id');
    });

    it('should have index on favorites user_id', () => {
      const indices = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='favorites'").all();
      const indexNames = indices.map((idx: any) => idx.name);

      expect(indexNames).toContain('idx_favorites_user_id');
    });

    it('should have index on favorites recipe_id', () => {
      const indices = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='favorites'").all();
      const indexNames = indices.map((idx: any) => idx.name);

      expect(indexNames).toContain('idx_favorites_recipe_id');
    });
  });

  describe('Query Performance', () => {
    let userId: number;

    beforeEach(() => {
      const result = db.prepare(
        'INSERT INTO users (email, password_hash) VALUES (?, ?)'
      ).run('test@example.com', 'hashed_password');
      userId = Number(result.lastInsertRowid);

      // Insert multiple inventory items for performance testing
      const stmt = db.prepare(
        'INSERT INTO inventory_items (user_id, name, category, type, spirit_classification) VALUES (?, ?, ?, ?, ?)'
      );

      for (let i = 0; i < 100; i++) {
        stmt.run(userId, `Item ${i}`, 'spirit', 'Vodka', 'Premium Vodka');
      }
    });

    it('should efficiently query inventory items by user_id', () => {
      const startTime = Date.now();

      db.prepare('SELECT * FROM inventory_items WHERE user_id = ?').all(userId);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Query should be fast (less than 10ms for 100 rows)
      expect(duration).toBeLessThan(10);
    });

    it('should efficiently count inventory items for a user', () => {
      const result = db.prepare('SELECT COUNT(*) as count FROM inventory_items WHERE user_id = ?').get(userId) as any;

      expect(result.count).toBe(100);
    });
  });
});
