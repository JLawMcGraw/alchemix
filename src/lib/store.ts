// AlcheMix Zustand Store
// Global state management for the application

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppState, User, Bottle, Recipe, Favorite, ChatMessage } from '@/types';
import { authApi, inventoryApi, recipeApi, favoritesApi, aiApi } from './api';

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial State
      user: null,
      token: null,
      isAuthenticated: false,
      bottles: [],
      recipes: [],
      favorites: [],
      chatHistory: [],
      isLoading: false,
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
          bottles: [],
          recipes: [],
          favorites: [],
          chatHistory: [],
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

      // Bottle Actions
      fetchBottles: async () => {
        try {
          set({ isLoading: true, error: null });
          const bottles = await inventoryApi.getAll();
          console.log('📦 Fetched bottles:', bottles);
          console.log('📦 Bottles length:', bottles?.length);
          console.log('📦 Bottles type:', typeof bottles, Array.isArray(bottles));
          set({ bottles, isLoading: false });
        } catch (error: any) {
          console.error('❌ Error fetching bottles:', error);
          const errorMessage = error.response?.data?.error || 'Failed to fetch bottles';
          set({ error: errorMessage, isLoading: false });
          throw new Error(errorMessage);
        }
      },

      addBottle: async (bottle) => {
        try {
          set({ isLoading: true, error: null });
          const newBottle = await inventoryApi.add(bottle);
          set((state) => ({
            bottles: [...state.bottles, newBottle],
            isLoading: false,
          }));
        } catch (error: any) {
          const errorMessage = error.response?.data?.error || 'Failed to add bottle';
          set({ error: errorMessage, isLoading: false });
          throw new Error(errorMessage);
        }
      },

      updateBottle: async (id, bottle) => {
        try {
          set({ isLoading: true, error: null });
          const updatedBottle = await inventoryApi.update(id, bottle);
          set((state) => ({
            bottles: state.bottles.map((b) => (b.id === id ? updatedBottle : b)),
            isLoading: false,
          }));
        } catch (error: any) {
          const errorMessage = error.response?.data?.error || 'Failed to update bottle';
          set({ error: errorMessage, isLoading: false });
          throw new Error(errorMessage);
        }
      },

      deleteBottle: async (id) => {
        try {
          set({ isLoading: true, error: null });
          await inventoryApi.delete(id);
          set((state) => ({
            bottles: state.bottles.filter((b) => b.id !== id),
            isLoading: false,
          }));
        } catch (error: any) {
          const errorMessage = error.response?.data?.error || 'Failed to delete bottle';
          set({ error: errorMessage, isLoading: false });
          throw new Error(errorMessage);
        }
      },

      // Recipe Actions
      fetchRecipes: async () => {
        try {
          set({ isLoading: true, error: null });
          const recipes = await recipeApi.getAll();
          set({ recipes, isLoading: false });
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
          set((state) => ({
            chatHistory: [...state.chatHistory, userMessage],
          }));
          console.log('📝 [Store] User message added to history');

          // Get AI response (backend builds the system prompt from database)
          console.log('🌐 [Store] Calling API...');
          const response = await aiApi.sendMessage(
            message,
            get().chatHistory,
            '' // Backend ignores this and builds its own prompt
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
