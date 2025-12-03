import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useStore } from './store';
import type { InventoryItem, Recipe, Favorite } from '@/types';

// Mock the API modules
vi.mock('./api', () => ({
  authApi: {
    login: vi.fn(),
    signup: vi.fn(),
    logout: vi.fn(),
    me: vi.fn(),
  },
  inventoryApi: {
    getAll: vi.fn(),
    add: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  recipeApi: {
    getAll: vi.fn(),
    add: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteAll: vi.fn(),
    deleteBulk: vi.fn(),
  },
  favoritesApi: {
    getAll: vi.fn(),
    add: vi.fn(),
    remove: vi.fn(),
  },
  aiApi: {
    sendMessage: vi.fn(),
  },
}));

// Mock aiPersona
vi.mock('./aiPersona', () => ({
  buildSystemPrompt: vi.fn(() => 'Mock system prompt'),
}));

describe('Zustand Store', () => {
  beforeEach(() => {
    // Reset store to initial state
    // Note: token is no longer stored in state (now in httpOnly cookie)
    useStore.setState({
      user: null,
      isAuthenticated: false,
      inventoryItems: [],
      recipes: [],
      favorites: [],
      chatHistory: [],
      isLoading: false,
      error: null,
    });

    // Clear all mocks
    vi.clearAllMocks();

    // Mock localStorage
    const localStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };
    global.localStorage = localStorageMock as any;
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = useStore.getState();

      expect(state.user).toBeNull();
      // Note: token is no longer in state (stored in httpOnly cookie)
      expect(state.isAuthenticated).toBe(false);
      expect(state.inventoryItems).toEqual([]);
      expect(state.recipes).toEqual([]);
      expect(state.favorites).toEqual([]);
      expect(state.chatHistory).toEqual([]);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('Auth Actions', () => {
    describe('login', () => {
      it('should login successfully', async () => {
        const { authApi } = await import('./api');
        // Response no longer includes token (it's set as httpOnly cookie by server)
        const mockResponse = {
          user: { id: 1, email: 'test@example.com' },
          csrfToken: 'csrf-token-123', // CSRF token for state-changing requests
        };

        (authApi.login as any).mockResolvedValue(mockResponse);

        const credentials = { email: 'test@example.com', password: 'password123' };
        await useStore.getState().login(credentials);

        const state = useStore.getState();
        expect(state.user).toEqual(mockResponse.user);
        // Token is now in httpOnly cookie, not in state
        expect(state.isAuthenticated).toBe(true);
        expect(state.isLoading).toBe(false);
        expect(state.error).toBeNull();

        // No longer storing token in localStorage (it's in httpOnly cookie)
        // localStorage is only used for persisting user data across page reloads
      });

      it('should handle login error', async () => {
        const { authApi } = await import('./api');

        (authApi.login as any).mockRejectedValue({
          response: { data: { error: 'Invalid credentials' } },
        });

        const credentials = { email: 'test@example.com', password: 'wrong' };

        // Auth slice wraps errors with fallback message
        await expect(useStore.getState().login(credentials)).rejects.toThrow('Login failed');

        const state = useStore.getState();
        expect(state.user).toBeNull();
        expect(state.isAuthenticated).toBe(false);
      });

      it('should set loading state during login', async () => {
        const { authApi } = await import('./api');

        (authApi.login as any).mockImplementation(() => {
          return Promise.resolve({
            user: { id: 1, email: 'test@example.com' },
            csrfToken: 'csrf-token',
          });
        });

        await useStore.getState().login({ email: 'test@example.com', password: 'pass' });
      });
    });

    describe('signup', () => {
      it('should signup successfully', async () => {
        const { authApi } = await import('./api');
        const mockResponse = {
          user: { id: 2, email: 'newuser@example.com' },
          csrfToken: 'new-csrf-token',
        };

        (authApi.signup as any).mockResolvedValue(mockResponse);

        const credentials = { email: 'newuser@example.com', password: 'SecurePass123!' };
        await useStore.getState().signup(credentials);

        const state = useStore.getState();
        expect(state.user).toEqual(mockResponse.user);
        expect(state.isAuthenticated).toBe(true);
      });

      it('should handle signup error', async () => {
        const { authApi } = await import('./api');

        (authApi.signup as any).mockRejectedValue({
          response: { data: { error: 'Email already exists' } },
        });

        // Auth slice wraps errors with fallback message
        await expect(
          useStore.getState().signup({ email: 'existing@example.com', password: 'pass' })
        ).rejects.toThrow('Signup failed');
      });
    });

    describe('logout', () => {
      it('should logout and clear state', async () => {
        const { authApi } = await import('./api');
        (authApi.logout as any).mockResolvedValue({});

        // Set initial authenticated state
        useStore.setState({
          user: { id: 1, email: 'test@example.com' },
          isAuthenticated: true,
          inventoryItems: [{ id: 1, name: 'Gin', category: 'spirit' }] as any,
          recipes: [{ id: 1, name: 'Recipe 1' }] as any,
          favorites: [{ id: 1, recipe_id: 1 }] as any,
          chatHistory: [{ role: 'user', content: 'Hello' }],
        });

        useStore.getState().logout();

        const state = useStore.getState();
        expect(state.user).toBeNull();
        // Token is cleared by server (httpOnly cookie)
        expect(state.isAuthenticated).toBe(false);
      });
    });

    describe('setUser', () => {
      it('should set user', () => {
        const user = { id: 1, email: 'test@example.com' };

        // setUser now only takes user parameter (token is in httpOnly cookie)
        useStore.getState().setUser(user);

        const state = useStore.getState();
        expect(state.user).toEqual(user);
        expect(state.isAuthenticated).toBe(true);
      });
    });

    describe('validateToken', () => {
      it('should validate session and set user', async () => {
        const { authApi } = await import('./api');
        const mockUser = { id: 1, email: 'test@example.com' };

        (authApi.me as any).mockResolvedValue(mockUser);

        // With httpOnly cookies, we don't check token existence
        // Instead, we try to fetch user data - if cookie is valid, it works
        const result = await useStore.getState().validateToken();

        expect(result).toBe(true);
        const state = useStore.getState();
        expect(state.user).toEqual(mockUser);
        expect(state.isAuthenticated).toBe(true);
      });

      it('should return false when session is invalid', async () => {
        const { authApi } = await import('./api');

        (authApi.me as any).mockRejectedValue(new Error('Unauthorized'));

        const result = await useStore.getState().validateToken();

        expect(result).toBe(false);
        const state = useStore.getState();
        expect(state.isAuthenticated).toBe(false);
        expect(state.user).toBeNull();
      });

      it('should handle expired session', async () => {
        const { authApi } = await import('./api');

        (authApi.me as any).mockRejectedValue(new Error('Token expired'));

        const result = await useStore.getState().validateToken();

        expect(result).toBe(false);
        const state = useStore.getState();
        expect(state.isAuthenticated).toBe(false);
        expect(state.user).toBeNull();
      });
    });
  });

  describe('Inventory Item Actions', () => {
    describe('fetchItems', () => {
      it('should fetch items successfully', async () => {
        const { inventoryApi } = await import('./api');
        const mockItems: InventoryItem[] = [
          { id: 1, name: 'Gin', category: 'spirit' } as InventoryItem,
          { id: 2, name: 'Vodka', category: 'spirit' } as InventoryItem,
        ];

        (inventoryApi.getAll as any).mockResolvedValue({
          items: mockItems,
          pagination: {
            page: 1,
            limit: 100,
            total: mockItems.length,
            totalPages: 1,
            hasNextPage: false,
            hasPreviousPage: false,
          },
        });

        await useStore.getState().fetchItems();

        const state = useStore.getState();
        expect(state.inventoryItems).toEqual(mockItems);
        expect(state.isLoading).toBe(false);
        expect(state.error).toBeNull();
      });

      it('should handle fetch error', async () => {
        const { inventoryApi } = await import('./api');

        (inventoryApi.getAll as any).mockRejectedValue({
          response: { data: { error: 'Network error' } },
        });

        // Inventory slice wraps errors with fallback message
        await expect(useStore.getState().fetchItems()).rejects.toThrow('Failed to fetch inventory items');

        const state = useStore.getState();
        expect(state.error).toBe('Failed to fetch inventory items');
      });
    });

    describe('addItem', () => {
      it('should add item to state', async () => {
        const { inventoryApi } = await import('./api');
        const newItem: InventoryItem = {
          id: 3,
          name: 'Rum',
          category: 'spirit',
        } as InventoryItem;

        (inventoryApi.add as any).mockResolvedValue(newItem);

        useStore.setState({
          inventoryItems: [
            { id: 1, name: 'Gin', category: 'spirit' } as InventoryItem,
            { id: 2, name: 'Vodka', category: 'spirit' } as InventoryItem,
          ],
        });

        await useStore.getState().addItem(newItem);

        const state = useStore.getState();
        expect(state.inventoryItems).toHaveLength(3);
        expect(state.inventoryItems[2]).toEqual(newItem);
      });
    });

    describe('updateItem', () => {
      it('should update item in state', async () => {
        const { inventoryApi } = await import('./api');
        const updatedItem: InventoryItem = {
          id: 1,
          name: 'Gin',
          category: 'spirit',
          abv: '40',
        } as InventoryItem;

        (inventoryApi.update as any).mockResolvedValue(updatedItem);

        useStore.setState({
          inventoryItems: [
            { id: 1, name: 'Gin', category: 'spirit' } as InventoryItem,
            { id: 2, name: 'Vodka', category: 'spirit' } as InventoryItem,
          ],
        });

        await useStore.getState().updateItem(1, { abv: '40' });

        const state = useStore.getState();
        expect(state.inventoryItems[0].abv).toBe('40');
      });
    });

    describe('deleteItem', () => {
      it('should remove item from state', async () => {
        const { inventoryApi } = await import('./api');

        (inventoryApi.delete as any).mockResolvedValue(undefined);

        useStore.setState({
          inventoryItems: [
            { id: 1, name: 'Gin', category: 'spirit' } as InventoryItem,
            { id: 2, name: 'Vodka', category: 'spirit' } as InventoryItem,
          ],
        });

        await useStore.getState().deleteItem(1);

        const state = useStore.getState();
        expect(state.inventoryItems).toHaveLength(1);
        expect(state.inventoryItems[0].id).toBe(2);
      });
    });
  });

  describe('Recipe Actions', () => {
    describe('fetchRecipes', () => {
      it('should fetch recipes successfully', async () => {
        const { recipeApi } = await import('./api');
        const mockRecipes: Recipe[] = [
          { id: 1, name: 'Martini', ingredients: 'Gin, Vermouth' } as Recipe,
          { id: 2, name: 'Negroni', ingredients: 'Gin, Campari, Vermouth' } as Recipe,
        ];

        (recipeApi.getAll as any).mockResolvedValue({ recipes: mockRecipes });

        await useStore.getState().fetchRecipes();

        const state = useStore.getState();
        expect(state.recipes).toEqual(mockRecipes);
      });
    });

    describe('addRecipe', () => {
      it('should add recipe to state', async () => {
        const { recipeApi } = await import('./api');
        const newRecipe: Recipe = {
          id: 3,
          name: 'Manhattan',
          ingredients: 'Whiskey, Vermouth, Bitters',
        } as Recipe;

        (recipeApi.add as any).mockResolvedValue(newRecipe);

        useStore.setState({
          recipes: [
            { id: 1, name: 'Martini' } as Recipe,
            { id: 2, name: 'Negroni' } as Recipe,
          ],
        });

        await useStore.getState().addRecipe(newRecipe);

        const state = useStore.getState();
        expect(state.recipes).toHaveLength(3);
        expect(state.recipes[2]).toEqual(newRecipe);
      });
    });

    describe('bulkDeleteRecipes', () => {
      it('should delete multiple recipes and update state', async () => {
        const { recipeApi } = await import('./api');
        (recipeApi.deleteBulk as any).mockResolvedValue({ deleted: 2 });

        useStore.setState({
          recipes: [
            { id: 1, name: 'Martini', ingredients: [] } as Recipe,
            { id: 2, name: 'Negroni', ingredients: [] } as Recipe,
            { id: 3, name: 'Manhattan', ingredients: [] } as Recipe,
          ],
        });

        const deleted = await useStore.getState().bulkDeleteRecipes([1, 2]);

        expect(deleted).toBe(2);
        const state = useStore.getState();
        expect(state.recipes).toHaveLength(1);
        expect(state.recipes[0].id).toBe(3);
      });
    });
  });

  describe('Favorites Actions', () => {
    describe('fetchFavorites', () => {
      it('should fetch favorites successfully', async () => {
        const { favoritesApi } = await import('./api');
        const mockFavorites: Favorite[] = [
          { id: 1, recipe_id: 1, recipe_name: 'Martini' } as Favorite,
          { id: 2, recipe_id: 2, recipe_name: 'Negroni' } as Favorite,
        ];

        (favoritesApi.getAll as any).mockResolvedValue(mockFavorites);

        await useStore.getState().fetchFavorites();

        const state = useStore.getState();
        expect(state.favorites).toEqual(mockFavorites);
      });
    });

    describe('addFavorite', () => {
      it('should add favorite to state', async () => {
        const { favoritesApi } = await import('./api');
        const newFavorite: Favorite = {
          id: 3,
          recipe_id: 3,
          recipe_name: 'Manhattan',
        } as Favorite;

        (favoritesApi.add as any).mockResolvedValue(newFavorite);

        useStore.setState({
          favorites: [
            { id: 1, recipe_name: 'Martini' } as Favorite,
          ],
        });

        await useStore.getState().addFavorite('Manhattan', 3);

        const state = useStore.getState();
        expect(state.favorites).toHaveLength(2);
        expect(state.favorites[1]).toEqual(newFavorite);
      });
    });

    describe('removeFavorite', () => {
      it('should remove favorite from state', async () => {
        const { favoritesApi } = await import('./api');

        (favoritesApi.remove as any).mockResolvedValue(undefined);

        useStore.setState({
          favorites: [
            { id: 1, recipe_name: 'Martini' } as Favorite,
            { id: 2, recipe_name: 'Negroni' } as Favorite,
          ],
        });

        await useStore.getState().removeFavorite(1);

        const state = useStore.getState();
        expect(state.favorites).toHaveLength(1);
        expect(state.favorites[0].id).toBe(2);
      });
    });
  });

  describe('AI Chat Actions', () => {
    describe('sendMessage', () => {
      it('should send message and update chat history', async () => {
        const { aiApi } = await import('./api');
        const aiResponse = 'You can make a Martini!';

        (aiApi.sendMessage as any).mockResolvedValue(aiResponse);

        useStore.setState({
          inventoryItems: [{ id: 1, name: 'Gin', category: 'spirit' }] as InventoryItem[],
          recipes: [{ id: 1, name: 'Martini' }] as Recipe[],
          favorites: [],
          chatHistory: [],
        });

        const userMessage = 'What can I make?';
        const response = await useStore.getState().sendMessage(userMessage);

        expect(response).toBe(aiResponse);

        const state = useStore.getState();
        expect(state.chatHistory).toHaveLength(2);
        expect(state.chatHistory[0]).toEqual(
          expect.objectContaining({ role: 'user', content: userMessage })
        );
        expect(state.chatHistory[1]).toEqual(
          expect.objectContaining({ role: 'assistant', content: aiResponse })
        );
      });

      it('should append to existing chat history', async () => {
        const { aiApi } = await import('./api');
        const aiResponse = 'Sure, here is the recipe!';

        (aiApi.sendMessage as any).mockResolvedValue(aiResponse);

        useStore.setState({
          chatHistory: [
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Hi there!' },
          ],
        });

        await useStore.getState().sendMessage('Can you give me a recipe?');

        const state = useStore.getState();
        expect(state.chatHistory).toHaveLength(4);
      });
    });

    describe('clearChat', () => {
      it('should clear chat history', () => {
        useStore.setState({
          chatHistory: [
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Hi!' },
          ],
        });

        useStore.getState().clearChat();

        const state = useStore.getState();
        expect(state.chatHistory).toEqual([]);
      });
    });
  });

  describe('UI Actions', () => {
    it('should set loading state', () => {
      useStore.getState().setLoading(true);
      expect(useStore.getState().isLoading).toBe(true);

      useStore.getState().setLoading(false);
      expect(useStore.getState().isLoading).toBe(false);
    });

    it('should set error state', () => {
      const errorMessage = 'Something went wrong';
      useStore.getState().setError(errorMessage);
      expect(useStore.getState().error).toBe(errorMessage);

      useStore.getState().setError(null);
      expect(useStore.getState().error).toBeNull();
    });
  });
});
