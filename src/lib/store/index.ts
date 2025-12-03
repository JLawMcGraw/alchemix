/**
 * AlcheMix Zustand Store
 * Main store combining all slices using Zustand's slice pattern
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createAuthSlice, AuthSlice } from './createAuthSlice';
import { createInventorySlice, InventorySlice } from './createInventorySlice';
import { createRecipesSlice, RecipesSlice } from './createRecipesSlice';
import { createChatSlice, ChatSlice } from './createChatSlice';

// Combined store type
export type AppStore = AuthSlice & InventorySlice & RecipesSlice & ChatSlice;

export const useStore = create<AppStore>()(
  persist(
    (...a) => ({
      ...createAuthSlice(...a),
      ...createInventorySlice(...a),
      ...createRecipesSlice(...a),
      ...createChatSlice(...a),
    }),
    {
      name: 'alchemix-storage', // LocalStorage key
      partialize: (state) => ({
        // Only persist user, NOT isAuthenticated
        // isAuthenticated should be derived from valid httpOnly cookie session
        // Token is now stored in httpOnly cookie (not accessible via JS)
        user: state.user,
      }),
      onRehydrateStorage: () => (state) => {
        // After rehydration, mark as hydrated
        // Keep isAuthenticated = false initially, will be set to true after cookie validation
        if (state) {
          state._hasHydrated = true;
          state.isAuthenticated = false;
        }
      },
    }
  )
);
