# Active Tasks

Last updated: 2025-11-17 (Session 13)

## High Priority - Deployment & Testing
- [ ] **Phase 1 Deployment** - Deploy to free tier production
  - Test full stack functionality on Mac
  - Push code to GitHub
  - Deploy frontend to Vercel
  - Deploy backend to Railway (with persistent storage)
  - Configure production environment variables
  - Test deployed app end-to-end
- [ ] **Test CSV Import with Collections** - Verify collection assignment works
  - Test recipe CSV imports with collection_id assignment
  - Verify collection recipe counts update after import
  - Test bulk operations with large recipe sets (200+)
- [ ] **Mobile Device Testing** - Test responsive behavior on actual devices
- [ ] **Refactor AddBottleModal** - Update to match database schema like EditBottleModal
  - Change Spirit → name or Liquor Type
  - Change Brand → part of name
  - Add fields: Stock Number, Distillery Location, ABV (%), etc.

## Critical (User Requested Improvements) - COMPLETED ✅
- ✅ **Refine modal UX/UI** - 2025-11-08
  - ✅ Fixed modal scrolling bug
  - ✅ Improved form layouts with better spacing
  - ✅ Added animations (fade-in, slide-up)
  - ✅ Full mobile responsiveness (<640px)
- ✅ **Improve form validation** - 2025-11-08
  - ✅ Real-time validation on all fields
  - ✅ Inline error messages with icons
  - ✅ Specific, actionable error text
  - ✅ Field-level validation logic
- ✅ **Add loading states** - 2025-11-08
  - ✅ Spinner component created
  - ✅ Loading spinners in all modals
  - ✅ Disabled states during async operations
  - ✅ Success animations on completion
- [ ] **CSV import preview** - Show data preview before importing (Optional)
  - Display first 5 rows of CSV
  - Column mapping validation
  - Duplicate detection
  - Error rows highlighting
- [ ] **Test modals with real data** - Verify functionality with backend

## Medium Priority - Enhancements
- [ ] Edit and optimize logo image for TopNav/Login integration
- [ ] Add Anthropic API key to backend .env for AI testing
- [ ] Test accessibility with screen readers
- [ ] Add CSV column mapping preview UI
- [ ] Add tooltip hints for complex fields
- [ ] Field autocomplete for common values (spirit types, locations)
- [ ] Evaluate Redis-backed token blacklist for multi-instance deployments
- [ ] Persist AI chat history per user (beyond in-memory session)

## Low Priority - Optional Enhancements
- [ ] Build recipe creation modal
- [ ] Add error boundary components
- [ ] Implement advanced inventory filtering
- [ ] Add bulk operations for inventory
- [ ] Dark mode support
- [ ] Collection search/filter functionality
- [ ] Collection reordering
- [ ] Nested collections (sub-folders)

## Future Enhancements
- [ ] 4-step CSV upload flow (enhanced UX)
- [ ] Empty state illustrations
- [ ] Mobile PWA setup
- [ ] Performance optimization
- [ ] Image uploads for recipes/bottles

## Recently Completed

### Session 13 - 2025-11-17 (Smart Shopping List Complete & Production Hardening)
- ✅ Complete Smart Shopping List UI (craftable and near-miss recipe views)
- ✅ Implement safe array guards for shopping list data (safeCraftableRecipes, safeNearMissRecipes)
- ✅ Fix ingredient parser (stopped stripping "sugar" literal from ingredients)
- ✅ Implement bulk delete recipes endpoint (DELETE /bulk, up to 500 IDs)
- ✅ Add bulkDeleteRecipes store action for atomic state updates
- ✅ Fix recipes page pagination after large CSV imports
- ✅ Add logout cleanup for shopping list state (prevent data leaks)
- ✅ Harden AI endpoint (Anthropic key validation, placeholder check)
- ✅ Tighten prompt injection regex (only SQL-like phrases, not words like "Select")
- ✅ Fix rate limiting warnings (moved inside routers after authMiddleware)
- ✅ Update test infrastructure (schema alignment, all tests passing)
- ✅ Rename vitest.config.ts → vitest.config.mts for ESM compatibility
- ✅ Upgrade to @vitejs/plugin-react@5 for Vitest/Vite compatibility

