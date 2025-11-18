# Session History

This file tracks the 10 most recent development sessions. Older sessions are archived in `archives/session-history-archive.md`.

---

## Session: 2025-11-17 - Smart Shopping List Feature Complete & Production Hardening

### Summary
Completed the Smart Shopping List feature by implementing full UI for craftable and near-miss recipe views. User provided comprehensive fixes from an additional session including safe array guards, backend ingredient parser improvements, pagination/bulk delete for recipes, AI improvements (prompt injection tightening, Anthropic key validation, rate limiting), and test infrastructure updates. Feature now provides intelligent ingredient recommendations with fuzzy matching, displays craftable recipes, shows near-miss recipes with highlighted missing ingredients, and includes full inventory view.

### Components Worked On
- **Frontend Pages**: Smart Shopping List page (`src/app/shopping-list/page.tsx`) - completed craftable/near-miss recipe displays
- **Backend Routes**: Shopping list endpoint (`api/src/routes/shoppingList.ts`) - parser fixes, fuzzy matching improvements
- **Backend Routes**: Recipes bulk delete (`api/src/routes/recipes.ts`) - DELETE /bulk endpoint (up to 500 IDs)
- **Backend Routes**: AI messages hardening (`api/src/routes/messages.ts`) - Anthropic key validation, prompt injection tightening
- **Zustand Store**: Added `bulkDeleteRecipes` action, logout cleanup for shopping list state
- **API Client**: `recipeApi.deleteBulk` method, safe response defaults for shopping list
- **React Components**: Safe array guards (`safeCraftableRecipes`, `safeNearMissRecipes`)
- **TypeScript Types**: Extended store contract with bulk delete, shopping list interfaces
- **Test Infrastructure**: Updated schema in `api/src/tests/setup.ts`, fixed all integration tests
- **Configuration**: Renamed `vitest.config.ts` → `vitest.config.mts` for ESM compatibility

### Key Achievements
- ✅ **Shopping List UI Complete**: Craftable and near-miss recipe views with proper rendering
- ✅ **Safe Array Guards**: Frontend prevents crashes when data is loading (safeCraftableRecipes, safeNearMissRecipes)
- ✅ **Ingredient Parser Fix**: Stopped stripping literal "sugar" from ingredients (preserves "sugar syrup")
- ✅ **Bulk Delete Recipes**: Backend endpoint handles up to 500 recipe IDs per request
- ✅ **Store Bulk Action**: `bulkDeleteRecipes` for atomic state updates without rate limit issues
- ✅ **Logout Cleanup**: Shopping list state cleared on logout to prevent data leaks
- ✅ **Pagination Fixes**: Recipes page pagination restored after large CSV imports
- ✅ **AI Hardening**: Anthropic placeholder keys fail fast with 503, not 401
- ✅ **Prompt Injection Tightened**: Only strips SQL-like phrases, not words like "Select Aperitivo"
- ✅ **Rate Limiting Fixed**: Moved inside routers after authMiddleware to stop warnings
- ✅ **Test Infrastructure**: All tests passing with updated schema (Windows ✅, WSL documented)
- ✅ **Vitest/Vite Compatibility**: Upgraded to `@vitejs/plugin-react@5` and ESM config

### Issues Encountered
- **Shopping List Array Crashes**: Initial implementation didn't guard against undefined craftableRecipes/nearMissRecipes
  - **Resolution**: Added `safeCraftableRecipes = Array.isArray(craftableRecipes) ? craftableRecipes : []` pattern
- **Ingredient Matching Bug**: Backend was stripping "sugar" from "sugar syrup", breaking near-miss counts
  - **Resolution**: Removed "sugar" from unitsToRemove list in parser
- **Pagination Broken**: Large CSV imports broke recipe pagination display
  - **Resolution**: Fixed count display logic to use database totals, not filtered array length
- **Rate Limit Warnings**: Per-user rate limiting logged warnings about missing req.user
  - **Resolution**: Moved rate limiter inside routers after authMiddleware
- **Anthropic API 401s**: Placeholder "your-api-key-here" hit remote API with clear error
  - **Resolution**: Added guard to check for placeholder value and return 503 with helpful message
- **Prompt Injection False Positives**: Regex stripped words like "Select" from legitimate recipe names
  - **Resolution**: Tightened regex to only match SQL-like phrases (SELECT...FROM, DROP TABLE, etc.)

### Next Session Focus
1. Deploy to production (Vercel + Railway) with persistent storage
2. Test full shopping list feature with 300+ recipes
3. Verify bulk delete handles large selections (100+ recipes)
4. Add collection search/filter functionality
5. Implement conversation persistence for AI chat beyond in-memory

---

## Session: 2025-11-16 - Security Hardening & AI Conversation Context

