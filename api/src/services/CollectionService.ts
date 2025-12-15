/**
 * Collection Service
 *
 * Business logic for recipe collections (books/groups).
 * Extracted from routes/collections.ts for testability and reusability.
 *
 * @version 1.0.0
 * @date December 2025
 */

import { db } from '../database/db';
import { sanitizeString } from '../utils/inputValidator';
import { memoryService } from './MemoryService';

/**
 * Collection entity as stored in database
 */
export interface Collection {
  id: number;
  user_id: number;
  name: string;
  description: string | null;
  created_at: string;
}

/**
 * Collection with computed recipe count
 */
export interface CollectionWithCount extends Collection {
  recipe_count: number;
}

/**
 * Input for creating a collection
 */
export interface CreateCollectionInput {
  name: string;
  description?: string;
}

/**
 * Input for updating a collection
 */
export interface UpdateCollectionInput {
  name?: string;
  description?: string | null;
}

/**
 * Result of an update operation
 */
export interface UpdateResult {
  success: boolean;
  collection?: Collection;
  error?: string;
}

/**
 * Pagination result for collections
 */
export interface PaginatedCollections {
  collections: CollectionWithCount[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

/**
 * Collection Service
 *
 * Handles all collection business logic independent of HTTP layer.
 */
export class CollectionService {
  /**
   * Get all collections for a user with recipe counts (no pagination - backwards compatible)
   */
  getAll(userId: number): CollectionWithCount[] {
    return db.prepare(`
      SELECT
        c.*,
        COUNT(r.id) as recipe_count
      FROM collections c
      LEFT JOIN recipes r ON r.collection_id = c.id
      WHERE c.user_id = ?
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `).all(userId) as CollectionWithCount[];
  }

  /**
   * Get paginated collections for a user with recipe counts
   *
   * @param userId - User ID
   * @param page - Page number (1-indexed, default 1)
   * @param limit - Items per page (default 50, max 100)
   */
  getPaginated(userId: number, page: number = 1, limit: number = 50): PaginatedCollections {
    // Validate and clamp parameters
    const safePage = Math.max(1, Math.floor(page));
    const safeLimit = Math.min(100, Math.max(1, Math.floor(limit)));
    const offset = (safePage - 1) * safeLimit;

    // Get total count
    const countResult = db.prepare(
      'SELECT COUNT(*) as total FROM collections WHERE user_id = ?'
    ).get(userId) as { total: number };

    const total = countResult.total;
    const totalPages = Math.ceil(total / safeLimit);

    // Get paginated results with recipe counts
    const collections = db.prepare(`
      SELECT
        c.*,
        COUNT(r.id) as recipe_count
      FROM collections c
      LEFT JOIN recipes r ON r.collection_id = c.id
      WHERE c.user_id = ?
      GROUP BY c.id
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
    `).all(userId, safeLimit, offset) as CollectionWithCount[];

    return {
      collections,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages,
        hasNextPage: safePage < totalPages,
        hasPreviousPage: safePage > 1
      }
    };
  }

  /**
   * Get a single collection by ID (with ownership check)
   */
  getById(collectionId: number, userId: number): Collection | null {
    const collection = db.prepare(
      'SELECT * FROM collections WHERE id = ? AND user_id = ?'
    ).get(collectionId, userId) as Collection | undefined;

    return collection || null;
  }

  /**
   * Check if a collection exists and belongs to user
   */
  exists(collectionId: number, userId: number): boolean {
    const result = db.prepare(
      'SELECT id FROM collections WHERE id = ? AND user_id = ?'
    ).get(collectionId, userId);

    return !!result;
  }

  /**
   * Create a new collection
   */
  create(userId: number, input: CreateCollectionInput): Collection {
    const sanitizedName = sanitizeString(input.name, 100);
    const sanitizedDescription = input.description
      ? sanitizeString(input.description, 500)
      : null;

    const result = db.prepare(`
      INSERT INTO collections (user_id, name, description)
      VALUES (?, ?, ?)
    `).run(userId, sanitizedName, sanitizedDescription);

    const collection = db.prepare(
      'SELECT * FROM collections WHERE id = ?'
    ).get(result.lastInsertRowid) as Collection;

    // Store in MemMachine (fire-and-forget)
    memoryService.storeUserCollection(userId, {
      name: sanitizedName,
      description: sanitizedDescription || undefined,
    }).catch(err => {
      console.error('Failed to store collection in MemMachine (non-critical):', err);
    });

    return collection;
  }

  /**
   * Update an existing collection
   *
   * Returns null if collection doesn't exist or doesn't belong to user
   */
  update(collectionId: number, userId: number, input: UpdateCollectionInput): UpdateResult {
    // Check ownership
    if (!this.exists(collectionId, userId)) {
      return { success: false, error: 'Collection not found or access denied' };
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: (string | number | null)[] = [];

    if (input.name !== undefined) {
      const sanitizedName = sanitizeString(input.name, 100);
      if (sanitizedName) {
        updates.push('name = ?');
        values.push(sanitizedName);
      }
    }

    if (input.description !== undefined) {
      const sanitizedDescription = input.description
        ? sanitizeString(input.description, 500)
        : null;
      updates.push('description = ?');
      values.push(sanitizedDescription);
    }

    if (updates.length === 0) {
      return { success: false, error: 'No valid fields to update' };
    }

    values.push(collectionId);

    db.prepare(`
      UPDATE collections
      SET ${updates.join(', ')}
      WHERE id = ?
    `).run(...values);

    const collection = db.prepare(
      'SELECT * FROM collections WHERE id = ?'
    ).get(collectionId) as Collection;

    return { success: true, collection };
  }

  /**
   * Delete a collection
   *
   * Recipes in this collection will have collection_id set to NULL (not deleted).
   * Returns false if collection doesn't exist or doesn't belong to user.
   */
  delete(collectionId: number, userId: number): boolean {
    if (!this.exists(collectionId, userId)) {
      return false;
    }

    db.prepare('DELETE FROM collections WHERE id = ?').run(collectionId);
    return true;
  }

  /**
   * Delete a collection and all its recipes
   *
   * Returns the number of recipes deleted, or -1 if collection doesn't exist.
   */
  deleteWithRecipes(collectionId: number, userId: number): { success: boolean; recipesDeleted: number } {
    if (!this.exists(collectionId, userId)) {
      return { success: false, recipesDeleted: 0 };
    }

    // Delete recipes in this collection first
    const deleteRecipesResult = db.prepare(
      'DELETE FROM recipes WHERE collection_id = ? AND user_id = ?'
    ).run(collectionId, userId);

    // Then delete the collection
    db.prepare('DELETE FROM collections WHERE id = ?').run(collectionId);

    return { success: true, recipesDeleted: deleteRecipesResult.changes };
  }
}

// Export singleton instance
export const collectionService = new CollectionService();
