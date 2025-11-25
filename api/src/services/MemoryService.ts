/**
 * MemMachine Memory Service Client (v1 API)
 *
 * Integrates AlcheMix with MemMachine v1 for AI memory capabilities:
 * - Semantic search over user recipes (OpenAI embeddings)
 * - Conversation memory across sessions
 * - User preference storage and retrieval
 *
 * Architecture:
 * - MemMachine backend (port 8080): Core memory service (Docker)
 * - User isolation: Each user has separate namespace (user_1, user_2, etc.)
 * - No cross-user data leakage: User 1 cannot access User 2's recipes
 * - Session-based organization: recipes, chat-{date}, etc.
 *
 * Migration from legacy API → v1 API:
 * - Old: GET /memory?user_id=X&query=Y
 * - New: POST /v1/memories/search with headers + body
 *
 * @version 2.0.0 (MemMachine v1 API)
 * @date November 23, 2025
 */

import axios, { AxiosInstance } from 'axios';
import {
  NewEpisode,
  SearchQuery,
  MemMachineSearchResponse,
  NormalizedSearchResult,
  SessionHeaders,
  EpisodicEpisode,
  ProfileMemory,
  CreateEpisodeResponse,
  MEMMACHINE_CONSTANTS,
} from '../types/memmachine';

const { GROUP_ID, AGENT_ID, RECIPE_SESSION, CHAT_SESSION_PREFIX, DEFAULT_SEARCH_LIMIT, MAX_PROMPT_RECIPES } =
  MEMMACHINE_CONSTANTS;

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
 * MemoryService Client (v1 API)
 *
 * Provides type-safe interface to MemMachine v1 API
 */
export class MemoryService {
  private client: AxiosInstance;

