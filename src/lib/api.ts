// AlcheMix API Client
// Connects to Express backend at localhost:3000
//
// SECURITY: Uses httpOnly cookies for JWT storage (XSS protection)
// - Auth token stored in httpOnly cookie (not accessible via JavaScript)
// - CSRF token stored in regular cookie (read by JS for header inclusion)
// - All state-changing requests include X-CSRF-Token header

import axios, { AxiosInstance, AxiosError } from 'axios';
import type {
  User,
  AuthResponse,
  LoginCredentials,
  SignupCredentials,
  InventoryItem,
  InventoryItemInput,
  InventoryCategory,
  Recipe,
  Collection,
  Favorite,
  ApiResponse,
  ShoppingListResponse,
  ShoppingListStats,
  ShoppingListItem,
} from '@/types';

// API Base URL (Express backend)
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

/**
 * Get CSRF token from cookie
 * The csrf_token cookie is set by the server on login/signup
 * and must be included in X-CSRF-Token header for state-changing requests
 */
function getCSRFToken(): string | null {
  if (typeof document === 'undefined') return null;

  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'csrf_token') {
      return decodeURIComponent(value);
    }
  }
  return null;
}

// Create Axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // CRITICAL: Send cookies with requests (httpOnly auth cookie)
});

// Request interceptor to add CSRF token
apiClient.interceptors.request.use(
  (config) => {
    // Add CSRF token to state-changing requests
    // The auth token is now in an httpOnly cookie (sent automatically)
    const method = config.method?.toUpperCase();
    if (method && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
      const csrfToken = getCSRFToken();
      if (csrfToken && config.headers) {
        config.headers['X-CSRF-Token'] = csrfToken;
      }
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    // Handle 401 Unauthorized (token expired or invalid)
    if (error.response?.status === 401) {
      // Clear Zustand persisted storage to reset isAuthenticated
      if (typeof window !== 'undefined') {
        localStorage.removeItem('alchemix-storage');
        // Prevent redirect loop by only redirecting if not already on login page
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }

    // Handle 403 Forbidden (CSRF validation failed)
    if (error.response?.status === 403) {
      console.error('CSRF validation failed. Try logging in again.');
    }

    return Promise.reject(error);
  }
);

/**
 * Generic API Request Wrapper
 * Eliminates boilerplate by handling response unwrapping and error normalization
 */
async function request<T>(
  method: 'get' | 'post' | 'put' | 'delete',
  url: string,
  data?: unknown,
  config?: Record<string, unknown>
): Promise<T> {
  try {
    let response;
    if (method === 'get') {
      response = await apiClient.get(url, config);
    } else if (method === 'delete') {
      // Axios delete requires body in config.data
      response = await apiClient.delete(url, { ...config, data });
    } else {
      response = await apiClient[method](url, data, config);
    }

    // Unwrap nested data structure (response.data.data)
    return response.data.data !== undefined ? response.data.data : response.data;
  } catch (error) {
    // Re-throw for handling by calling code
    throw error;
  }
}

// Auth API
export const authApi = {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    return request<AuthResponse>('post', '/auth/login', credentials);
  },

  async signup(credentials: SignupCredentials): Promise<AuthResponse> {
    return request<AuthResponse>('post', '/auth/signup', credentials);
  },

  async me(): Promise<User> {
    return request<User>('get', '/auth/me');
  },

  async logout(): Promise<void> {
    await apiClient.post('/auth/logout');
  },

  async verifyEmail(token: string): Promise<{ message: string }> {
    return request<{ message: string }>('post', '/auth/verify-email', { token });
  },

  async resendVerification(): Promise<{ message: string }> {
    return request<{ message: string }>('post', '/auth/resend-verification');
  },

  async forgotPassword(email: string): Promise<{ message: string }> {
    return request<{ message: string }>('post', '/auth/forgot-password', { email });
  },

  async resetPassword(token: string, password: string): Promise<{ message: string }> {
    return request<{ message: string }>('post', '/auth/reset-password', { token, password });
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
    return request<{ message: string }>('post', '/auth/change-password', { currentPassword, newPassword });
  },

  async deleteAccount(password: string): Promise<{ message: string }> {
    return request<{ message: string }>('delete', '/auth/account', { password });
  },

  async exportData(): Promise<{
    user: User;
    inventory: InventoryItem[];
    recipes: Recipe[];
    favorites: Favorite[];
    collections: Collection[];
    exportedAt: string;
  }> {
    return request('get', '/auth/export');
  },

  async importData(
    data: {
      inventory?: InventoryItem[];
      recipes?: Recipe[];
      favorites?: Favorite[];
      collections?: Collection[];
    },
    options?: { overwrite?: boolean }
  ): Promise<{
    imported: {
      inventory: number;
      recipes: number;
      favorites: number;
      collections: number;
    };
  }> {
    return request('post', '/auth/import', { data, options });
  },
};

export interface InventoryPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

type InventoryQueryParams = {
  category?: InventoryCategory;
  page?: number;
  limit?: number;
};

// Inventory API (uses new /api/inventory-items endpoint)
export const inventoryApi = {
  async getAll(params?: InventoryQueryParams): Promise<{
    items: InventoryItem[];
    pagination?: InventoryPagination;
  }> {
    const searchParams = new URLSearchParams();
    if (params?.category) {
      searchParams.set('category', params.category);
    }
    if (params?.page) {
      searchParams.set('page', params.page.toString());
    }
    if (params?.limit) {
      searchParams.set('limit', params.limit.toString());
    }

    const queryString = searchParams.toString();
    const url = `/api/inventory-items${queryString ? `?${queryString}` : ''}`;
    const { data } = await apiClient.get<{
      success: boolean;
      data: InventoryItem[];
      pagination?: InventoryPagination;
    }>(url);

    return {
      items: data.data ?? [],
      pagination: data.pagination,
    };
  },

  async getCategoryCounts(): Promise<Record<string, number>> {
    const { data } = await apiClient.get<{
      success: boolean;
      data: Record<string, number>;
    }>('/api/inventory-items/category-counts');
    return data.data;
  },

  async add(item: InventoryItemInput): Promise<InventoryItem> {
    return request<InventoryItem>('post', '/api/inventory-items', item);
  },

  async update(id: number, item: Partial<InventoryItemInput>): Promise<InventoryItem> {
    return request<InventoryItem>('put', `/api/inventory-items/${id}`, item);
  },

  async delete(id: number): Promise<void> {
    return request<void>('delete', `/api/inventory-items/${id}`);
  },

  async deleteBulk(ids: number[]): Promise<{ deleted: number }> {
    const { data } = await apiClient.delete<{ success: boolean; deleted: number; message: string }>(
      '/api/inventory-items/bulk',
      { data: { ids } }
    );
    return { deleted: data.deleted };
  },

  async importCSV(file: File): Promise<{ success: boolean; imported: number; failed: number; errors?: Array<{ row: number; error: string }> }> {
    const formData = new FormData();
    formData.append('file', file);

    const { data } = await apiClient.post<{ success: boolean; imported: number; failed: number; errors?: Array<{ row: number; error: string }> }>(
      '/api/inventory-items/import',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return data;
  },

  async backfillPeriodicTags(force: boolean = false): Promise<{ success: boolean; updated: number; total: number }> {
    const { data } = await apiClient.post<{ success: boolean; updated: number; total: number }>(
      `/api/inventory-items/backfill-periodic-tags${force ? '?force=true' : ''}`
    );
    return data;
  },

  async backfillCategories(): Promise<{ success: boolean; updated: number; total: number }> {
    const { data } = await apiClient.post<{ success: boolean; updated: number; total: number }>(
      '/api/inventory-items/backfill-categories'
    );
    return data;
  },
};

// Recipe API
export const recipeApi = {
  async getAll(
    page: number = 1,
    limit: number = 50,
    options?: { search?: string; masteryIds?: number[] }
  ): Promise<{
    recipes: Recipe[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNextPage: boolean;
      hasPreviousPage: boolean;
    }
  }> {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(limit));

    if (options?.search) {
      params.set('search', options.search);
    }
    if (options?.masteryIds && options.masteryIds.length > 0) {
      params.set('masteryIds', options.masteryIds.join(','));
    }

    const { data } = await apiClient.get<{
      success: boolean;
      data: Recipe[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        hasNextPage: boolean;
        hasPreviousPage: boolean;
      };
    }>(`/api/recipes?${params.toString()}`);
    return { recipes: data.data, pagination: data.pagination };
  },

  async add(recipe: Recipe): Promise<Recipe> {
    const { data } = await apiClient.post<{ success: boolean; data: Recipe }>('/api/recipes', recipe);
    return data.data;
  },

  async update(id: number, recipe: Partial<Recipe>): Promise<Recipe> {
    const { data } = await apiClient.put<{ success: boolean; data: Recipe }>(`/api/recipes/${id}`, recipe);
    return data.data;
  },

  async delete(id: number): Promise<void> {
    await apiClient.delete(`/api/recipes/${id}`);
  },

  async deleteBulk(ids: number[]): Promise<{ deleted: number }> {
    const { data } = await apiClient.delete<{ success: boolean; deleted: number }>('/api/recipes/bulk', {
      data: { ids },
    });
    return { deleted: data.deleted };
  },

  async deleteAll(): Promise<{ deleted: number; message: string }> {
    const { data } = await apiClient.delete<{ success: boolean; deleted: number; message: string }>('/api/recipes/all');
    return { deleted: data.deleted, message: data.message };
  },

  async bulkMove(recipeIds: number[], collectionId: number | null): Promise<{ moved: number; message: string }> {
    const { data } = await apiClient.post<{ success: boolean; moved: number; message: string }>(
      '/api/recipes/bulk-move',
      { recipeIds, collectionId }
    );
    return { moved: data.moved, message: data.message };
  },

  async importCSV(file: File, collectionId?: number): Promise<{ imported: number; failed: number; errors?: Array<{ row: number; error: string }> }> {
    const formData = new FormData();
    formData.append('file', file);
    if (collectionId) {
      formData.append('collection_id', collectionId.toString());
    }

    const { data } = await apiClient.post<{ success: boolean; imported: number; failed: number; errors?: Array<{ row: number; error: string }> }>(
      '/api/recipes/import',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return { imported: data.imported, failed: data.failed, errors: data.errors };
  },

  /**
   * Seed classic cocktail recipes for first-time users
   * Called once on first login to add 100+ classic recipes
   */
  async seedClassics(): Promise<{ seeded: boolean; count: number; message: string }> {
    const { data } = await apiClient.post<{ 
      success: boolean; 
      seeded: boolean; 
      count: number; 
      message: string 
    }>('/api/recipes/seed-classics');
    return { seeded: data.seeded, count: data.count, message: data.message };
  },

  /**
   * Get classic cocktail data for onboarding preview (PUBLIC - no auth required)
   * Returns recipes with pre-computed 'requires' array for ingredient matching
   */
  async getClassics(): Promise<ClassicRecipe[]> {
    const { data } = await apiClient.get<{ 
      success: boolean; 
      data: ClassicRecipe[] 
    }>('/api/recipes/classics');
    return data.data;
  },
};

/**
 * Classic recipe type for onboarding
 * Includes 'requires' array for matching against user's element selection
 */
export interface ClassicRecipe {
  name: string;
  ingredients: string[];
  instructions: string;
  glass: string;
  spirit_type: string;
  requires: string[]; // Element symbols (e.g., ['Gn', 'Sv', 'Cp'] for Negroni)
}

// Custom Glasses API
export interface CustomGlass {
  id: number;
  user_id: number;
  name: string;
  created_at: string;
}

export const glassesApi = {
  async getAll(): Promise<CustomGlass[]> {
    const { data } = await apiClient.get<{ success: boolean; data: CustomGlass[] }>('/api/glasses');
    return data.data;
  },

  async add(name: string): Promise<CustomGlass> {
    const { data } = await apiClient.post<{ success: boolean; data: CustomGlass }>('/api/glasses', { name });
    return data.data;
  },

  async delete(id: number): Promise<void> {
    await apiClient.delete(`/api/glasses/${id}`);
  },
};

// Collections API
export const collectionsApi = {
  async getAll(): Promise<Collection[]> {
    const { data } = await apiClient.get<{ success: boolean; data: Collection[] }>('/api/collections');
    return data.data;
  },

  async add(collection: Collection): Promise<Collection> {
    const { data } = await apiClient.post<{ success: boolean; data: Collection }>('/api/collections', collection);
    return data.data;
  },

  async update(id: number, collection: Partial<Collection>): Promise<Collection> {
    const { data } = await apiClient.put<{ success: boolean; data: Collection }>(`/api/collections/${id}`, collection);
    return data.data;
  },

  async delete(id: number, options?: { deleteRecipes?: boolean }): Promise<{ recipesDeleted?: number }> {
    const params = options?.deleteRecipes ? '?deleteRecipes=true' : '';
    const { data } = await apiClient.delete<{ success: boolean; message: string; recipesDeleted?: number }>(
      `/api/collections/${id}${params}`
    );
    return { recipesDeleted: data.recipesDeleted };
  },
};

// Shopping List API
export const shoppingListApi = {
  async getSmart(): Promise<ShoppingListResponse> {
    const { data } = await apiClient.get<{
      success: boolean;
      data: ShoppingListResponse['data'];
      stats: ShoppingListResponse['stats'];
      craftableRecipes?: ShoppingListResponse['craftableRecipes'];
      nearMissRecipes?: ShoppingListResponse['nearMissRecipes'];
      needFewRecipes?: ShoppingListResponse['needFewRecipes'];
      majorGapsRecipes?: ShoppingListResponse['majorGapsRecipes'];
    }>('/api/shopping-list/smart?_t=' + Date.now()); // Cache-busting timestamp

    const defaultStats: ShoppingListStats = {
      totalRecipes: 0,
      craftable: 0,
      nearMisses: 0,
      inventoryItems: 0,
    };

    return {
      data: data.data ?? [],
      stats: data.stats ?? defaultStats,
      craftableRecipes: data.craftableRecipes ?? [],
      nearMissRecipes: data.nearMissRecipes ?? [],
      needFewRecipes: data.needFewRecipes ?? [],
      majorGapsRecipes: data.majorGapsRecipes ?? [],
    };
  },

  // Shopping List Items CRUD
  async getItems(): Promise<ShoppingListItem[]> {
    const { data } = await apiClient.get<{ success: boolean; data: ShoppingListItem[] }>('/api/shopping-list/items');
    return data.data;
  },

  async addItem(name: string): Promise<ShoppingListItem> {
    const { data } = await apiClient.post<{ success: boolean; data: ShoppingListItem }>('/api/shopping-list/items', { name });
    return data.data;
  },

  async updateItem(id: number, updates: { checked?: boolean; name?: string }): Promise<ShoppingListItem> {
    const { data } = await apiClient.put<{ success: boolean; data: ShoppingListItem }>(`/api/shopping-list/items/${id}`, updates);
    return data.data;
  },

  async removeItem(id: number): Promise<void> {
    await apiClient.delete(`/api/shopping-list/items/${id}`);
  },

  async clearChecked(): Promise<number> {
    const { data } = await apiClient.delete<{ success: boolean; deleted: number }>('/api/shopping-list/items/checked');
    return data.deleted;
  },
};

// Favorites API
export const favoritesApi = {
  async getAll(): Promise<Favorite[]> {
    const { data } = await apiClient.get<{ success: boolean; data: Favorite[] }>('/api/favorites');
    return data.data;
  },

  async add(recipeName: string, recipeId?: number): Promise<Favorite> {
    const { data } = await apiClient.post<{ success: boolean; data: Favorite }>('/api/favorites', {
      recipe_name: recipeName,
      recipe_id: recipeId
    });
    return data.data;
  },

  async remove(id: number): Promise<void> {
    await apiClient.delete(`/api/favorites/${id}`);
  },
};

// AI API
export const aiApi = {
  async sendMessage(
    message: string,
    conversationHistory: { role: string; content: string }[]
  ): Promise<string> {
    const { data } = await apiClient.post<{ success: boolean; data: { message: string } }>('/api/messages', {
      message,
      history: Array.isArray(conversationHistory)
        ? conversationHistory.map((entry) => ({
            role: entry.role,
            content: entry.content,
          }))
        : [],
    });

    return data.data.message;
  },

  /**
   * Stream a message to the AI bartender
   * Uses Server-Sent Events for real-time response streaming
   */
  async sendMessageStream(
    message: string,
    conversationHistory: { role: string; content: string }[],
    onChunk: (text: string) => void,
    onComplete: () => void,
    onError: (error: string) => void
  ): Promise<void> {
    const csrfToken = getCSRFToken();

    const response = await fetch(`${API_BASE_URL}/api/messages/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
      },
      credentials: 'include',
      body: JSON.stringify({
        message,
        history: Array.isArray(conversationHistory)
          ? conversationHistory.map((entry) => ({
              role: entry.role,
              content: entry.content,
            }))
          : [],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Request failed' }));
      onError(errorData.error || `HTTP ${response.status}`);
      return;
    }

    if (!response.body) {
      onError('No response body');
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6).trim();
          if (jsonStr) {
            try {
              const data = JSON.parse(jsonStr);
              if (data.error) {
                onError(data.error);
                return;
              }
              if (data.done) {
                onComplete();
                return;
              }
              if (data.text) {
                onChunk(data.text);
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }
      }
    }

    onComplete();
  },

  async getDashboardInsight(): Promise<{ greeting: string; insight: string }> {
    const { data } = await apiClient.get<{ success: boolean; data: { greeting: string; insight: string } }>(
      '/api/messages/dashboard-insight'
    );

    return data.data;
  },
};

export default apiClient;
