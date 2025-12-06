/**
 * MemMachine v2 API Type Definitions
 *
 * Updated for MemMachine v2 API (December 2025)
 * Key changes from v1:
 * - UUID → UID for episode identifiers
 * - Header-based sessions → Body-based org_id/project_id
 * - profile_memory → semantic_memory
 * - New project management endpoints
 */

// ============================================================================
// PROJECT MANAGEMENT
// ============================================================================

/**
 * Project Configuration
 *
 * Configuration options for a MemMachine project
 */
export interface ProjectConfig {
  /** Embedder model name (e.g., "openai", "sentence-transformers") */
  embedder?: string;
  /** Reranker model name */
  reranker?: string;
}

/**
 * Create Project Request
 *
 * Used for POST /api/v2/projects to create a new project
 */
export interface CreateProjectRequest {
  /** Organization identifier */
  org_id: string;
  /** Project identifier (unique within org) */
  project_id: string;
  /** Optional description */
  description?: string;
  /** Optional configuration */
  config?: ProjectConfig;
}

/**
 * Project Response
 *
 * Response from project operations
 */
export interface ProjectResponse {
  /** Organization identifier */
  org_id: string;
  /** Project identifier */
  project_id: string;
  /** Project description */
  description?: string;
  /** Project configuration */
  config?: ProjectConfig;
}

// ============================================================================
// MEMORY OPERATIONS
// ============================================================================

/**
 * Memory Message
 *
 * Individual message to be stored as memory
 */
export interface MemoryMessage {
  /** Content of the memory */
  content: string;
  /** Producer identifier (who created this, e.g., "user_1") */
  producer: string;
  /** Produced for identifier (recipient, e.g., "user_1") */
  produced_for: string;
  /** Optional ISO timestamp (defaults to now) */
  timestamp?: string;
  /** Optional role (e.g., "user", "assistant") */
  role?: string;
  /** Optional metadata key-value pairs */
  metadata?: Record<string, string>;
}

/**
 * Add Memories Request
 *
 * Used for POST /api/v2/memories to add memories
 */
export interface AddMemoriesRequest {
  /** Organization identifier */
  org_id: string;
  /** Project identifier */
  project_id: string;
  /** Messages to store */
  messages: MemoryMessage[];
}

/**
 * Add Memory Result
 *
 * Result for a single added memory
 */
export interface AddMemoryResult {
  /** UID of the created episode */
  uid: string;
}

/**
 * Add Memories Response
 *
 * Response from POST /api/v2/memories
 */
export interface AddMemoriesResponse {
  /** Results for each added memory */
  results: AddMemoryResult[];
}

/**
 * Search Memories Request
 *
 * Used for POST /api/v2/memories/search
 */
export interface SearchMemoriesRequest {
  /** Organization identifier */
  org_id: string;
  /** Project identifier */
  project_id: string;
  /** Search query text */
  query: string;
  /** Maximum results to return (default: 10) */
  top_k?: number;
  /** Optional filter expression */
  filter?: string;
  /** Memory types to search (default: all) */
  types?: MemoryType[];
}

/**
 * Memory Type
 *
 * Types of memory that can be searched/added
 */
export type MemoryType = 'Episodic' | 'Semantic';

/**
 * Episodic Memory Episode (v2)
 *
 * Individual memory episode from episodic memory store
 */
