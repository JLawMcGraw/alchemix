/**
 * MemMachine Memory Service Client (v2 API)
 *
 * Integrates AlcheMix with MemMachine v2 for AI memory capabilities:
 * - Semantic search over user recipes (OpenAI embeddings)
 * - Conversation memory across sessions
 * - User preference storage and retrieval
 *
 * Architecture:
 * - MemMachine backend (port 8080): Core memory service (Docker)
 * - User isolation: Each user has their own project (user_X_recipes)
 * - No cross-user data leakage: User 1 cannot access User 2's recipes
 * - Project-based organization: org_id/project_id model
 *
 * Migration from v1 → v2 API:
 * - Old: Header-based sessions (user-id, session-id, group-id, agent-id)
 * - New: Body-based org_id/project_id params
 * - Old: UUID for episode IDs
 * - New: UID for episode IDs
 * - Old: profile_memory
 * - New: semantic_memory
 *
 * @version 3.0.0 (MemMachine v2 API)
 * @date December 2, 2025
 */

import type Database from 'better-sqlite3';
import { logger } from '../utils/logger';
import {
  AddMemoriesRequest,
  AddMemoriesResponse,
  SearchMemoriesRequest,
  SearchResultResponse,
  DeleteEpisodicMemoryRequest,
  DeleteProjectRequest,
  CreateProjectRequest,
  EpisodicEpisode,
  SemanticMemory,
  NormalizedSearchResult,
  MEMMACHINE_CONSTANTS,
  buildRecipeProjectId,
  buildChatProjectId,
} from '../types/memmachine';

const { ORG_ID, DEFAULT_SEARCH_LIMIT, MAX_PROMPT_RECIPES } = MEMMACHINE_CONSTANTS;

/**
 * Custom HTTP Error for fetch responses
 */
class HttpError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

/**
 * Check if error is an HTTP error with specific status
 */
function isHttpError(error: unknown): error is HttpError {
  return error instanceof HttpError;
}

/**
 * MemoryService Configuration
 */
export interface MemoryServiceConfig {
  baseURL: string;
  timeout?: number;
}

/**
 * Recipe Data for Storage
 */
export interface RecipeData {
  name: string;
  ingredients: string[] | string;
  instructions?: string;
  glass?: string;
  category?: string;
}

/**
 * Collection Data for Storage
 */
export interface CollectionData {
  name: string;
  description?: string;
}

/**
 * MemoryService Client (v2 API)
 *
 * Provides type-safe interface to MemMachine v2 API
 */
export class MemoryService {
  private baseURL: string;
  private timeout: number;
  private projectCache: Set<string> = new Set(); // Cache of created projects

  constructor(config: MemoryServiceConfig) {
    this.baseURL = config.baseURL;
    this.timeout = config.timeout || 120000; // 120 seconds for batch operations
  }

