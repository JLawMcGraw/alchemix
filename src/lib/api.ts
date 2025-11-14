// AlcheMix API Client
// Connects to Express backend at localhost:3000

import axios, { AxiosInstance, AxiosError } from 'axios';
import type {
  User,
  AuthResponse,
  LoginCredentials,
  SignupCredentials,
  Bottle,
  Recipe,
  Favorite,
  ApiResponse,
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

// Auth API
export const authApi = {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const { data } = await apiClient.post<AuthResponse>('/auth/login', credentials);
    return data;
  },

  async signup(credentials: SignupCredentials): Promise<AuthResponse> {
    const { data } = await apiClient.post<AuthResponse>('/auth/signup', credentials);
    return data;
  },

  async me(): Promise<User> {
    const { data } = await apiClient.get<User>('/auth/me');
    return data;
  },

  async logout(): Promise<void> {
    await apiClient.post('/auth/logout');
  },
};

// Inventory API
export const inventoryApi = {
  async getAll(): Promise<Bottle[]> {
    const { data } = await apiClient.get<{ success: boolean; data: Bottle[] }>('/api/inventory');
    return data.data;
  },

  async add(bottle: Bottle): Promise<Bottle> {
    const { data } = await apiClient.post<{ success: boolean; data: Bottle }>('/api/inventory', bottle);
    return data.data;
  },

  async update(id: number, bottle: Partial<Bottle>): Promise<Bottle> {
    const { data } = await apiClient.put<{ success: boolean; data: Bottle }>(`/api/inventory/${id}`, bottle);
    return data.data;
  },

  async delete(id: number): Promise<void> {
    await apiClient.delete(`/api/inventory/${id}`);
  },

  async importCSV(file: File): Promise<{ count: number }> {
    const formData = new FormData();
    formData.append('file', file);

    const { data } = await apiClient.post<{ count: number }>(
      '/api/inventory/import',
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
  async getAll(): Promise<Recipe[]> {
    const { data } = await apiClient.get<{ success: boolean; data: Recipe[] }>('/api/recipes');
    return data.data;
  },

  async add(recipe: Recipe): Promise<Recipe> {
    const { data } = await apiClient.post<{ success: boolean; data: Recipe }>('/api/recipes', recipe);
    return data.data;
  },

  async importCSV(file: File): Promise<{ count: number }> {
    const formData = new FormData();
    formData.append('file', file);

    const { data } = await apiClient.post<{ count: number }>(
      '/api/recipes/import',
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
    conversationHistory: { role: string; content: string }[],
    systemPrompt: string
  ): Promise<string> {
    const { data } = await apiClient.post<{ content: { text: string }[] }>('/api/messages', {
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        ...conversationHistory,
        { role: 'user', content: message },
      ],
    });

    return data.content[0].text;
  },
};

export default apiClient;
