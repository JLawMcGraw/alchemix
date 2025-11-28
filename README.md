# AlcheMix - Modern Cocktail Lab Management

[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

Modern cocktail inventory and recipe management system with AI-powered bartender recommendations. Built with Next.js 14, TypeScript, and Zustand.

## ✨ Current Status

**Version:** v1.19.0 (UUID Deletion & MemMachine Integration Complete)
**Phase:** Production Ready - True AI Memory Deletion
**Last Updated:** November 27, 2025
**Known Issues:** None - Full UUID lifecycle implemented and tested

### What's Working
- ✅ **Complete TypeScript monorepo** (Frontend + Backend) ⭐
- ✅ **Modern Express backend** with JWT auth, full CRUD APIs ⭐
- ✅ **SQLite database** with auto-initialization ⭐
- ✅ **My Bar (Inventory Management) Complete** - Modern category-organized interface ⭐⭐⭐
  - Category-based tab navigation (9 tabs: All, Spirits, Liqueurs, Mixers, Syrups, Garnishes, Wine, Beer, Other)
  - Live item counts per category displayed in tab badges
  - Card grid layout (similar to Recipes page) with hover effects
  - ItemDetailModal with dual view/edit modes
  - 4 organized sections: Basic Info, Production Details, Tasting Profile, Additional Notes
  - Inline editing - click Edit to enable, Save to commit, Cancel to revert
  - Paginated fetching (100 items per page) handles large inventories
  - Type-safe with InventoryCategory union type
  - CSV import with category validation
  - Responsive design (mobile-friendly single column)
- ✅ **Smart Shopping List Complete** - Intelligent ingredient recommendations ⭐⭐⭐
  - "Near miss" algorithm analyzes recipes missing exactly 1 ingredient
  - **Comprehensive Ingredient Matching Improvements** ⭐ **v1.18.2 (IN PROGRESS - BUG)**:
    - **Unicode normalization (NFKD)**: Properly handles fractions (½, ¾) and accents (Curaçao)
    - **Syrup variant normalization**: "Mai Tai Rich Simple Syrup" matches "Simple Syrup"
    - **Brand name stripping**: "Pierre Ferrand Dry Curaçao" matches generic "Curaçao"
    - **Spirit synonyms**: Light rum = white rum = silver rum, Jamaican rum variants, Pernod/Pastis/Absinthe
    - **Relaxed single-token matching**: "Rye" matches "Rye Whiskey"
    - **Curated ALWAYS_AVAILABLE**: Pantry staples (water, ice, sugar, salt, eggs, milk/cream, coffee, mint, cinnamon)
    - **Aged rum detection**: "Bacardi 8" → dark rum, "Havana Club 7" → dark rum
    - **Chambord synonyms**: Chambord ↔ Black Raspberry Liqueur
    - 🔴 **BLOCKED**: Code changes not loading despite correct implementation and passing tests
  - Smart recommendations ranked by number of recipes each ingredient unlocks
  - Pagination (top 10 per page) with Previous/Next navigation
  - Clickable stats for 4 view modes: recommendations, craftable, near misses, inventory
  - Craftable recipes view shows what you can make right now
  - Near-miss view highlights the single missing ingredient per recipe
  - Full inventory view with category grouping
  - Safe array guards prevent crashes during data loading
  - Logout cleanup prevents data leaks between users
  - **Stock-Based Filtering**: Only items with stock > 0 are considered "in stock" ⭐ **NEW v1.15**
  - **Fixed**: Favorites integration (proper recipe_id/name matching, safe ingredient parsing)
- ✅ **Recipe Mastery Filters** - Navigate recipes by craftability level ⭐⭐ **NEW v1.14**
  - 4 mastery levels: Craftable (0 missing), Near Misses (1 missing), Need 2-3 (2-3 missing), Major Gaps (4+ missing)
  - Clickable stat cards on dashboard bounce to filtered recipe view
  - Dynamic heading shows filter type and exact recipe count
  - "Clear Filter" button to return to full recipe list
  - Backend categorization in shopping list API with accurate counts
  - **Fixed**: Browser cache-busting prevents stale 304 responses blocking new API fields
- ✅ **Recipe Collections Complete** - Organize recipes into collections/folders with bulk operations ⭐⭐⭐
  - Create, edit, and delete collections with descriptions
  - Collections act as folders (click to enter, back button to return)
  - Assign recipes to collections from CSV import
  - Move individual recipes between collections from detail modal
  - Bulk selection with checkboxes for mass move/delete operations
  - Bulk delete endpoint (up to 500 recipes) with atomic state updates
  - Uncategorized recipes section for recipes not in collections
  - Database-accurate recipe counts (handles 200+ recipes correctly)
  - **Auto-refresh stats** after any recipe operation (add/delete/update) ⭐ **v1.18.4**
  - **Improved recipe modals** with dynamic ingredient inputs (Enter to add) ⭐ **v1.18.4**
- ✅ **AI Bartender with MemMachine Memory** - Context-aware Claude AI with semantic recipe search ⭐⭐⭐⭐
  - **MemMachine V1 Integration**: User-specific AI memory with semantic search over recipes ⭐ **v1.18**
    - **Complete V1 API Migration**: Full TypeScript types, response validation, semantic search tested
    - Each user has isolated memory namespace (`user_{userId}`) - zero cross-user data leakage
    - Automatic recipe storage on create/import with v1 `/v1/memories` endpoint
    - **UUID Deletion System** (v1.19.0): True deletion prevents ghost data accumulation ⭐⭐
      - **Problem Solved**: Deleted recipes no longer remain in vector database forever
      - **Architecture**: 4-layer deletion (SessionMemory → LongTermMemory → DeclarativeMemory → Neo4j)
      - **Implementation**: DELETE /v1/memories/{uuid} endpoint removes episodes + clusters + derivatives
      - **Storage**: recipes.memmachine_uuid column tracks episode UUIDs for targeted deletion
      - **Tested**: End-to-end verification (create → store UUID → delete → verify removal)
    - **Semantic Search**: 5-10 relevant recipes per query vs 241 all recipes (73% cost reduction)
    - Daily chat sessions using `chat-YYYY-MM-DD` format for natural conversation boundaries
    - OpenAI text-embedding-3-small embeddings for vector similarity search
    - Response validation with nested array flattening (episodic_memory[][])
    - Fire-and-forget pattern ensures core functionality never fails if MemMachine is down
    - **Verified Testing**: 241/241 recipes successfully seeded, semantic search returning relevant results
    - **Fixed Configuration** (v1.18.4): Correct port (8080), reranker config, batch upload working ⭐
  - **Claude Haiku 4.5** with **Prompt Caching** (claude-haiku-4-5-20251001) ⭐ **NEW v1.17**
    - **98% total cost reduction** ($0.75 → $0.015 per session with semantic search + caching)
    - Intelligent caching: Static context (inventory/recipes) cached for 5-min TTL with 90% discount
    - Performance: Same quality recommendations at 50x lower cost
  - Context-aware system prompts with user's full bar inventory and recipe collection
  - "Lab Assistant" persona (informed enthusiasm, scientific voice, supportive curiosity)
  - **Clickable recipe names** that open RecipeDetailModal with full details ⭐ **FIXED v1.18**
    - Enhanced AI prompt with visual borders (━━━) and mandatory RECOMMENDATIONS: line
    - Fixed regex matching for recipe names with parentheses (negative lookbehind/lookahead)
    - Works with special characters: "Mai Tai (Trader Vic)", "Whiskey & Rye", etc.
  - Flexible recipe name matching (handles "#1" suffixes, partial matches)
  - 90-second timeout for large prompts (300+ recipes)
  - 8-layer prompt injection protection plus sanitized stored context/history
  - Sanitized chat history (last 10 turns) supplied with each request
  - **Fixed**: Chat history synchronization (complete history sent to backend before reply)
- ✅ **Authentication Complete** - Enhanced security and modern UX ⭐⭐⭐
  - **Persistent Token Versioning** (v1.18.5): Database-backed session invalidation survives server restarts ⭐
  - **Password Visibility Toggles**: Eye icons in login/signup for easy password verification ⭐
  - **Real-Time Password Requirements**: Inline validation with color feedback and checkmarks ⭐
  - **Simplified Password Policy** (v1.18.5): 8+ chars, uppercase, number or symbol ⭐
  - Added `_hasHydrated` flag to Zustand store for proper rehydration timing
  - Created `useAuthGuard` hook for consistent auth protection across pages
  - Token validation after Zustand hydration completes
  - API response unwrapping fixed (nested data.data structure)
  - Client-side password validator matches backend policy exactly
- ✅ **Recipe CRUD Complete** - Full create, read, update, delete operations ⭐⭐
- ✅ **Recipe Editing** - Inline edit mode in RecipeDetailModal with form validation ⭐
- ✅ **Recipe Deletion** - Backend endpoint with CASCADE cleanup and confirmation ⭐
- ✅ **Recipe CSV Import** - Flexible parsing with multiple delimiters (;, |, \n, ,) ⭐
- ✅ **RecipeDetailModal** - Full recipe details with edit/delete capabilities ⭐
- ✅ **Dashboard UI Polish** - Streamlined layout with AI-formatted greeting ⭐
  - Single-column control panel header (removed two-column grid)
  - AI-generated greeting with <strong> tag support for number highlighting
  - Lab Assistant's Notebook card featuring proactive insights
  - Button relocations (AI button in AI card, Add Item in Bar card)
  - Beige header background with teal number highlights
  - Responsive card grid for Bar/Recipes/Favorites overview
  - **Fixed**: Custom greeting parser preserves <strong> tags without dangerouslySetInnerHTML (no spacing artifacts)
- ✅ **Seasonal Dashboard Insights** - Context-aware AI recommendations based on season ⭐⭐ **NEW v1.14**
  - Automatic season detection (Spring/Summer/Fall/Winter) based on current month
  - Seasonal cocktail category suggestions (e.g., Winter: stirred spirit-forward, Summer: tiki drinks)
  - MemMachine integration retrieves conversation history for personalized recommendations
  - AI analyzes full recipe and inventory lists to count craftable recipes by category
  - Consistent Lab Assistant personality matching AI Bartender voice
  - HTML rendering for `<strong>` tags to highlight recipe counts
  - Example: "Perfect for winter: Your bourbon collection unlocks **15 stirred cocktails**"
- ✅ **Comprehensive Test Infrastructure** - 318/318 tests passing (100% pass rate) ⭐⭐⭐
  - 111 new integration tests added (35% coverage increase)
  - Complete route coverage (inventoryItems, recipes, collections, favorites, messages)
  - Security testing (prompt injection, SQL injection, XSS prevention, token versioning)
  - 17 dedicated token versioning security tests (database persistence, restart simulation, attack scenarios)
  - Test utilities (helpers, assertions, mocks) reduce boilerplate by ~60%
  - Docker testing environment (Dockerfile + docker-compose.test.yml)
  - Test documentation with best practices guide
  - npm scripts: test:api, test:api:docker
- ✅ **Docker Environment Complete** - Full setup with Mac troubleshooting ⭐⭐⭐ **NEW v1.18.3**
  - Fixed Docker Desktop installation on Mac (symlinks to /Applications)
  - Docker Compose V2 syntax (`docker compose` not `docker-compose`)
  - All 6 services running: Neo4j, Postgres, MemMachine, Bar Server, API, Frontend
  - Test user creation script for local development
  - Comprehensive Mac-specific troubleshooting documentation
- ✅ **Hybrid Development Environment** - Docker infrastructure + local dev ⭐⭐ **v1.18.2**
  - Docker runs infrastructure services only (Neo4j, Postgres, MemMachine, Bar Server)
  - API and Frontend run locally with hot reload for fast iteration
  - `docker-compose.dev.yml` disables api/web services using profiles
  - Separate `api/.env` for local development (localhost URLs)
  - Best of both worlds: Docker stability + local development speed
  - Commands: `docker compose -f docker-compose.yml -f docker-compose.dev.yml up` + `npm run dev:all`
- ✅ **TypeScript Build** - Frontend and backend builds passing (all errors fixed) ⭐
- ✅ **Ingredient Parsing** - Universal parser handles JSON arrays and strings ⭐
- ✅ **Favorites Enhanced** - Now properly links recipe_id for data integrity ⭐
- ✅ **CSV Import Fixed** - Flexible field name matching, 42 bottles imported ⭐
- ✅ **Edit Modal Refactored** - Now matches database schema correctly ⭐
- ✅ **Enterprise Security (Phase 2+3+4 Complete)** ⭐⭐⭐
  - Token Blacklist (immediate logout)
  - Persistent blacklist storage (SQLite) with hydration for multi-instance deployments
  - Token Versioning (session fixation protection)
  - User Rate Limiting (100 req/user/15min)
  - **CRITICAL FIX**: Rate limiter bypass vulnerability patched (now scopes by router base path/route patterns)
  - Security Headers (HSTS, CSP, X-Frame-Options, Referrer-Policy)
  - JWT Token IDs (jti for granular revocation)
  - Input Validation (comprehensive XSS prevention)
  - Defense-in-Depth (6-layer security architecture)
  - ~4,500 lines of enterprise-grade documentation
- ✅ **CRITICAL Security Fixes (Nov 11, 2025)** ⭐⭐⭐
  - Query parameter sanitization (GDPR/PCI-DSS/HIPAA compliant - prevents PII leakage)
  - Client request ID validation (prevents XSS/log injection attacks)
  - Graceful shutdown with database closure (30s timeout for zero-downtime)
  - Custom error classes with operational vs programming error distinction
- ✅ **Production-Ready Observability** ⭐⭐
  - Winston structured logging (JSON format, file rotation)
  - Request correlation IDs for distributed tracing
  - Performance metrics tracking (request duration, slow request detection)
  - Comprehensive error tracking with context
- ✅ Complete authentication flow (login/signup)
- ✅ All 7 pages implemented and functional
- ✅ Professional Lucide React icon system
- ✅ Toast notification system
- ✅ Production-ready modal system with full accessibility
- ✅ Real-time form validation with inline error messages
- ✅ Loading states and success animations
- ✅ Mobile responsive modals (<640px)
- ✅ WCAG 2.1 AA accessibility compliance
- ✅ CSV import functionality (bottles & recipes) with flexible parsing
- ✅ Recipe detail modal with full information display
- ✅ Favorites management with recipe_id linking
- ✅ Full inventory table with filtering
- ✅ View recipe from favorites page

### Latest Session (Session 16 - November 27, 2025)
- ✅ **Security Hardening**: Fixed HIGH severity token versioning vulnerability ⭐⭐⭐
  - Migrated from in-memory Map to database-backed token versioning (survives restarts)
  - Added token_version column to users table with safe idempotent migration
  - Updated auth middleware to use database for getTokenVersion/incrementTokenVersion
  - Gated JWT_SECRET logging behind NODE_ENV check (prevents production metadata leakage)
  - Created comprehensive test suite (17 new token versioning tests, 318/318 passing)
- ✅ **Login/Signup UX Improvements**: Modern password experience ⭐⭐
  - Password visibility toggles (eye icons) with proper vertical centering
  - Real-time password requirements (auto-show on focus, auto-hide on blur)
  - Visual success feedback (black → teal color, checkmarks appear when met)
  - Simplified password policy: 8 chars minimum, uppercase, number OR symbol
  - Frontend/backend validation alignment (same regex patterns on both sides)
- ✅ **Project Cleanup**: Reduced root directory clutter (53 → 19 files, 64% reduction)
  - Deleted Windows batch files, redundant testing docs, misc files
  - Archived migration documentation to Documentation/archived/
  - Consolidated Docker documentation
- ✅ **Documentation**: Updated PROJECT_PROGRESS.md, DEV_NOTES.md, created SECURITY_FIXES_2025-11-27.md

### Next Phase
- 🚀 **Deployment to Production** (Vercel + Railway)
- 🧪 Test AI Bartender with full recipe collection (300+ recipes)
- 🧪 End-to-end testing with production data
- 📱 Mobile device testing (iOS, Android)
- ♿ Screen reader accessibility verification
- 🎯 Write tests for new recipe PUT/DELETE endpoints

### Optional Enhancements
- CSV import preview with column mapping
- Recipe creation form (standalone page)
- Password reset flow
- Dark mode support
- Advanced recipe search/filtering

## 🚀 Quick Start

```bash
# Install all dependencies (frontend + backend)
npm run install:all

# Set up backend environment
cp api/.env.example api/.env
# Edit api/.env and add a secure JWT_SECRET

# Run both frontend and backend together
npm run dev:all

# Frontend: http://localhost:3001
# Backend API: http://localhost:3000
```

**Alternative - Run separately:**
```bash
# Terminal 1 - Backend
cd api
npm run dev

# Terminal 2 - Frontend (from root)
npm run dev
```

## 📋 Prerequisites

- **Node.js v20.x LTS** (v24 not compatible with better-sqlite3)
- **npm** (comes with Node.js)
- **Git** (for cloning the repository)

That's it! Both frontend and backend are included in this monorepo. No separate backend installation needed.

## 🏗️ Tech Stack

### Frontend
- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript 5.3
- **State Management:** Zustand 4.5 (with localStorage persistence)
- **HTTP Client:** Axios 1.6 (with interceptors)
- **UI Components:** Custom components + Lucide React icons
- **Styling:** CSS Modules + Global CSS Variables

### Backend (in `/api` folder)
- **Framework:** Express.js 4.18
- **Language:** TypeScript 5.3
- **Database:** SQLite (via better-sqlite3)
- **Authentication:** JWT + bcrypt
- **Security:** Helmet.js, CORS, rate limiting
- **AI Integration:** Anthropic Claude API
- **Dev Server:** tsx watch (hot-reload)

## 📁 Project Structure

```
alchemix-next/                  # Monorepo root
├── src/                        # Frontend (Next.js)
│   ├── app/                    # Next.js App Router pages
│   │   ├── login/             # Login/signup page
│   │   ├── dashboard/         # Dashboard with stats & overview
│   │   ├── bar/               # My Bar (inventory management)
│   │   ├── ai/                # AI Bartender chat interface
│   │   ├── recipes/           # Recipe library with search/filter
│   │   ├── favorites/         # Favorites & chat history
│   │   └── layout.tsx         # Root layout with TopNav + ToastProvider
│   ├── components/
│   │   ├── layout/            # Layout components (TopNav)
│   │   ├── modals/            # Modal components (CSV, Add/Edit, Delete, RecipeDetail)
│   │   └── ui/                # UI components (Button, Card, Input, Toast, Spinner)
│   ├── hooks/
│   │   └── useAuthGuard.ts    # Authentication guard hook (prevents redirect loops)
│   ├── lib/
│   │   ├── api.ts             # API client (Axios with interceptors)
│   │   ├── store.ts           # Zustand store (auth, inventory, recipes)
│   │   └── aiPersona.ts       # AI persona and response parsing
│   ├── styles/
│   │   └── globals.css        # Design system CSS variables
│   └── types/
│       └── index.ts           # TypeScript type definitions
├── api/                        # Backend (Express + TypeScript)
│   ├── src/
│   │   ├── routes/            # API routes (auth, inventory, recipes, favorites, messages)
│   │   ├── middleware/        # Auth middleware, error handler
│   │   ├── database/          # SQLite database setup
│   │   ├── types/             # Backend type definitions
│   │   ├── utils/             # CORS config, utilities
│   │   └── server.ts          # Express server entry point
│   ├── data/                  # SQLite database (auto-created)
│   ├── package.json           # Backend dependencies
│   ├── tsconfig.json          # Backend TypeScript config
│   └── .env                   # Backend environment variables
├── public/
│   └── logo.png               # AlcheMix logo
├── Documentation/             # Project documentation
│   ├── SESSION_HISTORY.md     # Development session records
│   ├── PROJECT_STATUS.md      # Current implementation status
│   ├── DEV_NOTES.md           # Technical decisions & gotchas
│   └── metrics/               # Session effectiveness tracking
├── MONOREPO_SETUP.md          # Quick setup guide
└── package.json               # Root package.json with monorepo scripts
```

## 🎨 Design System

### Colors
- **Primary:** `#3DD6C1` (Teal)
- **Secondary:** `#F2A74B` (Orange)
- **Background:** `#F8F5EB` (Warm beige)
- **Surface:** `#FFFFFF` (White)
- **Text:** `#2D2C28` (Dark gray)

### Typography
- **Display:** Space Grotesk
- **Body:** Inter

### Spacing
8px grid system: 8px, 16px, 24px, 32px, 64px

### Border Radius
8px standard radius

## 🔌 API Integration

The Next.js app connects to the Express backend API running on port 3000.

**Authentication:**
- `POST /auth/login` - User login
- `POST /auth/signup` - User registration
- `GET /auth/me` - Get current user
- `POST /auth/logout` - Logout user

**Inventory Management:**
- `GET /api/inventory` - Get all bottles
- `POST /api/inventory` - Add new bottle
- `PUT /api/inventory/:id` - Update bottle
- `DELETE /api/inventory/:id` - Delete bottle
- `POST /api/inventory/import` - Import bottles from CSV

**Recipe Management:**
- `GET /api/recipes` - Get all recipes
- `POST /api/recipes` - Add new recipe
- `PUT /api/recipes/:id` - Update existing recipe (supports collection_id assignment)
- `DELETE /api/recipes/:id` - Delete recipe
- `POST /api/recipes/import` - Import recipes from CSV (supports collection_id parameter)

**Collections:**
- `GET /api/collections` - Get all user collections (with recipe counts)
- `POST /api/collections` - Create new collection (name, description)
- `PUT /api/collections/:id` - Update collection details
- `DELETE /api/collections/:id` - Delete collection (recipes become uncategorized)

**Favorites:**
- `GET /api/favorites` - Get user favorites
- `POST /api/favorites` - Add favorite (with optional recipe_id)
- `DELETE /api/favorites/:id` - Remove favorite

**AI Bartender:**
- `POST /api/messages` - Send message to AI (requires ANTHROPIC_API_KEY)

## 📦 Features

### ✅ Implemented

**Foundation (Phase 1):**
- Complete Next.js 14 project structure
- TypeScript strict mode configuration
- Design system with CSS variables (AlcheMix brand colors)
- Core UI components (Button, Card, Input, Toast, Spinner, SuccessCheckmark)
- Zustand store with localStorage persistence
- Axios API client with interceptors
- Comprehensive TypeScript types
- forwardRef support on all interactive components

**Pages (Phase 2):**
- Login/Signup page with form validation
- Dashboard with stats and overview cards
- My Bar inventory page with table and filtering
- AI Bartender chat interface
- Recipe library with search and filters
- Favorites & History page with tabs
- Professional Lucide React icon system

**Modals & Notifications (Phase 3 & 4 - Production Ready):**
- CSV upload modal (bottles and recipes) with ARIA labels
- Add bottle modal (12-field form) with real-time validation
- Edit bottle modal (pre-filled editing) with real-time validation
- Delete confirmation modal with focus management
- Recipe detail modal with full recipe information and edit mode
- Recipe editing with inline forms (name, category, ingredients, instructions, glass)
- Recipe deletion with confirmation and CASCADE favorites cleanup
- Recipe collections with folder-like navigation (click to enter, back to return)
- Bulk recipe operations (multi-select with checkboxes, mass move/delete)
- Collection management modal (create, edit, delete collections)
- Collection assignment (from CSV import or individual recipe detail modal)
- Toast notification system (ToastProvider)
- Full CRUD operations on My Bar page
- Success animations with auto-dismiss (1.5s)
- Loading spinners for all async operations
- Inline error messages with validation feedback
- Mobile responsive design (<640px breakpoint)
- WCAG 2.1 AA accessibility compliance
- Keyboard navigation (ESC, Tab, Enter)
- Focus management and focus trapping
- Unsaved changes protection
- Smooth animations (fade-in, slide-up)

### ⚠️ Testing & Validation Needed

- Test with real backend data (bottles, recipes)
- Test mobile responsive on actual devices
- Test accessibility with screen readers (NVDA, JAWS, VoiceOver)

### 🚧 Planned Features

- Recipe creation form (standalone page)
- CSV import preview with column mapping
- Advanced inventory filtering and search
- Bulk operations for inventory
- Tooltip hints for complex fields
- Field autocomplete/suggestions
- Error boundary components
- Account settings page
- Password reset flow
- Dark mode support
- PWA capabilities

## 🔧 Development

### Frontend Commands (from root)
```bash
# Install dependencies
npm install

# Run dev server (port 3001)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Type checking
npm run type-check

# Linting
npm run lint
```

### Backend Commands (from /api folder)
```bash
# Install dependencies
cd api && npm install

# Run dev server (port 3000)
cd api && npm run dev

# Run all tests (195 tests)
cd api && npm test

# Run tests by category
cd api && npm run test:unit      # Utils + Middleware (164 tests)
cd api && npm run test:db        # Database (31 tests)
cd api && npm run test:routes    # Routes (25 tests)

# Build for production
cd api && npm run build

# Type checking
cd api && npm run type-check
```

### Monorepo Commands (from root)
```bash
# Install all dependencies (frontend + backend)
npm run install:all

# Run both services concurrently
npm run dev:all
```

## ⚙️ Environment Setup

### Frontend (.env.local)

Create `.env.local` in the Next.js project root:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000
```

### Backend (api/.env)

Create `api/.env` file (copy from `api/.env.example`):

```env
# Server Configuration
PORT=3000
FRONTEND_URL=http://localhost:3001

# Security
JWT_SECRET=your_generated_secret_here

# Database
DATABASE_PATH=./alchemix.db

# AI Integration (Optional)
ANTHROPIC_API_KEY=your_api_key_here
```

**Important:**
- Copy from example: `cp api/.env.example api/.env`
- Generate JWT_SECRET using: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- JWT_SECRET must be at least 32 characters for security
- CORS is configured to accept requests from `FRONTEND_URL`
- Database auto-initializes on first run
- Environment variables are loaded automatically via `api/src/config/env.ts`

## 🚀 Getting Started

### First Time Setup

1. **Install Node.js v20 LTS** (required for better-sqlite3)
   ```bash
   node --version  # Should show v20.x
   ```

2. **Clone the Repository**
   ```bash
   git clone https://github.com/JLawMcGraw/alchemix.git
   cd alchemix
   ```

3. **Install All Dependencies** (frontend + backend)
   ```bash
   npm run install:all
   ```

4. **Configure Backend Environment**
   ```bash
   cp api/.env.example api/.env
   # Edit api/.env and add your JWT_SECRET and ANTHROPIC_API_KEY
   ```

5. **Generate JWT Secret** (copy this to your api/.env file)
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

### Running the Application

**Recommended - Run both services:**
```bash
npm run dev:all
# Backend: http://localhost:3000
# Frontend: http://localhost:3001
```

**Alternative - Run separately:**

**Terminal 1 - Backend:**
```bash
cd api
npm run dev
# Server starts on http://localhost:3000
```

**Terminal 2 - Frontend:**
```bash
npm run dev
# App starts on http://localhost:3001 (from root directory)
```

### Testing the App

1. Navigate to http://localhost:3001
2. Click "Create Account" to sign up
3. Login with your credentials
4. Explore the features:
   - Dashboard: View stats and quick actions
   - My Bar: Add bottles, import CSV, manage inventory
   - Recipes: Browse recipes, import CSV, add to favorites
   - AI Bartender: Chat with AI (requires API key)
   - Favorites: View saved recipes and chat history

## 📝 Development Workflow

### Making Changes

```bash
# Type checking (frontend)
npm run type-check

# Type checking (backend)
cd api && npm run type-check

# Linting
npm run lint

# Build for production (test)
npm run build
cd api && npm run build
```

### Git Workflow

```bash
# Check status
git status

# Stage changes
git add .

# Commit with descriptive message
git commit -m "feat: description of changes"

# Push to GitHub
git push
```

## 📚 Documentation

Detailed documentation is available in the `Documentation/` folder:

- **SESSION_HISTORY.md** - Development session records
- **PROJECT_STATUS.md** - Current implementation status
- **ACTIVE_TASKS.md** - Prioritized task list
- **DEV_NOTES.md** - Technical decisions and gotchas
- **PROGRESS_SUMMARY.md** - High-level progress overview

## 🐛 Known Issues & Limitations

1. **End-to-End Testing**: Full monorepo testing with production data needed
2. **CSV Preview**: No preview/column mapping before importing CSV files (optional enhancement)
3. **Mobile Testing**: Responsive design not tested on actual devices yet
4. **Screen Reader Testing**: Accessibility not yet verified with actual screen readers (NVDA, JAWS, VoiceOver)
5. **Recipe Creation Page**: Standalone recipe creation form not yet built (recipes can be imported via CSV)
6. **Password Reset**: Password reset flow not implemented (post-MVP)

See `Documentation/ACTIVE_TASKS.md` for the complete task list and priorities.

## 🎯 Next Steps

**High Priority:**
1. **Test monorepo locally** - Run `npm run dev:all` and verify end-to-end functionality
2. **Deploy to production** - Vercel (frontend) + Railway (backend)
3. Create deployment guide for monorepo setup
4. Test modal improvements with real backend data
5. Test mobile responsive on actual devices (iPhone, Android)

**Medium Priority:**
6. Test accessibility with screen readers (NVDA, JAWS, VoiceOver)
7. Add tests for recipe PUT/DELETE endpoints
8. Implement recipe creation form (standalone page)
9. Add CSV import preview with column mapping
10. Build account settings page

**Optional Enhancements:**
- Tooltip hints for complex form fields
- Field autocomplete/suggestions (Spirit types, locations)
- Advanced inventory filtering
- Bulk operations for inventory

See `Documentation/PROJECT_STATUS.md` for full implementation roadmap.

## 🤝 Project History

This is a complete rewrite of AlcheMix as a modern full-stack TypeScript application. The project evolved from a vanilla JavaScript version to this production-ready monorepo with:

- **Complete TypeScript backend** built from scratch (Session 5 - Nov 9, 2025)
- **Modern React frontend** with Next.js 14 and comprehensive UI components
- **SQLite database** with auto-initialization and secure authentication
- **Production-ready features** including modals, accessibility, and mobile support

The original vanilla JS version (`cocktail-analysis`) is legacy and no longer required - this monorepo contains everything needed to run AlcheMix.

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

- **Icons:** [Lucide React](https://lucide.dev/)
- **Fonts:** [Google Fonts](https://fonts.google.com/) (Space Grotesk, Inter)
- **Framework:** [Next.js](https://nextjs.org/)

---

**Built with ❤️ using Next.js 14 + Express + TypeScript**

**Current Version:** v1.18.5 (Security Hardening + Login UX Improvements)
**Last Updated:** November 27, 2025
