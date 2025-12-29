import { expect } from 'vitest';

/**
 * Custom assertions for API responses
 */

/**
 * Assert that response contains proper pagination metadata
 */
export function assertPagination(
  pagination: any,
  expected: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage?: boolean;
    hasPreviousPage?: boolean;
  }
) {
  expect(pagination).toBeDefined();
  expect(pagination.page).toBe(expected.page);
  expect(pagination.limit).toBe(expected.limit);
  expect(pagination.total).toBe(expected.total);
  expect(pagination.totalPages).toBe(expected.totalPages);

  if (expected.hasNextPage !== undefined) {
    expect(pagination.hasNextPage).toBe(expected.hasNextPage);
  }

  if (expected.hasPreviousPage !== undefined) {
    expect(pagination.hasPreviousPage).toBe(expected.hasPreviousPage);
  }
}

/**
 * Assert that response has standard success structure
 */
export function assertSuccessStructure(response: any, expectedStatus: number = 200) {
  expect(response.status).toBe(expectedStatus);
  expect(response.body).toHaveProperty('success', true);
  expect(response.body).toHaveProperty('data');
}

/**
 * Assert that response has standard error structure
 */
export function assertErrorStructure(response: any, expectedStatus: number) {
  expect(response.status).toBe(expectedStatus);
  expect(response.body).toHaveProperty('success', false);
  expect(response.body).toHaveProperty('error');
  expect(typeof response.body.error).toBe('string');
}

/**
 * Assert that an array contains specific properties on all items
 */
export function assertArrayItemsHaveProperties(array: any[], properties: string[]) {
  expect(Array.isArray(array)).toBe(true);
  array.forEach((item) => {
    properties.forEach((prop) => {
      expect(item).toHaveProperty(prop);
    });
  });
}

/**
 * Assert that user data is properly isolated (items belong to correct user)
 */
export function assertUserDataIsolation(items: any[], userId: number) {
  expect(Array.isArray(items)).toBe(true);
  items.forEach((item) => {
    expect(item.user_id).toBe(userId);
  });
}

/**
 * Assert that response is an authentication error
 */
export function assertAuthenticationError(response: any) {
  assertErrorStructure(response, 401);
  expect(response.body.error).toMatch(/authorization|token|authenticated/i);
}

/**
 * Assert that response is a validation error
 */
export function assertValidationError(response: any, field?: string) {
  assertErrorStructure(response, 400);
  if (field) {
    expect(response.body.error.toLowerCase()).toContain(field.toLowerCase());
  }
}

/**
 * Assert that response is a not found error
 */
export function assertNotFoundError(response: any) {
  assertErrorStructure(response, 404);
}

/**
 * Assert that an item was created with expected properties
 */
export function assertCreatedItem(response: any, expectedProperties: Record<string, any>) {
  assertSuccessStructure(response, 201);
  expect(response.body.data).toMatchObject(expectedProperties);
  expect(response.body.data.id).toBeGreaterThan(0);
  expect(response.body.data.created_at).toBeDefined();
}

/**
 * Assert that an item was updated successfully
 */
export function assertUpdatedItem(response: any) {
  assertSuccessStructure(response, 200);
}

/**
 * Assert that an item was deleted successfully
 */
export function assertDeletedItem(response: any) {
  assertSuccessStructure(response, 200);
}

/**
 * Assert that a recipe has valid structure
 */
export function assertValidRecipe(recipe: any) {
  expect(recipe).toHaveProperty('id');
  expect(recipe).toHaveProperty('user_id');
  expect(recipe).toHaveProperty('name');
  expect(recipe).toHaveProperty('ingredients');
  expect(recipe).toHaveProperty('created_at');

  // Ingredients should be a JSON array
  expect(typeof recipe.ingredients).toBe('string');
  const parsed = JSON.parse(recipe.ingredients);
  expect(Array.isArray(parsed)).toBe(true);
}

/**
 * Assert that an inventory item has valid structure
 */
export function assertValidInventoryItem(item: any) {
  expect(item).toHaveProperty('id');
  expect(item).toHaveProperty('user_id');
  expect(item).toHaveProperty('name');
  expect(item).toHaveProperty('category');
  expect(item).toHaveProperty('created_at');

  // Category should be one of valid values
  const validCategories = ['spirit', 'liqueur', 'wine', 'beer', 'bitters', 'mixer', 'syrup', 'garnish', 'pantry'];
  expect(validCategories).toContain(item.category);
}

/**
 * Assert that a collection has valid structure
 */
export function assertValidCollection(collection: any, expectRecipeCount: boolean = false) {
  expect(collection).toHaveProperty('id');
  expect(collection).toHaveProperty('user_id');
  expect(collection).toHaveProperty('name');
  expect(collection).toHaveProperty('created_at');

  if (expectRecipeCount) {
    expect(collection).toHaveProperty('recipe_count');
    expect(typeof collection.recipe_count).toBe('number');
  }
}

/**
 * Assert that a favorite has valid structure
 */
export function assertValidFavorite(favorite: any) {
  expect(favorite).toHaveProperty('id');
  expect(favorite).toHaveProperty('user_id');
  expect(favorite).toHaveProperty('recipe_name');
  expect(favorite).toHaveProperty('created_at');
}

/**
 * Assert that response contains one of the acceptable status codes
 */
export function assertOneOfStatuses(response: any, acceptableStatuses: number[]) {
  expect(acceptableStatuses).toContain(response.status);
}

/**
 * Assert rate limit error
 */
export function assertRateLimitError(response: any) {
  expect(response.status).toBe(429);
  expect(response.body.success).toBe(false);
  expect(response.body.error).toMatch(/rate limit|too many requests/i);
}

/**
 * Assert security validation error (prompt injection, XSS, SQL injection)
 */
export function assertSecurityError(response: any) {
  expect(response.status).toBe(400);
  expect(response.body.success).toBe(false);
  expect(response.body.error).toBeTruthy();
  expect(response.body.error).toMatch(/prohibited|injection|invalid/i);
}
