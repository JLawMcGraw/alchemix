# Test Utilities

This directory contains shared test utilities, helpers, and fixtures for the AlcheMix API test suite.

## Files

### `setup.ts`
Core test setup including database creation and cleanup.

**Key Functions:**
- `createTestDatabase()` - Creates an isolated in-memory SQLite database with full schema
- `cleanupTestDatabase(db)` - Cleans up and deletes the test database file
- `testUsers` - Fixture data for test users
- `testBottles` - Fixture data for inventory items (legacy)
- `testRecipes` - Fixture data for recipes

**Usage:**
```typescript
import { createTestDatabase, cleanupTestDatabase } from '../tests/setup';

let testDb: Database.Database;

beforeEach(() => {
  testDb = createTestDatabase();
});

afterEach(() => {
  cleanupTestDatabase(testDb);
});
```

### `helpers.ts`
Helper functions for creating test data and generating tokens.

**Key Functions:**
- `generateTestToken(payload, expiresIn)` - Generate valid JWT token
- `generateExpiredToken(payload)` - Generate expired JWT token
- `generateInvalidToken()` - Generate malformed JWT token
- `createTestUser(db, email, passwordHash)` - Create a test user and return userId + token
- `createTestUsers(db, count)` - Create multiple test users
- `createTestInventoryItems(db, userId, items)` - Bulk create inventory items
- `createTestRecipes(db, userId, recipes)` - Bulk create recipes
- `createTestCollections(db, userId, collections)` - Bulk create collections
- `createTestFavorites(db, userId, favorites)` - Bulk create favorites
- `testData` - Pre-defined test data (spirits, mixers, recipes, collections)
- `wait(ms)` - Helper for rate limit testing
- `paginationQuery(page, limit)` - Generate pagination query strings
- `categoryQuery(category)` - Generate category filter query strings

**Usage:**
```typescript
import { createTestUser, createTestInventoryItems, testData } from '../tests/helpers';

const { userId, authToken } = createTestUser(testDb);
const itemIds = createTestInventoryItems(testDb, userId, testData.spirits);
```

### `assertions.ts`
Custom assertion helpers for API responses.

**Key Functions:**
- `assertPagination(pagination, expected)` - Validate pagination metadata
- `assertSuccessStructure(response, status)` - Validate success response structure
- `assertErrorStructure(response, status)` - Validate error response structure
- `assertArrayItemsHaveProperties(array, properties)` - Validate array items
- `assertUserDataIsolation(items, userId)` - Ensure user data isolation
- `assertAuthenticationError(response)` - Validate 401 authentication errors
- `assertValidationError(response, field?)` - Validate 400 validation errors
- `assertNotFoundError(response)` - Validate 404 not found errors
- `assertCreatedItem(response, expectedProperties)` - Validate 201 created responses
- `assertValidRecipe(recipe)` - Validate recipe structure
- `assertValidInventoryItem(item)` - Validate inventory item structure
- `assertValidCollection(collection, expectRecipeCount)` - Validate collection structure
- `assertValidFavorite(favorite)` - Validate favorite structure
- `assertOneOfStatuses(response, acceptableStatuses)` - Accept multiple status codes
- `assertRateLimitError(response)` - Validate 429 rate limit errors
- `assertSecurityError(response)` - Validate security validation errors

**Usage:**
```typescript
import { assertSuccessStructure, assertPagination, assertValidRecipe } from '../tests/assertions';

const response = await request(server!)
  .get('/api/recipes')
  .set('Authorization', `Bearer ${authToken}`)
  .expect(200);

assertSuccessStructure(response, 200);
assertPagination(response.body.pagination, {
  page: 1,
  limit: 50,
  total: 3,
  totalPages: 1
});
response.body.data.forEach(assertValidRecipe);
```

### `mocks.ts`
Mock implementations for external dependencies.