### Summary
Closed the remaining audit items by persisting JWT revocations, sanitizing all AI prompt context, and aligning the UI password policy with backend enforcement. AI chat now sends sanitized conversation history, favorites toggle reliably by recipe_id, and DeleteConfirm/Buttons gained the props required by the recipes UI. Documentation, README, and metrics were updated to reflect the security upgrades.

### Components Worked On
- **Backend**: Added `token_blacklist` table, persisted blacklist in `api/src/utils/tokenBlacklist.ts`, sanitized AI request history in `api/src/routes/messages.ts`
- **Database**: Updated schema initialization with `token_blacklist` table
- **API Client**: `aiApi.sendMessage` now posts sanitized history payloads
- **React Components**: Login page password hint/validation, DeleteConfirmModal warning prop, Button ghost variant, Card inline style prop
- **Zustand Store**: AI favorites toggle now uses `recipe_id`, store sendMessage posts history array
- **Next.js Pages**: `/ai` favorites logic, `/login` validation, `/recipes` delete modals (title/message)
- **TypeScript Types**: Added missing `quantity`, `collection_id` fields to shared interfaces; type-check errors resolved
- **Documentation**: SESSION_HISTORY, PROJECT_STATUS, ACTIVE_TASKS, DEV_NOTES, README, PROGRESS_SUMMARY, prompt-effectiveness metrics

### Key Achievements
- ✅ `token_blacklist` table + hydration ensures logout survives restarts and multi-node deployments
- ✅ Chat history sanitization prevents stored prompt injection and gives Claude conversation context
- ✅ Login form enforces 12+ character complex passwords and displays requirement hint
- ✅ AI favorites toggle compares `recipe_id` first, preventing duplicate entries after rename
- ✅ Added `ghost` Button variant and Card `style` prop to satisfy recipes page usage
- ✅ DeleteConfirmModal now accepts custom warning message + titles in recipes modals
- ✅ Type-check errors cleared across repo (`npm run type-check` now passes)
- ✅ README/Progress docs bumped to v1.9.0-alpha (Security Hardening & AI Context) with new highlights

### Issues Encountered
- **better-sqlite3 ABI mismatch inside sandbox**: Sandbox Node (ABI 115) can’t load rebuilt module (ABI 137)
  - **Resolution**: Confirmed backend tests pass locally on Node 24; documented sandbox limitation
- **TypeScript errors after tightenings**: Missing Button variant, Card style prop, DeleteConfirm warning prop
  - **Resolution**: Extended component props and updated usage accordingly
- **AI history still stateless**: Client collected chatHistory but never sent it
  - **Resolution**: API client/back end now send sanitized history array limited to last 10 turns

### Next Session Focus
1. Decide on Redis-backed blacklist (optional) or keep SQLite approach documented
2. Finish deployment prep (Vercel/Railway) once security docs verified
3. Add conversation persistence beyond in-memory (store chatHistory per user)
4. Tackle remaining ACTIVE_TASKS (CSV preview, AddBottleModal schema parity, deployment checklist)

---

## Session: 2025-11-15 - Recipe Collections & Bulk Operations

### Summary
Implemented complete recipe collections feature allowing users to organize recipes into folders/books. Collections provide folder-like navigation (click to enter, back button to return), CSV import integration (assign recipes to collection during import), individual recipe assignment (move recipes between collections from detail modal), and bulk operations (multi-select with checkboxes for mass move/delete). Also enforced mandatory README and prompt-effectiveness updates in SESSION_END.md.

### Components Worked On
- **Backend**: Collections API routes (CRUD operations), database schema (collections table, collection_id foreign key)
- **React Components**: CollectionModal, CSVUploadModal (collection selector), RecipeDetailModal (collection assignment)
- **Recipes Page**: Folder-like navigation, bulk selection system, uncategorized recipes section
- **Zustand Store**: Added collections state, CRUD actions, fetchCollections integration
- **API Client**: Added collections API methods (getAll, create, update, delete)
- **TypeScript Types**: Added Collection interface, updated Recipe with collection_id
- **Documentation**: SESSION_END.md (mandatory updates), README.md, prompt-effectiveness.md

### Key Achievements
- ✅ Created collections database schema with user_id, name, description, timestamps
- ✅ Implemented full CRUD API endpoints for collections (GET/POST/PUT/DELETE)
- ✅ Collections return recipe_count via database JOIN query
- ✅ Added collection selector dropdown in CSV upload modal
- ✅ Implemented collection assignment in RecipeDetailModal
- ✅ Built folder-like navigation (click to enter collection, back button to return)
- ✅ Created bulk selection system (checkboxes, Set-based selection, O(1) operations)
- ✅ Implemented bulk move modal and bulk delete functionality
- ✅ Added uncategorized recipes section for recipes without collection_id
- ✅ Fixed recipe count display (uses collection.recipe_count, not filtered array length)
- ✅ Added collection_id support in PUT /api/recipes/:id endpoint
- ✅ Updated SESSION_END.md to make README and prompt-effectiveness updates mandatory

