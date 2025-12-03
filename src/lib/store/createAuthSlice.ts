/**
 * Auth Slice
 * Manages user authentication state and actions
 *
 * SECURITY: HttpOnly Cookie-Based Authentication
 * - JWT token is stored in httpOnly cookie (NOT accessible via JavaScript)
 * - Prevents XSS attacks from stealing authentication tokens
 * - CSRF protection via X-CSRF-Token header
 * - Token is automatically sent with all requests (withCredentials: true)
 *
 * How it works:
 * 1. Login/Signup: Server sets httpOnly cookie with JWT
 * 2. API Requests: Browser automatically includes cookie
 * 3. CSRF Protection: Frontend reads csrf_token cookie and includes in header
 * 4. Logout: Server clears the httpOnly cookie
 */

import { StateCreator } from 'zustand';
import type { User, LoginCredentials, SignupCredentials } from '@/types';
import { authApi } from '../api';
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

export interface AuthSlice {
  // State
  user: User | null;
  isAuthenticated: boolean;
  _hasHydrated: boolean;

  // Actions
  login: (credentials: LoginCredentials) => Promise<void>;
  signup: (credentials: SignupCredentials) => Promise<void>;
  logout: () => void;
  setUser: (user: User) => void;
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
  isAuthenticated: false,
  _hasHydrated: false,

  // Actions
  login: async (credentials) => {
    try {
      const response = await authApi.login(credentials);

      // Server sets httpOnly cookie automatically
      // Response now contains user data and csrfToken (token is in cookie)
      const { user } = response;

      set({
        user: user,
        isAuthenticated: true,
      });
    } catch (error) {
      throw new Error(getErrorMessage(error, 'Login failed'));
    }
  },

  signup: async (credentials) => {
    try {
      const response = await authApi.signup(credentials);

      // Server sets httpOnly cookie automatically
      // Response now contains user data and csrfToken (token is in cookie)
      const { user } = response;

      set({
        user: user,
        isAuthenticated: true,
      });
    } catch (error) {
      throw new Error(getErrorMessage(error, 'Signup failed'));
    }
  },

  logout: () => {
    // Reset authentication state
    set({
      user: null,
      isAuthenticated: false,
    });

    // Call logout API (clears httpOnly cookie on server)
    authApi.logout().catch(console.error);
  },

  setUser: (user) => {
    set({ user, isAuthenticated: true });
  },

  validateToken: async () => {
    // With httpOnly cookies, we can't check if token exists in JS
    // Instead, we try to fetch user data - if cookie is valid, it will work
    try {
      const response = await authApi.me();
      set({ user: response, isAuthenticated: true });
      return true;
    } catch (error) {
      // Cookie is invalid, expired, or not present
      set({ isAuthenticated: false, user: null });
      // Clear Zustand persisted storage
      if (typeof window !== 'undefined') {
        localStorage.removeItem('alchemix-storage');
      }
      return false;
    }
  },
});
