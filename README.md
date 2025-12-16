# AlcheMix - Modern Cocktail Lab Management

[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-Proprietary-red)](LICENSE)

Modern cocktail inventory and recipe management system with AI-powered bartender recommendations. Features a "Molecular Mixology" design system that treats cocktails as chemical formulas and ingredients as periodic table elements.

**Version:** v1.30.0 | **Last Updated:** December 16, 2025

## Features

### Core Features
- **My Bar** - Category-organized inventory with 9 tabs, card grid layout, CSV import, periodic tags
- **Periodic Table of Mixology** - 6x6 grid classifying ingredients by function (Group) and origin (Period)
- **Recipe Management** - Full CRUD, collections/folders, bulk operations, CSV import, spirit detection
- **Recipe Molecule Visualization** - Chemical bond-style molecular diagrams for cocktail recipes
- **Smart Shopping List** - Near-miss algorithm, ingredient recommendations, 6 recipe buckets
- **AI Bartender** - Claude-powered assistant with hybrid search (SQLite + MemMachine semantic memory)
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

## Prerequisites

Before you begin, ensure you have the following installed:

| Requirement | Version | Check Command |
|-------------|---------|---------------|
| Node.js | 18.x or higher | `node --version` |
| npm | 9.x or higher | `npm --version` |
| Git | Any recent | `git --version` |
| Docker | (Optional) For AI features | `docker --version` |

## Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/JLawMcGraw/alchemix.git
cd alchemix
npm run install:all
```

### 2. Configure Environment

```bash
# Copy the example environment file
cp api/.env.example api/.env
```

Edit `api/.env` and set the required values:

```env
# REQUIRED - Generate a secure secret (minimum 32 characters)
JWT_SECRET=your-super-secure-secret-key-at-least-32-chars

# REQUIRED - Database location (auto-created)
DATABASE_PATH=./data/alchemix.db

