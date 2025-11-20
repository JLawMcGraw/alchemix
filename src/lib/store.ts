// AlcheMix Zustand Store
// Global state management for the application

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppState, User, InventoryItem, Recipe, Collection, Favorite, ChatMessage } from '@/types';
import { authApi, inventoryApi, recipeApi, collectionsApi, favoritesApi, aiApi, shoppingListApi } from './api';

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial State
      user: null,
      token: null,
      isAuthenticated: false,
      inventoryItems: [],
      recipes: [],
      collections: [],
      favorites: [],
      chatHistory: [],
      shoppingListSuggestions: [],
      shoppingListStats: null,
      craftableRecipes: [],
      nearMissRecipes: [],
      dashboardGreeting: 'Ready for your next experiment?',
      dashboardInsight: '',
      isLoading: false,
      isLoadingShoppingList: false,
      isDashboardInsightLoading: false,
      error: null,
      _hasHydrated: false,

      // Auth Actions
      login: async (credentials) => {
        try {
          set({ isLoading: true, error: null });
          const response = await authApi.login(credentials);

          // Extract token and user from response
          const { token, user } = response;

          // Store token and user
          if (typeof window !== 'undefined') {
            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify(user));
          }

          set({
            user: user,
            token: token,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error: any) {
          const errorMessage = error.response?.data?.error || 'Login failed';
          set({ error: errorMessage, isLoading: false });
          throw new Error(errorMessage);
        }
      },

      signup: async (credentials) => {
        try {
          set({ isLoading: true, error: null });
          const response = await authApi.signup(credentials);

          // Extract token and user from response
          const { token, user } = response;

          // Store token and user
          if (typeof window !== 'undefined') {
            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify(user));
          }

          set({
            user: user,
            token: token,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error: any) {
          const errorMessage = error.response?.data?.error || 'Signup failed';
          set({ error: errorMessage, isLoading: false });
          throw new Error(errorMessage);
        }
      },

      logout: () => {
        // Clear localStorage
        if (typeof window !== 'undefined') {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        }

        // Reset state
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          inventoryItems: [],
          recipes: [],
          collections: [],
          favorites: [],
          chatHistory: [],
          shoppingListSuggestions: [],
          shoppingListStats: null,
          craftableRecipes: [],
          nearMissRecipes: [],
        });

        // Call logout API
        authApi.logout().catch(console.error);
      },

      setUser: (user, token) => {
        set({ user, token, isAuthenticated: true });
      },

      // Validate persisted token on app load
      validateToken: async () => {
        const { token } = get();
        if (!token) {
          set({ isAuthenticated: false, user: null, token: null });
          return false;
        }

        try {
          // Try to fetch user data with the persisted token
          const response = await authApi.me();
          set({ user: response, isAuthenticated: true });
          return true;
        } catch (error) {
          // Token is invalid or expired - clear everything
          set({ isAuthenticated: false, user: null, token: null });
          if (typeof window !== 'undefined') {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            localStorage.removeItem('alchemix-storage');
          }
          return false;
        }
      },

      // Inventory Item Actions
      fetchItems: async () => {
        try {
          set({ isLoading: true, error: null });
          let page = 1;
          const limit = 100;
          const aggregatedItems: InventoryItem[] = [];
          let hasMore = true;

          while (hasMore) {
            const { items, pagination } = await inventoryApi.getAll({ page, limit });
            aggregatedItems.push(...items);

            if (!pagination) {
              hasMore = false;
            } else {
              hasMore = pagination.hasNextPage;
              page += 1;
            }

            if (items.length === 0) {
              break;
            }
          }

          console.log('📦 Fetched inventory items:', aggregatedItems);
          console.log('📦 Items length:', aggregatedItems.length);
          console.log('📦 Items type:', typeof aggregatedItems, Array.isArray(aggregatedItems));
          set({ inventoryItems: aggregatedItems, isLoading: false });
        } catch (error: any) {
          console.error('❌ Error fetching inventory items:', error);
          const errorMessage = error.response?.data?.error || 'Failed to fetch inventory items';
          set({ error: errorMessage, isLoading: false });
          throw new Error(errorMessage);
        }
      },

      addItem: async (item) => {
        try {
          set({ isLoading: true, error: null });
          const newItem = await inventoryApi.add(item);
          set((state) => ({
            inventoryItems: [...state.inventoryItems, newItem],
            isLoading: false,
          }));
        } catch (error: any) {
          const errorMessage = error.response?.data?.error || 'Failed to add inventory item';
          set({ error: errorMessage, isLoading: false });
          throw new Error(errorMessage);
        }
      },

      updateItem: async (id, item) => {
        try {
          set({ isLoading: true, error: null });
          const updatedItem = await inventoryApi.update(id, item);
          set((state) => ({
            inventoryItems: state.inventoryItems.map((i) => (i.id === id ? updatedItem : i)),
            isLoading: false,
          }));
        } catch (error: any) {
          const errorMessage = error.response?.data?.error || 'Failed to update inventory item';
          set({ error: errorMessage, isLoading: false });
          throw new Error(errorMessage);
        }
      },

      deleteItem: async (id) => {
        try {
          set({ isLoading: true, error: null });
          await inventoryApi.delete(id);
          set((state) => ({
            inventoryItems: state.inventoryItems.filter((i) => i.id !== id),
            isLoading: false,
          }));
        } catch (error: any) {
          const errorMessage = error.response?.data?.error || 'Failed to delete inventory item';
          set({ error: errorMessage, isLoading: false });
          throw new Error(errorMessage);
        }
      },

      // Recipe Actions
      fetchRecipes: async (page: number = 1, limit: number = 50) => {
        try {
          set({ isLoading: true, error: null });

          // When requesting the default page, fetch the entire collection to keep UI in sync
          if (page === 1) {
            const aggregated: Recipe[] = [];
            let currentPage = page;
            let hasMore = true;

            while (hasMore) {
              const { recipes: pageRecipes, pagination } = await recipeApi.getAll(currentPage, limit);
              if (Array.isArray(pageRecipes)) {
                aggregated.push(...pageRecipes);
              }

              const shouldContinue =
                Boolean(pagination?.hasNextPage) &&
                Boolean(pageRecipes?.length);

              if (shouldContinue) {
                currentPage += 1;
              } else {
                hasMore = false;
              }
            }

            set({ recipes: aggregated, isLoading: false });
            return aggregated;
          }

          // Fallback: fetch a single requested page
          const { recipes } = await recipeApi.getAll(page, limit);
          set({ recipes, isLoading: false });
          return recipes;
        } catch (error: any) {
          const errorMessage = error.response?.data?.error || 'Failed to fetch recipes';
          set({ error: errorMessage, isLoading: false });
          throw new Error(errorMessage);
        }
      },

      addRecipe: async (recipe) => {
        try {
          set({ isLoading: true, error: null });
          const newRecipe = await recipeApi.add(recipe);
          set((state) => ({
            recipes: [...state.recipes, newRecipe],
            isLoading: false,
          }));
        } catch (error: any) {
          const errorMessage = error.response?.data?.error || 'Failed to add recipe';
          set({ error: errorMessage, isLoading: false });
          throw new Error(errorMessage);
        }
      },

      updateRecipe: async (id, recipe) => {
        try {
          set({ isLoading: true, error: null });
          const updatedRecipe = await recipeApi.update(id, recipe);
          set((state) => ({
            recipes: state.recipes.map((r) => (r.id === id ? updatedRecipe : r)),
            isLoading: false,
          }));
        } catch (error: any) {
          const errorMessage = error.response?.data?.error || 'Failed to update recipe';
          set({ error: errorMessage, isLoading: false });
          throw new Error(errorMessage);
        }
      },

      deleteRecipe: async (id) => {
        try {
          set({ isLoading: true, error: null });
          await recipeApi.delete(id);
          set((state) => ({
            recipes: state.recipes.filter((r) => r.id !== id),
            isLoading: false,
          }));
        } catch (error: any) {
          const errorMessage = error.response?.data?.error || 'Failed to delete recipe';
          set({ error: errorMessage, isLoading: false });
          throw new Error(errorMessage);
        }
      },

      bulkDeleteRecipes: async (ids) => {
        if (!Array.isArray(ids) || ids.length === 0) {
          return 0;
        }

        try {
          set({ isLoading: true, error: null });
          const { deleted } = await recipeApi.deleteBulk(ids);
          const idsToDelete = new Set(ids);
          set((state) => ({
            recipes: state.recipes.filter((r) => !r.id || !idsToDelete.has(r.id)),
            isLoading: false,
          }));
          return deleted;
        } catch (error: any) {
          const errorMessage = error.response?.data?.error || 'Failed to delete recipes';
          set({ error: errorMessage, isLoading: false });
          throw new Error(errorMessage);
        }
      },

      // Collection Actions
      fetchCollections: async () => {
        try {
          set({ isLoading: true, error: null });
          const collections = await collectionsApi.getAll();
          set({ collections, isLoading: false });
        } catch (error: any) {
          const errorMessage = error.response?.data?.error || 'Failed to fetch collections';
          set({ error: errorMessage, isLoading: false });
          throw new Error(errorMessage);
        }
      },

      addCollection: async (collection) => {
        try {
          set({ isLoading: true, error: null });
          const newCollection = await collectionsApi.add(collection);
          set((state) => ({
            collections: [...state.collections, newCollection],
            isLoading: false,
          }));
        } catch (error: any) {
          const errorMessage = error.response?.data?.error || 'Failed to add collection';
          set({ error: errorMessage, isLoading: false });
          throw new Error(errorMessage);
        }
      },

      updateCollection: async (id, collection) => {
        try {
          set({ isLoading: true, error: null });
          const updatedCollection = await collectionsApi.update(id, collection);
          set((state) => ({
            collections: state.collections.map((c) =>
              c.id === id ? updatedCollection : c
            ),
            isLoading: false,
          }));
        } catch (error: any) {
          const errorMessage = error.response?.data?.error || 'Failed to update collection';
          set({ error: errorMessage, isLoading: false });
          throw new Error(errorMessage);
        }
      },

      deleteCollection: async (id) => {
        try {
          set({ isLoading: true, error: null });
          await collectionsApi.delete(id);
          set((state) => ({
            collections: state.collections.filter((c) => c.id !== id),
            isLoading: false,
          }));
        } catch (error: any) {
          const errorMessage = error.response?.data?.error || 'Failed to delete collection';
          set({ error: errorMessage, isLoading: false });
          throw new Error(errorMessage);
        }
      },

      // Favorites Actions
      fetchFavorites: async () => {
        try {
          set({ isLoading: true, error: null });
          const favorites = await favoritesApi.getAll();
          set({ favorites, isLoading: false });
        } catch (error: any) {
          const errorMessage = error.response?.data?.error || 'Failed to fetch favorites';
          set({ error: errorMessage, isLoading: false });
          throw new Error(errorMessage);
        }
      },

      addFavorite: async (recipeName, recipeId?) => {
        try {
          set({ isLoading: true, error: null });
          const newFavorite = await favoritesApi.add(recipeName, recipeId);
          set((state) => ({
            favorites: [...state.favorites, newFavorite],
            isLoading: false,
          }));
        } catch (error: any) {
          const errorMessage = error.response?.data?.error || 'Failed to add favorite';
          set({ error: errorMessage, isLoading: false });
          throw new Error(errorMessage);
        }
      },

      removeFavorite: async (id) => {
        try {
          set({ isLoading: true, error: null });
          await favoritesApi.remove(id);
          set((state) => ({
            favorites: state.favorites.filter((f) => f.id !== id),
            isLoading: false,
          }));
        } catch (error: any) {
          const errorMessage = error.response?.data?.error || 'Failed to remove favorite';
          set({ error: errorMessage, isLoading: false });
          throw new Error(errorMessage);
        }
      },

      // Shopping List Actions
      fetchShoppingList: async () => {
        try {
          set({ isLoadingShoppingList: true, error: null });
          const response = await shoppingListApi.getSmart();
          set({
            shoppingListSuggestions: response.data,
            shoppingListStats: response.stats,
            craftableRecipes: response.craftableRecipes,
            nearMissRecipes: response.nearMissRecipes,
            isLoadingShoppingList: false,
          });
        } catch (error: any) {
          const errorMessage = error.response?.data?.error || 'Failed to fetch shopping list';
          set({ error: errorMessage, isLoadingShoppingList: false });
          throw new Error(errorMessage);
        }
      },

      fetchDashboardInsight: async () => {
        try {
          set({ isDashboardInsightLoading: true });
          const response = await aiApi.getDashboardInsight();
          set({
            dashboardGreeting: response.greeting,
            dashboardInsight: response.insight,
            isDashboardInsightLoading: false,
          });
        } catch (error: any) {
          console.error('Failed to fetch dashboard insight:', error);
          // Keep default greeting on error
          set({ isDashboardInsightLoading: false });
        }
      },

      // AI Chat Actions
      sendMessage: async (message) => {
        try {
          console.log('📤 [Store] Starting sendMessage');
          set({ isLoading: true, error: null });

          // Add user message to history with timestamp
          const userMessage: ChatMessage = {
            role: 'user',
            content: message,
            timestamp: new Date().toISOString()
          };
          const historyWithUser = [...get().chatHistory, userMessage];
          set({ chatHistory: historyWithUser });
          console.log('📝 [Store] User message added to history');

          // Get AI response (backend builds the system prompt from database)
          console.log('🌐 [Store] Calling API...');
          const response = await aiApi.sendMessage(
            message,
            historyWithUser,
          );
          console.log('✅ [Store] AI response received:', response?.substring(0, 50) + '...');

          // Add AI response to history with timestamp
          const aiMessage: ChatMessage = {
            role: 'assistant',
            content: response,
            timestamp: new Date().toISOString()
          };
          set((state) => ({
            chatHistory: [...state.chatHistory, aiMessage],
            isLoading: false,
          }));
          console.log('📝 [Store] AI message added to history');

          return response;
        } catch (error: any) {
          console.error('❌ [Store] Error in sendMessage:', error);
          const errorMessage = error.response?.data?.error || error.message || 'Failed to send message';
          set({ error: errorMessage, isLoading: false });
          throw error;
        }
      },

      clearChat: () => {
        set({ chatHistory: [] });
      },

      // UI Actions
      setLoading: (isLoading) => {
        set({ isLoading });
      },

      setError: (error) => {
        set({ error });
      },
    }),
    {
      name: 'alchemix-storage', // LocalStorage key
      partialize: (state) => ({
        // Only persist user and token, NOT isAuthenticated
        // isAuthenticated should be derived from valid token, not persisted
        user: state.user,
        token: state.token,
      }),
      onRehydrateStorage: () => (state) => {
        // After rehydration, mark as hydrated
        // Keep isAuthenticated = false initially, will be set to true after validation
        if (state) {
          state._hasHydrated = true;
          state.isAuthenticated = false;
        }
      },
    }
  )
);
