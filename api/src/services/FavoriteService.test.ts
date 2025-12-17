/**
 * FavoriteService Tests
 *
 * Tests for the favorites/bookmarking service.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '../database/db';
import { FavoriteService } from './FavoriteService';

describe('FavoriteService', () => {
  let favoriteService: FavoriteService;
  const testUserId = 9999;
  const otherUserId = 9998;
  const testRecipeId = 99999;

  beforeEach(() => {
    favoriteService = new FavoriteService();

    // Clean up test data
    db.prepare('DELETE FROM favorites WHERE user_id IN (?, ?)').run(testUserId, otherUserId);
    db.prepare('DELETE FROM recipes WHERE id = ?').run(testRecipeId);

    // Create test user if needed
    const existingUser = db.prepare('SELECT id FROM users WHERE id = ?').get(testUserId);
    if (!existingUser) {
      db.prepare(`
        INSERT INTO users (id, email, password_hash, created_at, is_verified)
        VALUES (?, ?, ?, datetime('now'), 1)
      `).run(testUserId, 'favtest@example.com', 'hash123');
    }

    const existingOther = db.prepare('SELECT id FROM users WHERE id = ?').get(otherUserId);
    if (!existingOther) {
      db.prepare(`
        INSERT INTO users (id, email, password_hash, created_at, is_verified)
        VALUES (?, ?, ?, datetime('now'), 1)
      `).run(otherUserId, 'favother@example.com', 'hash456');
    }

    // Create test recipe for FK tests
    db.prepare(`
      INSERT INTO recipes (id, user_id, name, ingredients, created_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `).run(testRecipeId, testUserId, 'Test Recipe', '["gin", "lime"]');
  });

  afterEach(() => {
    // Clean up test data
    db.prepare('DELETE FROM favorites WHERE user_id IN (?, ?)').run(testUserId, otherUserId);
    db.prepare('DELETE FROM recipes WHERE id = ?').run(testRecipeId);
  });

  describe('validateRecipeName', () => {
    it('should return sanitized name for valid input', () => {
      const result = favoriteService.validateRecipeName('Margarita');
      expect(result).toBe('Margarita');
    });

    it('should trim whitespace', () => {
      const result = favoriteService.validateRecipeName('  Margarita  ');
      expect(result).toBe('Margarita');
    });

    it('should return null for empty string', () => {
      const result = favoriteService.validateRecipeName('');
      expect(result).toBeNull();
    });

    it('should return null for whitespace only', () => {
      const result = favoriteService.validateRecipeName('   ');
      expect(result).toBeNull();
    });

    it('should return null for non-string input', () => {
      expect(favoriteService.validateRecipeName(null)).toBeNull();
      expect(favoriteService.validateRecipeName(undefined)).toBeNull();
      expect(favoriteService.validateRecipeName(123)).toBeNull();
      expect(favoriteService.validateRecipeName({})).toBeNull();
    });

    it('should truncate very long names', () => {
      const longName = 'A'.repeat(300);
      const result = favoriteService.validateRecipeName(longName);
      expect(result).not.toBeNull();
      expect(result!.length).toBeLessThanOrEqual(255);
    });
  });

  describe('validateRecipeId', () => {
    it('should accept valid positive numbers', () => {
      const result = favoriteService.validateRecipeId(1);
      expect(result.isValid).toBe(true);
      expect(result.value).toBe(1);
    });

    it('should accept null as valid (external recipe)', () => {
      const result = favoriteService.validateRecipeId(null);
      expect(result.isValid).toBe(true);
      expect(result.value).toBeNull();
    });

    it('should accept undefined as valid', () => {
      const result = favoriteService.validateRecipeId(undefined);
      expect(result.isValid).toBe(true);
      expect(result.value).toBeNull();
    });

    it('should accept empty string as valid', () => {
      const result = favoriteService.validateRecipeId('');
      expect(result.isValid).toBe(true);
      expect(result.value).toBeNull();
    });

    it('should reject zero', () => {
      const result = favoriteService.validateRecipeId(0);
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject negative numbers', () => {
      const result = favoriteService.validateRecipeId(-1);
      expect(result.isValid).toBe(false);
    });

    it('should accept numeric strings', () => {
      const result = favoriteService.validateRecipeId('123');
      expect(result.isValid).toBe(true);
      expect(result.value).toBe(123);
    });
  });

  describe('create', () => {
    it('should create a favorite with recipe_id', () => {
      const favorite = favoriteService.create(testUserId, 'Test Cocktail', testRecipeId);

      expect(favorite).toBeDefined();
      expect(favorite.id).toBeDefined();
      expect(favorite.user_id).toBe(testUserId);
      expect(favorite.recipe_name).toBe('Test Cocktail');
      expect(favorite.recipe_id).toBe(testRecipeId);
    });

    it('should create a favorite without recipe_id (external)', () => {
      const favorite = favoriteService.create(testUserId, 'External Recipe', null);

      expect(favorite).toBeDefined();
      expect(favorite.recipe_name).toBe('External Recipe');
      expect(favorite.recipe_id).toBeNull();
    });

    it('should set created_at timestamp', () => {
      const favorite = favoriteService.create(testUserId, 'Timestamped', null);

      expect(favorite.created_at).toBeDefined();
    });
  });

  describe('getAll', () => {
    it('should return empty array for user with no favorites', () => {
      const favorites = favoriteService.getAll(testUserId);
      expect(favorites).toEqual([]);
    });

    it('should return all favorites for user', () => {
      favoriteService.create(testUserId, 'Fav 1', null);
      favoriteService.create(testUserId, 'Fav 2', null);
      favoriteService.create(testUserId, 'Fav 3', null);

      const favorites = favoriteService.getAll(testUserId);

      expect(favorites).toHaveLength(3);
    });

    it('should order by created_at DESC (newest first)', () => {
      // Insert with explicit timestamps to guarantee ordering
      db.prepare(`
        INSERT INTO favorites (user_id, recipe_name, recipe_id, created_at)
        VALUES (?, ?, ?, datetime('now', '-2 seconds'))
      `).run(testUserId, 'First', null);
      db.prepare(`
        INSERT INTO favorites (user_id, recipe_name, recipe_id, created_at)
        VALUES (?, ?, ?, datetime('now', '-1 seconds'))
      `).run(testUserId, 'Second', null);
      db.prepare(`
        INSERT INTO favorites (user_id, recipe_name, recipe_id, created_at)
        VALUES (?, ?, ?, datetime('now'))
      `).run(testUserId, 'Third', null);

      const favorites = favoriteService.getAll(testUserId);

      expect(favorites[0].recipe_name).toBe('Third');
      expect(favorites[2].recipe_name).toBe('First');
    });

    it('should not return other users favorites', () => {
      favoriteService.create(testUserId, 'My Fav', null);
      favoriteService.create(otherUserId, 'Other Fav', null);

      const myFavorites = favoriteService.getAll(testUserId);

      expect(myFavorites).toHaveLength(1);
      expect(myFavorites[0].recipe_name).toBe('My Fav');
    });
  });

  describe('getPaginated', () => {
    beforeEach(() => {
      // Create 15 favorites for pagination testing
      for (let i = 1; i <= 15; i++) {
        favoriteService.create(testUserId, `Recipe ${i}`, null);
      }
    });

    it('should return paginated results with metadata', () => {
      const result = favoriteService.getPaginated(testUserId, 1, 5);

      expect(result.favorites).toHaveLength(5);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(5);
      expect(result.pagination.total).toBe(15);
      expect(result.pagination.totalPages).toBe(3);
      expect(result.pagination.hasNextPage).toBe(true);
      expect(result.pagination.hasPreviousPage).toBe(false);
    });

    it('should return correct page', () => {
      const result = favoriteService.getPaginated(testUserId, 2, 5);

      expect(result.pagination.page).toBe(2);
      expect(result.pagination.hasPreviousPage).toBe(true);
      expect(result.pagination.hasNextPage).toBe(true);
    });

    it('should handle last page', () => {
      const result = favoriteService.getPaginated(testUserId, 3, 5);

      expect(result.favorites).toHaveLength(5);
      expect(result.pagination.hasNextPage).toBe(false);
      expect(result.pagination.hasPreviousPage).toBe(true);
    });

    it('should clamp page to minimum 1', () => {
      const result = favoriteService.getPaginated(testUserId, -5, 5);

      expect(result.pagination.page).toBe(1);
    });

    it('should clamp limit to maximum 100', () => {
      const result = favoriteService.getPaginated(testUserId, 1, 500);

      expect(result.pagination.limit).toBe(100);
    });

    it('should use default values', () => {
      const result = favoriteService.getPaginated(testUserId);

      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(50);
    });
  });

  describe('getById', () => {
    it('should return favorite by ID', () => {
      const created = favoriteService.create(testUserId, 'Find Me', null);

      const found = favoriteService.getById(created.id, testUserId);

      expect(found).not.toBeNull();
      expect(found!.recipe_name).toBe('Find Me');
    });

    it('should return null for non-existent ID', () => {
      const found = favoriteService.getById(99999, testUserId);

      expect(found).toBeNull();
    });

    it('should return null for wrong user', () => {
      const created = favoriteService.create(testUserId, 'Private', null);

      const found = favoriteService.getById(created.id, otherUserId);

      expect(found).toBeNull();
    });
  });

  describe('exists', () => {
    it('should return true for existing favorite', () => {
      const created = favoriteService.create(testUserId, 'Exists', null);

      expect(favoriteService.exists(created.id, testUserId)).toBe(true);
    });

    it('should return false for non-existent favorite', () => {
      expect(favoriteService.exists(99999, testUserId)).toBe(false);
    });

    it('should return false for wrong user', () => {
      const created = favoriteService.create(testUserId, 'Private', null);

      expect(favoriteService.exists(created.id, otherUserId)).toBe(false);
    });
  });

  describe('delete', () => {
    it('should delete favorite and return true', () => {
      const created = favoriteService.create(testUserId, 'Delete Me', null);

      const result = favoriteService.delete(created.id, testUserId);

      expect(result).toBe(true);
      expect(favoriteService.exists(created.id, testUserId)).toBe(false);
    });

    it('should return false for non-existent favorite', () => {
      const result = favoriteService.delete(99999, testUserId);

      expect(result).toBe(false);
    });

    it('should return false when trying to delete other users favorite', () => {
      const created = favoriteService.create(testUserId, 'Protected', null);

      const result = favoriteService.delete(created.id, otherUserId);

      expect(result).toBe(false);
      // Original should still exist
      expect(favoriteService.exists(created.id, testUserId)).toBe(true);
    });
  });

  describe('isRecipeFavorited', () => {
    it('should return true if recipe is favorited', () => {
      favoriteService.create(testUserId, 'Favorited Recipe', testRecipeId);

      expect(favoriteService.isRecipeFavorited(testUserId, testRecipeId)).toBe(true);
    });

    it('should return false if recipe is not favorited', () => {
      expect(favoriteService.isRecipeFavorited(testUserId, 999)).toBe(false);
    });

    it('should not find other users favorites', () => {
      favoriteService.create(testUserId, 'Other Fav', testRecipeId);

      // Other user should not find testUser's favorite
      expect(favoriteService.isRecipeFavorited(otherUserId, testRecipeId)).toBe(false);
    });
  });

  describe('getByRecipeId', () => {
    it('should return favorite by recipe ID', () => {
      favoriteService.create(testUserId, 'By Recipe ID', testRecipeId);

      const found = favoriteService.getByRecipeId(testUserId, testRecipeId);

      expect(found).not.toBeNull();
      expect(found!.recipe_name).toBe('By Recipe ID');
    });

    it('should return null if not found', () => {
      const found = favoriteService.getByRecipeId(testUserId, 999);

      expect(found).toBeNull();
    });
  });
});
