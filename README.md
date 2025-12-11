# AlcheMix - Modern Cocktail Lab Management

[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-Proprietary-red)](LICENSE)

Modern cocktail inventory and recipe management system with AI-powered bartender recommendations. Features a "Molecular Mixology" design system that treats cocktails as chemical formulas and ingredients as periodic table elements.

**Version:** v1.30.0 | **Last Updated:** December 10, 2025

## Features

### Core Features
- **My Bar** - Category-organized inventory with 9 tabs, card grid layout, CSV import
- **Recipe Management** - Full CRUD, collections/folders, bulk operations, CSV import, spirit detection
- **Recipe Molecule Visualization** - Chemical bond-style molecular diagrams for cocktail recipes
- **Smart Shopping List** - Near-miss algorithm, ingredient recommendations, 6 recipe buckets
- **AI Bartender** - Claude-powered assistant with MemMachine semantic memory
- **Dashboard** - Lab overview with My Bar composition, Recipe Mastery stats, Collections sidebar

### Design & UX
- **Molecular Mixology Design** - Scientific, laboratory-inspired interface
- **Element Group Colors** - Color-coded ingredient categories (spirits, acids, sugars, etc.)
- **Spirit Detection** - Automatic spirit identification from recipe ingredients with colored badges
- **Typography System** - Inter (UI) + JetBrains Mono (data) font pairing
- **Recipe Cards** - Molecule visualization with spirit badges and craftable indicators

### Security & Auth
- **Secure Auth** - HttpOnly cookie JWT with CSRF protection (XSS-resistant)
- **Account Settings** - Change password, delete account, data export/import
- **Email Verification** - Secure signup flow with verification tokens
- **Password Reset** - Secure reset flow with email delivery

## Quick Start

```bash
# Install dependencies
npm run install:all

# Configure environment
cp api/.env.example api/.env
# Edit api/.env - add JWT_SECRET and optionally ANTHROPIC_API_KEY, SMTP settings

# Run both frontend and backend
npm run dev:all

# Frontend: http://localhost:3001
# Backend: http://localhost:3000
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14, TypeScript, Zustand, CSS Modules |
| Backend | Express.js, TypeScript, SQLite, JWT |
| AI | Claude API (Haiku 4.5), MemMachine v2 semantic memory |
| Infrastructure | Docker, Neo4j 5.23, PostgreSQL 16 (pgvector) |
| Email | Nodemailer (Gmail, SendGrid, Mailgun, Amazon SES) |

## Project Structure

```
alchemix/
├── src/                    # Next.js frontend
│   ├── app/               # Pages (login, dashboard, bar, recipes, ai, settings, etc.)
│   ├── components/        # UI components and modals
│   │   ├── BottleCard/    # Inventory bottle display component
│   │   ├── RecipeCard/    # Recipe card with molecule visualization
│   │   ├── GlassSelector/ # Glassware selection component
│   │   ├── layout/        # TopNav, navigation components
│   │   └── modals/        # AddBottle, AddRecipe, EditBottle, CSVUpload, etc.
│   ├── hooks/             # Custom hooks (useAuthGuard, useVerificationGuard)
│   ├── lib/               # API client, store, utilities
│   └── styles/            # globals.css (design system tokens)
├── api/                    # Express backend
│   ├── src/
│   │   ├── routes/        # API endpoints
│   │   ├── services/      # Business logic (RecipeService, EmailService, etc.)
│   │   ├── middleware/    # Auth, error handling
│   │   └── database/      # SQLite setup
│   └── .env               # Environment configuration
├── packages/               # Shared packages
│   └── recipe-molecule/   # Chemical bond-style recipe visualization
│       └── src/core/      # Parser, classifier, layout engine
├── docker/                 # Docker configuration
│   ├── docker-compose.yml # Main compose file
│   ├── Dockerfile.*       # Frontend/backend Dockerfiles
│   ├── memmachine/        # MemMachine config templates
│   └── .env.example       # Docker env template
├── Documentation/          # Project docs
│   ├── REDESIGN_PLAN.md   # Visual redesign phases & progress
│   ├── PROJECT_PROGRESS.md # Session history
│   ├── DEV_NOTES.md       # Technical decisions
│   └── railway-deployment/ # Railway deployment guide
├── .claude/                # Claude Code session docs
├── alchemix-design-system.md # Full design specification
└── railway/                # Railway deployment configs
```

## API Endpoints

### Authentication
- `POST /auth/signup` - Create account (sends verification email)
- `POST /auth/login` - Login
- `POST /auth/logout` - Logout
- `GET /auth/me` - Get current user
- `POST /auth/verify-email` - Verify email with token
- `POST /auth/resend-verification` - Resend verification email
- `POST /auth/forgot-password` - Request password reset
- `POST /auth/reset-password` - Reset password with token
- `POST /auth/change-password` - Change password (authenticated)
- `DELETE /auth/account` - Delete account and all data
- `GET /auth/export` - Export all user data as JSON
- `POST /auth/import` - Import user data from JSON

### Resources
- `GET/POST/PUT/DELETE /api/inventory` - Inventory management
- `GET/POST/PUT/DELETE /api/recipes` - Recipe management
- `DELETE /api/recipes/bulk` - Bulk delete (up to 500)
- `GET/POST/PUT/DELETE /api/collections` - Recipe collections
- `GET/POST/DELETE /api/favorites` - Favorites
- `GET/POST/DELETE /api/glasses` - Custom glassware types
- `POST /api/messages` - AI Bartender chat
- `GET /api/shopping-list/smart` - Smart shopping recommendations

## Environment Variables

```env
# Required
JWT_SECRET=your-secret-key-minimum-32-chars
DATABASE_PATH=./data/alchemix.db
FRONTEND_URL=http://localhost:3001

