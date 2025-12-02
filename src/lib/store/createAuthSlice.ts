/**
 * Auth Slice
 * Manages user authentication state and actions
 */

import { StateCreator } from 'zustand';
import type { User, LoginCredentials, SignupCredentials } from '@/types';
import { authApi } from '../api';

export interface AuthSlice {
  // State
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  _hasHydrated: boolean;

  // Actions
  login: (credentials: LoginCredentials) => Promise<void>;
  signup: (credentials: SignupCredentials) => Promise<void>;
  logout: () => void;
  setUser: (user: User, token: string) => void;
  validateToken: () => Promise<boolean>;
}

export const createAuthSlice: StateCreator<
  AuthSlice,
  [],
  [],
  AuthSlice
> = (set, get) => ({
  // Initial State
  user: null,
  token: null,
  isAuthenticated: false,
  _hasHydrated: false,

  // Actions
  login: async (credentials) => {
    try {
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
      });
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Login failed';
      throw new Error(errorMessage);
    }
  },

  signup: async (credentials) => {
    try {
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
      });
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Signup failed';
      throw new Error(errorMessage);
    }
  },

  logout: () => {
    // Clear localStorage
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }

    // Reset authentication state
    set({
      user: null,
      token: null,
      isAuthenticated: false,
    });

    // Call logout API
    authApi.logout().catch(console.error);
  },

  setUser: (user, token) => {
    set({ user, token, isAuthenticated: true });
  },

  validateToken: async () => {
    // Check both store and localStorage to handle pre-hydration calls
    const storeToken = get().token;
    const localToken = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const token = storeToken || localToken;

    if (!token) {
      set({ isAuthenticated: false, user: null, token: null });
      return false;
    }

    try {
      // Try to fetch user data with the persisted token
      const response = await authApi.me();
      // Sync the token to store if we used localStorage token
      set({ user: response, isAuthenticated: true, token });
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
});
