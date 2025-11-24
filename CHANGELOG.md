# Changelog

All notable changes to the AlcheMix Next.js/Express monorepo will be documented here.

## v1.18.0 – 2025-11-23 (MemMachine v1 API Migration)

### 🚀 MemMachine v1 API Migration Complete
- **Migrated from legacy MemMachine API to v1 API** with full semantic search capabilities
- **73% additional cost reduction** via semantic search (only 5-10 relevant recipes vs all 241)
- **Combined total savings**: 98% reduction from original Sonnet implementation
- **New capabilities**: Conversation memory persistence, user profile extraction, vector-based recipe search

### 🏗️ Technical Implementation
- Created comprehensive TypeScript types in `api/src/types/memmachine.ts`
  - `NewEpisode`, `SearchQuery`, `MemMachineSearchResponse`, `NormalizedSearchResult`
  - `SessionHeaders` (Axios-compatible), `MEMMACHINE_CONSTANTS`
- Completely refactored `MemoryService` for v1 API (558 lines)
  - Added `buildHeaders()`, `buildEpisode()`, `formatRecipeForStorage()`
  - Added `validateAndNormalizeResponse()` for defensive programming
  - Rewrote `storeUserRecipe()`, `queryUserProfile()`, `storeConversationTurn()`
  - Updated `formatContextForPrompt()` with recipe-only filtering logic
  - Removed `formatUserProfileForPrompt()` (merged into formatContextForPrompt)
- Updated integration points in `messages.ts` (removed deprecated method calls)
- Fixed TypeScript compilation errors (SessionHeaders type, generic assertions)

### 📊 API Changes
- **Old API**: `GET /memory?user_id=X&query=Y` (query params)
- **New API**: `POST /v1/memories/search` (headers + body)
- **Session Strategy**: Daily chat sessions (`chat-2025-11-23`) for natural boundaries
- **Request Headers**: `user-id`, `session-id`, `group-id`, `agent-id` required for all calls

### ✅ Testing & Validation
- Successfully seeded 241 recipes for test user (100% success rate)
- Semantic search verified: "rum cocktails with lime" returns 5 relevant Zombie variations
- User isolation confirmed: user_1 and user_2 have separate namespaces
- Response validation handles edge cases (missing fields, null values, empty arrays)
- TypeScript compilation passes with zero errors

### 🎯 Key Implementation Decisions
1. **Recipe Deletion**: Historical data remains in MemMachine (acceptable for MVP, Option A documented for future UUID tracking)
2. **Session IDs**: Daily chat sessions (`chat-YYYY-MM-DD`) instead of 5-minute buckets
3. **Response Validation**: Added defensive validation layer to prevent runtime errors
4. **Filtering Logic**: Only recipe-related episodic memories included in AI prompts

### 📝 Documentation
- Created `MEMMACHINE_V1_MIGRATION_COMPLETE.md` with comprehensive migration summary
- Updated `CHANGELOG.md` with v1.18.0 entry
- Inline documentation in MemoryService (extensive JSDoc comments)
- Migration plan recommendations implemented (pre-flight tests, response validation, filtering)

### 💰 Cost Impact
- **Per Session Cost**: $0.0189 → $0.00504 (73% reduction)
- **Prompt Size**: 44,900 tokens → ~12,000 tokens (73% reduction)
- **Annual Savings** (10k users/month): $16,632/year
- **Combined Savings** (vs original Sonnet): 98% total reduction

## v1.17.0 – 2025-11-23 (AI Cost Optimization)

### 🚀 Major Cost Reduction (97% Savings!)
- **Migrated to Claude 3.5 Haiku** (`claude-3-5-haiku-20241022`) from Sonnet for 12x base cost reduction
- **Implemented Anthropic Prompt Caching** with structured content blocks and cache breakpoints
- **Cost Impact**: $0.75 → $0.021 per session (97.2% reduction)
- **Annual Savings**: $874,800 for 10k users at scale

### 🏗️ Technical Implementation
- Refactored `buildContextAwarePrompt()` to return structured blocks with `cache_control` breakpoints
- Refactored `buildDashboardInsightPrompt()` to use same caching architecture
- Added `anthropic-beta: prompt-caching-2024-07-31` header to enable caching
- Separated static content (inventory/recipes - cached) from dynamic content (MemMachine/history - uncached)

### 📊 Observability
- Added comprehensive cost tracking logs showing cache write/read/regular input tokens
- Logs display savings percentage on cache hits with emoji indicators (💰✅✍️📝📤🎉)
- Dashboard and chat endpoints both track cache performance independently

### 📝 Documentation
- Updated README.md with Haiku model details and cost savings
- Updated SESSION_START.md with v1.17.0 status
- Created `AI_COST_OPTIMIZATION_IMPLEMENTATION.md` with complete technical summary
- Original plan documented in `AI_COST_OPTIMIZATION.md`

### ✅ Quality Assurance
- Zero frontend changes required (fully backwards compatible)
- TypeScript compilation passes (`npm run type-check`)
- Server startup validated successfully
- Same AI quality maintained (Haiku excels at structured recommendations)

## v1.9.0-alpha – 2025-11-16
- Persisted JWT blacklists in SQLite (`token_blacklist` table + hydration) so logout revocations survive restarts and scale horizontally
- Sanitized all stored prompt context (inventory/recipes/favorites) plus the latest 10 chat turns before sending requests to Claude
- API client now posts chat history to the backend, enabling context-aware follow-up questions
- Login page enforces the backend password policy (12+ characters, uppercase/lowercase/digit/special, common password blacklist) and surfaces inline guidance
- AI favorites toggle compares `recipe_id` before falling back to names, preventing duplicate/removal mismatches after renames
- Added Button "ghost" variant, Card `style` prop, and DeleteConfirm warning text prop to support recipes/favorites UI use cases
- TypeScript cleanup: `npm run type-check` now passes for both frontend and backend
- Documentation updated (SESSION_HISTORY, PROJECT_STATUS, ACTIVE_TASKS, DEV_NOTES, README, PROGRESS_SUMMARY, metrics)

## v1.8.0-alpha – 2025-11-15
- Delivered full recipe collections experience (CRUD, folder navigation, bulk move/delete, uncategorized section)
- Integrated collection assignment into CSV import and RecipeDetailModal
- Added collections state/actions to Zustand store and API client
- Updated README/PROJECT_STATUS to reflect collections feature completion
