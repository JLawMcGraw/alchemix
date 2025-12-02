// AlcheMix API Client
// Connects to Express backend at localhost:3000

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
} from '@/types';

// API Base URL (Express backend)
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

// Create Axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // For cookies (CSRF tokens)
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config) => {
    // Get token from localStorage
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
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
    // Handle 401 Unauthorized (token expired)
    if (error.response?.status === 401) {
      // Clear all auth data and redirect to login
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        // Clear Zustand persisted storage to reset isAuthenticated
        localStorage.removeItem('alchemix-storage');
        // Prevent redirect loop by only redirecting if not already on login page
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
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
  data?: any,
  config?: any
): Promise<T> {
  try {
    let response;
    if (method === 'get' || method === 'delete') {
      response = await apiClient[method](url, config);
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
};

// Recipe API
export const recipeApi = {
  async getAll(page: number = 1, limit: number = 50): Promise<{
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
    const { data } = await apiClient.get<{
      success: boolean;
      data: Recipe[];
      pagination: any;
    }>(`/api/recipes?page=${page}&limit=${limit}`);
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

  async importCSV(file: File, collectionId?: number): Promise<{ imported: number; failed: number; errors?: any[] }> {
    const formData = new FormData();
    formData.append('file', file);
    if (collectionId) {
      formData.append('collection_id', collectionId.toString());
    }

    const { data } = await apiClient.post<{ success: boolean; imported: number; failed: number; errors?: any[] }>(
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

  async delete(id: number): Promise<void> {
    await apiClient.delete(`/api/collections/${id}`);
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
    console.log('🔌 [API] Sending to /api/messages:', { message: message.substring(0, 50) + '...' });

    // Backend expects simple { message: "..." } format
    const { data} = await apiClient.post<{ success: boolean; data: { message: string } }>('/api/messages', {
      message,
      history: Array.isArray(conversationHistory)
        ? conversationHistory.map((entry) => ({
            role: entry.role,
            content: entry.content,
          }))
        : [],
    });

    console.log('🔌 [API] Response received:', { success: data.success, hasMessage: !!data.data?.message });

    return data.data.message;
  },

  async getDashboardInsight(): Promise<{ greeting: string; insight: string }> {
    console.log('🔌 [API] Fetching dashboard insight from /api/messages/dashboard-insight');

    const { data } = await apiClient.get<{ success: boolean; data: { greeting: string; insight: string } }>(
      '/api/messages/dashboard-insight'
    );

    console.log('🔌 [API] Dashboard insight received:', { success: data.success });

    return data.data;
  },
};

export default apiClient;