**Key Functions:**
- `createMockTokenBlacklist()` - Create mock token blacklist
- `createMockAnthropicResponse(text)` - Create mock Anthropic API response
- `createMockAnthropicError(status, errorType)` - Create mock API error
- `createMockRateLimitError()` - Create mock rate limit error
- `setupAxiosMock(mockImplementation?)` - Setup axios mock
- `mockAnthropicSuccess(axios, responseText)` - Mock successful API response
- `mockAnthropicError(axios, status)` - Mock API error
- `mockAnthropicRateLimit(axios)` - Mock rate limit error
- `setupDatabaseMock()` - Setup database mock
- `setupTokenBlacklistMock()` - Setup token blacklist mock
- `suppressConsole()` - Suppress console output during tests
- `mockEnv(envVars)` - Mock environment variables
- `createMockRequest(overrides)` - Create mock Express request
- `createMockResponse()` - Create mock Express response
- `createMockNext()` - Create mock Express next function

**Usage:**
```typescript
import { mockAnthropicSuccess } from '../tests/mocks';
import axios from 'axios';

vi.mock('axios');

it('should handle AI response', async () => {
  mockAnthropicSuccess(axios, 'AI response text');

  const response = await request(server!)
    .post('/api/messages')
    .set('Authorization', `Bearer ${authToken}`)
    .send({ message: 'test question' });

  expect(response.status).toBe(200);
});
```

## Common Patterns

### Basic Route Test Structure

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express, { Express } from 'express';
import { createServer, Server } from 'http';
import request from 'supertest';
import { createTestDatabase, cleanupTestDatabase } from '../tests/setup';
import { createTestUser } from '../tests/helpers';
import Database from 'better-sqlite3';

let testDb: Database.Database;

vi.mock('../database/db', () => ({
  db: {
    prepare: (sql: string) => testDb.prepare(sql),
    pragma: (pragma: string, options?: any) => testDb.pragma(pragma, options),
  },
}));

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

describe('Route Integration Tests', () => {
  let app: Express;
  let server: Server | null = null;
  let userId: number;
  let authToken: string;

  beforeEach(() => {
    testDb = createTestDatabase();
    const user = createTestUser(testDb);
    userId = user.userId;
    authToken = user.authToken;

    app = express();
    app.use(express.json());
    app.use('/api/route', routeHandler);
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

  it('should do something', async () => {
    const response = await request(server!)
      .get('/api/route')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body.success).toBe(true);
  });
});
```

### Testing with Multiple Users

```typescript
import { createTestUsers } from '../tests/helpers';

const users = createTestUsers(testDb, 2);
const [user1, user2] = users;

// user1.userId, user1.authToken
// user2.userId, user2.authToken
```

### Testing with Pre-populated Data

```typescript
import { createTestInventoryItems, testData } from '../tests/helpers';

const itemIds = createTestInventoryItems(testDb, userId, testData.spirits);
// Creates 5 spirit items (Bourbon, Gin, Vodka, Rum, Tequila)
```

### Testing Authentication

```typescript
import { generateExpiredToken, generateInvalidToken } from '../tests/helpers';
import { assertAuthenticationError } from '../tests/assertions';

it('should reject expired tokens', async () => {
  const expiredToken = generateExpiredToken({ userId, email: 'test@example.com' });
  const response = await request(server!)
    .get('/api/route')
    .set('Authorization', `Bearer ${expiredToken}`)
    .expect(401);

  assertAuthenticationError(response);
});
```

### Testing Pagination

```typescript
import { paginationQuery } from '../tests/helpers';
import { assertPagination } from '../tests/assertions';

const response = await request(server!)
  .get(`/api/route${paginationQuery(2, 10)}`)
  .set('Authorization', `Bearer ${authToken}`)
  .expect(200);

assertPagination(response.body.pagination, {
  page: 2,
  limit: 10,
  total: 25,
  totalPages: 3,
  hasNextPage: true,
  hasPreviousPage: true
});
```

## Best Practices

1. **Always use unique database instances** - Each test gets its own database via `createTestDatabase()`
2. **Clean up after tests** - Always call `cleanupTestDatabase()` in `afterEach()`
3. **Use helper functions** - Don't manually create test data when helpers exist
4. **Use custom assertions** - They provide better error messages and reduce boilerplate
5. **Mock external dependencies** - Use mocks for token blacklist, Anthropic API, etc.
6. **Test user isolation** - Always verify users can only access their own data
7. **Test authentication** - Include tests for unauthenticated, expired tokens, invalid tokens
8. **Test validation** - Include tests for missing fields, invalid data, edge cases
9. **Handle rate limits** - For AI endpoints, accept [200, 429, 503] status codes
10. **Close servers properly** - Always close the HTTP server in `afterEach()`
