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

    // Mock document.cookie for CSRF token
    Object.defineProperty(document, 'cookie', {
      writable: true,
      value: 'csrf_token=test-csrf-token-123',
    });

    // Mock window.location
    delete (window as any).location;
    window.location = { href: '', pathname: '' } as any;
  });

  describe('Request Interceptor', () => {
    it('should add X-CSRF-Token header for POST requests', async () => {
      // Trigger interceptor with POST method
      const config = { headers: {}, method: 'POST' };
      const interceptor = mockAxiosInstance._requestInterceptor;
      const result = interceptor(config);

      expect(result.headers['X-CSRF-Token']).toBe('test-csrf-token-123');
    });

    it('should add X-CSRF-Token header for PUT requests', async () => {
      const config = { headers: {}, method: 'PUT' };
      const interceptor = mockAxiosInstance._requestInterceptor;
      const result = interceptor(config);

      expect(result.headers['X-CSRF-Token']).toBe('test-csrf-token-123');
    });

    it('should add X-CSRF-Token header for DELETE requests', async () => {
      const config = { headers: {}, method: 'DELETE' };
      const interceptor = mockAxiosInstance._requestInterceptor;
      const result = interceptor(config);

      expect(result.headers['X-CSRF-Token']).toBe('test-csrf-token-123');
    });

    it('should not add X-CSRF-Token header for GET requests', () => {
      const config = { headers: {}, method: 'GET' };
      const interceptor = mockAxiosInstance._requestInterceptor;
      const result = interceptor(config);

      expect(result.headers['X-CSRF-Token']).toBeUndefined();
    });

    it('should handle missing CSRF cookie gracefully', () => {
      // Clear the cookie
      Object.defineProperty(document, 'cookie', {
        writable: true,
        value: '',
      });

      const config = { headers: {}, method: 'POST' };
      const interceptor = mockAxiosInstance._requestInterceptor;
      const result = interceptor(config);

      // Should not crash, just no CSRF header
      expect(result.headers['X-CSRF-Token']).toBeUndefined();
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

      // Now only clears alchemix-storage (token is in httpOnly cookie, cleared by server)
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

      // Response no longer includes token (it's in httpOnly cookie)
      const mockResponse = {
        data: {
          success: true,
          data: {
            csrfToken: 'csrf-token',
            user: { id: 1, email: 'test@example.com' },
          },
        },
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await authApi.login(credentials);

      // request() calls apiClient.post(url, data, config) - config is undefined here
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/auth/login', credentials, undefined);
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
            csrfToken: 'csrf-token',
            user: { id: 2, email: 'newuser@example.com' },
          },
        },
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await authApi.signup(credentials);

      // request() calls apiClient.post(url, data, config) - config is undefined here
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/auth/signup', credentials, undefined);
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

      // request() calls apiClient.get(url, config) - config is undefined here
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/auth/me', undefined);
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

      // request() calls apiClient.post(url, data, config) - config is undefined here
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/inventory-items', newBottle, undefined);
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

      // request() calls apiClient.put(url, data, config) - config is undefined here
      expect(mockAxiosInstance.put).toHaveBeenCalledWith(`/api/inventory-items/${bottleId}`, updates, undefined);
      expect(result).toEqual(mockResponse.data.data);
    });

    it('should delete a bottle', async () => {
      const bottleId = 1;

      // delete uses request() which expects response.data.data structure
      const mockResponse = {
        data: {
          success: true,
          data: undefined, // void return
        },
      };

      mockAxiosInstance.delete.mockResolvedValue(mockResponse);

      await inventoryApi.delete(bottleId);

      // request() calls apiClient.delete(url, { data }) - data is undefined for simple deletes
      expect(mockAxiosInstance.delete).toHaveBeenCalledWith(`/api/inventory-items/${bottleId}`, { data: undefined });
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

      // recipeApi.add doesn't use request(), it uses apiClient.post directly
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
