// AlcheMix Zustand Store
// Global state management for the application

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppState, User, Bottle, Recipe, Favorite, ChatMessage } from '@/types';
import { authApi, inventoryApi, recipeApi, favoritesApi, aiApi } from './api';
import { buildSystemPrompt } from './aiPersona';

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

      // Auth Actions
      login: async (credentials) => {
        try {
          set({ isLoading: true, error: null });
          const response = await authApi.login(credentials);

          // Extract token and user from response.data
          const { token, user } = response.data;

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

          // Extract token and user from response.data
          const { token, user } = response.data;

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
          set({ isAuthenticated: false, user: null });
          return false;
        }

        try {
          // Try to fetch user data with the persisted token
          const user = await authApi.me();
          set({ user, isAuthenticated: true });
          return true;
        } catch (error) {
          // Token is invalid or expired
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

      addFavorite: async (recipeName) => {
        try {
          set({ isLoading: true, error: null });
          const newFavorite = await favoritesApi.add(recipeName);
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
          set({ isLoading: true, error: null });

          // Add user message to history
          const userMessage: ChatMessage = { role: 'user', content: message };
          set((state) => ({
            chatHistory: [...state.chatHistory, userMessage],
          }));

          // Build context-aware system prompt
          const systemPrompt = buildSystemPrompt({
            inventory: get().bottles,
            recipes: get().recipes,
            favorites: get().favorites,
            history: {},
          });

          // Get AI response
          const response = await aiApi.sendMessage(
            message,
            get().chatHistory,
            systemPrompt
          );

          // Add AI response to history
          const aiMessage: ChatMessage = { role: 'assistant', content: response };
          set((state) => ({
            chatHistory: [...state.chatHistory, aiMessage],
            isLoading: false,
          }));

          return response;
        } catch (error: any) {
          const errorMessage = error.response?.data?.error || 'Failed to send message';
          set({ error: errorMessage, isLoading: false });
          throw new Error(errorMessage);
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
        // After rehydration, ensure isAuthenticated is false
        // It will be set to true only after successful token validation
        if (state) {
          state.isAuthenticated = false;
        }
      },
    }
  )
);
