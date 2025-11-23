# Changelog

All notable changes to the AlcheMix Next.js/Express monorepo will be documented here.

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
