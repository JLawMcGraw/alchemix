# AlcheMix - Modern Cocktail Lab Management

[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-Proprietary-red)](LICENSE)

Modern cocktail inventory and recipe management system with AI-powered bartender recommendations.

**Version:** v1.25.0 | **Last Updated:** December 3, 2025

## Features

- **My Bar** - Category-organized inventory with 9 tabs, card grid layout, CSV import
- **Recipe Management** - Full CRUD, collections/folders, bulk operations, CSV import
- **Smart Shopping List** - Near-miss algorithm, ingredient recommendations, 6 recipe buckets
- **AI Bartender** - Claude-powered assistant with MemMachine semantic memory
- **Secure Auth** - HttpOnly cookie JWT with CSRF protection (XSS-resistant)
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
│   ├── app/               # Pages (login, dashboard, bar, recipes, ai, etc.)
│   ├── components/        # UI components and modals
│   ├── hooks/             # Custom hooks (useAuthGuard, useVerificationGuard)
│   └── lib/               # API client, store, utilities
├── api/                    # Express backend
│   ├── src/
│   │   ├── routes/        # API endpoints
│   │   ├── services/      # Business logic (RecipeService, EmailService, etc.)
│   │   ├── middleware/    # Auth, error handling
│   │   └── database/      # SQLite setup
│   └── .env               # Environment configuration
├── docker/                 # Docker configuration
│   ├── docker-compose.yml # Main compose file
│   ├── Dockerfile.*       # Frontend/backend Dockerfiles
│   ├── memmachine/        # MemMachine config templates
│   └── .env.example       # Docker env template
├── Documentation/          # Project docs
│   ├── railway-deployment/ # Railway deployment guide
│   ├── PROJECT_PROGRESS.md
│   └── DEV_NOTES.md
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

### Resources
- `GET/POST/PUT/DELETE /api/inventory` - Inventory management
- `GET/POST/PUT/DELETE /api/recipes` - Recipe management
- `DELETE /api/recipes/bulk` - Bulk delete (up to 500)
- `GET/POST/PUT/DELETE /api/collections` - Recipe collections
- `GET/POST/DELETE /api/favorites` - Favorites
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

# Run tests (548 tests: 466 backend + 82 frontend)
cd api && npm test          # Backend
npm run test:ui -- --run    # Frontend

# Build
npm run build              # Frontend
cd api && npm run build    # Backend
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

## Documentation

- `Documentation/PROJECT_PROGRESS.md` - Session history and progress
- `Documentation/DEV_NOTES.md` - Technical decisions and gotchas
- `Documentation/railway-deployment/` - Railway deployment guide
- `api/.env.example` - Full environment variable reference
- `docker/.env.example` - Docker environment template

## License

Copyright (c) 2025 Jacob Lawrence. All Rights Reserved.

---

**Built with Next.js 14 + Express + TypeScript**