# Optional - AI
ANTHROPIC_API_KEY=sk-ant-...

# Optional - Email (for verification/reset)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=AlcheMix <your-email@gmail.com>

# Optional - MemMachine
MEMMACHINE_API_URL=http://localhost:8080
```

## Development

```bash
# Type check
npm run type-check          # Frontend
cd api && npm run type-check # Backend

# Build
npm run build              # Frontend
cd api && npm run build    # Backend
```

## Testing

The project has comprehensive test coverage using Vitest:

| Suite | Tests | Description |
|-------|-------|-------------|
| Frontend | 99 | API client, store, UI components (Button, Input, Modal) |
| Backend | 488 | Auth, inventory, recipes, collections, favorites, messages, shopping list |
| Recipe Molecule | 124 | Ingredient parser, classifier, layout engine |
| **Total** | **711** | |

```bash
# Run all tests
npm test && cd api && npm test && cd ../packages/recipe-molecule && npm test

# Run with coverage
cd api && npm test -- --coverage
```

## Docker (Required for AI Features)

The AI Bartender requires MemMachine (semantic memory) which runs in Docker alongside Neo4j and Postgres.

```bash
# Start all services (Neo4j, Postgres, MemMachine, API, Frontend)
docker compose -f docker/docker-compose.yml up

# Or infrastructure only (for local dev with hot reload)
docker compose -f docker/docker-compose.yml -f docker/docker-compose.dev.yml up -d
npm run dev:all
```

### Docker Services

| Service | Port | Description |
|---------|------|-------------|
| Neo4j | 7474, 7687 | Graph database for vector embeddings |
| Postgres | 5432 | Profile storage for MemMachine |
| MemMachine | 8080 | Semantic memory API (v2) |
| API | 3000 | Express backend |
| Frontend | 3001 | Next.js frontend |

### MemMachine v2 API

AlcheMix uses MemMachine v2 API for semantic recipe search and AI context:
- Recipes stored with UIDs for tracking
- Per-user project isolation (`org: alchemix`, `project: user_{id}_recipes`)
- Vector similarity search via Neo4j GDS plugin

## Design System

AlcheMix uses the "Molecular Mixology" design system - a clinical, scientific aesthetic inspired by laboratory interfaces and chemistry textbooks.

### Design Principles
- **Clinical Aesthetic** - Clean, precise, laboratory-inspired interface
- **Chemical Metaphor** - Ingredients as elements, recipes as molecules
- **Typography** - Inter (UI/headings), JetBrains Mono (data/measurements)
- **Color Coding** - Ingredient groups have distinct colors (agave=teal, grain=amber, etc.)

### Key Design Files
- `alchemix-design-system.md` - Complete design specification
- `Documentation/REDESIGN_PLAN.md` - Implementation phases and progress

### Element Group Colors
| Group | Color | Ingredients |
|-------|-------|-------------|
| Agave | Teal `#0D9488` | Tequila, Mezcal |
| Grain | Amber `#D97706` | Whiskey, Bourbon, Rye |
| Cane | Green `#65A30D` | Rum, Cachaça |
| Juniper | Sky `#0EA5E9` | Gin |
| Grape | Violet `#7C3AED` | Brandy, Cognac |
| Botanical | Pink `#EC4899` | Amaro, Vermouth, Bitters |
| Acid | Yellow `#F59E0B` | Citrus |
| Sugar | Indigo `#6366F1` | Syrups, Liqueurs |

## Documentation

- `alchemix-design-system.md` - Full "Molecular Mixology" design specification
- `Documentation/REDESIGN_PLAN.md` - Visual redesign phases and progress
- `Documentation/PROJECT_PROGRESS.md` - Session history and progress
- `Documentation/DEV_NOTES.md` - Technical decisions and gotchas
- `Documentation/railway-deployment/` - Railway deployment guide
- `api/.env.example` - Full environment variable reference
- `docker/.env.example` - Docker environment template

## License

Copyright (c) 2025 Jacob Lawrence. All Rights Reserved.

---

**Built with Next.js 14 + Express + TypeScript**
