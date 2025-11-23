/**
 * MemMachine Memory Service Client
 *
 * Integrates AlcheMix with MemMachine for AI memory capabilities:
 * - Store user preferences (likes, dislikes, allergies)
 * - Retrieve relevant recipe recommendations from knowledge base
 * - Query user profile and conversation history
 *
 * Architecture:
 * - MemMachine backend (port 8080): Core memory service (Docker - default port)
 * - User isolation: Each user has a separate namespace (user_1, user_2, etc.)
 * - No cross-user data leakage: User 1 cannot access User 2's recipes
 * - Semantic search: OpenAI embeddings for intelligent recipe recommendations
 */

import axios, { AxiosInstance } from 'axios';

/**
 * Memory Context Response
 *
 * Structure returned by MemMachine GET /memory endpoint
 */
export interface MemoryContext {
  status: 'success' | 'error';
  data: {
    profile: ProfileMemory[];
    context: ContextEpisode[][];
    formatted_query: string;
    query_type: string;
  };
}

export interface ProfileMemory {
  tag: string;
  feature: string;
  value: string;
  metadata: {
    id: number;
    similarity_score: number;
  };
}

export interface ContextEpisode {
  uuid: string;
  episode_type: string;
  content_type: string;
  content: string;
  timestamp: string;
  group_id: string;
  session_id: string;
  producer_id: string;
  produced_for_id: string;
  user_metadata: {
    speaker: string;
    timestamp: string;
    type: string;
  };
}

/**
 * Memory Storage Request
 *
 * Format for POST /memory to store new memories
 */
export interface StoreMemoryRequest {
  user_id: string;
  query: string;
}

/**
 * Memory Query Request
 *
 * Format for GET /memory to retrieve memories
 */
export interface QueryMemoryRequest {
  user_id: string;
  query: string;
  timestamp?: string;
}

/**
 * MemoryService Configuration
 */
export interface MemoryServiceConfig {
  baseURL: string;
  timeout?: number;
}

/**
 * MemoryService Client
 *
 * Provides type-safe interface to MemMachine bar_server API
 */
