import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useStore } from './store';
import type { Bottle, Recipe, Favorite } from '@/types';

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
    useStore.setState({
      user: null,
      token: null,
      isAuthenticated: false,
      bottles: [],
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
      expect(state.token).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.bottles).toEqual([]);
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
        const mockResponse = {
          data: {
            user: { id: 1, email: 'test@example.com' },
            token: 'jwt-token-123',
          },
        };

        (authApi.login as any).mockResolvedValue(mockResponse);

        const credentials = { email: 'test@example.com', password: 'password123' };
        await useStore.getState().login(credentials);

        const state = useStore.getState();
        expect(state.user).toEqual(mockResponse.data.user);
        expect(state.token).toBe(mockResponse.data.token);
        expect(state.isAuthenticated).toBe(true);
        expect(state.isLoading).toBe(false);
        expect(state.error).toBeNull();

        expect(localStorage.setItem).toHaveBeenCalledWith('token', mockResponse.data.token);
        expect(localStorage.setItem).toHaveBeenCalledWith('user', JSON.stringify(mockResponse.data.user));
      });

      it('should handle login error', async () => {
        const { authApi } = await import('./api');
        const errorMessage = 'Invalid credentials';

        (authApi.login as any).mockRejectedValue({
          response: { data: { error: errorMessage } },
        });

        const credentials = { email: 'test@example.com', password: 'wrong' };

        await expect(useStore.getState().login(credentials)).rejects.toThrow(errorMessage);

        const state = useStore.getState();
        expect(state.user).toBeNull();
        expect(state.isAuthenticated).toBe(false);
        expect(state.error).toBe(errorMessage);
        expect(state.isLoading).toBe(false);
      });

      it('should set loading state during login', async () => {
        const { authApi } = await import('./api');

        (authApi.login as any).mockImplementation(() => {
          // Check loading state during async operation
          const state = useStore.getState();
          expect(state.isLoading).toBe(true);

          return Promise.resolve({
            data: {
              user: { id: 1, email: 'test@example.com' },
              token: 'jwt-token',
            },
          });
        });

        await useStore.getState().login({ email: 'test@example.com', password: 'pass' });
      });
    });

    describe('signup', () => {
      it('should signup successfully', async () => {
        const { authApi } = await import('./api');
        const mockResponse = {
          data: {
            user: { id: 2, email: 'newuser@example.com' },
            token: 'new-jwt-token',
          },
        };

        (authApi.signup as any).mockResolvedValue(mockResponse);

        const credentials = { email: 'newuser@example.com', password: 'SecurePass123!' };
        await useStore.getState().signup(credentials);

        const state = useStore.getState();
        expect(state.user).toEqual(mockResponse.data.user);
        expect(state.token).toBe(mockResponse.data.token);
        expect(state.isAuthenticated).toBe(true);
      });

      it('should handle signup error', async () => {
        const { authApi } = await import('./api');
        const errorMessage = 'Email already exists';

        (authApi.signup as any).mockRejectedValue({
          response: { data: { error: errorMessage } },
        });

        await expect(
          useStore.getState().signup({ email: 'existing@example.com', password: 'pass' })
        ).rejects.toThrow(errorMessage);

        const state = useStore.getState();
        expect(state.error).toBe(errorMessage);
      });
    });

    describe('logout', () => {
      it('should logout and clear state', async () => {
        const { authApi } = await import('./api');
        (authApi.logout as any).mockResolvedValue({});

        // Set initial authenticated state
        useStore.setState({
          user: { id: 1, email: 'test@example.com' },
          token: 'jwt-token',
          isAuthenticated: true,
          bottles: [{ id: 1, name: 'Bottle 1' }] as any,
          recipes: [{ id: 1, name: 'Recipe 1' }] as any,
          favorites: [{ id: 1, recipe_id: 1 }] as any,
          chatHistory: [{ role: 'user', content: 'Hello' }],
        });

        useStore.getState().logout();

        const state = useStore.getState();
        expect(state.user).toBeNull();
        expect(state.token).toBeNull();
        expect(state.isAuthenticated).toBe(false);
        expect(state.bottles).toEqual([]);
        expect(state.recipes).toEqual([]);
        expect(state.favorites).toEqual([]);
        expect(state.chatHistory).toEqual([]);

        expect(localStorage.removeItem).toHaveBeenCalledWith('token');
        expect(localStorage.removeItem).toHaveBeenCalledWith('user');
      });
    });

    describe('setUser', () => {
      it('should set user and token', () => {
        const user = { id: 1, email: 'test@example.com' };
        const token = 'jwt-token';

        useStore.getState().setUser(user, token);

        const state = useStore.getState();
        expect(state.user).toEqual(user);
        expect(state.token).toBe(token);
        expect(state.isAuthenticated).toBe(true);
      });
    });

    describe('validateToken', () => {
      it('should validate token and set user', async () => {
        const { authApi } = await import('./api');
        const mockUser = { id: 1, email: 'test@example.com' };

        (authApi.me as any).mockResolvedValue(mockUser);

        useStore.setState({ token: 'valid-token' });

        const result = await useStore.getState().validateToken();

        expect(result).toBe(true);
        const state = useStore.getState();
        expect(state.user).toEqual(mockUser);
        expect(state.isAuthenticated).toBe(true);
      });

      it('should return false when no token exists', async () => {
        useStore.setState({ token: null });

        const result = await useStore.getState().validateToken();

        expect(result).toBe(false);
        const state = useStore.getState();
        expect(state.isAuthenticated).toBe(false);
        expect(state.user).toBeNull();
      });

      it('should handle invalid token', async () => {
        const { authApi } = await import('./api');

        (authApi.me as any).mockRejectedValue(new Error('Invalid token'));

        useStore.setState({ token: 'invalid-token' });

        const result = await useStore.getState().validateToken();

        expect(result).toBe(false);
        const state = useStore.getState();
        expect(state.isAuthenticated).toBe(false);
        expect(state.user).toBeNull();
        expect(state.token).toBeNull();
      });
    });
  });

  describe('Bottle Actions', () => {
    describe('fetchBottles', () => {
      it('should fetch bottles successfully', async () => {
        const { inventoryApi } = await import('./api');
        const mockBottles: Bottle[] = [
          { id: 1, name: 'Gin', category: 'Spirits', quantity: 750 } as Bottle,
          { id: 2, name: 'Vodka', category: 'Spirits', quantity: 1000 } as Bottle,
        ];

        (inventoryApi.getAll as any).mockResolvedValue(mockBottles);

        await useStore.getState().fetchBottles();

        const state = useStore.getState();
        expect(state.bottles).toEqual(mockBottles);
        expect(state.isLoading).toBe(false);
        expect(state.error).toBeNull();
      });

      it('should handle fetch error', async () => {
        const { inventoryApi } = await import('./api');
        const errorMessage = 'Network error';

        (inventoryApi.getAll as any).mockRejectedValue({
          response: { data: { error: errorMessage } },
        });

        await expect(useStore.getState().fetchBottles()).rejects.toThrow(errorMessage);

        const state = useStore.getState();
        expect(state.error).toBe(errorMessage);
      });
    });

    describe('addBottle', () => {
      it('should add bottle to state', async () => {
        const { inventoryApi } = await import('./api');
        const newBottle: Bottle = {
          id: 3,
          name: 'Rum',
          category: 'Spirits',
          quantity: 750,
        } as Bottle;

        (inventoryApi.add as any).mockResolvedValue(newBottle);

        useStore.setState({
          bottles: [
            { id: 1, name: 'Gin' } as Bottle,
            { id: 2, name: 'Vodka' } as Bottle,
          ],
        });

        await useStore.getState().addBottle(newBottle);

        const state = useStore.getState();
        expect(state.bottles).toHaveLength(3);
        expect(state.bottles[2]).toEqual(newBottle);
      });
    });

    describe('updateBottle', () => {
      it('should update bottle in state', async () => {
        const { inventoryApi } = await import('./api');
        const updatedBottle: Bottle = {
          id: 1,
          name: 'Gin',
          category: 'Spirits',
          quantity: 500,
        } as Bottle;

        (inventoryApi.update as any).mockResolvedValue(updatedBottle);

        useStore.setState({
          bottles: [
            { id: 1, name: 'Gin', quantity: 750 } as Bottle,
            { id: 2, name: 'Vodka', quantity: 1000 } as Bottle,
          ],
        });

        await useStore.getState().updateBottle(1, { quantity: 500 });

        const state = useStore.getState();
        expect(state.bottles[0].quantity).toBe(500);
        expect(state.bottles[1].quantity).toBe(1000);
      });
    });

    describe('deleteBottle', () => {
      it('should remove bottle from state', async () => {
        const { inventoryApi } = await import('./api');

        (inventoryApi.delete as any).mockResolvedValue(undefined);

        useStore.setState({
          bottles: [
            { id: 1, name: 'Gin' } as Bottle,
            { id: 2, name: 'Vodka' } as Bottle,
          ],
        });

        await useStore.getState().deleteBottle(1);

        const state = useStore.getState();
        expect(state.bottles).toHaveLength(1);
        expect(state.bottles[0].id).toBe(2);
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

        (recipeApi.getAll as any).mockResolvedValue(mockRecipes);

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
          bottles: [{ id: 1, name: 'Gin' }] as Bottle[],
          recipes: [{ id: 1, name: 'Martini' }] as Recipe[],
          favorites: [],
          chatHistory: [],
        });

        const userMessage = 'What can I make?';
        const response = await useStore.getState().sendMessage(userMessage);

        expect(response).toBe(aiResponse);

        const state = useStore.getState();
        expect(state.chatHistory).toHaveLength(2);
        expect(state.chatHistory[0]).toEqual({ role: 'user', content: userMessage });
        expect(state.chatHistory[1]).toEqual({ role: 'assistant', content: aiResponse });
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
