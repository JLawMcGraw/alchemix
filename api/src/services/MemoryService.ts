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
      timeout: config.timeout || 30000,
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
   * Future Enhancement (Option A - UUID Tracking):
   * - Return UUID from MemMachine response
   * - Store UUID in AlcheMix DB (recipes.memmachine_uuid column)
   * - Use UUID for granular deletion
   *
   * @param userId - User ID
   * @param recipe - Recipe object with name, ingredients, instructions, etc.
   */
  async storeUserRecipe(userId: number, recipe: RecipeData): Promise<void> {
    try {
      const recipeText = this.formatRecipeForStorage(recipe);
      const episode = this.buildEpisode(recipeText, userId);
      const headers = this.buildHeaders(userId, RECIPE_SESSION);

      await this.client.post('/v1/memories', episode, { headers });

      console.log(`✅ MemMachine: Stored recipe "${recipe.name}" for user ${userId}`);

      // TODO: Option A - Track UUID for deletion
      // const response = await this.client.post<{uuid: string}>(...);
      // return response.data.uuid; // Store this in AlcheMix DB
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error(`❌ MemMachine: Failed to store recipe for user ${userId}:`, error.message);
        // Don't throw - recipe storage in MemMachine is optional (fire-and-forget)
      }
    }
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
   * Delete User Recipe
   *
   * OPTION A EXPLANATION (as requested):
   *
   * How Option A (UUID Tracking) Would Work:
   *
   * 1. DATABASE MIGRATION:
   *    Add a new column to track MemMachine UUIDs
   *    ```sql
   *    ALTER TABLE recipes ADD COLUMN memmachine_uuid TEXT;
   *    ```
   *
   * 2. STORE UUID ON CREATION:
   *    When storeUserRecipe() is called, MemMachine returns a UUID
   *    ```typescript
   *    const response = await this.client.post('/v1/memories', episode, { headers });
   *    const uuid = response.data.uuid; // MemMachine returns this
   *    // Store UUID in AlcheMix database alongside recipe
   *    db.run('UPDATE recipes SET memmachine_uuid = ? WHERE id = ?', [uuid, recipeId]);
   *    ```
   *
   * 3. DELETE USING UUID:
   *    When recipe is deleted from AlcheMix, also delete from MemMachine
   *    ```typescript
   *    // Get UUID from AlcheMix database
   *    const row = db.get('SELECT memmachine_uuid FROM recipes WHERE id = ?', [recipeId]);
   *    if (row.memmachine_uuid) {
   *      // Delete specific episode from MemMachine using UUID
   *      await this.client.delete('/v1/memories', {
   *        headers: this.buildHeaders(userId),
   *        data: { uuid: row.memmachine_uuid }
   *      });
   *    }
   *    ```
   *
   * CURRENT IMPLEMENTATION (Acceptable Compromise):
   * For now, we accept that historical data remains in MemMachine.
   * This is acceptable because:
   * - User's current recipe list in AlcheMix is still accurate
   * - Old memories naturally age out over time
   * - MemMachine search prioritizes recent/relevant memories
   * - Implementing Option A is a future enhancement (not critical for MVP)
   *
   * @param userId - User ID
   * @param recipeName - Name of recipe to delete
   */
  async deleteUserRecipe(userId: number, recipeName: string): Promise<void> {
    try {
      // Current implementation: Log and accept historical data remains
      console.log(
        `ℹ️  MemMachine: Recipe "${recipeName}" deleted from AlcheMix (historical data remains in MemMachine)`
      );

      // TODO: Implement Option A (UUID tracking) in future
      // 1. Add memmachine_uuid column to recipes table
      // 2. Return and store UUID when recipe is created
      // 3. Use UUID to delete specific episode here

      // For now, this is acceptable because:
      // - Search will only return deleted recipes if they're still relevant
      // - AI can handle "this recipe no longer exists" gracefully
      // - Historical data provides conversation context
    } catch (error) {
      console.error(`❌ MemMachine: Failed to delete recipe for user ${userId}:`, error);
      // Don't throw - deletion failures shouldn't break the app
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
   * Format Context for AI Prompt
   *
   * Converts NormalizedSearchResult into human-readable string for Claude's system prompt.
   * INCLUDES FILTERING LOGIC (as requested) to only include recipe-related content.
   *
   * @param searchResult - Normalized search result from MemMachine
   * @param limit - Maximum number of recipes to include (default: MAX_PROMPT_RECIPES)
   * @returns Formatted string for AI prompt
   */
  formatContextForPrompt(searchResult: NormalizedSearchResult, limit: number = MAX_PROMPT_RECIPES): string {
    if (!searchResult || (!searchResult.episodic?.length && !searchResult.profile?.length)) {
      return '';
    }

    let contextText = '\n\n## RELEVANT CONTEXT FROM MEMORY\n';

    // Add episodic memories (specific recipes found)
    // FILTERING LOGIC: Only include episodes that contain recipe content
    if (searchResult.episodic?.length > 0) {
      contextText += '\n### Recently Discussed Recipes:\n';

      // Filter for recipe-related content
      const recipeEpisodes = searchResult.episodic.filter(
        (result) =>
          result.content &&
          (result.content.includes('Recipe:') || result.content.startsWith('Recipe for'))
      );

      const limitedRecipes = recipeEpisodes.slice(0, limit);
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
  timeout: 30000,
});