### Session 12 - 2025-11-16 (Security Hardening & AI Context)
- ✅ Persisted JWT blacklists in SQLite (token_blacklist table) with hydration and cleanup
- ✅ Sanitized all AI prompt context plus last 10 chat turns before sending to Claude
- ✅ Updated aiApi + backend endpoint to include conversation history
- ✅ Login form now enforces backend password policy (12+ chars, complexity) with shared validator + UI hint
- ✅ AI favorites toggle now prefers recipe_id to avoid duplicate/deletion mismatches
- ✅ Added ghost Button variant, Card style prop, and DeleteConfirm warning prop to unblock recipes UI
- ✅ Updated README/PROJECT_STATUS/PROGRESS docs to v1.9.0-alpha (Security Hardening & AI Context)
- ✅ Documented sandbox Node ABI limitation and confirmed backend tests passing locally
- ✅ Added dev notes + metrics entry for security improvements

### Session 11 - 2025-11-15 (Recipe Collections & Bulk Operations)
- ✅ Create collections database schema (user_id, name, description, timestamps)
- ✅ Add collection_id foreign key to recipes table
- ✅ Implement full CRUD API endpoints for collections (GET/POST/PUT/DELETE)
- ✅ Collections return recipe_count via database JOIN query
- ✅ Create CollectionModal component for CRUD operations
- ✅ Add collections state to Zustand store with CRUD actions
- ✅ Add collection selector dropdown in CSVUploadModal
- ✅ Implement collection assignment in RecipeDetailModal
- ✅ Build folder-like navigation (click to enter collection, back button to return)
- ✅ Create bulk selection system (checkboxes, Set data structure, O(1) operations)
- ✅ Implement bulk move modal and bulk delete functionality
- ✅ Add uncategorized recipes section (recipes without collection_id)
- ✅ Fix recipe count display (use collection.recipe_count, not filtered array length)
- ✅ Add collection_id support in PUT /api/recipes/:id endpoint
- ✅ Add API client methods (getCollections, createCollection, updateCollection, deleteCollection)
- ✅ Update Collection TypeScript interface with recipe_count property
- ✅ Update SESSION_END.md to make README and prompt-effectiveness updates mandatory
- ✅ Update README.md version to v1.8.0-alpha with collections features
- ✅ Add comprehensive session metrics to prompt-effectiveness.md

### Session 10 - 2025-11-14 (AI Bartender Clickable Recipes & Authentication Fixes)
- ✅ Fix authentication logout on page refresh (Added `_hasHydrated` flag to Zustand store)
- ✅ Fix login redirect loops (Created `useAuthGuard` hook that waits for hydration)
- ✅ Fix API response unwrapping in auth endpoints (Extract nested data.data)
- ✅ Update Claude model to claude-sonnet-4-5-20250929
- ✅ Fix database import in backend (Named import `{ db }`)
- ✅ Implement context-aware system prompts (Backend builds with inventory + recipes + favorites)
- ✅ Increase Claude API timeout from 30s to 90s for large prompts
- ✅ Integrate RecipeDetailModal with AI page
- ✅ Implement clickable recipe names in AI responses
- ✅ Add flexible recipe name matching (handles "#1" suffixes)
- ✅ Strip markdown formatting from AI recommendation parsing
- ✅ **FIX CRITICAL BUG**: Add fetchRecipes() and fetchFavorites() to AI page mount
- ✅ Fix all TypeScript build errors (frontend and backend)
- ✅ Exclude vitest.config.ts from Next.js type checking
- ✅ Fix Bottle type mismatches (removed Brand, Quantity columns)
- ✅ Fix Favorite type mismatches (recipe_name vs recipeName)

### Session 9 - 2025-11-14 (Recipe CRUD Complete & TypeScript Build Fixes)
- ✅ Implement recipe update backend endpoint (PUT /api/recipes/:id)
- ✅ Implement recipe delete backend endpoint (DELETE /api/recipes/:id)
- ✅ Add recipeApi.update() and recipeApi.delete() to frontend API client
- ✅ Add updateRecipe() and deleteRecipe() to Zustand store
- ✅ Update Recipe interface with spirit_type and created_at fields
- ✅ Create edit mode in RecipeDetailModal with inline forms
- ✅ Add edit button (pencil icon) to modal header
- ✅ Create form inputs for name, category, ingredients, instructions, glass
- ✅ Add Save/Cancel buttons with proper state management
- ✅ Add Delete button with confirmation prompt
- ✅ Fix modal scrolling for long recipes (overflow-y: auto)
- ✅ Add form input styling with focus states
- ✅ Implement ESC key to cancel edit mode
- ✅ Add success/error toasts for all operations
- ✅ Fix JWT_SECRET type inference in auth.ts
- ✅ Fix missing db import in server.ts
- ✅ Fix validateBottleData import conflict in inventory.ts
- ✅ Fix spread argument errors in auth.test.ts
- ✅ Fix array type inference in recipes.ts (2 locations)
- ✅ Fix mock type errors in errorHandler.test.ts
- ✅ Fix read-only property assignments in errorHandler.test.ts
- ✅ Verify TypeScript build passes (npm run build)
- ✅ Verify backend build passes (cd api && npm run build)

