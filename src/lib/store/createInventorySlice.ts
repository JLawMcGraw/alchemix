/**
 * Inventory Slice
 * Manages inventory items state and CRUD operations
 */

import { StateCreator } from 'zustand';
import type { InventoryItem, InventoryItemInput, InventoryCategory, PaginationMetadata } from '@/types';
import { inventoryApi } from '../api';

export interface InventorySlice {
  // State
  inventoryItems: InventoryItem[];
  inventoryPagination: PaginationMetadata | null;
  isLoading: boolean;
  error: string | null;
  lastFetchParams: {
    page: number;
    limit: number;
    category?: InventoryCategory | 'all';
  };
  inventoryVersion: number; // increments on add/update/delete to signal downstream refreshes

  // Actions
  fetchItems: (page?: number, limit?: number, category?: InventoryCategory | 'all') => Promise<void>;
  addItem: (item: InventoryItemInput) => Promise<void>;
  updateItem: (id: number, item: Partial<InventoryItemInput>) => Promise<InventoryItem>;
  deleteItem: (id: number) => Promise<void>;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
}

export const createInventorySlice: StateCreator<
  InventorySlice,
  [],
  [],
  InventorySlice
> = (set, get) => ({
  // Initial State
  inventoryItems: [],
  inventoryPagination: null,
  isLoading: false,
  error: null,
  lastFetchParams: {
    page: 1,
    limit: 50,
    category: 'all',
  },
  inventoryVersion: 0,

  // Actions
  fetchItems: async (page?: number, limit?: number, category?: InventoryCategory | 'all') => {
    try {
      set({ isLoading: true, error: null });

      const previous = get().lastFetchParams;
      const nextPage = page ?? previous.page ?? 1;
      const nextLimit = limit ?? previous.limit ?? 50;
      const nextCategory = category ?? previous.category ?? 'all';

      // Fetch single page of items with optional category filter
      const { items, pagination } = await inventoryApi.getAll({
        page: nextPage,
        limit: nextLimit,
        category: nextCategory && nextCategory !== 'all' ? nextCategory : undefined
      });

      set({
        inventoryItems: items,
        inventoryPagination: pagination,
        isLoading: false,
        lastFetchParams: {
          page: nextPage,
          limit: nextLimit,
          category: nextCategory,
        },
      });
    } catch (error: any) {
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
        inventoryVersion: state.inventoryVersion + 1,
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
        inventoryVersion: state.inventoryVersion + 1,
      }));
      return updatedItem;
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
        inventoryVersion: state.inventoryVersion + 1,
      }));
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to delete inventory item';
      set({ error: errorMessage, isLoading: false });
      throw new Error(errorMessage);
    }
  },

  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
});
