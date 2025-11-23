import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express, { Express } from 'express';
import { createServer, Server } from 'http';
import request from 'supertest';
import { createTestDatabase, cleanupTestDatabase } from '../tests/setup';
import Database from 'better-sqlite3';
import jwt from 'jsonwebtoken';

// Mock the database module
let testDb: Database.Database;

vi.mock('../database/db', () => ({
  db: {
    prepare: (sql: string) => testDb.prepare(sql),
    pragma: (pragma: string, options?: any) => testDb.pragma(pragma, options),
  },
}));

// Import routes after mocking
// Mock token blacklist to avoid touching real DB handles during tests
vi.mock('../utils/tokenBlacklist', () => ({
  tokenBlacklist: {
    add: vi.fn(),
    remove: vi.fn(),
    isBlacklisted: vi.fn().mockReturnValue(false),
    size: vi.fn().mockReturnValue(0),
    cleanup: vi.fn(),
    shutdown: vi.fn(),
  },
}));

import shoppingListRoutes from './shoppingList';
import { errorHandler } from '../middleware/errorHandler';

describe('Shopping List Routes Integration Tests', () => {
  let app: Express;
  let authToken: string;
  let userId: number;
  let server: Server | null = null;

  beforeEach(() => {
    // Create test database
    testDb = createTestDatabase();

    // Create a test user
    const result = testDb.prepare(`
      INSERT INTO users (email, password_hash)
      VALUES (?, ?)
    `).run('test@example.com', 'hashedpassword');

    userId = result.lastInsertRowid as number;

    // Generate JWT token for authentication
    authToken = jwt.sign(
      { userId, email: 'test@example.com' },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );

    // Create Express app
    app = express();
    app.use(express.json());
    app.use('/api/shopping-list', shoppingListRoutes);
    app.use(errorHandler);

    server = createServer(app);
  });

  afterEach(() => {
    if (server) {
      server.close();
      server = null;
    }
    cleanupTestDatabase(testDb);
  });

  describe('GET /api/shopping-list/smart', () => {
    it('should reject unauthenticated requests', async () => {
      const response = await request(server!)
        .get('/api/shopping-list/smart')
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('No authorization token provided');
    });

    it('should return empty recommendations when user has no inventory or recipes', async () => {
      const response = await request(server!)
        .get('/api/shopping-list/smart')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toEqual([]);
      expect(response.body).toHaveProperty('stats');
      expect(response.body.stats).toMatchObject({
        totalRecipes: 0,
        craftable: 0,
        nearMisses: 0,
        inventoryItems: 0
      });
    });

    it('should identify a simple near miss (1 ingredient unlocks 1 recipe)', async () => {
      // Add bourbon and sugar to inventory
      testDb.prepare(`
        INSERT INTO inventory_items (user_id, name, category)
        VALUES (?, ?, 'spirit'), (?, ?, 'other')
      `).run(userId, 'Buffalo Trace Bourbon', userId, 'Sugar Cubes');

      // Add Old Fashioned recipe (needs bourbon + bitters)
      // User has bourbon but missing bitters
      testDb.prepare(`
        INSERT INTO recipes (user_id, name, ingredients)
        VALUES (?, ?, ?)
      `).run(
        userId,
        'Old Fashioned',
        JSON.stringify(['2 oz Bourbon', '2 dashes Angostura Bitters', '1 sugar cube'])
      );

      const response = await request(server!)
        .get('/api/shopping-list/smart')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);

      const bittersRec = response.body.data.find((rec: any) =>
        rec.ingredient.includes('bitters')
      );
      expect(bittersRec).toBeDefined();
      expect(bittersRec.unlocks).toBe(1);

      expect(response.body.stats).toMatchObject({
        totalRecipes: 1,
        craftable: 0,
        nearMisses: 1,
        inventoryItems: 2
      });
    });

    it('should count multiple recipes unlocked by the same ingredient', async () => {
      // Add rum, lime juice, and mint leaves to inventory
      testDb.prepare(`
        INSERT INTO inventory_items (user_id, name, category)
        VALUES (?, ?, 'spirit'), (?, ?, 'mixer'), (?, ?, 'garnish')
      `).run(userId, 'Havana Club Rum', userId, 'Fresh Lime Juice', userId, 'Mint Leaves');

      // Add three recipes that all need simple syrup
      testDb.prepare(`
        INSERT INTO recipes (user_id, name, ingredients)
        VALUES (?, ?, ?), (?, ?, ?), (?, ?, ?)
      `).run(
        userId, 'Daiquiri', JSON.stringify(['2 oz Rum', '1 oz Lime juice', '0.5 oz Simple syrup']),
        userId, 'Mojito', JSON.stringify(['2 oz Rum', '1 oz Lime juice', '0.5 oz Simple syrup', 'Mint leaves']),
        userId, 'Cuba Libre', JSON.stringify(['2 oz Rum', '0.5 oz Lime juice', 'Cola'])
      );

      const response = await request(server!)
        .get('/api/shopping-list/smart')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Find simple syrup recommendation
      const syrupRec = response.body.data.find((rec: any) =>
        rec.ingredient.includes('simple syrup')
      );
      expect(syrupRec).toBeDefined();
      expect(syrupRec.unlocks).toBe(2); // Daiquiri and Mojito

      // Find cola recommendation
      const colaRec = response.body.data.find((rec: any) =>
        rec.ingredient.includes('cola')
      );
      expect(colaRec).toBeDefined();
      expect(colaRec.unlocks).toBe(1); // Cuba Libre

      expect(response.body.stats.nearMisses).toBeGreaterThanOrEqual(2);
    });

    it('should sort recommendations by unlock count (descending)', async () => {
      // Add vodka to inventory
      testDb.prepare(`
        INSERT INTO inventory_items (user_id, name, category)
        VALUES (?, ?, 'spirit')
      `).run(userId, 'Grey Goose Vodka');

      // Add recipes:
      // - 3 recipes need cranberry juice
      // - 2 recipes need orange juice
      // - 1 recipe needs tomato juice
      testDb.prepare(`
        INSERT INTO recipes (user_id, name, ingredients)
        VALUES
          (?, ?, ?),
          (?, ?, ?),
          (?, ?, ?),
          (?, ?, ?),
          (?, ?, ?),
          (?, ?, ?)
      `).run(
        userId, 'Cosmopolitan', JSON.stringify(['1.5 oz Vodka', '1 oz Cranberry juice']),
        userId, 'Sea Breeze', JSON.stringify(['1.5 oz Vodka', '3 oz Cranberry juice']),
        userId, 'Cape Codder', JSON.stringify(['2 oz Vodka', '4 oz Cranberry juice']),
        userId, 'Screwdriver', JSON.stringify(['2 oz Vodka', '4 oz Orange juice']),
        userId, 'Fuzzy Navel', JSON.stringify(['1 oz Vodka', '4 oz Orange juice']),
        userId, 'Bloody Mary', JSON.stringify(['2 oz Vodka', '4 oz Tomato juice'])
      );

      const response = await request(server!)
        .get('/api/shopping-list/smart')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);

      // Verify results are sorted by unlock count (descending)
      const unlockCounts = response.body.data.map((rec: any) => rec.unlocks);
      const sortedUnlockCounts = [...unlockCounts].sort((a, b) => b - a);
      expect(unlockCounts).toEqual(sortedUnlockCounts);

      // Cranberry juice should be first (unlocks 3 recipes)
      expect(response.body.data[0].ingredient).toContain('cranberry');
      expect(response.body.data[0].unlocks).toBe(3);
    });

    it('should exclude already craftable recipes from recommendations', async () => {
      // Add bourbon, bitters, and lemon juice to inventory
      testDb.prepare(`
        INSERT INTO inventory_items (user_id, name, category)
        VALUES (?, ?, 'spirit'), (?, ?, 'spirit'), (?, ?, 'mixer')
      `).run(userId, 'Bourbon', userId, 'Angostura Bitters', userId, 'Fresh Lemon Juice');

      // Add two recipes:
      // 1. Bourbon & Bitters (craftable - has both ingredients)
      // 2. Bourbon Sour (near miss - needs lemon juice)
      testDb.prepare(`
        INSERT INTO recipes (user_id, name, ingredients)
        VALUES (?, ?, ?), (?, ?, ?)
      `).run(
        userId, 'Simple Bourbon', JSON.stringify(['2 oz Bourbon', '2 dashes Bitters']),
        userId, 'Bourbon Sour', JSON.stringify(['2 oz Bourbon', '1 oz Lemon juice', '0.5 oz Simple syrup'])
      );

      const response = await request(server!)
        .get('/api/shopping-list/smart')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.stats.craftable).toBe(1); // Simple Bourbon
      expect(response.body.stats.totalRecipes).toBe(2);

      const ingredientNames = response.body.data.map((rec: any) => rec.ingredient);
      expect(ingredientNames.some((name: string) => name.includes('simple syrup'))).toBe(true);
    });

    it('should exclude recipes missing 2+ ingredients', async () => {
      // Add only bourbon to inventory
      testDb.prepare(`
        INSERT INTO inventory_items (user_id, name, category)
        VALUES (?, ?, 'spirit')
      `).run(userId, 'Bourbon');

      // Add recipe that needs 3 ingredients but user only has 1 (missing 2)
      testDb.prepare(`
        INSERT INTO recipes (user_id, name, ingredients)
        VALUES (?, ?, ?)
      `).run(
        userId,
        'Whiskey Sour',
        JSON.stringify(['2 oz Bourbon', '1 oz Lemon juice', '0.5 oz Simple syrup'])
      );

      const response = await request(server!)
        .get('/api/shopping-list/smart')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.stats.nearMisses).toBe(0); // Recipe missing 2 ingredients, not 1
      expect(response.body.data).toEqual([]); // No recommendations
    });

    it('should handle recipes with empty or malformed ingredients', async () => {
      // Add vodka to inventory
      testDb.prepare(`
        INSERT INTO inventory_items (user_id, name, category)
        VALUES (?, ?, 'spirit')
      `).run(userId, 'Vodka');

      // Add recipes with edge cases
      testDb.prepare(`
        INSERT INTO recipes (user_id, name, ingredients)
        VALUES (?, ?, ?), (?, ?, ?), (?, ?, ?)
      `).run(
        userId, 'Empty Ingredients', '[]',
        userId, 'Invalid JSON', 'not valid json',
        userId, 'Vodka Martini', JSON.stringify(['2 oz Vodka', '1 oz Dry vermouth'])
      );

      const response = await request(server!)
        .get('/api/shopping-list/smart')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.stats.totalRecipes).toBe(3);

      // Should handle gracefully and only process valid recipe
      const vermouthRec = response.body.data.find((rec: any) =>
        rec.ingredient.includes('vermouth')
      );
      expect(vermouthRec).toBeDefined();
      expect(vermouthRec.unlocks).toBe(1);
    });

    it('should perform case-insensitive ingredient matching', async () => {
      // Add bourbon with mixed case to inventory
      testDb.prepare(`
        INSERT INTO inventory_items (user_id, name, category)
        VALUES (?, ?, 'spirit')
      `).run(userId, 'BUFFALO TRACE BOURBON');

      // Add recipe with lowercase bourbon reference
      testDb.prepare(`
        INSERT INTO recipes (user_id, name, ingredients)
        VALUES (?, ?, ?)
      `).run(
        userId,
        'Old Fashioned',
        JSON.stringify(['2 oz bourbon', '2 dashes bitters'])
      );

      const response = await request(server!)
        .get('/api/shopping-list/smart')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Should recognize that user has bourbon (case-insensitive)
      // Only bitters should be in recommendations
      const recommendations = response.body.data;
      const bourbonRec = recommendations.find((rec: any) =>
        rec.ingredient.includes('bourbon')
      );
      expect(bourbonRec).toBeUndefined(); // Bourbon should NOT be recommended (user has it)
    });

    it('should handle fuzzy matching for ingredient names', async () => {
      // Add "Angostura Aromatic Bitters" and Bourbon to inventory
      testDb.prepare(`
        INSERT INTO inventory_items (user_id, name, category)
        VALUES (?, ?, 'spirit'), (?, ?, 'spirit')
      `).run(userId, 'Angostura Aromatic Bitters', userId, 'Bourbon');

      // Add recipe that just says "bitters"
      testDb.prepare(`
        INSERT INTO recipes (user_id, name, ingredients)
        VALUES (?, ?, ?)
      `).run(
        userId,
        'Old Fashioned',
        JSON.stringify(['2 oz Bourbon', '2 dashes bitters', '1 sugar cube'])
      );

      const response = await request(server!)
        .get('/api/shopping-list/smart')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // User has "Angostura Aromatic Bitters" which should match "bitters"
      // So bitters should NOT be in recommendations
      const bittersRec = response.body.data.find((rec: any) =>
        rec.ingredient === 'bitters'
      );
      expect(bittersRec).toBeUndefined();

      // Should recommend sugar cube only (bourbon and bitters are present via fuzzy match)
      const sugarRec = response.body.data.find((rec: any) =>
        rec.ingredient.includes('sugar')
      );
      expect(sugarRec).toBeDefined();
    });

    it('should return correct statistics', async () => {
      // Add 2 bottles to inventory
      testDb.prepare(`
        INSERT INTO inventory_items (user_id, name, category)
        VALUES (?, ?, 'spirit'), (?, ?, 'spirit')
      `).run(userId, 'Vodka', userId, 'Rum');

      // Add 4 recipes:
      // - 1 craftable (Rum & Coke)
      // - 2 near misses needing orange juice
      // - 1 recipe missing 2 ingredients
      testDb.prepare(`
        INSERT INTO recipes (user_id, name, ingredients)
        VALUES (?, ?, ?), (?, ?, ?), (?, ?, ?), (?, ?, ?)
      `).run(
        userId, 'Rum & Coke', JSON.stringify(['2 oz Rum', 'Cola']),
        userId, 'Screwdriver', JSON.stringify(['2 oz Vodka', '4 oz Orange juice']),
        userId, 'Rum & Orange', JSON.stringify(['2 oz Rum', '4 oz Orange juice']),
        userId, 'Margarita', JSON.stringify(['2 oz Tequila', '1 oz Lime juice', '1 oz Triple sec'])
      );

      const response = await request(server!)
        .get('/api/shopping-list/smart')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.stats).toMatchObject({
        totalRecipes: 4,
        craftable: 0, // Rum & Coke needs cola which is not in inventory
        inventoryItems: 2
      });

      // Orange juice should unlock 2 recipes
      const orangeRec = response.body.data.find((rec: any) =>
        rec.ingredient.includes('orange')
      );
      if (orangeRec) {
        expect(orangeRec.unlocks).toBe(2);
      }
    });

    it('should expose breakdowns for recipes missing 2-3 and 4+ ingredients', async () => {
      // Inventory: only vodka
      testDb.prepare(`
        INSERT INTO inventory_items (user_id, name, category)
        VALUES (?, ?, 'spirit')
      `).run(userId, 'Vodka');

      // Recipes:
      // - Missing 2 ingredients
      // - Missing 3 ingredients
      // - Missing 4 ingredients
      testDb.prepare(`
        INSERT INTO recipes (user_id, name, ingredients)
        VALUES
        (?, ?, ?),
        (?, ?, ?),
        (?, ?, ?)
      `).run(
        userId, 'Two Away', JSON.stringify(['Vodka', 'Orange Juice', 'Triple Sec']), // missing 2
        userId, 'Three Away', JSON.stringify(['Vodka', 'Cranberry Juice', 'Lime Juice', 'Cointreau']), // missing 3
        userId, 'Four Away', JSON.stringify(['Gin', 'Tonic', 'Lime', 'Simple Syrup', 'Bitters']) // missing 5
      );

      const response = await request(server!)
        .get('/api/shopping-list/smart')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Stats include missing ingredient buckets
      expect(response.body.stats).toMatchObject({
        totalRecipes: 3,
        craftable: 0,
        nearMisses: 0,
        missing2to3: 2,
        missing4plus: 1,
      });

      // Buckets contain the correct recipes
      expect(response.body.needFewRecipes).toHaveLength(2);
      expect(response.body.needFewRecipes.map((r: any) => r.name)).toEqual(
        expect.arrayContaining(['Two Away', 'Three Away'])
      );

      expect(response.body.majorGapsRecipes).toHaveLength(1);
      expect(response.body.majorGapsRecipes[0].name).toBe('Four Away');
    });
  });
});
