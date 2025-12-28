/**
 * MemoryService Tests
 *
 * Tests for MemMachine integration service.
 * Uses mocked fetch to avoid actual API calls.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock logger
vi.mock('../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock database module for formatContextForPrompt
vi.mock('../database/db', () => ({
  queryOne: vi.fn(),
  queryAll: vi.fn(),
  execute: vi.fn(),
}));

// Mock ShoppingListService for formatContextForPrompt
vi.mock('./ShoppingListService', () => ({
  shoppingListService: {
    getUserBottles: vi.fn().mockResolvedValue([]),
    isCraftable: vi.fn().mockReturnValue(true),
    findMissingIngredients: vi.fn().mockReturnValue([]),
  },
}));

import { MemoryService } from './MemoryService';
import type { RecipeData, NormalizedSearchResult } from './MemoryService';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Helper to create mock fetch response with both text() and json() methods
function mockResponse(data: object, ok = true) {
  const text = JSON.stringify(data);
  return {
    ok,
    status: ok ? 200 : 500,
    statusText: ok ? 'OK' : 'Error',
    text: async () => text,
    json: async () => data,
  };
}

describe('MemoryService', () => {
  let memoryService: MemoryService;

  beforeEach(() => {
    vi.clearAllMocks();
    memoryService = new MemoryService({
      baseURL: 'http://localhost:8080',
      timeout: 5000,
    });

    // Default successful response
    mockFetch.mockResolvedValue(mockResponse({}));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with provided config', () => {
      const service = new MemoryService({
        baseURL: 'http://test:9000',
        timeout: 10000,
      });

      expect(service).toBeInstanceOf(MemoryService);
    });

    it('should use default timeout if not provided', () => {
      const service = new MemoryService({
        baseURL: 'http://test:9000',
      });

      expect(service).toBeInstanceOf(MemoryService);
    });
  });

  describe('healthCheck', () => {
    it('should return true when service is healthy', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({ status: 'healthy' }));

      const result = await memoryService.healthCheck();

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/v2/health',
        expect.objectContaining({
          method: 'GET',
        })
      );
    });

    it('should return false when service is unhealthy', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({ status: 'unhealthy' }));

      const result = await memoryService.healthCheck();

      expect(result).toBe(false);
    });

    it('should return false on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await memoryService.healthCheck();

      expect(result).toBe(false);
    });

    it('should return false on HTTP error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const result = await memoryService.healthCheck();

      expect(result).toBe(false);
    });
  });

  describe('storeUserRecipe', () => {
    const testRecipe: RecipeData = {
      name: 'Mojito',
      ingredients: ['White rum', 'Lime juice', 'Sugar', 'Mint', 'Soda water'],
      instructions: 'Muddle mint with sugar and lime juice',
      glass: 'Highball',
      category: 'Cocktail',
    };

    it('should store recipe and return UID', async () => {
      // Mock project creation (409 = already exists)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        statusText: 'Conflict',
        text: async () => '',
      });

      // Mock memory storage
      mockFetch.mockResolvedValueOnce(mockResponse({
        results: [{ uid: 'test-uid-123' }],
      }));

      const result = await memoryService.storeUserRecipe(1, testRecipe);

      expect(result).toBe('test-uid-123');
    });

    it('should handle string ingredients', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        statusText: 'Conflict',
      });

      mockFetch.mockResolvedValueOnce(mockResponse({
        results: [{ uid: 'uid-456' }],
      }));

      const recipeWithStringIngredients: RecipeData = {
        name: 'Simple Drink',
        ingredients: 'Vodka, Orange juice',
      };

      const result = await memoryService.storeUserRecipe(1, recipeWithStringIngredients);

      expect(result).toBe('uid-456');
    });

    it('should handle JSON string ingredients', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        statusText: 'Conflict',
      });

      mockFetch.mockResolvedValueOnce(mockResponse({
        results: [{ uid: 'uid-789' }],
      }));

      const recipeWithJsonIngredients: RecipeData = {
        name: 'JSON Drink',
        ingredients: '["Gin", "Tonic"]',
      };

      const result = await memoryService.storeUserRecipe(1, recipeWithJsonIngredients);

      expect(result).toBe('uid-789');
    });

    it('should return null on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        statusText: 'Conflict',
      });

      mockFetch.mockRejectedValueOnce(new Error('API Error'));

      const result = await memoryService.storeUserRecipe(1, testRecipe);

      expect(result).toBeNull();
    });

    it('should return null when no UID in response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        statusText: 'Conflict',
      });

      mockFetch.mockResolvedValueOnce(mockResponse({ results: [] }));

      const result = await memoryService.storeUserRecipe(1, testRecipe);

      expect(result).toBeNull();
    });
  });

  describe('queryUserProfile', () => {
    it('should return normalized search results', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({
        content: {
          episodic_memory: {
            long_term_memory: {
              episodes: [
                { content: 'Recipe: Mojito. Category: Cocktail.', uid: 'uid1' },
              ],
            },
          },
          semantic_memory: [
            { content: 'User prefers citrus cocktails' },
          ],
        },
      }));

      const result = await memoryService.queryUserProfile(1, 'rum cocktails');

      expect(result.episodic).toHaveLength(1);
      expect(result.episodic[0].content).toContain('Mojito');
      expect(result.semantic).toHaveLength(1);
    });

    it('should return empty results for new user (404)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      const result = await memoryService.queryUserProfile(999, 'any query');

      expect(result.episodic).toEqual([]);
      expect(result.semantic).toEqual([]);
    });

    it('should throw on other API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(memoryService.queryUserProfile(1, 'test')).rejects.toThrow(
        'Failed to query user profile'
      );
    });
  });

  describe('deleteUserRecipeByUid', () => {
    it('should delete recipe and return true', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({}));

      const result = await memoryService.deleteUserRecipeByUid(1, 'uid-123', 'Mojito');

      expect(result).toBe(true);
    });

    it('should return true for 404 (already deleted)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      const result = await memoryService.deleteUserRecipeByUid(1, 'uid-123');

      expect(result).toBe(true);
    });

    it('should return false on other errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await memoryService.deleteUserRecipeByUid(1, 'uid-123');

      expect(result).toBe(false);
    });
  });

  describe('deleteAllRecipeMemories', () => {
    it('should delete project and return true', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({}));

      const result = await memoryService.deleteAllRecipeMemories(1);

      expect(result).toBe(true);
    });

    it('should return true for 404 (project not exists)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      const result = await memoryService.deleteAllRecipeMemories(1);

      expect(result).toBe(true);
    });

    it('should return true on 500 (MemMachine returns 500 when project doesnt exist)', async () => {
      // MemMachine returns 500 with "Session is None" when project doesn't exist
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => '',
      });

      const result = await memoryService.deleteAllRecipeMemories(1);

      expect(result).toBe(true); // Treat as success since nothing to delete
    });
  });

  describe('storeConversationTurn', () => {
    it('should store conversation without throwing', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409, // Project already exists
        statusText: 'Conflict',
      });

      mockFetch.mockResolvedValueOnce(mockResponse({}));

      await expect(
        memoryService.storeConversationTurn(1, 'What cocktail should I make?', 'Try a Mojito!')
      ).resolves.not.toThrow();
    });

    it('should not throw on API error (fire-and-forget)', async () => {
      mockFetch.mockRejectedValueOnce(new Error('API Error'));

      await expect(
        memoryService.storeConversationTurn(1, 'Hello', 'Hi!')
      ).resolves.not.toThrow();
    });
  });

  describe('formatContextForPrompt', () => {
    it('should return empty string for empty results', async () => {
      const emptyResult: NormalizedSearchResult = {
        episodic: [],
        semantic: [],
      };

      const result = await memoryService.formatContextForPrompt(emptyResult, 1);

      expect(result).toBe('');
    });

    it('should format episodic memories', async () => {
      const searchResult: NormalizedSearchResult = {
        episodic: [
          { content: 'Recipe: Mojito. Ingredients: Rum, Lime.', uid: 'uid1' },
        ],
        semantic: [],
      };

      const result = await memoryService.formatContextForPrompt(searchResult, 1);

      expect(result).toContain('Mojito');
      expect(result).toContain('SEMANTIC SEARCH RESULTS');
    });

    it('should format semantic memories', async () => {
      const searchResult: NormalizedSearchResult = {
        episodic: [],
        semantic: [
          { content: 'User prefers sweet cocktails' },
        ],
      };

      const result = await memoryService.formatContextForPrompt(searchResult, 1);

      expect(result).toContain('User Preferences');
      expect(result).toContain('sweet cocktails');
    });

    it('should filter already recommended recipes', async () => {
      const searchResult: NormalizedSearchResult = {
        episodic: [
          { content: 'Recipe: Mojito. Category: Cocktail.', uid: 'uid1' },
          { content: 'Recipe: Margarita. Category: Cocktail.', uid: 'uid2' },
        ],
        semantic: [],
      };

      const alreadyRecommended = new Set(['Mojito']);
      const result = await memoryService.formatContextForPrompt(
        searchResult,
        1,
        false, // checkDatabase = false to avoid DB queries
        10,
        alreadyRecommended
      );

      expect(result).toContain('Margarita');
      expect(result).not.toContain('1. Recipe: Mojito');
    });

    it('should limit number of recipes', async () => {
      const searchResult: NormalizedSearchResult = {
        episodic: [
          { content: 'Recipe: Mojito', uid: 'uid1' },
          { content: 'Recipe: Margarita', uid: 'uid2' },
          { content: 'Recipe: Daiquiri', uid: 'uid3' },
        ],
        semantic: [],
      };

      const result = await memoryService.formatContextForPrompt(searchResult, 1, false, 2);

      // Should only include 2 recipes
      const recipeMatches = result.match(/\d\. Recipe:/g);
      expect(recipeMatches?.length || 0).toBeLessThanOrEqual(2);
    });
  });

  describe('storeUserRecipesBatch', () => {
    it('should batch upload recipes', async () => {
      // True batch: all recipes sent in one API call, returns multiple UIDs
      mockFetch.mockResolvedValue(mockResponse({
        results: [{ uid: 'uid-1' }, { uid: 'uid-2' }],
      }));

      const recipes: RecipeData[] = [
        { name: 'Recipe1', ingredients: ['A', 'B'] },
        { name: 'Recipe2', ingredients: ['C', 'D'] },
      ];

      const result = await memoryService.storeUserRecipesBatch(1, recipes);

      expect(result.success).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.uidResults.length).toBe(2);
      expect(result.uidResults[0]).toEqual({ name: 'Recipe1', uid: 'uid-1' });
      expect(result.uidResults[1]).toEqual({ name: 'Recipe2', uid: 'uid-2' });
    });

    it('should preserve UIDs for duplicate recipe names', async () => {
      // Duplicate recipe names should each get their own UID
      mockFetch.mockResolvedValue(mockResponse({
        results: [{ uid: 'uid-1' }, { uid: 'uid-2' }, { uid: 'uid-3' }],
      }));

      const recipes: RecipeData[] = [
        { name: 'Mojito', ingredients: ['Rum', 'Lime'] },
        { name: 'Daiquiri', ingredients: ['Rum', 'Lime', 'Sugar'] },
        { name: 'Mojito', ingredients: ['White Rum', 'Mint'] }, // Duplicate name
      ];

      const result = await memoryService.storeUserRecipesBatch(1, recipes);

      expect(result.success).toBe(3);
      expect(result.failed).toBe(0);
      expect(result.uidResults.length).toBe(3);
      // Each recipe gets its own UID, even with duplicate names
      expect(result.uidResults[0]).toEqual({ name: 'Mojito', uid: 'uid-1' });
      expect(result.uidResults[1]).toEqual({ name: 'Daiquiri', uid: 'uid-2' });
      expect(result.uidResults[2]).toEqual({ name: 'Mojito', uid: 'uid-3' });
    });

    it('should handle batch API failure', async () => {
      // Project creation succeeds, batch upload fails
      mockFetch
        .mockResolvedValueOnce(mockResponse({})) // Project creation
        .mockRejectedValueOnce(new Error('API Error'));

      const recipes: RecipeData[] = [
        { name: 'Recipe1', ingredients: ['A'] },
        { name: 'Recipe2', ingredients: ['B'] },
      ];

      const result = await memoryService.storeUserRecipesBatch(1, recipes);

      // When batch fails, all recipes in that batch fail
      expect(result.success).toBe(0);
      expect(result.failed).toBe(2);
      expect(result.errors.length).toBe(2);
    });
  });

  describe('getEnhancedContext', () => {
    it('should return user context on success', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({
        content: {
          episodic_memory: { long_term_memory: { episodes: [] } },
          semantic_memory: [],
        },
      }));

      const result = await memoryService.getEnhancedContext(1, 'test query');

      expect(result.userContext).not.toBeNull();
    });

    it('should return null userContext on failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('API Error'));

      const result = await memoryService.getEnhancedContext(1, 'test query');

      expect(result.userContext).toBeNull();
    });
  });
});
