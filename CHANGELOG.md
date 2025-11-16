# Changelog

All notable changes to the AlcheMix Next.js/Express monorepo will be documented here.

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
