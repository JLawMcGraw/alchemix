/**
 * MemMachine v1 API Type Definitions
 *
 * Based on actual API testing (November 23, 2025)
 * These types match the REAL response structure from MemMachine v1
 */

/**
 * New Episode Request
 *
 * Used for POST /v1/memories to store new episodic memories
 */
export interface NewEpisode {
  /** Content of the memory episode (text or embeddings) */
  episode_content: string | number[];
  /** Identifier of entity producing the episode (e.g., "user_1", "alchemix-bartender") */
  producer: string;
  /** Identifier of entity for whom episode is produced */
  produced_for: string;
}

/**
 * Search Query Request
 *
 * Used for POST /v1/memories/search to find relevant memories
 */
export interface SearchQuery {
  /** Search query text */
  query: string;
  /** Maximum number of results to return (default: 10) */
  limit?: number;
  /** Optional filters for narrowing results */
  filter?: Record<string, any>;
}

/**
 * Episodic Memory Episode
 *
 * Individual memory episode from episodic memory store
 */
export interface EpisodicEpisode {
  /** Unique identifier for this episode */
  uuid: string;
  /** Type of episode (e.g., "message", "observation") */
  episode_type: string;
  /** Content type (e.g., "string", "embedding") */
  content_type: string;
  /** Actual content of the episode */
  content: string;
  /** ISO timestamp when episode was created */
  timestamp: string;
  /** Group identifier (namespace) */
  group_id: string;
  /** Session identifier (conversation thread) */
  session_id: string;
  /** Producer identifier (who created this) */
  producer_id: string;
  /** Produced for identifier (who this was created for) */
  produced_for_id: string;
  /** Additional user-defined metadata */
  user_metadata: Record<string, any>;
}

/**
 * Profile Memory Entry
 *
 * Extracted user preferences, facts, or patterns
 */
export interface ProfileMemory {
  /** Content of the profile memory */
  content: string;
  /** Relevance score (0-1) */
  score?: number;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Search Response from MemMachine v1
 *
 * ACTUAL response structure (verified via API testing)
 */
export interface MemMachineSearchResponse {
  /** Status code (0 = success) */
  status: number;
  /** Response content */
  content: {
    /** Episodic memory results (array of episode groups) */
    episodic_memory: EpisodicEpisode[][];
    /** Profile memory results */
    profile_memory: ProfileMemory[];
  };
}

/**
 * Session Headers
 *
 * Required headers for all MemMachine v1 API calls
 * Extends Record<string, string> to be compatible with Axios headers
 */
export interface SessionHeaders extends Record<string, string> {
  /** User identifier (e.g., "user_1") */
  'user-id': string;
  /** Session identifier (conversation thread, e.g., "recipes", "chat-2025-11-23") */
  'session-id': string;
  /** Group identifier (namespace, e.g., "alchemix") */
  'group-id': string;
  /** Agent identifier (e.g., "alchemix-bartender") */
  'agent-id': string;
}

/**
 * Delete Data Request
 *
 * Used for DELETE /v1/memories to remove memories
 */
export interface DeleteDataRequest {
  session?: {
    /** User IDs to delete data for */
    user_ids?: string[];
    /** Session ID to delete */
    session_id?: string;
    /** Group ID to delete from */
    group_id?: string;
    /** Agent IDs to delete data for */
    agent_ids?: string[];
  };
}

/**
 * Normalized Search Result
 *
 * Internal format after processing MemMachineSearchResponse
 * This makes it easier to work with the episodic_memory array structure
 */
export interface NormalizedSearchResult {
  /** Episodic memory episodes (flattened from nested arrays) */
  episodic: EpisodicEpisode[];
  /** Profile memory entries */
  profile: ProfileMemory[];
}

/**
 * Recipe Deletion with UUID Tracking
 *
 * OPTION A: Track UUIDs for granular deletion
 *
 * How it works:
 * 1. When recipe is stored in MemMachine, save the returned UUID
 * 2. Store UUID in AlcheMix database (recipes.memmachine_uuid column)
 * 3. When recipe is deleted from AlcheMix, also delete from MemMachine using UUID
 *
 * Future enhancement - requires DB migration:
 * ALTER TABLE recipes ADD COLUMN memmachine_uuid TEXT;
 *
 * For now, we'll accept that historical data remains in MemMachine.
 * This is acceptable because:
 * - User's current recipe list in AlcheMix is still accurate
 * - Old memories naturally age out over time
 * - MemMachine search prioritizes recent/relevant memories
 */

/**
 * Constants for MemMachine Configuration
 */
export const MEMMACHINE_CONSTANTS = {
  /** Group ID for all AlcheMix memories */
  GROUP_ID: 'alchemix',
  /** Agent ID for AlcheMix bartender */
  AGENT_ID: 'alchemix-bartender',
  /** Session ID for recipe storage */
  RECIPE_SESSION: 'recipes',
  /** Session ID prefix for chat conversations (appends date: chat-2025-11-23) */
  CHAT_SESSION_PREFIX: 'chat-',
  /** Default search limit */
  DEFAULT_SEARCH_LIMIT: 10,
  /** Maximum recipes to include in AI prompt */
  MAX_PROMPT_RECIPES: 10,
} as const;
