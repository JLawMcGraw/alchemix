/**
 * Chat Slice
 * Manages AI chat, shopping list, and dashboard insights state
 */

import { StateCreator } from 'zustand';
import type {
  ChatMessage,
  ShoppingListSuggestion,
  ShoppingListStats,
  CraftableRecipe,
  NearMissRecipe,
  NeedFewRecipe,
  MajorGapsRecipe
} from '@/types';
import { aiApi, shoppingListApi } from '../api';
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

export interface ChatSlice {
  // State
  chatHistory: ChatMessage[];
  shoppingListSuggestions: ShoppingListSuggestion[];
  shoppingListStats: ShoppingListStats | null;
  craftableRecipes: CraftableRecipe[];
  nearMissRecipes: NearMissRecipe[];
  needFewRecipes: NeedFewRecipe[];
  majorGapsRecipes: MajorGapsRecipe[];
  dashboardGreeting: string;
  dashboardInsight: string;
  isLoadingShoppingList: boolean;
  isDashboardInsightLoading: boolean;

  // Actions
  sendMessage: (message: string) => Promise<string>;
  clearChat: () => void;
  fetchShoppingList: () => Promise<void>;
  fetchDashboardInsight: () => Promise<void>;
}

export const createChatSlice: StateCreator<
  ChatSlice,
  [],
  [],
  ChatSlice
> = (set, get) => ({
  // Initial State
  chatHistory: [],
  shoppingListSuggestions: [],
  shoppingListStats: null,
  craftableRecipes: [],
  nearMissRecipes: [],
  needFewRecipes: [],
  majorGapsRecipes: [],
  dashboardGreeting: 'Ready for your next experiment?',
  dashboardInsight: '',
  isLoadingShoppingList: false,
  isDashboardInsightLoading: false,

  // Actions
  sendMessage: async (message) => {
    try {
      // Add user message to history with timestamp
      const userMessage: ChatMessage = {
        role: 'user',
        content: message,
        timestamp: new Date().toISOString()
      };
      const historyWithUser = [...get().chatHistory, userMessage];
      set({ chatHistory: historyWithUser });

      // Get AI response (backend builds the system prompt from database)
      const response = await aiApi.sendMessage(
        message,
        historyWithUser,
      );

      // Add AI response to history with timestamp
      const aiMessage: ChatMessage = {
        role: 'assistant',
        content: response,
        timestamp: new Date().toISOString()
      };
      set((state) => ({
        chatHistory: [...state.chatHistory, aiMessage],
      }));

      return response;
    } catch (error) {
      // Re-throw the original error for upstream handling
      throw error;
    }
  },

  clearChat: () => {
    set({ chatHistory: [] });
  },

  fetchShoppingList: async () => {
    try {
      set({
        isLoadingShoppingList: true,
        shoppingListSuggestions: [],
        shoppingListStats: null,
        craftableRecipes: [],
        nearMissRecipes: [],
        needFewRecipes: [],
        majorGapsRecipes: [],
      });
      const response = await shoppingListApi.getSmart();
      set({
        shoppingListSuggestions: response.data,
        shoppingListStats: response.stats,
        craftableRecipes: response.craftableRecipes,
        nearMissRecipes: response.nearMissRecipes,
        needFewRecipes: response.needFewRecipes || [],
        majorGapsRecipes: response.majorGapsRecipes || [],
        isLoadingShoppingList: false,
      });
    } catch (error) {
      set({ isLoadingShoppingList: false });
      throw new Error(getErrorMessage(error, 'Failed to fetch shopping list'));
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
    } catch (error) {
      console.error('Failed to fetch dashboard insight:', error);
      // Keep default greeting on error
      set({ isDashboardInsightLoading: false });
    }
  },
});
