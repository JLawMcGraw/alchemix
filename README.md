# AlcheMix - Modern Cocktail Lab Management

[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-Proprietary-red)](LICENSE)

Modern cocktail inventory and recipe management system with AI-powered bartender recommendations. Features a "Molecular Mixology" design system that treats cocktails as chemical formulas and ingredients as periodic table elements.

![AlcheMix Login](public/login%20screenshot.png)

**Version:** v1.36.0 | **Tests:** 1,706

## Features

- **My Bar** - Category-organized inventory with 9 tabs, auto-classification, CSV import, periodic table tags
- **Periodic Table of Mixology** - 90+ elements organized by function and origin, with hidden elements that appear as you add inventory
- **Recipe Management** - Collections, bulk operations, CSV import, spirit detection, favorites
- **Recipe Molecule Visualization** - Chemical bond-style molecular diagrams with 80+ classified ingredients and Instagram Story export
- **Smart Shopping List** - Near-miss algorithm, ingredient recommendations, recipe buckets
- **AI Bartender** - Gemini-powered with SSE streaming, hybrid search (PostgreSQL + MemMachine), concept expansion
- **Dashboard** - Lab overview with bar composition, recipe mastery stats, AI insights
- **Onboarding** - 3-step first-time flow: welcome, quick-add bottles, preview makeable cocktails
- **Dark Mode** - Full theme support (light/dark/system) with persistence
- **Secure Auth** - HttpOnly JWT cookies, CSRF protection, email verification, password reset

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14, TypeScript, Zustand, CSS Modules |
| Backend | Express.js, TypeScript, PostgreSQL (pg), JWT |
| AI | Gemini 3 Flash with SSE streaming |
| Infrastructure | Docker, Neo4j 5.23, PostgreSQL 16, MemMachine v2 |
| Email | Resend (recommended) or SMTP via Nodemailer |

## Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/JLawMcGraw/alchemix.git
git clone https://github.com/JLawMcGraw/memmachine.git
cd alchemix
npm run install:all
```

### 2. Configure Environment

```bash
cp docker/.env.example docker/.env
cp api/.env.example api/.env
```

Edit `docker/.env`:
```env
OPENAI_API_KEY=your-openai-api-key
```

Edit `api/.env`:
```env
JWT_SECRET=your-super-secure-secret-key-at-least-32-chars
DATABASE_URL=postgresql://memmachine:memmachinepassword@localhost:5432/alchemix
FRONTEND_URL=http://localhost:3001

# Optional
GEMINI_API_KEY=your-gemini-key          # AI Bartender
RESEND_API_KEY=re_your_key              # Email verification/reset
MEMMACHINE_API_URL=http://localhost:8080 # Semantic search
```

### 3. Start Services

```bash
# Start PostgreSQL, Neo4j, and MemMachine
cd docker && docker compose up -d

# Create database (first time only)
docker exec alchemix-postgres psql -U memmachine -c "CREATE DATABASE alchemix;"

# Start frontend + backend
cd .. && npm run dev:all
```

- **Frontend**: http://localhost:3001
- **Backend**: http://localhost:3000

### 4. Create an Account

1. Open http://localhost:3001 and sign up
2. If email is not configured, check terminal for the verification link
3. Complete onboarding: add bottles, see what cocktails you can make

## Project Structure

```
alchemix/
├── src/                    # Next.js frontend
│   ├── app/               # Pages (login, onboarding, dashboard, bar, recipes, ai, account)
│   ├── components/        # UI components, modals, BottleCard, RecipeCard, PeriodicTable
│   ├── hooks/             # useAuthGuard, useSettings, useTheme
│   ├── lib/               # API client, Zustand store, recipeLinker, utilities
│   └── styles/            # globals.css (design system tokens)
├── api/                    # Express backend
│   └── src/
│       ├── routes/        # API endpoints (auth, inventory, recipes, messages, etc.)
│       ├── services/      # AIService, MemoryService, ShoppingListService, etc.
│       ├── middleware/    # Auth, CSRF, rate limiting, request logging
│       ├── config/        # Environment validation, rate limiters
│       ├── utils/         # Winston logger, validators, token blacklist
│       └── database/      # PostgreSQL pool + schema
├── packages/
│   ├── recipe-molecule/   # Chemical bond-style recipe visualization
│   └── types/             # Shared TypeScript definitions
├── docker/                 # Docker compose + MemMachine config
└── Documentation/          # Architecture, progress, dev notes
```

## Development

```bash
npm run type-check              # Frontend types
cd api && npm run type-check    # Backend types
npm run lint                    # ESLint
npm run build                   # Frontend build
cd api && npm run build         # Backend build
```

## Testing

| Suite | Tests |
|-------|-------|
| Frontend | 460 |
| Backend | 948 |
| Recipe Molecule | 298 |
| **Total** | **1,706** |

```bash
npm test                                          # Frontend
cd api && npm test                                # Backend
cd packages/recipe-molecule && npm test           # Molecule
```

## Services

| Service | Port |
|---------|------|
| Frontend (Next.js) | 3001 |
| Backend (Express) | 3000 |
| PostgreSQL | 5432 |
| Neo4j | 17474, 17687 |
| MemMachine | 8080 |

## Troubleshooting

**Docker must start first** - If you see `ECONNREFUSED 127.0.0.1:5432`, run `cd docker && docker compose up -d` and wait 30-60 seconds.

**JWT_SECRET error** - Must be at least 32 characters. Generate one: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

**Database doesn't exist** - Run: `docker exec alchemix-postgres psql -U memmachine -c "CREATE DATABASE alchemix;"`

**CORS errors** - Ensure `FRONTEND_URL` in `api/.env` matches exactly (no trailing slash): `http://localhost:3001`

**Email verification not working** - Without Resend/SMTP configured, verification links are logged to the terminal.

**AI Bartender errors** - Check `GEMINI_API_KEY` is set in `api/.env`.

For more details, see `Documentation/DEV_NOTES.md` or [open an issue](https://github.com/JLawMcGraw/alchemix/issues).

## Documentation

- [`Documentation/ARCHITECTURE.md`](Documentation/ARCHITECTURE.md) - System architecture, dependency maps, security
- [`Documentation/PROJECT_PROGRESS.md`](Documentation/PROJECT_PROGRESS.md) - Development session history
- [`Documentation/DEV_NOTES.md`](Documentation/DEV_NOTES.md) - Technical decisions and gotchas
- [`alchemix-design-system.md`](alchemix-design-system.md) - Full design specification (colors, typography, components)

## License

Copyright (c) 2025 Jacob Lawrence. All Rights Reserved.

---

**Built with Next.js 14 + Express + TypeScript**