# REQUIRED - Frontend URL for CORS
FRONTEND_URL=http://localhost:3001
```

Optional settings for full functionality:
- `ANTHROPIC_API_KEY` - Enable AI Bartender features
- `SMTP_*` - Enable email verification and password reset
- `MEMMACHINE_API_URL` - Enable semantic recipe search (requires Docker)

### 3. Start Development Servers

```bash
npm run dev:all
```

This starts both servers:
- **Frontend**: http://localhost:3001
- **Backend**: http://localhost:3000

### 4. Create an Account

1. Open http://localhost:3001
2. Click "Sign Up" and create an account
3. If SMTP is not configured, check the terminal for the verification link
4. Start adding inventory and recipes!

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14, TypeScript, Zustand, CSS Modules |
| Backend | Express.js, TypeScript, SQLite, JWT |
| AI | Claude Sonnet 4.5, SQLite + MemMachine v2 hybrid search |
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
│   │   ├── PeriodicTableV2/ # Periodic table of mixology
│   │   ├── GlassSelector/ # Glassware selection component
│   │   ├── layout/        # TopNav, navigation components
│   │   └── modals/        # AddBottle, AddRecipe, EditBottle, CSVUpload, etc.
│   ├── hooks/             # Custom hooks (useAuthGuard, useSettings)
│   ├── lib/               # API client, store/, periodicTable/, utilities
│   └── styles/            # globals.css (design system tokens)
├── api/                    # Express backend
│   ├── src/
│   │   ├── routes/        # API endpoints (auth/, inventory, recipes, etc.)
│   │   ├── services/      # Business logic (AIService, MemoryService, ClassificationService, etc.)
│   │   ├── middleware/    # Auth, CSRF, rate limiting, request logging
│   │   ├── config/        # Environment, rate limiters
│   │   ├── utils/         # Logger, validators, token blacklist
│   │   ├── database/      # SQLite setup
│   │   └── data/          # Static data (cocktailIngredients.json)
│   └── .env               # Environment configuration
├── packages/               # Shared packages
│   ├── recipe-molecule/   # Chemical bond-style recipe visualization
│   └── types/             # Shared TypeScript definitions
├── docker/                 # Docker configuration
│   ├── docker-compose.yml # Main compose file
│   ├── Dockerfile.*       # Frontend/backend Dockerfiles
│   ├── memmachine/        # MemMachine config templates
│   └── .env.example       # Docker env template
├── Documentation/          # Project docs
│   ├── ARCHITECTURE.md    # System architecture & dependency maps
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
| Frontend | 206 | API client, store, UI components, page tests |
| Backend | 750 | Auth, inventory, recipes, collections, favorites, messages, shopping list, middleware, services |
| Recipe Molecule | 124 | Ingredient parser, classifier, layout engine |
| **Total** | **1,080** | |

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

AlcheMix uses a hybrid search architecture combining SQLite and MemMachine:
- **SQLite ingredient matching** - Fast exact matching with 100+ cocktail query expansions
- **MemMachine semantic search** - Vector similarity for recipe discovery
- **Intelligent prioritization** - Specific ingredients (green chartreuse) searched before generic (gin, lime)
- **Pre-computed craftability** - Markers (✅ CRAFTABLE, ⚠️ NEAR-MISS, ❌ MISSING) verified against user inventory
- Per-user project isolation (`org: alchemix`, `project: user_{id}_recipes`)

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
- `Documentation/ARCHITECTURE.md` - System architecture, dependency maps, security
- `Documentation/REDESIGN_PLAN.md` - Visual redesign phases and progress
- `Documentation/PROJECT_PROGRESS.md` - Session history and progress
- `Documentation/DEV_NOTES.md` - Technical decisions and gotchas
- `Documentation/railway-deployment/` - Railway deployment guide
- `api/.env.example` - Full environment variable reference
- `docker/.env.example` - Docker environment template

## Troubleshooting

### Installation Issues

**`npm run install:all` fails**
```bash
# Clear npm cache and node_modules
rm -rf node_modules api/node_modules packages/*/node_modules
npm cache clean --force
npm run install:all
```

**Node version errors**
```bash
# Check your Node version (requires 18+)
node --version

# Use nvm to install correct version
nvm install 20
nvm use 20
```

### Server Startup Issues

**Port already in use (EADDRINUSE)**
```bash
# Find what's using port 3000 or 3001
lsof -i :3000
lsof -i :3001

# Kill the process
kill -9 <PID>

# Or use different ports in api/.env
PORT=3002
FRONTEND_URL=http://localhost:3003
```

**JWT_SECRET error on startup**
```
Error: JWT_SECRET must be at least 32 characters
```
Edit `api/.env` and set a longer secret:
```env
JWT_SECRET=my-super-secure-secret-key-that-is-at-least-32-characters-long
```

**SQLite "no such table" error**
```
SqliteError: no such table: users
```
The database auto-creates on first run. If corrupted:
```bash
# Delete and recreate database
rm -rf api/data/alchemix.db
npm run dev:all
```

### Authentication Issues

**"Invalid credentials" when logging in**
- Passwords are case-sensitive
- Minimum 8 characters required
- Try resetting via "Forgot Password" if SMTP is configured

**Email verification not working**
1. Check if SMTP is configured in `api/.env`
2. If not configured, verification links are logged to terminal:
   ```
   [EMAIL] Verification email would be sent to: user@example.com
   [EMAIL] Verification URL: http://localhost:3001/verify-email?token=...
   ```
3. Copy the URL from terminal and open in browser

**"Verification Failed" after clicking email link**
- Links expire after 24 hours - request a new one
- Links can only be used once
- Make sure you're clicking the full URL

### API & CORS Issues

**CORS errors in browser console**
```
Access to fetch blocked by CORS policy
```
Ensure `FRONTEND_URL` in `api/.env` matches your frontend URL exactly:
```env
FRONTEND_URL=http://localhost:3001  # No trailing slash
```

**401 Unauthorized on API requests**
- Session may have expired - try logging out and back in
- Clear browser cookies for localhost
- Check that both servers are running

### AI Features Not Working

**AI Bartender returns errors**
1. Check `ANTHROPIC_API_KEY` is set in `api/.env`
2. Verify your API key is valid at https://console.anthropic.com

**MemMachine/semantic search not working**
MemMachine requires Docker:
```bash
# Start infrastructure
docker compose -f docker/docker-compose.yml -f docker/docker-compose.dev.yml up -d

# Verify MemMachine is running
curl http://localhost:8080/health
```

### Build & Type Errors

**TypeScript errors**
```bash
# Check for type errors
npm run type-check        # Frontend
cd api && npm run type-check  # Backend
```

**Build fails**
```bash
# Clean build artifacts
rm -rf .next api/dist

# Rebuild
npm run build
cd api && npm run build
```

### Database Issues

**Database locked errors**
- Only one server instance should run at a time
- Check for zombie Node processes: `ps aux | grep node`

**Data not persisting**
- Check `DATABASE_PATH` in `api/.env`
- Ensure the `api/data/` directory is writable
- Don't delete `api/data/alchemix.db` while server is running

### Docker Issues

**Docker containers won't start**
```bash
# Check Docker is running
docker info

# View container logs
docker compose -f docker/docker-compose.yml logs

# Restart with fresh state
docker compose -f docker/docker-compose.yml down -v
docker compose -f docker/docker-compose.yml up
```

**Neo4j or Postgres connection refused**
Wait 30-60 seconds after starting Docker - databases take time to initialize.

### Still Having Issues?

1. Check the terminal output for detailed error messages
2. Review `Documentation/DEV_NOTES.md` for known issues
3. Search existing issues: https://github.com/JLawMcGraw/alchemix/issues
4. Open a new issue with:
   - Your Node.js version (`node --version`)
   - Your OS (macOS, Windows, Linux)
   - Full error message/stack trace
   - Steps to reproduce

## License

Copyright (c) 2025 Jacob Lawrence. All Rights Reserved.

---

**Built with Next.js 14 + Express + TypeScript**