### Session 8 - 2025-11-13 (Recipe System Enhancement)
- ✅ Install Node.js v20 LTS via nvm on Mac
- ✅ Configure nvm in ~/.zshrc for automatic loading
- ✅ Create backend .env with secure JWT_SECRET
- ✅ Implement recipe CSV import endpoint with flexible parsing
- ✅ Add multer file upload configuration
- ✅ Create validateRecipeData() with findField() helper
- ✅ Support multiple ingredient delimiters (;, |, \n, ,)
- ✅ Create RecipeDetailModal component (~220 lines)
- ✅ Create RecipeDetailModal.module.css (~270 lines)
- ✅ Add parseIngredients() helper to handle JSON arrays
- ✅ Fix ingredient .split() errors on dashboard
- ✅ Fix ingredient .split() errors on recipes page
- ✅ Integrate RecipeDetailModal on recipes page
- ✅ Integrate RecipeDetailModal on favorites page
- ✅ Add handleViewRecipe() with recipe lookup (by ID, fallback to name)
- ✅ Fix "Add to Favorites" error (corrected API parameters)
- ✅ Enhance favoritesApi.add() to accept optional recipe_id
- ✅ Update Zustand store addFavorite() signature
- ✅ Export RecipeDetailModal from modals/index.ts

### Session 7 - 2025-11-12 (CSV Import & Edit Modal Fixes)
- ✅ Fix API response structure mismatch (nested data extraction)
- ✅ Implement validateBottleData function with flexible field matching
- ✅ Add findField() helper for multiple column name variations
- ✅ Add safeString() and safeNumber() type conversion helpers
- ✅ Fix CSV import to accept 42 bottles successfully
- ✅ Completely refactor EditBottleModal to match database schema
- ✅ Organize modal fields into logical sections
- ✅ Update validation for new field names
- ✅ Fix handleSubmit to use correct database fields
- ✅ Add debug logging to store and page components
- ✅ Kill zombie node processes on ports 3000 and 3001

### Session 4 - 2025-11-08 (Modal System Polish)
- ✅ Fix modal scrolling bug (min-height: 0 on content)
- ✅ Add mobile responsive styles to all modals
- ✅ Create Spinner component (sm/md/lg, primary/white)
- ✅ Create SuccessCheckmark component (animated)
- ✅ Add loading spinners to all async operations
- ✅ Add success animations on save (1.5s auto-dismiss)
- ✅ Implement real-time form validation (all fields)
- ✅ Add ARIA labels for accessibility (role, aria-*)
- ✅ Implement focus management (auto-focus, trapping)
- ✅ Add keyboard shortcuts (ESC, Tab, Enter)
- ✅ Add unsaved changes confirmation
- ✅ Add modal animations (fade-in, slide-up)
- ✅ Update Button and Input with forwardRef
- ✅ Improve error display with icons

### Session 3 - 2025-11-07 (Modal System)
- ✅ Create CSV upload modal component (bottles and recipes)
- ✅ Build add bottle form modal (12 fields)
- ✅ Build edit bottle form modal
- ✅ Build delete confirmation modal
- ✅ Add toast notification system (ToastProvider + useToast)
- ✅ Wire up all modals to My Bar page actions
- ✅ Wire up CSV modal to Recipes page
- ✅ Integrate toast notifications for all user actions
- ✅ Commit and push modal system to GitHub (13 files created)

### Session 2 - 2025-11-07 (Icon Refactor & Bug Fixes)
- ✅ Replace all emoji icons with Lucide React icons
- ✅ Fix array initialization bugs in all pages
- ✅ Fix CORS configuration in backend
- ✅ Install lucide-react package
- ✅ Test full authentication flow
- ✅ Downgrade Node.js to v20 LTS
- ✅ Install backend dependencies

### Session 1 - 2025-11-07 (Foundation)
- ✅ Create all 7 MVP pages
- ✅ Build TopNav component
- ✅ Set up Zustand store
- ✅ Configure API client with Axios
- ✅ Create core UI components (Button, Card, Input)
- ✅ Implement design system
- ✅ Initialize Next.js project
- ✅ Create GitHub repository

---
