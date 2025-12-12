# AlcheMix - Session Initialization

## Read These Files for Context

**Immediately read in order:**
1. `README.md` - Current status, features, tech stack, quick start
2. `Documentation/PROJECT_PROGRESS.md` - Active tasks, session history, implementation status
3. `Documentation/REDESIGN_PLAN.md` - **ACTIVE** Visual redesign phases, progress, next steps

**Read when needed:**
- `alchemix-design-system.md` - Full "Molecular Mixology" design specification
- `Documentation/DEV_NOTES.md` - Technical decisions, gotchas, lessons learned
- `CHANGELOG.md` - Version history and changes
- `MONOREPO_SETUP.md` - Development workflow details

---

## Project Overview

**AlcheMix** is a full-stack cocktail inventory and recipe management app with AI-powered bartender recommendations.

| Field | Value |
|-------|-------|
| Version | v1.30.0 |
| Phase | Feature Development |
| Last Updated | December 11, 2025 |
| Blockers | None |
| Tests | 142 recipe-molecule tests passing |
| Active Branch | `alchemix-redesign` |

### Visual Redesign Status: COMPLETE

All 10 phases of the "Molecular Mixology" visual redesign are complete:

**Redesign Progress**:
- Phase 1-4 (Batch A - Foundation): **Complete** - Colors, fonts, typography, spacing, components
- Phase 5-7 (Batch B - Features): **Complete** - Periodic table, molecule viz, page layouts
- Phase 8-10 (Batch C - Polish): **Complete** - Dark mode, animations, accessibility

### Tech Stack

- **Frontend**: Next.js 14, TypeScript 5.3, Zustand 4.5, CSS Modules
- **Backend**: Express.js 4.18, TypeScript, SQLite (better-sqlite3)
- **AI**: Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) with Prompt Caching
- **Memory**: MemMachine (Neo4j vector store, semantic search)
- **Auth**: JWT + bcrypt, token blacklist, database-backed token versioning

---

## Directory Structure

```
alchemix/
├── src/                        # Frontend (Next.js)
│   ├── app/                    # Pages: login, dashboard, bar, ai, recipes, favorites, shopping-list, account
│   ├── components/             # ui/, layout/, modals/
│   ├── hooks/                  # useAuthGuard.ts
│   ├── lib/                    # api.ts, store.ts, aiPersona.ts, passwordPolicy.ts, spirits.ts
│   ├── styles/                 # globals.css (design system)
│   └── types/                  # TypeScript definitions
├── api/                        # Backend (Express)
│   ├── src/
│   │   ├── routes/             # auth, inventory, inventoryItems, recipes, collections, favorites, messages, shoppingList
│   │   ├── services/           # MemoryService.ts (MemMachine integration)
│   │   ├── middleware/         # auth.ts, errorHandler.ts, userRateLimit.ts
│   │   ├── database/           # db.ts (SQLite schema)
│   │   ├── utils/              # tokenBlacklist.ts, inputValidation.ts
│   │   └── tests/              # 318 tests
│   └── data/                   # SQLite database (auto-generated)
├── docker/                     # Docker configs for MemMachine, Neo4j, etc.
├── Documentation/              # PROJECT_PROGRESS.md, DEV_NOTES.md, archives/
└── public/                     # Logo assets
```

---

## Quick Commands

```bash
# Install all dependencies
npm run install:all

# Run both frontend + backend (recommended)
npm run dev:all
# → Frontend: http://localhost:3001
# → Backend: http://localhost:3000

# Type checking
npm run type-check              # Frontend
cd api && npm run type-check    # Backend

# Run tests
cd api && npm test              # All 318 tests
cd api && npm run test:unit     # Unit tests only
cd api && npm run test:routes   # Route tests only

# Linting
npm run lint
```

### Docker (for MemMachine infrastructure)

```bash
# Hybrid: Docker infrastructure + local dev
docker compose -f docker/docker-compose.yml -f docker/docker-compose.dev.yml up -d
npm run dev:all

# Full Docker
docker compose -f docker/docker-compose.yml up --build
```

---

## Critical Rules

### Code Quality
- **TypeScript strict mode** - No `any` types, all code fully typed
- **React best practices** - Functional components, hooks, Zustand for global state
- **Next.js App Router** - Server components by default, `'use client'` when needed
- **CSS Modules** - Component-scoped styling using design system variables

