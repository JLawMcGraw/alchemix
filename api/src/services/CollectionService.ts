/**
 * Collection Service
 *
 * Business logic for recipe collections (books/groups).
 * Extracted from routes/collections.ts for testability and reusability.
 *
 * @version 1.0.0
 * @date December 2025
 */

import { queryOne, queryAll, execute } from '../database/db';
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
  async getAll(userId: number): Promise<CollectionWithCount[]> {
    return queryAll<CollectionWithCount>(
      `SELECT
        c.*,
        COUNT(r.id) as recipe_count
      FROM collections c
      LEFT JOIN recipes r ON r.collection_id = c.id
      WHERE c.user_id = $1
      GROUP BY c.id
      ORDER BY c.created_at DESC`,
      [userId]
    );
  }

  /**
   * Get paginated collections for a user with recipe counts
   *
   * @param userId - User ID
   * @param page - Page number (1-indexed, default 1)
   * @param limit - Items per page (default 50, max 100)
   */
  async getPaginated(userId: number, page: number = 1, limit: number = 50): Promise<PaginatedCollections> {
    // Validate and clamp parameters
    const safePage = Math.max(1, Math.floor(page));
    const safeLimit = Math.min(100, Math.max(1, Math.floor(limit)));
    const offset = (safePage - 1) * safeLimit;

    // Get total count
    const countResult = await queryOne<{ total: string }>(
      'SELECT COUNT(*) as total FROM collections WHERE user_id = $1',
      [userId]
    );

    const total = parseInt(countResult?.total ?? '0', 10);
    const totalPages = Math.ceil(total / safeLimit);

    // Get paginated results with recipe counts
    const collections = await queryAll<CollectionWithCount>(
      `SELECT
        c.*,
        COUNT(r.id) as recipe_count
      FROM collections c
      LEFT JOIN recipes r ON r.collection_id = c.id
      WHERE c.user_id = $1
      GROUP BY c.id
      ORDER BY c.created_at DESC
      LIMIT $2 OFFSET $3`,
      [userId, safeLimit, offset]
    );

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
  async getById(collectionId: number, userId: number): Promise<Collection | null> {
    return queryOne<Collection>(
      'SELECT * FROM collections WHERE id = $1 AND user_id = $2',
      [collectionId, userId]
    );
  }

  /**
   * Check if a collection exists and belongs to user
   */
  async exists(collectionId: number, userId: number): Promise<boolean> {
    const result = await queryOne<{ id: number }>(
      'SELECT id FROM collections WHERE id = $1 AND user_id = $2',
      [collectionId, userId]
    );
    return !!result;
  }

  /**
   * Create a new collection
   */
  async create(userId: number, input: CreateCollectionInput): Promise<Collection> {
    const sanitizedName = sanitizeString(input.name, 100);
    const sanitizedDescription = input.description
      ? sanitizeString(input.description, 500)
      : null;

    const result = await execute(
      `INSERT INTO collections (user_id, name, description)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [userId, sanitizedName, sanitizedDescription]
    );

    const collection = result.rows[0] as Collection;

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
  async update(collectionId: number, userId: number, input: UpdateCollectionInput): Promise<UpdateResult> {
    // Check ownership
    if (!await this.exists(collectionId, userId)) {
      return { success: false, error: 'Collection not found or access denied' };
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: (string | number | null)[] = [];
    let paramIndex = 1;

    if (input.name !== undefined) {
      const sanitizedName = sanitizeString(input.name, 100);
      if (sanitizedName) {
        updates.push(`name = $${paramIndex++}`);
        values.push(sanitizedName);
      }
    }

    if (input.description !== undefined) {
      const sanitizedDescription = input.description
        ? sanitizeString(input.description, 500)
        : null;
      updates.push(`description = $${paramIndex++}`);
      values.push(sanitizedDescription);
    }

    if (updates.length === 0) {
      return { success: false, error: 'No valid fields to update' };
    }

    values.push(collectionId);

    const result = await execute(
      `UPDATE collections
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );

    const collection = result.rows[0] as Collection;

    return { success: true, collection };
  }

  /**
   * Delete a collection
   *
   * Recipes in this collection will have collection_id set to NULL (not deleted).
   * Returns false if collection doesn't exist or doesn't belong to user.
   */
  async delete(collectionId: number, userId: number): Promise<boolean> {
    if (!await this.exists(collectionId, userId)) {
      return false;
    }

    await execute('DELETE FROM collections WHERE id = $1', [collectionId]);
    return true;
  }

  /**
   * Delete a collection and all its recipes
   *
   * Returns the number of recipes deleted, or -1 if collection doesn't exist.
   */
  async deleteWithRecipes(collectionId: number, userId: number): Promise<{ success: boolean; recipesDeleted: number }> {
    if (!await this.exists(collectionId, userId)) {
      return { success: false, recipesDeleted: 0 };
    }

    // Delete recipes in this collection first
    const deleteRecipesResult = await execute(
      'DELETE FROM recipes WHERE collection_id = $1 AND user_id = $2',
      [collectionId, userId]
    );

    // Then delete the collection
    await execute('DELETE FROM collections WHERE id = $1', [collectionId]);

    return { success: true, recipesDeleted: deleteRecipesResult.rowCount ?? 0 };
  }
}

// Export singleton instance
export const collectionService = new CollectionService();
