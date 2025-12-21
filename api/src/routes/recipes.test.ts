/**
 * Recipes Routes Tests
 *
 * Tests for user recipe CRUD operations.
 * Updated for PostgreSQL - mocks RecipeService layer.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock RecipeService
vi.mock('../services/RecipeService', () => ({
  recipeService: {
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    bulkDelete: vi.fn(),
    deleteAll: vi.fn(),
    sanitizeCreateInput: vi.fn(),
    validateCollection: vi.fn(),
    importFromCSV: vi.fn(),
    syncMemMachine: vi.fn(),
    clearMemMachine: vi.fn(),
    seedClassics: vi.fn(),
  },
}));

// Mock the auth middleware to bypass JWT verification
vi.mock('../middleware/auth', () => ({
  authMiddleware: vi.fn((req: any, _res: any, next: any) => {
    req.user = { userId: 1, email: 'test@example.com' };
    next();
  }),
  generateToken: vi.fn(() => 'mock-token'),
  generateTokenId: vi.fn(() => 'mock-jti'),
}));

// Mock token blacklist
vi.mock('../utils/tokenBlacklist', () => ({
  tokenBlacklist: {
    isBlacklisted: vi.fn().mockResolvedValue(false),
    add: vi.fn(),
  },
}));

// Mock MemoryService
vi.mock('../services/MemoryService', () => ({
  memoryService: {
    deleteUserRecipeByUid: vi.fn().mockResolvedValue(undefined),
    storeUserRecipe: vi.fn().mockResolvedValue('mock-uid'),
    isEnabled: vi.fn().mockReturnValue(true),
  },
}));

// Mock logger
vi.mock('../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  logSecurityEvent: vi.fn(),
}));

import { recipeService } from '../services/RecipeService';

// Helper to create mock recipe
const createMockRecipe = (overrides: Partial<{
  id: number;
  user_id: number;
  name: string;
  ingredients: string[];
  instructions: string;
  glass: string;
  category: string;
  memmachine_uid: string | null;
  created_at: string;
  updated_at: string;
}> = {}) => ({
  id: 1,
  user_id: 1,
  name: 'Test Recipe',
  ingredients: ['2 oz Spirit', '1 oz Citrus'],
  instructions: 'Shake and strain',
  glass: 'Coupe',
  category: 'Cocktail',
  memmachine_uid: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

describe('Recipes Routes', () => {
  let app: express.Application;
  const testUserId = 1;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Default mock implementations
    (recipeService.getAll as ReturnType<typeof vi.fn>).mockResolvedValue({
      items: [],
      pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
    });
    (recipeService.create as ReturnType<typeof vi.fn>).mockResolvedValue(createMockRecipe());
    (recipeService.update as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true, recipe: createMockRecipe() });
    (recipeService.delete as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
    (recipeService.bulkDelete as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    (recipeService.deleteAll as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    (recipeService.sanitizeCreateInput as ReturnType<typeof vi.fn>).mockResolvedValue({ valid: true, data: {} });

    // Create fresh app with routes
    app = express();
    app.use(express.json());

    // Import routes fresh (auth is already mocked)
    const { default: recipesRouter } = await import('./recipes');
    app.use('/api/recipes', recipesRouter);

    // Add error handler
    app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      res.status(500).json({ success: false, error: err.message });
    });
  });

  describe('GET /api/recipes', () => {
    it('should return empty list when user has no recipes', async () => {
      (recipeService.getAll as ReturnType<typeof vi.fn>).mockResolvedValue({
        items: [],
        pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
      });

      const res = await request(app).get('/api/recipes');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
      expect(res.body.pagination).toMatchObject({
        page: 1,
        limit: 50,
        total: 0,
        totalPages: 0,
      });
    });

    it('should return user recipes with pagination', async () => {
      const mockRecipes = [
        createMockRecipe({ id: 1, name: 'Old Fashioned' }),
        createMockRecipe({ id: 2, name: 'Martini' }),
        createMockRecipe({ id: 3, name: 'Negroni' }),
      ];

      (recipeService.getAll as ReturnType<typeof vi.fn>).mockResolvedValue({
        items: mockRecipes,
        pagination: { page: 1, limit: 50, total: 3, totalPages: 1 },
      });

      const res = await request(app).get('/api/recipes');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(3);
      expect(res.body.pagination).toMatchObject({
        page: 1,
        limit: 50,
        total: 3,
        totalPages: 1,
      });
    });

    it('should support custom pagination limits', async () => {
      const mockRecipes = Array.from({ length: 5 }, (_, i) =>
        createMockRecipe({ id: i + 1, name: `Recipe ${i + 1}` })
      );

      (recipeService.getAll as ReturnType<typeof vi.fn>).mockResolvedValue({
        items: mockRecipes,
        pagination: { page: 1, limit: 5, total: 10, totalPages: 2 },
      });

      const res = await request(app).get('/api/recipes?limit=5');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(5);
      expect(res.body.pagination).toMatchObject({
        page: 1,
        limit: 5,
        total: 10,
        totalPages: 2,
      });
    });

    it('should support page parameter', async () => {
      (recipeService.getAll as ReturnType<typeof vi.fn>).mockResolvedValue({
        items: [],
        pagination: { page: 2, limit: 50, total: 100, totalPages: 2 },
      });

      const res = await request(app).get('/api/recipes?page=2');

      expect(res.status).toBe(200);
      expect(res.body.pagination.page).toBe(2);
    });

    it('should return recipes with parsed ingredients', async () => {
      const mockRecipe = createMockRecipe({
        name: 'Margarita',
        ingredients: ['2 oz Tequila', '1 oz Lime juice', '1 oz Triple sec'],
      });

      (recipeService.getAll as ReturnType<typeof vi.fn>).mockResolvedValue({
        items: [mockRecipe],
        pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
      });

      const res = await request(app).get('/api/recipes');

      expect(res.status).toBe(200);
      expect(res.body.data[0].ingredients).toEqual(['2 oz Tequila', '1 oz Lime juice', '1 oz Triple sec']);
    });
  });

  describe('POST /api/recipes', () => {
    it('should create a new recipe with required fields', async () => {
      const newRecipe = createMockRecipe({
        id: 1,
        name: 'Mojito',
        ingredients: ['2 oz Rum', '1 oz Lime juice', 'Mint leaves'],
        instructions: 'Muddle mint with lime juice',
      });

      (recipeService.sanitizeCreateInput as ReturnType<typeof vi.fn>).mockResolvedValue({
        valid: true,
        data: {
          name: 'Mojito',
          ingredients: ['2 oz Rum', '1 oz Lime juice', 'Mint leaves'],
          instructions: 'Muddle mint with lime juice',
        },
      });
      (recipeService.create as ReturnType<typeof vi.fn>).mockResolvedValue(newRecipe);

      const res = await request(app)
        .post('/api/recipes')
        .send({
          name: 'Mojito',
          ingredients: ['2 oz Rum', '1 oz Lime juice', 'Mint leaves'],
          instructions: 'Muddle mint with lime juice',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Mojito');
      expect(res.body.data.id).toBe(1);
    });

    it('should create recipe with optional fields', async () => {
      const newRecipe = createMockRecipe({
        id: 1,
        name: 'Manhattan',
        glass: 'Coupe',
        category: 'Classic',
      });

      (recipeService.sanitizeCreateInput as ReturnType<typeof vi.fn>).mockResolvedValue({
        valid: true,
        data: {
          name: 'Manhattan',
          ingredients: ['2 oz Rye'],
          instructions: 'Stir',
          glass: 'Coupe',
          category: 'Classic',
        },
      });
      (recipeService.create as ReturnType<typeof vi.fn>).mockResolvedValue(newRecipe);

      const res = await request(app)
        .post('/api/recipes')
        .send({
          name: 'Manhattan',
          ingredients: ['2 oz Rye'],
          instructions: 'Stir',
          glass: 'Coupe',
          category: 'Classic',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.glass).toBe('Coupe');
      expect(res.body.data.category).toBe('Classic');
    });

    it('should reject missing name field', async () => {
      (recipeService.sanitizeCreateInput as ReturnType<typeof vi.fn>).mockResolvedValue({
        valid: false,
        error: 'Recipe name is required',
      });

      const res = await request(app)
        .post('/api/recipes')
        .send({
          ingredients: ['Ingredient'],
          instructions: 'Instructions',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('PUT /api/recipes/:id', () => {
    it('should update recipe fields', async () => {
      const updatedRecipe = createMockRecipe({
        id: 1,
        name: 'Updated Recipe',
        instructions: 'New instructions',
        glass: 'Highball',
      });

      (recipeService.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        recipe: updatedRecipe,
      });

      const res = await request(app)
        .put('/api/recipes/1')
        .send({
          name: 'Updated Recipe',
          instructions: 'New instructions',
          glass: 'Highball',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Updated Recipe');
    });

    it('should return 404 for non-existent recipe', async () => {
      (recipeService.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        error: 'Recipe not found or access denied',
      });

      const res = await request(app)
        .put('/api/recipes/99999')
        .send({ name: 'Updated Recipe' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 for invalid recipe ID', async () => {
      const res = await request(app)
        .put('/api/recipes/invalid')
        .send({ name: 'Updated' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Invalid recipe ID');
    });
  });

  describe('DELETE /api/recipes/:id', () => {
    it('should delete recipe', async () => {
      (recipeService.delete as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
      });

      const res = await request(app).delete('/api/recipes/1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 404 for non-existent recipe', async () => {
      (recipeService.delete as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        error: 'Recipe not found or access denied',
      });

      const res = await request(app).delete('/api/recipes/99999');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 for invalid recipe ID', async () => {
      const res = await request(app).delete('/api/recipes/invalid');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Invalid recipe ID');
    });
  });

  describe('DELETE /api/recipes/bulk', () => {
    it('should delete multiple recipes', async () => {
      (recipeService.bulkDelete as ReturnType<typeof vi.fn>).mockResolvedValue(3);

      const res = await request(app)
        .delete('/api/recipes/bulk')
        .send({ ids: [1, 2, 3] });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.deleted).toBe(3);
    });

    it('should return 400 for missing ids array', async () => {
      const res = await request(app)
        .delete('/api/recipes/bulk')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('ids array is required');
    });

    it('should return 400 for empty ids array', async () => {
      const res = await request(app)
        .delete('/api/recipes/bulk')
        .send({ ids: [] });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject more than 500 IDs', async () => {
      const largeIds = Array.from({ length: 501 }, (_, i) => i + 1);

      const res = await request(app)
        .delete('/api/recipes/bulk')
        .send({ ids: largeIds });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('maximum 500');
    });

    it('should only delete valid recipe IDs', async () => {
      (recipeService.bulkDelete as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      const res = await request(app)
        .delete('/api/recipes/bulk')
        .send({ ids: [1, 99999] });

      expect(res.status).toBe(200);
      expect(res.body.deleted).toBe(1);
    });
  });

  describe('DELETE /api/recipes/all', () => {
    it('should delete all user recipes', async () => {
      (recipeService.deleteAll as ReturnType<typeof vi.fn>).mockResolvedValue(5);

      const res = await request(app).delete('/api/recipes/all');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.deleted).toBe(5);
      expect(res.body.message).toContain('5 recipes');
    });

    it('should return 0 when user has no recipes', async () => {
      (recipeService.deleteAll as ReturnType<typeof vi.fn>).mockResolvedValue(0);

      const res = await request(app).delete('/api/recipes/all');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.deleted).toBe(0);
    });
  });

  describe('MemMachine Integration', () => {
    describe('POST /api/recipes/memmachine/sync', () => {
      it('should sync recipes to MemMachine', async () => {
        (recipeService.syncMemMachine as ReturnType<typeof vi.fn>).mockResolvedValue({
          uploaded: 5,
          skipped: 0,
          errors: [],
        });

        const res = await request(app).post('/api/recipes/memmachine/sync');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toContain('5 recipes uploaded');
      });

      it('should handle sync errors', async () => {
        (recipeService.syncMemMachine as ReturnType<typeof vi.fn>).mockRejectedValue(
          new Error('MemMachine service unavailable')
        );

        const res = await request(app).post('/api/recipes/memmachine/sync');

        expect(res.status).toBe(500);
        expect(res.body.success).toBe(false);
        expect(res.body.error).toContain('MemMachine');
      });
    });

    describe('DELETE /api/recipes/memmachine/clear', () => {
      it('should clear MemMachine memories', async () => {
        (recipeService.clearMemMachine as ReturnType<typeof vi.fn>).mockResolvedValue(true);

        const res = await request(app).delete('/api/recipes/memmachine/clear');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toContain('Cleared');
      });

      it('should handle clear failure', async () => {
        (recipeService.clearMemMachine as ReturnType<typeof vi.fn>).mockResolvedValue(false);

        const res = await request(app).delete('/api/recipes/memmachine/clear');

        expect(res.status).toBe(500);
        expect(res.body.success).toBe(false);
      });
    });
  });

  describe('memmachine_uid tracking', () => {
    it('should return memmachine_uid in GET response', async () => {
      const mockRecipe = createMockRecipe({
        id: 1,
        name: 'UUID Recipe',
        memmachine_uid: 'test-uid-123',
      });

      (recipeService.getAll as ReturnType<typeof vi.fn>).mockResolvedValue({
        items: [mockRecipe],
        pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
      });

      const res = await request(app).get('/api/recipes');

      expect(res.status).toBe(200);
      expect(res.body.data[0].memmachine_uid).toBe('test-uid-123');
    });

    it('should allow recipe without memmachine_uid', async () => {
      const mockRecipe = createMockRecipe({
        id: 1,
        name: 'No UUID Recipe',
        memmachine_uid: null,
      });

      (recipeService.getAll as ReturnType<typeof vi.fn>).mockResolvedValue({
        items: [mockRecipe],
        pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
      });

      const res = await request(app).get('/api/recipes');

      expect(res.status).toBe(200);
      expect(res.body.data[0].memmachine_uid).toBeNull();
    });
  });

  describe('POST /api/recipes/seed-classics', () => {
    it('should seed classic recipes for first-time user', async () => {
      (recipeService.seedClassics as ReturnType<typeof vi.fn>).mockResolvedValue({
        seeded: true,
        count: 20,
      });

      const res = await request(app).post('/api/recipes/seed-classics');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.seeded).toBe(true);
      expect(res.body.count).toBe(20);
      expect(res.body.message).toContain('20 classic cocktail recipes');
      expect(recipeService.seedClassics).toHaveBeenCalledWith(testUserId);
    });

    it('should return seeded: false if already seeded', async () => {
      (recipeService.seedClassics as ReturnType<typeof vi.fn>).mockResolvedValue({
        seeded: false,
        count: 0,
      });

      const res = await request(app).post('/api/recipes/seed-classics');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.seeded).toBe(false);
      expect(res.body.count).toBe(0);
      expect(res.body.message).toBe('Classic recipes already added');
    });

    it('should handle service errors gracefully', async () => {
      (recipeService.seedClassics as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Database error')
      );

      const res = await request(app).post('/api/recipes/seed-classics');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });
});