export interface EpisodicEpisode {
  /** Unique identifier for this episode (UID, not UUID) */
  uid: string;
  /** Episode type */
  episode_type?: string;
  /** Content type */
  content_type?: string;
  /** Actual content of the episode */
  content: string;
  /** ISO timestamp when episode was created */
  created_at?: string;
  /** Producer identifier */
  producer_id?: string;
  /** Produced for identifier */
  produced_for_id?: string;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Semantic Memory Entry (formerly Profile Memory)
 *
 * Extracted facts, preferences, or patterns
 */
export interface SemanticMemory {
  /** Content of the semantic memory */
  content: string;
  /** Relevance score (0-1) */
  score?: number;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Long-term Memory Container
 *
 * Contains episodes stored in long-term memory
 */
export interface LongTermMemory {
  /** Array of episodic episodes */
  episodes: EpisodicEpisode[];
}

/**
 * Short-term Memory Container
 *
 * Contains recent episodes and summaries
 */
export interface ShortTermMemory {
  /** Recent episodes */
  episodes: EpisodicEpisode[];
  /** AI-generated summaries of conversations */
  episode_summary?: string[];
}

/**
 * Episodic Memory Container (v2 nested structure)
 *
 * v2 API returns episodic memory split into long-term and short-term
 */
export interface EpisodicMemoryContainer {
  /** Long-term stored episodes (recipes, facts) */
  long_term_memory: LongTermMemory;
  /** Short-term recent episodes */
  short_term_memory: ShortTermMemory;
}

/**
 * Search Result Response
 *
 * Response from POST /api/v2/memories/search
 */
export interface SearchResultResponse {
  /** Status code (0 = success) */
  status: number;
  /** Search results content */
  content: {
    /** Episodic memory results (nested structure with long_term/short_term) */
    episodic_memory: EpisodicMemoryContainer;
    /** Semantic memory results (formerly profile_memory) */
    semantic_memory: SemanticMemory[];
  };
}

/**
 * Delete Episodic Memory Request
 *
 * Used for POST /api/v2/memories/episodic/delete
 */
export interface DeleteEpisodicMemoryRequest {
  /** Organization identifier */
  org_id: string;
  /** Project identifier */
  project_id: string;
  /** Episode UID to delete */
  episodic_id: string;
}

/**
 * Delete Semantic Memory Request
 *
 * Used for POST /api/v2/memories/semantic/delete
 */
export interface DeleteSemanticMemoryRequest {
  /** Organization identifier */
  org_id: string;
  /** Project identifier */
  project_id: string;
  /** Semantic memory ID to delete */
  semantic_id: string;
}

/**
 * Delete Project Request
 *
 * Used for POST /api/v2/projects/delete
 */
export interface DeleteProjectRequest {
  /** Organization identifier */
  org_id: string;
  /** Project identifier */
  project_id: string;
}

// ============================================================================
// INTERNAL TYPES
// ============================================================================

/**
 * Normalized Search Result
 *
 * Internal format after processing SearchResultResponse
 */
export interface NormalizedSearchResult {
  /** Episodic memory episodes */
  episodic: EpisodicEpisode[];
  /** Semantic memory entries (formerly profile) */
  semantic: SemanticMemory[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Constants for MemMachine v2 Configuration
 *
 * v2 uses org_id/project_id model instead of header-based sessions
 */
export const MEMMACHINE_CONSTANTS = {
  /** Organization ID for all AlcheMix memories */
  ORG_ID: 'alchemix',

  /** Project ID for recipe storage (will be prefixed with user_X_) */
  RECIPE_PROJECT_SUFFIX: 'recipes',

  /** Project ID prefix for chat conversations (e.g., user_1_chat_2025-12-02) */
  CHAT_PROJECT_SUFFIX: 'chat',

  /** Default search limit */
  DEFAULT_SEARCH_LIMIT: 20,

  /** Maximum recipes to include in AI prompt */
  MAX_PROMPT_RECIPES: 20,
} as const;

/**
 * Helper function to build project ID for recipes
 *
 * @param userId - AlcheMix user ID
 * @returns Project ID string (e.g., "user_1_recipes")
 */
export function buildRecipeProjectId(userId: number): string {
  return `user_${userId}_${MEMMACHINE_CONSTANTS.RECIPE_PROJECT_SUFFIX}`;
}

/**
 * Helper function to build project ID for chat
 *
 * @param userId - AlcheMix user ID
 * @param date - Optional date string (YYYY-MM-DD), defaults to today
 * @returns Project ID string (e.g., "user_1_chat_2025-12-02")
 */
export function buildChatProjectId(userId: number, date?: string): string {
  const dateStr = date || new Date().toISOString().split('T')[0];
  return `user_${userId}_${MEMMACHINE_CONSTANTS.CHAT_PROJECT_SUFFIX}_${dateStr}`;
}

// ============================================================================
// LEGACY COMPATIBILITY (for gradual migration)
// ============================================================================

/**
 * @deprecated Use SemanticMemory instead
 */
export type ProfileMemory = SemanticMemory;
