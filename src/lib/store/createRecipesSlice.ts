/**
 * Recipes Slice
 * Manages recipes, collections, and favorites state and CRUD operations
 */

import { StateCreator } from 'zustand';
import type { Recipe, Collection, Favorite } from '@/types';
import { recipeApi, collectionsApi, favoritesApi } from '../api';
import { AxiosError } from 'axios';

/** Extract error message from Axios or standard Error */
function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof AxiosError) {
    return error.response?.data?.error || fallback;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
}

export interface RecipesSlice {
  // State
  recipes: Recipe[];
  collections: Collection[];
  favorites: Favorite[];

  // Recipe Actions
  fetchRecipes: (page?: number, limit?: number) => Promise<Recipe[]>;
  addRecipe: (recipe: Recipe) => Promise<void>;
  updateRecipe: (id: number, recipe: Partial<Recipe>) => Promise<void>;
  deleteRecipe: (id: number) => Promise<void>;
  bulkDeleteRecipes: (ids: number[]) => Promise<number>;

  // Collection Actions
  fetchCollections: () => Promise<void>;
  addCollection: (collection: Collection) => Promise<void>;
  updateCollection: (id: number, collection: Partial<Collection>) => Promise<void>;
  deleteCollection: (id: number) => Promise<void>;

  // Favorites Actions
  fetchFavorites: () => Promise<void>;
  addFavorite: (recipeName: string, recipeId?: number) => Promise<void>;
  removeFavorite: (id: number) => Promise<void>;
}

export const createRecipesSlice: StateCreator<
  RecipesSlice,
  [],
  [],
  RecipesSlice
> = (set) => ({
  // Initial State
  recipes: [],
  collections: [],
  favorites: [],

  // Recipe Actions
  fetchRecipes: async (page: number = 1, limit: number = 50) => {
    try {
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

        set({ recipes: aggregated });
        return aggregated;
      }

      // Fallback: fetch a single requested page
      const { recipes } = await recipeApi.getAll(page, limit);
      set({ recipes });
      return recipes;
    } catch (error) {
      throw new Error(getErrorMessage(error, 'Failed to fetch recipes'));
    }
  },

  addRecipe: async (recipe) => {
    try {
      const newRecipe = await recipeApi.add(recipe);
      set((state) => ({
        recipes: [...state.recipes, newRecipe],
      }));
    } catch (error) {
      throw new Error(getErrorMessage(error, 'Failed to add recipe'));
    }
  },

  updateRecipe: async (id, recipe) => {
    try {
      const updatedRecipe = await recipeApi.update(id, recipe);
      set((state) => ({
        recipes: state.recipes.map((r) => (r.id === id ? updatedRecipe : r)),
      }));
    } catch (error) {
      throw new Error(getErrorMessage(error, 'Failed to update recipe'));
    }
  },

  deleteRecipe: async (id) => {
    try {
      await recipeApi.delete(id);
      set((state) => ({
        recipes: state.recipes.filter((r) => r.id !== id),
      }));
    } catch (error) {
      throw new Error(getErrorMessage(error, 'Failed to delete recipe'));
    }
  },

  bulkDeleteRecipes: async (ids) => {
    if (!Array.isArray(ids) || ids.length === 0) {
      return 0;
    }

    try {
      const { deleted } = await recipeApi.deleteBulk(ids);
      const idsToDelete = new Set(ids);
      set((state) => ({
        recipes: state.recipes.filter((r) => !r.id || !idsToDelete.has(r.id)),
      }));
      return deleted;
    } catch (error) {
      throw new Error(getErrorMessage(error, 'Failed to delete recipes'));
    }
  },

  // Collection Actions
  fetchCollections: async () => {
    try {
      const collections = await collectionsApi.getAll();
      set({ collections });
    } catch (error) {
      throw new Error(getErrorMessage(error, 'Failed to fetch collections'));
    }
  },

  addCollection: async (collection) => {
    try {
      const newCollection = await collectionsApi.add(collection);
      set((state) => ({
        collections: [...state.collections, newCollection],
      }));
    } catch (error) {
      throw new Error(getErrorMessage(error, 'Failed to add collection'));
    }
  },

  updateCollection: async (id, collection) => {
    try {
      const updatedCollection = await collectionsApi.update(id, collection);
      set((state) => ({
        collections: state.collections.map((c) =>
          c.id === id ? updatedCollection : c
        ),
      }));
    } catch (error) {
      throw new Error(getErrorMessage(error, 'Failed to update collection'));
    }
  },

  deleteCollection: async (id) => {
    try {
      await collectionsApi.delete(id);
      set((state) => ({
        collections: state.collections.filter((c) => c.id !== id),
      }));
    } catch (error) {
      throw new Error(getErrorMessage(error, 'Failed to delete collection'));
    }
  },

  // Favorites Actions
  fetchFavorites: async () => {
    try {
      const favorites = await favoritesApi.getAll();
      set({ favorites });
    } catch (error) {
      throw new Error(getErrorMessage(error, 'Failed to fetch favorites'));
    }
  },

  addFavorite: async (recipeName, recipeId?) => {
    try {
      const newFavorite = await favoritesApi.add(recipeName, recipeId);
      set((state) => ({
        favorites: [...state.favorites, newFavorite],
      }));
    } catch (error) {
      throw new Error(getErrorMessage(error, 'Failed to add favorite'));
    }
  },

  removeFavorite: async (id) => {
    try {
      await favoritesApi.remove(id);
      set((state) => ({
        favorites: state.favorites.filter((f) => f.id !== id),
      }));
    } catch (error) {
      throw new Error(getErrorMessage(error, 'Failed to remove favorite'));
    }
  },
});
