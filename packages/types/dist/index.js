/**
 * @alchemix/types - Shared TypeScript Types
 *
 * Central type definitions shared between frontend and backend.
 *
 * Usage:
 *   import { User, Recipe, ApiResponse } from '@alchemix/types';
 *   import type { UserRow, JWTPayload } from '@alchemix/types/database';
 */
// Domain types - Core business entities
export * from './domain';
// API types - Request/response contracts
export * from './api';
// Database types - Backend-specific types
export * from './database';
