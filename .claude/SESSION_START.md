# AlcheMix - Session Context

## Quick Reference

| Field | Value |
|-------|-------|
| Version | v1.30.0 |
| Branch | `alchemix-redesign` |
| Tests | 1,251 total (921 backend, 206 frontend, 124 recipe-molecule) |
| Last Updated | December 17, 2025 |

---

## What is AlcheMix?

A full-stack cocktail inventory and recipe management app with AI-powered bartender recommendations. The UI uses a "Molecular Mixology" design system that treats cocktails as chemical formulas.

**Core Metaphor**:
- **Ingredients** → Periodic Table Elements (by function and origin)
- **Recipes** → Molecular Diagrams (node-link visualizations)
- **Inventory** → Mass/Volume measurements
- **User** → The chemist

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14, TypeScript, Zustand, CSS Modules |
| Backend | Express.js, TypeScript, SQLite (better-sqlite3) |
| AI | Claude Sonnet 4.5 with Prompt Caching |
| Memory | MemMachine (Neo4j vector store) + SQLite hybrid search |
| Auth | JWT + bcrypt, token blacklist, database-backed versioning |
| Molecule Viz | `@alchemix/recipe-molecule` (custom d3-force SVG) |

---

## Key Files to Read

**For Context**:
- `Documentation/PROJECT_PROGRESS.md` - Session history, recent work, current status
- `alchemix-design-system.md` - Full design specification, colors, components, logo

**When Needed**:
- `Documentation/ARCHITECTURE.md` - System architecture, dependency maps, security
- `Documentation/DEV_NOTES.md` - Technical decisions, gotchas, workarounds
- `README.md` - Setup instructions, features, tech stack

---

## Directory Structure

```
alchemix/
├── src/                        # Frontend (Next.js)
│   ├── app/                    # Pages: login, dashboard, bar, ai, recipes, favorites, shopping-list, account
│   ├── components/             # ui/, layout/, modals/, PeriodicTableV2/, RecipeCard/, BottleCard/
│   ├── hooks/                  # useAuthGuard.ts, useSettings.ts
│   ├── lib/                    # api.ts, store/, periodicTable/, formatters.ts
│   ├── styles/                 # globals.css (design system variables)
│   └── types/
├── api/                        # Backend (Express)
│   ├── src/
│   │   ├── routes/             # auth/, inventory, recipes, collections, favorites, messages, shoppingList, classifications
│   │   ├── services/           # AIService, MemoryService, ClassificationService, ShoppingListService
│   │   ├── middleware/         # auth.ts, csrf.ts, errorHandler.ts, requestId.ts, requestLogger.ts
│   │   ├── config/             # env.ts, rateLimiter.ts, validateEnv.ts
│   │   ├── database/           # db.ts (SQLite schema)
│   │   └── utils/              # logger.ts, tokenBlacklist.ts, inputValidation.ts
│   └── data/                   # SQLite database (auto-generated)
├── packages/
│   ├── recipe-molecule/        # Chemical bond-style recipe visualization
│   └── types/                  # Shared TypeScript definitions
├── docker/                     # Docker configs for MemMachine, Neo4j
├── Documentation/              # ARCHITECTURE.md, PROJECT_PROGRESS.md, DEV_NOTES.md
└── public/                     # Logo assets (icon.svg, logo.svg, logo-text.svg)
```

---

## Quick Commands

```bash
# Development
npm run dev:all                 # Frontend (3001) + Backend (3000)

# Testing
cd api && npm test              # All 921 backend tests
cd api && npm run test:unit     # Unit tests only
cd api && npm run test:routes   # Route tests only

# Type checking
npm run type-check              # Frontend
cd api && npm run type-check    # Backend

# Linting
npm run lint
```

---

## Design System Essentials

**Colors** (see `alchemix-design-system.md` for full spec):
- **Primary**: `#0D9488` (teal - `--bond-agave`)
- **Background**: `#F8F9FA` (paper white), `#0F172A` (dark slate)
- **Fonts**: Inter (UI), JetBrains Mono (data/formulas)

**Element Group Colors** (periodic table):
| Variable | Color | Usage |
|----------|-------|-------|
| `--bond-agave` | Teal | Tequila, Mezcal |
| `--bond-grain` | Amber | Whiskey, Bourbon, Rye |
| `--bond-cane` | Green | Rum, Cachaça |
| `--bond-juniper` | Sky Blue | Gin |
| `--bond-grape` | Violet | Brandy, Cognac |
| `--bond-botanical` | Pink | Amaro, Vermouth, Bitters |

**Logo**: Y-shaped molecule with 4 colored nodes (see `alchemix-design-system.md` for geometry).

---

## Key Features

- **8 Pages**: Login, Dashboard, My Bar, AI Bartender, Recipes, Favorites, Shopping List, Account
- **My Bar**: 9 category tabs, BottleCard grid, ItemDetailModal (view/edit)
- **Recipes**: Collections, bulk operations, CSV import, mastery filters, molecule visualization
- **AI Bartender**: MemMachine semantic search + concept expansion (spirit-forward, tiki, boozy, etc.)
- **Shopping List**: Persistent items, recipe buckets, near-miss algorithm
- **Periodic Table**: 6×6 grid by function (group) and origin (period)

---

## Critical Rules

### Code Quality
- TypeScript strict mode - no `any` types
- React functional components with hooks
- CSS Modules with design system variables
- Winston logger (no console.log in backend)

### Before Completing Work
- [ ] Type checks pass (frontend + backend)
- [ ] All tests pass
- [ ] Lint passes
- [ ] No browser console errors

### Git Workflow
- Never commit unless explicitly asked
- Never push unless explicitly asked
- Use conventional commits
- Never use `--force` or `--amend` without permission

---

## Ports

| Service | Port |
|---------|------|
| Frontend | 3001 |
| Backend | 3000 |
| MemMachine | 8080 |
| Neo4j HTTP | 7474 |
| Neo4j Bolt | 7687 |

---

## After Reading This

1. Read `Documentation/PROJECT_PROGRESS.md` for recent work and current state
2. Ask what specific task to work on
3. Load additional docs based on task type
4. Wait for task specification before making changes