### Issues Encountered
- **Recipe count showing 50 instead of 200+**: Using filteredRecipes.length only counts loaded recipes (max 50 per page)
  - **Resolution**: Changed to use activeCollection.recipe_count from database JOIN query
- **Collection recipe count not updating after import**: Import didn't refresh collections
  - **Resolution**: Added fetchCollections() call after successful CSV import with collectionId
- **Recipes all showing instead of folder structure**: User wanted folders, not filters
  - **Resolution**: Restructured to show collections as clickable cards with back button navigation
- **Uncategorized recipes disappearing**: Recipes without collection_id not visible
  - **Resolution**: Added dedicated "Uncategorized Recipes" section below collections grid

### Next Session Focus
1. Test CSV import with collection assignment (user reported it shows 0 recipes)
2. Verify collection recipe counts update correctly
3. Test bulk operations with large recipe sets
4. Consider adding collection search/filter
5. Deploy to production (Vercel + Railway)

---

## Session: 2025-11-14 - AI Bartender Clickable Recipes & Bug Fixes

### Summary
Fixed critical authentication bugs causing logout on refresh and redirect loops. Implemented clickable recipe names in AI chat responses that open RecipeDetailModal. Fixed extensive TypeScript build errors across the codebase. Integrated AI Bartender with context-aware system prompts that include user's full bar inventory and recipe collection.

### Components Worked On
- **React Components**: AI page (src/app/ai/page.tsx) - added RecipeDetailModal integration, recipe name clickability
- **TypeScript Types**: Fixed mismatched field names across Bottle and Favorite interfaces
- **Zustand Store**: Fixed authentication rehydration issue causing logout on refresh, added `_hasHydrated` flag
- **Hooks**: Created `useAuthGuard` hook (src/hooks/useAuthGuard.ts) for consistent auth protection
- **API Integration**: Fixed response unwrapping in auth API calls, updated Claude model to `claude-sonnet-4-5-20250929`
- **Backend**: Fixed database imports (named vs default export), implemented `buildContextAwarePrompt` function
- **CSS/Styling**: Removed non-existent table columns (Brand, Quantity) from Bar page

### Key Achievements
- ✅ Fixed authentication persistence across page refreshes
- ✅ Fixed login redirect loops by implementing `_hasHydrated` flag and `useAuthGuard` hook
- ✅ Increased Claude API timeout from 30s to 90s for large prompts
- ✅ Backend now builds context-aware prompts from database (user's inventory + recipes + favorites)
- ✅ Implemented `parseAIResponse` markdown stripping (removes `**` formatting)
- ✅ Implemented flexible recipe name matching (handles "#1" suffixes)
- ✅ Added comprehensive console logging for debugging recipe clickability
- ✅ Fixed all TypeScript build errors (frontend and backend both compile successfully)
- ✅ Excluded vitest.config.ts from Next.js type checking to resolve plugin conflicts

### Issues Encountered
- **Auth Bug**: `onRehydrateStorage` was setting `isAuthenticated = false` after rehydration, causing immediate logout
  - **Resolution**: Added `_hasHydrated` flag and only validate token after hydration completes
- **API Response Format**: Backend wraps responses in `{ success: true, data: {...} }` but frontend expected unwrapped data
  - **Resolution**: Fixed API client to unwrap `data.data` correctly
- **Database Import Error**: `import db` (default) instead of `import { db }` (named export)
  - **Resolution**: Changed to named import throughout backend
- **Claude API Timeout**: 30s timeout too short for prompts with 112 recipes (21KB+ payload)
  - **Resolution**: Increased to 90s timeout
- **Vitest Plugin Conflict**: Next.js couldn't type-check vitest.config.ts due to incompatible Vite plugin types
  - **Resolution**: Excluded vitest.config.ts from tsconfig.json
- **Frontend Ingredients Type**: Frontend `buildSystemPrompt` expected string ingredients but got arrays from database
  - **Resolution**: Removed frontend prompt building entirely - backend now handles it
- **Bottle Type Mismatches**: Table displayed non-existent fields (Brand, Quantity)
  - **Resolution**: Removed invalid columns, fixed AddBottleModal field mappings
- **⚠️ CRITICAL UNRESOLVED**: Recipes not loading on AI page - `availableRecipes: []` causes all recipe matches to fail
  - **Cause**: AI page doesn't call `fetchRecipes()` on mount
  - **Impact**: Recipe names are not clickable even though parsing and rendering code works
  - **Next Steps**: Add `fetchRecipes()` to AI page's useEffect

### Next Session Focus
1. **FIX CRITICAL BUG**: Add `fetchRecipes()` and `fetchFavorites()` to AI page useEffect
2. Test clickable recipe names with recipes loaded
3. Verify RecipeDetailModal opens with correct data
4. Test with full 300+ recipe collection
5. Consider prompt optimization strategies if 90s timeout is still insufficient

---