  /**
   * Make HTTP POST request using native fetch
   */
  private async post<T>(path: string, body: unknown): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseURL}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new HttpError(`HTTP ${response.status}: ${response.statusText}`, response.status);
      }

      return await response.json() as T;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Make HTTP GET request using native fetch
   */
  private async get<T>(path: string): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseURL}${path}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new HttpError(`HTTP ${response.status}: ${response.statusText}`, response.status);
      }

      return await response.json() as T;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Ensure Project Exists
   *
   * Creates a project if it doesn't exist. Uses local cache to avoid
   * unnecessary API calls.
   *
   * @param userId - AlcheMix user ID
   * @param projectType - Type of project ('recipes' or 'chat')
   */
  private async ensureProjectExists(userId: number, projectType: 'recipes' | 'chat', date?: string): Promise<string> {
    const projectId = projectType === 'recipes'
      ? buildRecipeProjectId(userId)
      : buildChatProjectId(userId, date);

    // Check local cache first
    if (this.projectCache.has(projectId)) {
      return projectId;
    }

    try {
      const request: CreateProjectRequest = {
        org_id: ORG_ID,
        project_id: projectId,
        description: `${projectType} for user ${userId}`,
      };

      await this.post('/api/v2/projects', request);
      this.projectCache.add(projectId);
      logger.info('MemMachine: Created project', { projectId });
    } catch (error) {
      if (isHttpError(error) && error.status === 409) {
        // 409 Conflict = project already exists, which is fine
        this.projectCache.add(projectId);
      } else {
        throw error;
      }
    }

    return projectId;
  }

  /**
   * Format Recipe for Storage
   *
   * Converts recipe object into semantic-rich text for embeddings.
   * MemMachine will generate vector embeddings from this text for semantic search.
   *
   * @param recipe - Recipe object with name, ingredients, instructions, etc.
   * @returns Formatted string optimized for semantic search
   */
  private formatRecipeForStorage(recipe: RecipeData): string {
    // Parse ingredients - handle both string and array formats
    let ingredientsText: string;
    if (Array.isArray(recipe.ingredients)) {
      ingredientsText = recipe.ingredients.join(', ');
    } else if (typeof recipe.ingredients === 'string') {
      try {
        const parsed = JSON.parse(recipe.ingredients);
        ingredientsText = Array.isArray(parsed) ? parsed.join(', ') : recipe.ingredients;
      } catch {
        ingredientsText = recipe.ingredients;
      }
    } else {
      ingredientsText = String(recipe.ingredients);
    }

    // Create semantic-rich text for embeddings
    // Format optimized for natural language search queries
    return [
      `Recipe: ${recipe.name}`,
      `Category: ${recipe.category || 'Cocktail'}`,
      recipe.glass ? `Glass: ${recipe.glass}` : '',
      `Ingredients: ${ingredientsText}`,
      recipe.instructions ? `Instructions: ${recipe.instructions}` : '',
    ]
      .filter(Boolean)
      .join('. ');
  }

  /**
   * Validate and Normalize Search Response
   *
   * Ensures MemMachine response has expected structure and normalizes it.
   * Prevents runtime errors from missing fields.
   *
   * @param response - Raw response from MemMachine API
   * @returns Normalized search result with episodic and semantic memories
   */
  private validateAndNormalizeResponse(response: SearchResultResponse): NormalizedSearchResult {
    // Validate top-level structure
    if (!response || typeof response !== 'object') {
      throw new Error('Invalid response structure from MemMachine: response is not an object');
    }

    if (!response.content || typeof response.content !== 'object') {
      throw new Error('Invalid response structure from MemMachine: missing content field');
    }

    const { episodic_memory, semantic_memory } = response.content;

    // v2 API returns nested structure: episodic_memory.long_term_memory.episodes
    // Extract episodes from long-term memory (recipes, stored facts)
    let validatedEpisodic: EpisodicEpisode[] = [];
    
    if (episodic_memory && typeof episodic_memory === 'object') {
      // Extract from long_term_memory
      if (episodic_memory.long_term_memory?.episodes && Array.isArray(episodic_memory.long_term_memory.episodes)) {
        validatedEpisodic = episodic_memory.long_term_memory.episodes.filter(
          (ep) => ep && typeof ep === 'object' && ep.content
        );
      }
      
      // Also include short_term_memory episodes if present
      if (episodic_memory.short_term_memory?.episodes && Array.isArray(episodic_memory.short_term_memory.episodes)) {
        const shortTermEpisodes = episodic_memory.short_term_memory.episodes.filter(
          (ep) => ep && typeof ep === 'object' && ep.content
        );
        validatedEpisodic = [...validatedEpisodic, ...shortTermEpisodes];
      }
    }

    const validatedSemantic: SemanticMemory[] = Array.isArray(semantic_memory) ? semantic_memory : [];

    return {
      episodic: validatedEpisodic,
      semantic: validatedSemantic,
    };
  }

  /**
   * Store User Recipe
   *
   * Stores a user's recipe in MemMachine for semantic search and AI context.
   * Recipe is stored in the user's recipes project.
   *
   * UID Tracking:
   * - Returns UID from MemMachine response
   * - Caller should store UID in AlcheMix DB (recipes.memmachine_uid column)
   * - Use UID for granular deletion
   *
   * @param userId - User ID
   * @param recipe - Recipe object with name, ingredients, instructions, etc.
   * @returns UID of the created episode (or null if storage failed)
   */
  async storeUserRecipe(userId: number, recipe: RecipeData): Promise<string | null> {
    try {
      const projectId = await this.ensureProjectExists(userId, 'recipes');
      const recipeText = this.formatRecipeForStorage(recipe);

      const request: AddMemoriesRequest = {
        org_id: ORG_ID,
        project_id: projectId,
        messages: [
          {
            content: recipeText,
            producer: `user_${userId}`,
            produced_for: `user_${userId}`,
          },
        ],
      };

      const response = await this.post<AddMemoriesResponse>('/api/v2/memories', request);

      const uid = response.results?.[0]?.uid;
      if (uid) {
        logger.info('MemMachine: Stored recipe', { recipeName: recipe.name, userId, uid });
        return uid;
      }

      logger.warn('MemMachine: No UID returned for recipe', { recipeName: recipe.name });
      return null;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('MemMachine: Failed to store recipe', { userId, error: errorMsg });
      // Don't throw - recipe storage in MemMachine is optional (fire-and-forget)
      return null;
    }
  }

  /**
   * Store Multiple User Recipes in Batches
   *
   * Efficiently stores multiple recipes using batched requests with rate limiting.
   * This prevents overwhelming MemMachine with sequential requests during bulk imports.
   *
   * Strategy:
   * - Process recipes in batches of 10
   * - Wait 500ms between batches to prevent rate limiting
   * - Continue processing even if some recipes fail
   * - Return UIDs mapped to recipe names for database storage
   *
   * @param userId - User ID
   * @param recipes - Array of recipe objects
   * @returns Object with success/failure counts and UID mapping
   */
  async storeUserRecipesBatch(
    userId: number,
    recipes: RecipeData[]
  ): Promise<{
    success: number;
    failed: number;
    errors: string[];
    uidMap: Map<string, string>; // Map recipe name → UID
  }> {
    const batchSize = 10;
    const delayBetweenBatches = 500;
    let successCount = 0;
    let failedCount = 0;
    const errors: string[] = [];
    const uidMap = new Map<string, string>();

    logger.info('MemMachine: Starting batch upload', { recipeCount: recipes.length, userId });

    // Ensure project exists once
    const projectId = await this.ensureProjectExists(userId, 'recipes');

    // Process recipes in batches
    for (let i = 0; i < recipes.length; i += batchSize) {
      const batch = recipes.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(recipes.length / batchSize);

      logger.info('MemMachine: Processing batch', { batchNumber, totalBatches, batchSize: batch.length });

      // Process each recipe in the current batch concurrently
      const batchPromises = batch.map(async (recipe) => {
        try {
          const recipeText = this.formatRecipeForStorage(recipe);

          const request: AddMemoriesRequest = {
            org_id: ORG_ID,
            project_id: projectId,
            messages: [
              {
                content: recipeText,
                producer: `user_${userId}`,
                produced_for: `user_${userId}`,
              },
            ],
          };

          const response = await this.post<AddMemoriesResponse>('/api/v2/memories', request);
          const uid = response.results?.[0]?.uid;

          logger.info('MemMachine: Stored recipe in batch', { recipeName: recipe.name, userId, uid });
          return { success: true, recipe: recipe.name, uid };
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          logger.error('MemMachine: Failed to store recipe in batch', { recipeName: recipe.name, userId, error: errorMsg });
          return { success: false, recipe: recipe.name, uid: null, error: errorMsg };
        }
      });

      // Wait for all recipes in this batch to complete
      const batchResults = await Promise.allSettled(batchPromises);

      // Count successes and failures, collect UIDs
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          if (result.value.success) {
            successCount++;
            if (result.value.uid) {
              uidMap.set(result.value.recipe, result.value.uid);
            }
          } else {
            failedCount++;
            errors.push(`${result.value.recipe}: ${result.value.error}`);
          }
        } else {
          failedCount++;
          errors.push(`Unknown recipe: ${result.reason}`);
        }
      }

      // Wait between batches (except for the last batch)
      if (i + batchSize < recipes.length) {
        await new Promise((resolve) => setTimeout(resolve, delayBetweenBatches));
      }
    }

    logger.info('MemMachine: Batch upload complete', { succeeded: successCount, failed: failedCount, uidsCaptured: uidMap.size });

    return { success: successCount, failed: failedCount, errors, uidMap };
  }

  /**
   * Query User Profile and Recipes
   *
   * Searches user's recipes and preferences using semantic search.
   * MemMachine uses OpenAI embeddings to find relevant recipes.
   *
   * @param userId - User ID
   * @param query - Natural language query (e.g., "rum cocktails with lime")
   * @returns Normalized search results with episodic and semantic memories
   * @throws Error if API call fails
   */
  async queryUserProfile(userId: number, query: string): Promise<NormalizedSearchResult> {
    try {
      const projectId = buildRecipeProjectId(userId);

      const searchRequest: SearchMemoriesRequest = {
        org_id: ORG_ID,
        project_id: projectId,
        query,
        top_k: DEFAULT_SEARCH_LIMIT,
      };

      const response = await this.post<SearchResultResponse>('/api/v2/memories/search', searchRequest);

      // Validate and normalize response structure
      const normalizedResult = this.validateAndNormalizeResponse(response);

      logger.info('MemMachine: Search results', { userId, episodicCount: normalizedResult.episodic.length, semanticCount: normalizedResult.semantic.length });

      return normalizedResult;
    } catch (error) {
      // 404 is expected if user has no recipes yet
      if (isHttpError(error) && error.status === 404) {
        logger.info('MemMachine: No project found for user (new user)', { userId });
        return { episodic: [], semantic: [] };
      }
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('MemMachine: User profile query failed', { userId, error: errorMsg });
      throw new Error(`Failed to query user profile: ${errorMsg}`);
    }
  }

  /**
   * Store Conversation Turn
   *
   * Stores a user message and AI response as episodic memory.
   * Uses date-based project IDs for daily conversation threads.
   *
   * Project Strategy: user_{userId}_chat_{YYYY-MM-DD}
   * - All conversations on the same day are grouped together
   * - Easy to retrieve conversation history by date
   * - Natural conversation boundaries
   *
   * @param userId - User ID
   * @param userMessage - User's message
   * @param aiResponse - AI bartender's response
   */
  async storeConversationTurn(userId: number, userMessage: string, aiResponse: string): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const projectId = await this.ensureProjectExists(userId, 'chat', today);

      const userIdStr = `user_${userId}`;

      // Store both messages in one request
      const request: AddMemoriesRequest = {
        org_id: ORG_ID,
        project_id: projectId,
        messages: [
          {
            content: `User: ${userMessage}`,
            producer: userIdStr,
            produced_for: 'alchemix-bartender',
            role: 'user',
          },
          {
            content: `Assistant: ${aiResponse}`,
            producer: 'alchemix-bartender',
            produced_for: userIdStr,
            role: 'assistant',
          },
        ],
      };

      await this.post('/api/v2/memories', request);

      logger.info('MemMachine: Stored conversation turn', { userId, projectId });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('MemMachine: Failed to store conversation', { userId, error: errorMsg });
      // Don't throw - conversation storage is optional
    }
  }

  /**
   * Delete User Recipe by UID
   *
   * Deletes a specific recipe from MemMachine using its UID.
   * This ensures the AI context stays synchronized with AlcheMix database.
   *
   * How it works:
   * 1. Recipe is created → MemMachine returns UID → Stored in recipes.memmachine_uid
   * 2. Recipe is deleted from AlcheMix → This method uses UID to delete from MemMachine
   * 3. AI context stays clean - no stale recipe recommendations
   *
   * @param userId - User ID
   * @param uid - MemMachine episode UID (from recipes.memmachine_uid)
   * @param recipeName - Recipe name (for logging only)
   * @returns True if deletion succeeded, false otherwise
   */
  async deleteUserRecipeByUid(userId: number, uid: string, recipeName?: string): Promise<boolean> {
    try {
      const projectId = buildRecipeProjectId(userId);

      const request: DeleteEpisodicMemoryRequest = {
        org_id: ORG_ID,
        project_id: projectId,
        episodic_id: uid,
      };

      await this.post('/api/v2/memories/episodic/delete', request);

      logger.info('MemMachine: Deleted recipe', { userId, recipeName: recipeName || undefined, uid });
      return true;
    } catch (error) {
      // 404 is acceptable - recipe might have already been deleted
      if (isHttpError(error) && error.status === 404) {
        logger.info('MemMachine: Recipe not found (already deleted)', { userId, recipeName: recipeName || undefined, uid });
        return true;
      }
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('MemMachine: Failed to delete recipe', { userId, recipeName: recipeName || undefined, uid, error: errorMsg });
      // Don't throw - deletion failures shouldn't break the app
      return false;
    }
  }

  /**
   * Delete User Recipe (Legacy - No UID)
   *
   * For recipes created before UID tracking was implemented.
   * These recipes don't have memmachine_uid in the database.
   *
   * @param userId - User ID
   * @param recipeName - Name of recipe to delete
   */
  async deleteUserRecipe(userId: number, recipeName: string): Promise<void> {
    logger.info('MemMachine: Legacy recipe deleted from AlcheMix (no UID)', { userId, recipeName });
  }

  /**
   * Delete Multiple Recipes by UID (Batch)
   *
   * Efficiently deletes multiple recipes from MemMachine during bulk operations.
   * Uses same batching strategy as bulk upload.
   *
   * @param userId - User ID
   * @param uids - Array of MemMachine episode UIDs
   * @returns Object with success/failure counts
   */
  async deleteUserRecipesBatch(userId: number, uids: string[]): Promise<{ success: number; failed: number }> {
    const batchSize = 10;
    const delayBetweenBatches = 500;
    let successCount = 0;
    let failedCount = 0;

    logger.info('MemMachine: Starting batch deletion', { uidCount: uids.length, userId });

    const projectId = buildRecipeProjectId(userId);

    for (let i = 0; i < uids.length; i += batchSize) {
      const batch = uids.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(uids.length / batchSize);

      logger.info('MemMachine: Processing deletion batch', { batchNumber, totalBatches, batchSize: batch.length });

      const batchPromises = batch.map(async (uid) => {
        try {
          const request: DeleteEpisodicMemoryRequest = {
            org_id: ORG_ID,
            project_id: projectId,
            episodic_id: uid,
          };

          await this.post('/api/v2/memories/episodic/delete', request);
          return { success: true };
        } catch (error) {
          // 404 is acceptable
          if (isHttpError(error) && error.status === 404) {
            return { success: true };
          }
          return { success: false };
        }
      });

      const batchResults = await Promise.allSettled(batchPromises);

      for (const result of batchResults) {
        if (result.status === 'fulfilled' && result.value.success) {
          successCount++;
        } else {
          failedCount++;
        }
      }

      if (i + batchSize < uids.length) {
        await new Promise((resolve) => setTimeout(resolve, delayBetweenBatches));
      }
    }

    logger.info('MemMachine: Batch deletion complete', { succeeded: successCount, failed: failedCount });

    return { success: successCount, failed: failedCount };
  }

  /**
   * Delete All Recipe Memories for User
   *
   * Deletes the entire recipes project for a user in MemMachine.
   * Use this when you want to start fresh with UID tracking.
   *
   * WARNING: This deletes ALL recipes from MemMachine for this user.
   * Only use when you plan to re-upload recipes with UID tracking.
   *
   * @param userId - User ID
   * @returns True if deletion succeeded, false otherwise
   */
  async deleteAllRecipeMemories(userId: number): Promise<boolean> {
    try {
      const projectId = buildRecipeProjectId(userId);

      const request: DeleteProjectRequest = {
        org_id: ORG_ID,
        project_id: projectId,
      };

      await this.post('/api/v2/projects/delete', request);

      // Remove from cache so it can be recreated
      this.projectCache.delete(projectId);

      logger.info('MemMachine: Deleted ALL recipe memories', { userId, projectId });
      return true;
    } catch (error) {
      // 404 is acceptable - project might not exist
      if (isHttpError(error) && error.status === 404) {
        logger.info('MemMachine: Project not found (already deleted or never existed)', { userId });
        return true;
      }
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('MemMachine: Failed to delete all recipe memories', { userId, error: errorMsg });
      return false;
    }
  }

  /**
   * Store User Collection
   *
   * Stores metadata about a user's recipe collection for context.
   * Helps AI understand user's organization and preferences.
   *
   * @param userId - User ID
   * @param collection - Collection object with name and description
   */
  async storeUserCollection(userId: number, collection: CollectionData): Promise<void> {
    try {
      const projectId = await this.ensureProjectExists(userId, 'recipes');

      const collectionText =
        `User created a recipe collection named "${collection.name}"` +
        (collection.description ? ` with description: "${collection.description}"` : '');

      const request: AddMemoriesRequest = {
        org_id: ORG_ID,
        project_id: projectId,
        messages: [
          {
            content: collectionText,
            producer: `user_${userId}`,
            produced_for: `user_${userId}`,
          },
        ],
      };

      await this.post('/api/v2/memories', request);

      logger.info('MemMachine: Stored collection', { collectionName: collection.name, userId });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('MemMachine: Failed to store collection', { userId, error: errorMsg });
      // Don't throw - collection storage is optional
    }
  }

  /**
   * Get Enhanced Context (User-Specific Recipes Only)
   *
   * Queries user's own recipes and preferences for context-aware recommendations.
   * No global knowledge base - each user only sees their own recipes.
   *
   * @param userId - User ID
   * @param query - User's cocktail query
   * @returns User's recipes and preferences matching the query (or null if unavailable)
   */
  async getEnhancedContext(
    userId: number,
    query: string
  ): Promise<{
    userContext: NormalizedSearchResult | null;
  }> {
    try {
      // Query user's own recipes and preferences
      const userContext = await this.queryUserProfile(userId, query);
      return { userContext };
    } catch (error) {
      logger.warn('MemoryService: User context query failed, continuing without it', { userId });
      return { userContext: null };
    }
  }

  /**
   * Format Context for AI Prompt (with Database Cross-Reference + Duplicate Filtering)
   *
   * Converts NormalizedSearchResult into human-readable string for Claude's system prompt.
   * FILTERS OUT:
   * 1. Deleted recipes (cross-reference with AlcheMix database)
   * 2. Already-recommended recipes (from conversation history)
   *
   * This solves two problems:
   * - MemMachine UID limitation: Filter deleted recipes when building AI context
   * - Duplicate recommendations: Hide recipes already suggested in this conversation
   *
   * @param searchResult - Normalized search result from MemMachine
   * @param userId - User ID (for database lookup)
   * @param db - Database instance (optional, for recipe verification)
   * @param limit - Maximum number of recipes to include (default: MAX_PROMPT_RECIPES)
   * @param alreadyRecommended - Set of recipe names to exclude (already recommended)
   * @returns Formatted string for AI prompt
   */
  formatContextForPrompt(
    searchResult: NormalizedSearchResult,
    userId: number,
    db?: Database.Database,
    limit: number = MAX_PROMPT_RECIPES,
    alreadyRecommended: Set<string> = new Set()
  ): string {
    if (!searchResult || (!searchResult.episodic?.length && !searchResult.semantic?.length)) {
      return '';
    }

    // Relabeled: These are SEARCH RESULTS, not definitive answers
    let contextText = '\n\n## SEMANTIC SEARCH RESULTS (Evaluate These - Not Pre-Selected Answers)\n';

    // Add episodic memories (specific recipes found)
    // FILTERING LOGIC: Only include episodes that:
    // 1. Contain recipe content
    // 2. Still exist in DB
    // 3. Haven't been recommended already in this conversation
    if (searchResult.episodic?.length > 0) {
      contextText += '\n### Potential Matches (use your judgment to filter):\n';

      // Filter for recipe-related content
      const recipeEpisodes = searchResult.episodic.filter(
        (result) =>
          result.content && (result.content.includes('Recipe:') || result.content.startsWith('Recipe for'))
      );

      // Extract recipe names and cross-reference with database (if provided)
      const validRecipes: typeof recipeEpisodes = [];
      if (db) {
        for (const episode of recipeEpisodes) {
          // Extract recipe name from "Recipe: NAME" format
          const match = episode.content.match(/Recipe:\s*([^\n.]+)/);
          if (match) {
            const recipeName = match[1].trim();

            // Check if recipe still exists in AlcheMix database
            const exists = db.prepare('SELECT 1 FROM recipes WHERE user_id = ? AND name = ? LIMIT 1').get(userId, recipeName);

            if (!exists) {
              logger.info('Filtered out deleted recipe from MemMachine context', { recipeName });
              continue;
            }

            // Check if already recommended in this conversation
            if (alreadyRecommended.has(recipeName)) {
              logger.info('Filtered out already-recommended recipe', { recipeName });
              continue;
            }

            validRecipes.push(episode);
          } else {
            // Can't extract name, include anyway (might be semantic memory or other content)
            validRecipes.push(episode);
          }
        }
      } else {
        // No database provided, filter only by alreadyRecommended
        for (const episode of recipeEpisodes) {
          const match = episode.content.match(/Recipe:\s*([^\n.]+)/);
          if (match) {
            const recipeName = match[1].trim();
            if (alreadyRecommended.has(recipeName)) {
              logger.info('Filtered out already-recommended recipe', { recipeName });
              continue;
            }
          }
          validRecipes.push(episode);
        }
      }

      const limitedRecipes = validRecipes.slice(0, limit);
      limitedRecipes.forEach((result, index) => {
        contextText += `${index + 1}. ${result.content}\n`;
      });

      // If no recipes found after filtering, indicate that
      if (limitedRecipes.length === 0) {
        contextText += '(No NEW recipe matches found - consider suggesting something different)\n';
      }
    }

    // Add semantic memories (user preferences) - renamed from profile
    if (searchResult.semantic?.length > 0) {
      contextText += '\n### User Preferences & Patterns:\n';
      const semantics = searchResult.semantic.slice(0, 3); // Top 3 most relevant
      semantics.forEach((result) => {
        contextText += `- ${result.content}\n`;
      });
    }

    return contextText;
  }

  /**
   * Health Check
   *
   * Verifies MemMachine service is accessible.
   *
   * @returns true if service is healthy, false otherwise
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.get<{ status: string }>('/api/v2/health');
      return response.status === 'healthy';
    } catch {
      return false;
    }
  }
}

/**
 * Singleton instance for application-wide use
 */
const memMachineURL = process.env.MEMMACHINE_API_URL || 'http://localhost:8080';
logger.info('MemMachine Service initialized (v2 API)', { url: memMachineURL });

export const memoryService = new MemoryService({
  baseURL: memMachineURL,
  timeout: 120000, // 120 seconds for batch operations
});