### Before Completing Work
- [ ] `npm run type-check` passes (frontend)
- [ ] `cd api && npm run type-check` passes (backend)
- [ ] `cd api && npm test` passes (318 tests)
- [ ] `npm run lint` passes
- [ ] No console errors in browser

### Git Workflow
- Never commit unless explicitly asked
- Never push unless explicitly asked
- Use conventional commits format
- Never use `--force` or `--amend` without explicit permission

### Design System (in `src/styles/globals.css`)

**NEW "Molecular Mixology" Design** (see `alchemix-design-system.md`):
- **Primary**: `#0D9488` (teal - `--bond-agave`)
- **Secondary**: `#D97706` (amber - `--bond-grain`)
- **Background**: `#F8F9FA` (paper white - clinical)
- **Fonts**: Inter (`--font-sans`), JetBrains Mono (`--font-mono`)
- **Spacing**: 8px grid system

**Element Group Colors** (ingredient categories):
- `--bond-agave`: Tequila, Mezcal
- `--bond-grain`: Whiskey, Bourbon, Rye
- `--bond-cane`: Rum, Cachaça
- `--bond-juniper`: Gin
- `--bond-grape`: Brandy, Cognac
- `--bond-botanical`: Amaro, Vermouth, Bitters
- `--bond-acid`: Citrus
- `--bond-sugar`: Syrups, Liqueurs

---

## Environment Setup

**Backend (`api/.env`)** - Required:
```bash
PORT=3000
FRONTEND_URL=http://localhost:3001
JWT_SECRET=<generate-with-crypto>
DATABASE_PATH=./data/alchemix.db
ANTHROPIC_API_KEY=<your-key>
MEMMACHINE_API_URL=http://localhost:8080
```

**Frontend (`.env.local`)** - Optional:
```bash
NEXT_PUBLIC_API_URL=http://localhost:3000
```

---

## Key Features (Current State)

- **8 Pages**: Login, Dashboard, My Bar, AI Bartender, Recipes, Favorites, Shopping List, Account
- **My Bar**: Category tabs (9), card grid, ItemDetailModal with view/edit modes
- **Recipes**: Collections (folders), bulk operations, CSV import, mastery filters
- **AI Bartender**: MemMachine semantic search, clickable recipe recommendations, 98% cost reduction
- **Shopping List**: Persistent items CRUD, 6 recipe buckets, near-miss algorithm, ranked recommendations
- **Custom Glasses**: User-defined glassware types API
- **Account**: Settings (theme/units), Export/Import data, Change password, Delete account
- **TopNav**: Horizontal nav with badges, user avatar dropdown
- **Security**: 8-layer defense, token blacklist, rate limiting, prompt injection protection
- **Auth**: JWT with database-backed token versioning, simplified password policy (8+ chars)
- **Logo Assets**: SVG icon, full logo, text-only wordmark in public/

---

## After Reading This

1. Read `README.md` and `Documentation/PROJECT_PROGRESS.md`
2. Read `Documentation/REDESIGN_PLAN.md` for current redesign status
3. Ask what specific task to work on
4. Load additional docs based on task:
   - `alchemix-design-system.md` for design/CSS work
   - `DEV_NOTES.md` for technical gotchas
   - Specific route files for API work
5. Wait for task specification before making changes

### Next Steps

**Recent Major Updates** (Dec 11, 2025):
- Periodic Table V2 refinements:
  - Fixed double popup issue
  - Improved classification matching with word boundary regex
  - Dropdown shows element TYPES not user bottles
  - Grayed-out state for elements not in bar
  - Element swapping from dropdown
  - Increased font sizes for readability

**Potential Future Work**:
1. Further refinement of element matching keywords
2. Add ability to reclassify items manually
3. Persist element swap selection per cell
4. Add search/filter within periodic table
5. Apply Brownian motion animations to Recipe Molecule nodes

---

## Ports Reference

| Service | Port |
|---------|------|
| Frontend (Next.js) | 3001 |
| Backend (Express) | 3000 |
| MemMachine | 8080 |
| Bar Server | 8001 |
| Neo4j HTTP | 7474 |
| Neo4j Bolt | 7687 |
| PostgreSQL | 5432 |
