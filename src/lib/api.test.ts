import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Use vi.hoisted to ensure mocks are set up before module import
const { mockAxiosInstance } = vi.hoisted(() => {
  const instance: any = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    _requestInterceptor: null,
    _responseInterceptor: null,
  };

  instance.interceptors = {
    request: {
      use: vi.fn((onFulfilled) => {
        instance._requestInterceptor = onFulfilled;
        return 0;
      }),
    },
    response: {
      use: vi.fn((onFulfilled, onRejected) => {
        instance._responseInterceptor = { onFulfilled, onRejected };
        return 0;
      }),
    },
  };

  return { mockAxiosInstance: instance };
});

vi.mock('axios', () => ({
  default: {
    create: () => mockAxiosInstance,
  },
}));

// Now import api after mocking
import { authApi, inventoryApi, recipeApi, favoritesApi, aiApi } from './api';

describe('API Client', () => {
  beforeEach(() => {
    // Clear mock calls
    vi.clearAllMocks();

    // Mock localStorage
    const localStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };
    global.localStorage = localStorageMock as any;

    // Mock window.location
    delete (window as any).location;
    window.location = { href: '', pathname: '' } as any;
  });

  describe('Request Interceptor', () => {
    it('should add Authorization header when token exists', async () => {
      // Setup
      const token = 'test-token-123';
      (localStorage.getItem as any).mockReturnValue(token);

      // Trigger interceptor
      const config = { headers: {} };
      const interceptor = mockAxiosInstance._requestInterceptor;
      const result = interceptor(config);

      expect(result.headers.Authorization).toBe(`Bearer ${token}`);
    });

    it('should not add Authorization header when token does not exist', () => {
      (localStorage.getItem as any).mockReturnValue(null);

      const config = { headers: {} };
      const interceptor = mockAxiosInstance._requestInterceptor;
      const result = interceptor(config);

      expect(result.headers.Authorization).toBeUndefined();
    });

    it('should handle missing headers object', () => {
      const token = 'test-token-123';
      (localStorage.getItem as any).mockReturnValue(token);

      const config = {};
      const interceptor = mockAxiosInstance._requestInterceptor;
      const result = interceptor(config);

      // Should not crash
      expect(result).toBeDefined();
    });
  });

  describe('Response Interceptor', () => {
    it('should clear localStorage and redirect on 401 error', async () => {
      const error = {
        response: {
          status: 401,
        },
      };

      window.location.pathname = '/dashboard';

      const interceptor = mockAxiosInstance._responseInterceptor.onRejected;

      try {
        await interceptor(error);
      } catch (e) {
        // Expected to reject
      }

      expect(localStorage.removeItem).toHaveBeenCalledWith('token');
      expect(localStorage.removeItem).toHaveBeenCalledWith('user');
      expect(localStorage.removeItem).toHaveBeenCalledWith('alchemix-storage');
      expect(window.location.href).toBe('/login');
    });

    it('should not redirect if already on login page', async () => {
      const error = {
        response: {
          status: 401,
        },
      };

      window.location.pathname = '/login';

      const interceptor = mockAxiosInstance._responseInterceptor.onRejected;

      try {
        await interceptor(error);
      } catch (e) {
        // Expected to reject
      }

      expect(window.location.href).toBe('');
    });

    it('should not handle non-401 errors specially', async () => {
      const error = {
        response: {
          status: 500,
        },
      };

      const interceptor = mockAxiosInstance._responseInterceptor.onRejected;

      await expect(interceptor(error)).rejects.toEqual(error);
      expect(localStorage.removeItem).not.toHaveBeenCalled();
    });

    it('should pass through successful responses', () => {
      const response = { data: { success: true } };
      const interceptor = mockAxiosInstance._responseInterceptor.onFulfilled;

      expect(interceptor(response)).toBe(response);
    });
  });

  describe('authApi', () => {
    it('should login with credentials', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'SecurePassword123!',
      };

      const mockResponse = {
        data: {
          success: true,
          data: {
            token: 'jwt-token',
            user: { id: 1, email: 'test@example.com' },
          },
        },
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await authApi.login(credentials);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/auth/login', credentials);
      expect(result).toEqual(mockResponse.data.data);
    });

    it('should signup with credentials', async () => {
      const credentials = {
        email: 'newuser@example.com',
        password: 'SecurePassword123!',
      };

      const mockResponse = {
        data: {
          success: true,
          data: {
            token: 'jwt-token',
            user: { id: 2, email: 'newuser@example.com' },
          },
        },
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await authApi.signup(credentials);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/auth/signup', credentials);
      expect(result).toEqual(mockResponse.data.data);
    });

    it('should fetch current user', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            id: 1,
            email: 'test@example.com',
          },
        },
      };

      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const result = await authApi.me();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/auth/me');
      expect(result).toEqual(mockResponse.data.data);
    });

    it('should logout', async () => {
      mockAxiosInstance.post.mockResolvedValue({});

      await authApi.logout();

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/auth/logout');
    });
  });

  describe('inventoryApi', () => {
    it('should fetch inventory items with pagination metadata', async () => {
      const mockItems = [
        { id: 1, name: 'Bottle 1', category: 'spirit' },
        { id: 2, name: 'Bottle 2', category: 'spirit' },
      ];

      const mockResponse = {
        data: {
          success: true,
          data: mockItems,
          pagination: {
            page: 1,
            limit: 50,
            total: 2,
            totalPages: 1,
            hasNextPage: false,
            hasPreviousPage: false,
          },
        },
      };

      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const result = await inventoryApi.getAll({ category: 'spirit', page: 1, limit: 50 });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/inventory-items?category=spirit&page=1&limit=50');
      expect(result).toEqual({
        items: mockItems,
        pagination: mockResponse.data.pagination,
      });
    });

    it('should add a bottle', async () => {
      const newBottle = {
        name: 'New Bottle',
        category: 'spirit',
        subcategory: 'Gin',
        quantity: 750,
      };

      const mockResponse = {
        data: {
          success: true,
          data: { id: 3, ...newBottle },
        },
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await inventoryApi.add(newBottle as any);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/inventory-items', newBottle);
      expect(result).toEqual(mockResponse.data.data);
    });

    it('should update a bottle', async () => {
      const bottleId = 1;
      const updates = { abv: '40' };

      const mockResponse = {
        data: {
          success: true,
          data: { id: bottleId, name: 'Gin', category: 'spirit', abv: '40' },
        },
      };

      mockAxiosInstance.put.mockResolvedValue(mockResponse);

      const result = await inventoryApi.update(bottleId, updates);

      expect(mockAxiosInstance.put).toHaveBeenCalledWith(`/api/inventory-items/${bottleId}`, updates);
      expect(result).toEqual(mockResponse.data.data);
    });

    it('should delete a bottle', async () => {
      const bottleId = 1;

      mockAxiosInstance.delete.mockResolvedValue({});

      await inventoryApi.delete(bottleId);

      expect(mockAxiosInstance.delete).toHaveBeenCalledWith(`/api/inventory-items/${bottleId}`);
    });

    it('should import CSV file', async () => {
      const file = new File(['content'], 'bottles.csv', { type: 'text/csv' });

      const mockResponse = {
        data: { count: 5 },
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await inventoryApi.importCSV(file);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/inventory-items/import',
        expect.any(FormData),
        expect.objectContaining({
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        })
      );
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('recipeApi', () => {
    it('should fetch all recipes', async () => {
      const mockRecipes = [
        { id: 1, name: 'Martini', ingredients: 'Gin, Vermouth' },
        { id: 2, name: 'Negroni', ingredients: 'Gin, Campari, Vermouth' },
      ];

      const mockResponse = {
        data: {
          success: true,
          data: mockRecipes,
          pagination: {
            page: 1,
            limit: 50,
            total: 2,
            totalPages: 1,
            hasNextPage: false,
            hasPreviousPage: false,
          },
        },
      };

      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const result = await recipeApi.getAll();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/recipes?page=1&limit=50');
      expect(result).toEqual({
        recipes: mockRecipes,
        pagination: mockResponse.data.pagination,
      });
    });

    it('should add a recipe', async () => {
      const newRecipe = {
        name: 'Manhattan',
        ingredients: 'Whiskey, Sweet Vermouth, Bitters',
        instructions: 'Stir and strain',
      };

      const mockResponse = {
        data: {
          success: true,
          data: { id: 3, ...newRecipe },
        },
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await recipeApi.add(newRecipe as any);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/recipes', newRecipe);
      expect(result).toEqual(mockResponse.data.data);
    });

    it('should import CSV file', async () => {
      const file = new File(['content'], 'recipes.csv', { type: 'text/csv' });

      const mockResponse = {
        data: { success: true, imported: 10, failed: 0, errors: [] },
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await recipeApi.importCSV(file);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/recipes/import',
        expect.any(FormData),
        expect.objectContaining({
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        })
      );
      expect(result).toEqual({
        imported: mockResponse.data.imported,
        failed: mockResponse.data.failed,
        errors: mockResponse.data.errors,
      });
    });
  });

  describe('favoritesApi', () => {
    it('should fetch all favorites', async () => {
      const mockFavorites = [
        { id: 1, recipe_id: 1, recipe_name: 'Martini' },
        { id: 2, recipe_id: 2, recipe_name: 'Negroni' },
      ];

      const mockResponse = {
        data: {
          success: true,
          data: mockFavorites,
        },
      };

      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const result = await favoritesApi.getAll();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/favorites');
      expect(result).toEqual(mockFavorites);
    });

    it('should add a favorite with recipe ID', async () => {
      const recipeName = 'Manhattan';
      const recipeId = 3;

      const mockResponse = {
        data: {
          success: true,
          data: { id: 3, recipe_id: recipeId, recipe_name: recipeName },
        },
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await favoritesApi.add(recipeName, recipeId);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/favorites', {
        recipe_name: recipeName,
        recipe_id: recipeId,
      });
      expect(result).toEqual(mockResponse.data.data);
    });

    it('should add a favorite without recipe ID', async () => {
      const recipeName = 'Old Fashioned';

      const mockResponse = {
        data: {
          success: true,
          data: { id: 4, recipe_name: recipeName },
        },
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await favoritesApi.add(recipeName);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/favorites', {
        recipe_name: recipeName,
        recipe_id: undefined,
      });
      expect(result).toEqual(mockResponse.data.data);
    });

    it('should remove a favorite', async () => {
      const favoriteId = 1;

      mockAxiosInstance.delete.mockResolvedValue({});

      await favoritesApi.remove(favoriteId);

      expect(mockAxiosInstance.delete).toHaveBeenCalledWith(`/api/favorites/${favoriteId}`);
    });
  });

  describe('aiApi', () => {
    it('should send a message and return response', async () => {
      const message = 'What cocktails can I make?';
      const conversationHistory = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
      ];

      const mockResponse = {
        data: {
          success: true,
          data: {
            message: 'You can make a Martini!',
          },
        },
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await aiApi.sendMessage(message, conversationHistory);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/messages', {
        message,
        history: conversationHistory,
      });
      expect(result).toBe('You can make a Martini!');
    });

    it('should handle empty conversation history', async () => {
      const message = 'Hello';
      const conversationHistory: any[] = [];

      const mockResponse = {
        data: {
          success: true,
          data: {
            message: 'Hello! How can I help?',
          },
        },
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await aiApi.sendMessage(message, conversationHistory);

      expect(result).toBe('Hello! How can I help?');
    });
  });

  describe('Error Handling', () => {
    it('should propagate API errors', async () => {
      const error = new Error('Network error');
      mockAxiosInstance.get.mockRejectedValue(error);

      await expect(inventoryApi.getAll()).rejects.toThrow('Network error');
    });

    it('should handle 404 errors', async () => {
      const error = {
        response: {
          status: 404,
          data: { error: 'Not found' },
        },
      };
      mockAxiosInstance.get.mockRejectedValue(error);

      await expect(recipeApi.getAll()).rejects.toEqual(error);
    });

    it('should handle 500 errors', async () => {
      const error = {
        response: {
          status: 500,
          data: { error: 'Internal server error' },
        },
      };
      mockAxiosInstance.post.mockRejectedValue(error);

      await expect(authApi.login({ email: 'test@test.com', password: 'pass' })).rejects.toEqual(error);
    });
  });
});