export class MemoryService {
  private client: AxiosInstance;
  private readonly KNOWLEDGE_BASE_USER = 'system_knowledge_base';

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
   * Query Recipe Knowledge Base
   *
   * Searches the global recipe knowledge base (241 recipes) with semantic search.
   * Uses BarQueryConstructor to intelligently parse queries about spirits, flavors, etc.
   *
   * @param query - Natural language query (e.g., "What drinks use rum and lime?")
   * @returns Relevant recipes and context from knowledge base
   */
  async queryRecipeKnowledgeBase(query: string): Promise<MemoryContext> {
    try {
      const response = await this.client.get<MemoryContext>('/memory', {
        params: {
          user_id: this.KNOWLEDGE_BASE_USER,
          query,
        },
      });

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('MemoryService: Recipe query failed:', error.message);
        throw new Error(`Failed to query recipe knowledge base: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Query User Profile and Preferences
   *
   * Retrieves user-specific memories:
   * - Likes/dislikes
   * - Allergies and restrictions
   * - Past conversations
   * - Favorite styles
   *
   * @param userId - User ID (as string for MemMachine)
   * @param query - Query about user preferences
   * @returns User profile memories and relevant context
   */
  async queryUserProfile(userId: number, query: string): Promise<MemoryContext> {
    try {
      const response = await this.client.get<MemoryContext>('/memory', {
        params: {
          user_id: `user_${userId}`,
          query,
        },
      });

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error(`MemoryService: User profile query failed for user ${userId}:`, error.message);
        throw new Error(`Failed to query user profile: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Store User Preference
   *
   * Stores a user preference, like, dislike, or allergy in MemMachine.
   *
   * Examples:
   * - "I love spicy margaritas with jalapeño"
   * - "I'm allergic to nuts"
   * - "I dislike overly sweet drinks"
   * - "I prefer whiskey-based cocktails"
   *
   * @param userId - User ID
   * @param preference - Natural language preference statement
   */
  async storeUserPreference(userId: number, preference: string): Promise<void> {
    try {
      await this.client.post('/memory', null, {
        params: {
          user_id: `user_${userId}`,
          query: preference,
        },
      });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error(`MemoryService: Failed to store preference for user ${userId}:`, error.message);
        throw new Error(`Failed to store user preference: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Store Conversation Turn
   *
   * Stores a user message and AI response as episodic memory.
   * This builds conversation history for context-aware responses.
   *
   * @param userId - User ID
   * @param userMessage - User's message
   * @param aiResponse - AI bartender's response
   */
  async storeConversationTurn(userId: number, userMessage: string, aiResponse: string): Promise<void> {
    try {
      // Store user message
      await this.client.post('/memory', null, {
        params: {
          user_id: `user_${userId}`,
          query: `User asked: "${userMessage}"`,
        },
      });

      // Store AI response
      await this.client.post('/memory', null, {
        params: {
          user_id: `user_${userId}`,
          query: `AI bartender responded: "${aiResponse}"`,
        },
      });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error(`MemoryService: Failed to store conversation for user ${userId}:`, error.message);
        // Don't throw - conversation storage is optional
      }
    }
  }

  /**
   * Store User Recipe
   *
   * Stores a user's recipe in MemMachine for semantic search and AI context.
   * This allows the AI to recommend recipes the user has created/imported.
   *
   * @param userId - User ID
   * @param recipe - Recipe object with name, ingredients, instructions, etc.
   */
  async storeUserRecipe(userId: number, recipe: {
    name: string;
    ingredients: string[] | string;
    instructions?: string;
    glass?: string;
    category?: string;
  }): Promise<void> {
    try {
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

      // Create semantic-rich recipe text for MemMachine
      const recipeText = (
        `Recipe for ${recipe.name}. ` +
        `Category: ${recipe.category || 'Cocktail'}. ` +
        (recipe.glass ? `Glass: ${recipe.glass}. ` : '') +
        `Ingredients: ${ingredientsText}. ` +
        (recipe.instructions ? `Instructions: ${recipe.instructions}` : '')
      );

      await this.client.post('/memory', null, {
        params: {
          user_id: `user_${userId}`,
          query: recipeText,
        },
      });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error(`MemoryService: Failed to store recipe for user ${userId}:`, error.message);
        // Don't throw - recipe storage in MemMachine is optional
      }
    }
  }

  /**
   * Delete User Recipe
   *
   * Removes a recipe from the user's MemMachine memory.
   * Note: MemMachine doesn't have a direct delete API, so this is a no-op for now.
   * Future: Could implement by storing recipe IDs and filtering on retrieval.
   *
   * @param userId - User ID
   * @param recipeName - Name of recipe to delete
   */
  async deleteUserRecipe(userId: number, recipeName: string): Promise<void> {
    // TODO: MemMachine doesn't currently support deleting specific memories
    // This is a placeholder for future implementation
    // Options:
    // 1. Store a "deletion marker" memory
    // 2. Filter out deleted recipes on retrieval
    // 3. Wait for MemMachine delete API
    console.warn(`MemoryService: Recipe deletion not yet implemented for "${recipeName}"`);
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
  async storeUserCollection(userId: number, collection: {
    name: string;
    description?: string;
  }): Promise<void> {
    try {
      const collectionText = (
        `User created a recipe collection named "${collection.name}"` +
        (collection.description ? ` with description: "${collection.description}"` : '')
      );

      await this.client.post('/memory', null, {
        params: {
          user_id: `user_${userId}`,
          query: collectionText,
        },
      });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error(`MemoryService: Failed to store collection for user ${userId}:`, error.message);
        // Don't throw - collection storage is optional
      }
    }
  }

  /**
   * Get Memory-Enhanced Context (User-Specific Recipes Only)
   *
   * Queries user's own recipes and preferences for context-aware recommendations.
   * No global knowledge base - each user only sees their own recipes.
   *
   * @param userId - User ID
   * @param query - User's cocktail query
   * @returns User's recipes and preferences matching the query
   */
  async getEnhancedContext(userId: number, query: string): Promise<{
    userContext: MemoryContext | null;
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
   * Format Memory Context for AI Prompt
   *
   * Converts MemoryContext into a human-readable string suitable for Claude's system prompt.
   *
   * @param context - Memory context from MemMachine
   * @param maxRecipes - Maximum number of recipes to include (default: 5)
   * @returns Formatted string for AI prompt
   */
  formatContextForPrompt(context: MemoryContext, maxRecipes: number = 5): string {
    if (!context.data || !context.data.context || context.data.context.length === 0) {
      return '';
    }

    const recipes: string[] = [];

    // Extract recipes from first context group (most relevant)
    const primaryContext = context.data.context[0] || [];

    for (const episode of primaryContext.slice(0, maxRecipes)) {
      if (episode.content && episode.content.startsWith('Recipe for')) {
        recipes.push(episode.content);
      }
    }

    if (recipes.length === 0) {
      return '';
    }

    return `\n## RELEVANT RECIPES FROM KNOWLEDGE BASE\n\nHere are ${recipes.length} relevant recipe(s) that may be helpful:\n\n${recipes.join('\n\n---\n\n')}`;
  }

  /**
   * Format User Profile for AI Prompt
   *
   * Extracts user preferences, allergies, and restrictions from profile memory.
   *
   * @param context - User profile context
   * @returns Formatted string for AI prompt
   */
  formatUserProfileForPrompt(context: MemoryContext): string {
    if (!context.data || !context.data.profile || context.data.profile.length === 0) {
      return '';
    }

    const preferences: string[] = [];
    const allergies: string[] = [];
    const restrictions: string[] = [];

    for (const memory of context.data.profile) {
      const value = memory.value;
      const tag = memory.tag.toLowerCase();

      if (value.toLowerCase().includes('allergic') || value.toLowerCase().includes('allergy')) {
        allergies.push(value);
      } else if (value.toLowerCase().includes('dislike') || value.toLowerCase().includes('hate')) {
        restrictions.push(value);
      } else {
        preferences.push(value);
      }
    }

    let result = '\n## USER PROFILE\n\n';

    if (allergies.length > 0) {
      result += `**CRITICAL - ALLERGIES:**\n${allergies.map(a => `- ${a}`).join('\n')}\n\n`;
    }

    if (restrictions.length > 0) {
      result += `**Dislikes/Restrictions:**\n${restrictions.map(r => `- ${r}`).join('\n')}\n\n`;
    }

    if (preferences.length > 0) {
      result += `**Preferences:**\n${preferences.map(p => `- ${p}`).join('\n')}\n`;
    }

    return result;
  }

  /**
   * Health Check
   *
   * Verifies MemMachine bar_server is accessible.
   *
   * @returns true if service is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Try a simple query to knowledge base
      await this.queryRecipeKnowledgeBase('test');
      return true;
    } catch (error) {
      return false;
    }
  }
}

/**
 * Singleton instance for application-wide use
 */
const memMachineURL = process.env.MEMMACHINE_API_URL || 'http://localhost:8080';
console.log(`🔧 MemMachine Service initialized with URL: ${memMachineURL}`);

export const memoryService = new MemoryService({
  baseURL: memMachineURL,
  timeout: 30000,
});