  constructor(config: MemoryServiceConfig) {
    this.client = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout || 120000, // Increased to 120 seconds for batch operations
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Build Session Headers
   *
   * Creates required headers for MemMachine v1 API calls
   *
   * @param userId - AlcheMix user ID (number)
   * @param sessionId - Session identifier (default: "recipes")
   * @returns SessionHeaders object
   */
  private buildHeaders(userId: number, sessionId: string = RECIPE_SESSION): SessionHeaders {
    return {
      'user-id': `user_${userId}`,
      'session-id': sessionId,
      'group-id': GROUP_ID,
      'agent-id': AGENT_ID,
    };
  }

  /**
   * Build Episode Payload
   *
   * Creates episode object for storing memories
   *
   * @param content - Episode content (text)
   * @param userId - AlcheMix user ID
   * @returns NewEpisode object
   */
  private buildEpisode(content: string, userId: number): NewEpisode {
    const userIdStr = `user_${userId}`;
    return {
      episode_content: content,
      producer: userIdStr,
      produced_for: userIdStr,
    };
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
   * @returns Normalized search result with episodic and profile memories
   * @throws Error if response structure is invalid
   */
  private validateAndNormalizeResponse(response: MemMachineSearchResponse): NormalizedSearchResult {
    // Validate top-level structure
    if (!response || typeof response !== 'object') {
      throw new Error('Invalid response structure from MemMachine: response is not an object');
    }

    if (!response.content || typeof response.content !== 'object') {
      throw new Error('Invalid response structure from MemMachine: missing content field');
    }

    const { episodic_memory, profile_memory } = response.content;

    // Validate episodic_memory is array of arrays
    if (!Array.isArray(episodic_memory)) {
      console.warn('MemMachine response missing episodic_memory array, using empty array');
    }

    // Flatten episodic_memory (it's an array of episode groups)
    // Filter out empty strings and null values
    const flattenedEpisodic: EpisodicEpisode[] = [];
    if (Array.isArray(episodic_memory)) {
      for (const group of episodic_memory) {
        if (Array.isArray(group)) {
          for (const episode of group) {
            // Skip empty strings, null, or invalid episodes
            if (episode && typeof episode === 'object' && episode.content) {
              flattenedEpisodic.push(episode as EpisodicEpisode);
            }
          }
        }
      }
    }

    // Validate profile_memory is array
    const validatedProfile: ProfileMemory[] = Array.isArray(profile_memory) ? profile_memory : [];

    return {
      episodic: flattenedEpisodic,
      profile: validatedProfile,
    };
  }

  /**
   * Store User Recipe
   *
   * Stores a user's recipe in MemMachine for semantic search and AI context.
   * Recipe is stored in the "recipes" session for that user.
   *
   * Option A Implementation - UUID Tracking:
   * - Returns UUID from MemMachine response
   * - Caller should store UUID in AlcheMix DB (recipes.memmachine_uuid column)
   * - Use UUID for granular deletion
   *
   * @param userId - User ID
   * @param recipe - Recipe object with name, ingredients, instructions, etc.
   * @returns UUID of the created episode (or null if storage failed)
   */
  async storeUserRecipe(userId: number, recipe: RecipeData): Promise<string | null> {
    try {
      const recipeText = this.formatRecipeForStorage(recipe);
      const episode = this.buildEpisode(recipeText, userId);
      const headers = this.buildHeaders(userId, RECIPE_SESSION);

      await this.client.post<CreateEpisodeResponse>('/v1/memories', episode, { headers });

      // MemMachine v1 API returns null on POST /v1/memories
      // UUIDs are only available via search queries after creation
      // For now, UUID tracking is not supported by MemMachine API
      console.log(`✅ MemMachine: Stored recipe "${recipe.name}" for user ${userId}`);
      return null;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error(`❌ MemMachine: Failed to store recipe for user ${userId}:`, error.message);
      }
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
   * - Return UUIDs mapped to recipe names for database storage
   *
   * @param userId - User ID
   * @param recipes - Array of recipe objects
   * @returns Object with success/failure counts and UUID mapping
   */
  async storeUserRecipesBatch(
    userId: number,
    recipes: RecipeData[]
  ): Promise<{
    success: number;
    failed: number;
    errors: string[];
    uuidMap: Map<string, string>; // Map recipe name → UUID
  }> {
    const batchSize = 10; // Process 10 recipes at a time
    const delayBetweenBatches = 500; // 500ms delay between batches
    let successCount = 0;
    let failedCount = 0;
    const errors: string[] = [];
    const uuidMap = new Map<string, string>();

    console.log(`📦 MemMachine: Starting batch upload of ${recipes.length} recipes for user ${userId}`);

    // Process recipes in batches
    for (let i = 0; i < recipes.length; i += batchSize) {
      const batch = recipes.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(recipes.length / batchSize);

      console.log(`📦 MemMachine: Processing batch ${batchNumber}/${totalBatches} (${batch.length} recipes)`);

      // Process each recipe in the current batch concurrently
      const batchPromises = batch.map(async (recipe) => {
        try {
          const recipeText = this.formatRecipeForStorage(recipe);
          const episode = this.buildEpisode(recipeText, userId);
          const headers = this.buildHeaders(userId, RECIPE_SESSION);

          const response = await this.client.post<CreateEpisodeResponse>('/v1/memories', episode, { headers });

          // MemMachine v1 API returns null on POST /v1/memories
          // UUIDs are only available via search queries after creation
          // For now, we accept that UUID tracking is not available with current MemMachine API
          // Deletion will use session-based cleanup instead

          console.log(`✅ MemMachine: Stored recipe "${recipe.name}" for user ${userId}`);
          return { success: true, recipe: recipe.name, uuid: null };
        } catch (error) {
          const errorMsg = axios.isAxiosError(error)
            ? error.message
            : error instanceof Error
            ? error.message
            : 'Unknown error';
          console.error(`❌ MemMachine: Failed to store recipe "${recipe.name}" for user ${userId}:`, errorMsg);
          return { success: false, recipe: recipe.name, uuid: null, error: errorMsg };
        }
      });

      // Wait for all recipes in this batch to complete
      const batchResults = await Promise.allSettled(batchPromises);

      // Count successes and failures, collect UUIDs
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          if (result.value.success) {
            successCount++;
            if (result.value.uuid) {
              uuidMap.set(result.value.recipe, result.value.uuid);
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

    console.log(
      `✅ MemMachine: Batch upload complete - ${successCount} succeeded, ${failedCount} failed, ${uuidMap.size} UUIDs captured`
    );

    return { success: successCount, failed: failedCount, errors, uuidMap };
  }

  /**
   * Query User Profile and Recipes
   *
   * Searches user's recipes and preferences using semantic search.
   * MemMachine uses OpenAI embeddings to find relevant recipes.
   *
   * @param userId - User ID
   * @param query - Natural language query (e.g., "rum cocktails with lime")
   * @returns Normalized search results with episodic and profile memories
   * @throws Error if API call fails
   */
  async queryUserProfile(userId: number, query: string): Promise<NormalizedSearchResult> {
    try {
      const searchQuery: SearchQuery = {
        query,
        limit: DEFAULT_SEARCH_LIMIT,
      };
      const headers = this.buildHeaders(userId, RECIPE_SESSION);

      const response = await this.client.post<MemMachineSearchResponse>(
        '/v1/memories/search',
        searchQuery,
        { headers }
      );

      // Validate and normalize response structure
      const normalizedResult = this.validateAndNormalizeResponse(response.data as MemMachineSearchResponse);

      console.log(
        `🔍 MemMachine: Found ${normalizedResult.episodic.length} episodic + ${normalizedResult.profile.length} profile results for user ${userId}`
      );

      return normalizedResult;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error(`❌ MemMachine: User profile query failed for user ${userId}:`, error.message);
        throw new Error(`Failed to query user profile: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Store Conversation Turn
   *
   * Stores a user message and AI response as episodic memory.
   * Uses date-based session IDs for daily conversation threads.
   *
   * Session Strategy: chat-{YYYY-MM-DD}
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
      // Use date-based session IDs for daily conversation threads
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const sessionId = `${CHAT_SESSION_PREFIX}${today}`;

      const userIdStr = `user_${userId}`;
      const agentIdStr = AGENT_ID;

      // Store user message
      await this.client.post(
        '/v1/memories',
        {
          episode_content: `User: ${userMessage}`,
          producer: userIdStr,
          produced_for: agentIdStr,
        },
        {
          headers: {
            'user-id': userIdStr,
            'session-id': sessionId,
            'group-id': GROUP_ID,
            'agent-id': agentIdStr,
          },
        }
      );

      // Store AI response
      await this.client.post(
        '/v1/memories',
        {
          episode_content: `Assistant: ${aiResponse}`,
          producer: agentIdStr,
          produced_for: userIdStr,
        },
        {
          headers: {
            'user-id': userIdStr,
            'session-id': sessionId,
            'group-id': GROUP_ID,
            'agent-id': agentIdStr,
          },
        }
      );

      console.log(`💬 MemMachine: Stored conversation turn for user ${userId} in session ${sessionId}`);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error(`❌ MemMachine: Failed to store conversation for user ${userId}:`, error.message);
        // Don't throw - conversation storage is optional
      }
    }
  }

  /**
   * Delete User Recipe by UUID
   *
   * OPTION A IMPLEMENTATION:
   * Deletes a specific recipe from MemMachine using its UUID.
   * This ensures the AI context stays synchronized with AlcheMix database.
   *
   * How it works:
   * 1. Recipe is created → MemMachine returns UUID → Stored in recipes.memmachine_uuid
   * 2. Recipe is deleted from AlcheMix → This method uses UUID to delete from MemMachine
   * 3. AI context stays clean - no stale recipe recommendations
   *
   * @param userId - User ID
   * @param uuid - MemMachine episode UUID (from recipes.memmachine_uuid)
   * @param recipeName - Recipe name (for logging only)
   * @returns True if deletion succeeded, false otherwise
   */
  async deleteUserRecipeByUuid(userId: number, uuid: string, recipeName?: string): Promise<boolean> {
    try {
      const headers = this.buildHeaders(userId, RECIPE_SESSION);

      // Delete specific episode using UUID
      await this.client.delete('/v1/memories', {
        headers,
        data: { uuid },
      });

      const logName = recipeName ? `"${recipeName}"` : `with UUID ${uuid}`;
      console.log(`✅ MemMachine: Deleted recipe ${logName} for user ${userId}`);
      return true;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const logName = recipeName ? `"${recipeName}"` : `with UUID ${uuid}`;
        console.error(`❌ MemMachine: Failed to delete recipe ${logName} for user ${userId}:`, error.message);
      }
      // Don't throw - deletion failures shouldn't break the app
      return false;
    }
  }

  /**
   * Delete User Recipe (Legacy - No UUID)
   *
   * For recipes created before UUID tracking was implemented.
   * These recipes don't have memmachine_uuid in the database.
   *
   * @param userId - User ID
   * @param recipeName - Name of recipe to delete
   */
  async deleteUserRecipe(userId: number, recipeName: string): Promise<void> {
    console.log(
      `ℹ️  MemMachine: Recipe "${recipeName}" deleted from AlcheMix (legacy recipe without UUID - data remains in MemMachine)`
    );
  }

  /**
   * Delete Multiple Recipes by UUID (Batch)
   *
   * Efficiently deletes multiple recipes from MemMachine during bulk operations.
   * Uses same batching strategy as bulk upload.
   *
   * @param userId - User ID
   * @param uuids - Array of MemMachine episode UUIDs
   * @returns Object with success/failure counts
   */
  async deleteUserRecipesBatch(
    userId: number,
    uuids: string[]
  ): Promise<{ success: number; failed: number }> {
    const batchSize = 10;
    const delayBetweenBatches = 500;
    let successCount = 0;
    let failedCount = 0;

    console.log(`🗑️ MemMachine: Starting batch deletion of ${uuids.length} recipes for user ${userId}`);

    for (let i = 0; i < uuids.length; i += batchSize) {
      const batch = uuids.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(uuids.length / batchSize);

      console.log(`🗑️ MemMachine: Processing deletion batch ${batchNumber}/${totalBatches} (${batch.length} UUIDs)`);

      const batchPromises = batch.map(async (uuid) => {
        const headers = this.buildHeaders(userId, RECIPE_SESSION);
        try {
          await this.client.delete('/v1/memories', {
            headers,
            data: { uuid },
          });
          return { success: true };
        } catch (error) {
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

      if (i + batchSize < uuids.length) {
        await new Promise((resolve) => setTimeout(resolve, delayBetweenBatches));
      }
    }

    console.log(
      `✅ MemMachine: Batch deletion complete - ${successCount} succeeded, ${failedCount} failed`
    );

    return { success: successCount, failed: failedCount };
  }

  /**
   * Delete All Recipe Memories for User
   *
   * Nukes the entire "recipes" session for a user in MemMachine.
   * Use this when you want to start fresh with UUID tracking.
   *
   * WARNING: This deletes ALL recipes from MemMachine for this user.
   * Only use when you plan to re-upload recipes with UUID tracking.
   *
   * @param userId - User ID
   * @returns True if deletion succeeded, false otherwise
   */
  async deleteAllRecipeMemories(userId: number): Promise<boolean> {
    try {
      const userIdStr = `user_${userId}`;
      const headers = this.buildHeaders(userId, RECIPE_SESSION);

      // Delete entire session using session-based deletion
      await this.client.delete('/v1/memories', {
        headers,
        data: {
          session: {
            user_ids: [userIdStr],
            session_id: RECIPE_SESSION,
            group_id: GROUP_ID,
          },
        },
      });

      console.log(`🗑️ MemMachine: Deleted ALL recipe memories for user ${userId} (session: ${RECIPE_SESSION})`);
      return true;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error(`❌ MemMachine: Failed to delete all recipe memories for user ${userId}:`, error.message);
      }
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
      const collectionText =
        `User created a recipe collection named "${collection.name}"` +
        (collection.description ? ` with description: "${collection.description}"` : '');

      const episode = this.buildEpisode(collectionText, userId);
      const headers = this.buildHeaders(userId, RECIPE_SESSION);

      await this.client.post('/v1/memories', episode, { headers });

      console.log(`📁 MemMachine: Stored collection "${collection.name}" for user ${userId}`);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error(`❌ MemMachine: Failed to store collection for user ${userId}:`, error.message);
        // Don't throw - collection storage is optional
      }
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
      console.warn(`MemoryService: User context query failed for user ${userId}, continuing without it`);
      return { userContext: null };
    }
  }

  /**
   * Format Context for AI Prompt (with Database Cross-Reference)
   *
   * Converts NormalizedSearchResult into human-readable string for Claude's system prompt.
   * FILTERS OUT DELETED RECIPES by cross-referencing with AlcheMix database.
   *
   * This solves the MemMachine UUID limitation: Even though we can't delete individual
   * recipes from MemMachine, we can filter them out when building the AI context.
   *
   * @param searchResult - Normalized search result from MemMachine
   * @param userId - User ID (for database lookup)
   * @param db - Database instance (optional, for recipe verification)
   * @param limit - Maximum number of recipes to include (default: MAX_PROMPT_RECIPES)
   * @returns Formatted string for AI prompt
   */
  formatContextForPrompt(
    searchResult: NormalizedSearchResult,
    userId: number,
    db?: any,
    limit: number = MAX_PROMPT_RECIPES
  ): string {
    if (!searchResult || (!searchResult.episodic?.length && !searchResult.profile?.length)) {
      return '';
    }

    let contextText = '\n\n## RELEVANT CONTEXT FROM MEMORY\n';

    // Add episodic memories (specific recipes found)
    // FILTERING LOGIC: Only include episodes that contain recipe content AND still exist in DB
    if (searchResult.episodic?.length > 0) {
      contextText += '\n### Recently Discussed Recipes:\n';

      // Filter for recipe-related content
      const recipeEpisodes = searchResult.episodic.filter(
        (result) =>
          result.content &&
          (result.content.includes('Recipe:') || result.content.startsWith('Recipe for'))
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

            if (exists) {
              validRecipes.push(episode);
            } else {
              console.log(`🗑️ Filtered out deleted recipe from MemMachine context: "${recipeName}"`);
            }
          } else {
            // Can't extract name, include anyway (might be profile memory or other content)
            validRecipes.push(episode);
          }
        }
      } else {
        // No database provided, include all (backward compatible)
        validRecipes.push(...recipeEpisodes);
      }

      const limitedRecipes = validRecipes.slice(0, limit);
      limitedRecipes.forEach((result, index) => {
        contextText += `${index + 1}. ${result.content}\n`;
      });

      // If no recipes found after filtering, indicate that
      if (limitedRecipes.length === 0) {
        contextText += '(No recipe-specific memories found for this query)\n';
      }
    }

    // Add profile memories (user preferences)
    if (searchResult.profile?.length > 0) {
      contextText += '\n### User Preferences & Patterns:\n';
      const profiles = searchResult.profile.slice(0, 3); // Top 3 most relevant
      profiles.forEach((result) => {
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
      const response = await axios.get(`${this.client.defaults.baseURL}/health`);
      return response.data.status === 'healthy';
    } catch (error) {
      return false;
    }
  }
}

/**
 * Singleton instance for application-wide use
 */
const memMachineURL = process.env.MEMMACHINE_API_URL || 'http://localhost:8080';
console.log(`🔧 MemMachine Service initialized (v1 API) with URL: ${memMachineURL}`);

export const memoryService = new MemoryService({
  baseURL: memMachineURL,
  timeout: 120000, // 120 seconds for batch operations
});
