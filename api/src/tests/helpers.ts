import jwt from 'jsonwebtoken';
import Database from 'better-sqlite3';

/**
 * Generate a JWT token for testing
 */
export function generateTestToken(payload: { userId: number; email: string }, expiresIn: string = '1h'): string {
  return jwt.sign(payload, process.env.JWT_SECRET || 'test-secret', { expiresIn });
}

/**
 * Generate an expired JWT token for testing
 */
export function generateExpiredToken(payload: { userId: number; email: string }): string {
  return jwt.sign(payload, process.env.JWT_SECRET || 'test-secret', { expiresIn: '-1h' });
}

/**
 * Generate an invalid JWT token (malformed signature)
 */
export function generateInvalidToken(): string {
  return 'invalid.jwt.token';
}

/**
 * Create a test user in the database and return user info with token
 */
export function createTestUser(
  db: Database.Database,
  email: string = 'test@example.com',
  passwordHash: string = 'hashedpassword'
): { userId: number; email: string; authToken: string } {
  const result = db
    .prepare(
      `
    INSERT INTO users (email, password_hash)
    VALUES (?, ?)
  `
    )
    .run(email, passwordHash);

  const userId = result.lastInsertRowid as number;
  const authToken = generateTestToken({ userId, email });

  return { userId, email, authToken };
}

/**
 * Create multiple test users
 */
export function createTestUsers(
  db: Database.Database,
  count: number = 2
): Array<{ userId: number; email: string; authToken: string }> {
  const users = [];
  for (let i = 0; i < count; i++) {
    users.push(createTestUser(db, `user${i}@example.com`, 'hashedpassword'));
  }
  return users;
}

/**
 * Create test inventory items for a user
 */
export function createTestInventoryItems(
  db: Database.Database,
  userId: number,
  items: Array<{ name: string; category: string; type?: string }>
): number[] {
  const ids: number[] = [];

  for (const item of items) {
    const result = db
      .prepare(
        `
      INSERT INTO inventory_items (user_id, name, category, type)
      VALUES (?, ?, ?, ?)
    `
      )
      .run(userId, item.name, item.category, item.type || null);

    ids.push(result.lastInsertRowid as number);
  }

  return ids;
}

/**
 * Create test recipes for a user
 */
export function createTestRecipes(
  db: Database.Database,
  userId: number,
  recipes: Array<{
    name: string;
    ingredients: string[];
    instructions?: string;
    collectionId?: number;
  }>
): number[] {
  const ids: number[] = [];

  for (const recipe of recipes) {
    const result = db
      .prepare(
        `
      INSERT INTO recipes (user_id, collection_id, name, ingredients, instructions)
      VALUES (?, ?, ?, ?, ?)
    `
      )
      .run(
        userId,
        recipe.collectionId || null,
        recipe.name,
        JSON.stringify(recipe.ingredients),
        recipe.instructions || null
      );

    ids.push(result.lastInsertRowid as number);
  }

  return ids;
}

/**
 * Create test collections for a user
 */
export function createTestCollections(
  db: Database.Database,
  userId: number,
  collections: Array<{ name: string; description?: string }>
): number[] {
  const ids: number[] = [];

  for (const collection of collections) {
    const result = db
      .prepare(
        `
      INSERT INTO collections (user_id, name, description)
      VALUES (?, ?, ?)
    `
      )
      .run(userId, collection.name, collection.description || null);

    ids.push(result.lastInsertRowid as number);
  }

  return ids;
}

/**
 * Create test favorites for a user
 */
export function createTestFavorites(
  db: Database.Database,
  userId: number,
  favorites: Array<{ recipeName: string; recipeId?: number }>
): number[] {
  const ids: number[] = [];

  for (const favorite of favorites) {
    const result = db
      .prepare(
        `
      INSERT INTO favorites (user_id, recipe_name, recipe_id)
      VALUES (?, ?, ?)
    `
      )
      .run(userId, favorite.recipeName, favorite.recipeId || null);

    ids.push(result.lastInsertRowid as number);
  }

  return ids;
}

/**
 * Common test data generators
 */
export const testData = {
  spirits: [
    { name: 'Bourbon', category: 'spirit', type: 'Bourbon' },
    { name: 'Gin', category: 'spirit', type: 'Gin' },
    { name: 'Vodka', category: 'spirit', type: 'Vodka' },
    { name: 'Rum', category: 'spirit', type: 'Rum' },
    { name: 'Tequila', category: 'spirit', type: 'Tequila' },
  ],

  mixers: [
    { name: 'Tonic Water', category: 'mixer' },
    { name: 'Club Soda', category: 'mixer' },
    { name: 'Ginger Beer', category: 'mixer' },
    { name: 'Cola', category: 'mixer' },
  ],

  recipes: [
    {
      name: 'Old Fashioned',
      ingredients: ['2 oz Bourbon', 'Sugar cube', '2 dashes Angostura bitters', 'Orange peel'],
      instructions: 'Muddle sugar and bitters, add bourbon and ice, stir, garnish with orange peel',
    },
    {
      name: 'Gin and Tonic',
      ingredients: ['2 oz Gin', '4 oz Tonic Water', 'Lime wedge'],
      instructions: 'Build in glass with ice, garnish with lime',
    },
    {
      name: 'Moscow Mule',
      ingredients: ['2 oz Vodka', '4 oz Ginger Beer', 'Lime juice'],
      instructions: 'Build in copper mug with ice, garnish with lime',
    },
  ],

  collections: [
    { name: 'Classic Cocktails', description: 'Timeless recipes every bartender should know' },
    { name: 'Tiki Drinks', description: 'Tropical rum-based cocktails' },
    { name: 'Whiskey Cocktails', description: 'Bourbon and rye-based drinks' },
  ],
};

/**
 * Assert helper for checking error responses
 */
export function assertErrorResponse(response: any, expectedStatus: number, errorMessageContains?: string) {
  if (response.status !== expectedStatus) {
    throw new Error(
      `Expected status ${expectedStatus} but got ${response.status}. Body: ${JSON.stringify(response.body)}`
    );
  }

  if (response.body.success !== false) {
    throw new Error(`Expected success to be false. Body: ${JSON.stringify(response.body)}`);
  }

  if (errorMessageContains && !response.body.error?.includes(errorMessageContains)) {
    throw new Error(
      `Expected error message to contain "${errorMessageContains}" but got "${response.body.error}"`
    );
  }
}

/**
 * Assert helper for checking success responses
 */
export function assertSuccessResponse(response: any, expectedStatus: number = 200) {
  if (response.status !== expectedStatus) {
    throw new Error(
      `Expected status ${expectedStatus} but got ${response.status}. Body: ${JSON.stringify(response.body)}`
    );
  }

  if (response.body.success !== true) {
    throw new Error(`Expected success to be true. Body: ${JSON.stringify(response.body)}`);
  }
}

/**
 * Wait for a specific amount of time (for rate limiting tests)
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate pagination query string
 */
export function paginationQuery(page: number, limit: number): string {
  return `?page=${page}&limit=${limit}`;
}

/**
 * Generate category filter query string
 */
export function categoryQuery(category: string): string {
  return `?category=${category}`;
}
