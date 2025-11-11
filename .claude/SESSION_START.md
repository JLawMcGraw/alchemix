# AlcheMix Next.js Project - Session Initialization

## FOR CLAUDE: READ THESE FILES IMMEDIATELY

Hello Claude, we're continuing work on **AlcheMix** - the modern React/Next.js rewrite of the Cocktail Analyzer platform. This is a complete rebuild using Next.js 14, TypeScript, and Zustand state management. This prompt is designed to efficiently initialize the proper context. As soon as you receive this prompt, please read the following files in order:

1. **THIS ENTIRE PROMPT DOCUMENT FIRST**
2. `C:\Users\jlawr\Desktop\DEV\alchemix-next\README.md`
3. `C:\Users\jlawr\Desktop\DEV\alchemix-next\PROGRESS_SUMMARY.md`

---

## Project Overview

**AlcheMix** is a modern full-stack web application for managing home bar inventory, discovering cocktails, and getting AI-powered bartending recommendations. This is a complete React/Next.js rewrite of the original vanilla JavaScript application, featuring:

- Modern component-based architecture
- TypeScript for type safety
- Zustand for state management
- AlcheMix design system (teal/orange scientific lab aesthetic)

### Current Status
- **Phase**: Security Hardened & Deployment Ready
- **Version**: 1.4.0-alpha (Security hardened full-stack with enterprise documentation)
- **Status**: Full-stack TypeScript monorepo complete, comprehensive security enhancements implemented (Phase 2+3), enterprise-grade documentation added, ready for production deployment

### Tech Stack

**Frontend:**
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript 5.3
- **State Management**: Zustand 4.5
- **HTTP Client**: Axios 1.6
- **Styling**: CSS Modules + Global CSS Variables
- **Icons**: Lucide React

**Backend (Monorepo - `/api` folder):**
- **Framework**: Express.js 4.x with TypeScript
- **Database**: SQLite (better-sqlite3)
- **Authentication**: JWT + bcrypt
- **Security**: Comprehensive 6-layer defense-in-depth architecture
  - Token Blacklist (immediate logout)
  - Token Versioning (session fixation protection)
  - User Rate Limiting (100 req/user/15min)
  - Security Headers (Helmet with HSTS, CSP, X-Frame-Options, Referrer-Policy)
  - JWT Token IDs (jti for granular revocation)
  - Input Validation (XSS prevention)
- **AI Integration**: Anthropic Claude API

### Key Directories

**Frontend:**
- `C:\Users\jlawr\Desktop\DEV\alchemix-next\src\app\` - Next.js App Router pages (all 7 pages built)
- `C:\Users\jlawr\Desktop\DEV\alchemix-next\src\components\` - React components (ui/, layout/, modals/)
- `C:\Users\jlawr\Desktop\DEV\alchemix-next\src\lib\` - API client, Zustand store, utilities
- `C:\Users\jlawr\Desktop\DEV\alchemix-next\src\styles\` - Design system CSS
- `C:\Users\jlawr\Desktop\DEV\alchemix-next\src\types\` - TypeScript type definitions
- `C:\Users\jlawr\Desktop\DEV\alchemix-next\public\` - Static assets (logo, fonts)

**Backend:**
- `C:\Users\jlawr\Desktop\DEV\alchemix-next\api\src\` - Express backend source code
- `C:\Users\jlawr\Desktop\DEV\alchemix-next\api\src\routes\` - API route handlers (auth, inventory, recipes, favorites, messages)
- `C:\Users\jlawr\Desktop\DEV\alchemix-next\api\src\middleware\` - Auth middleware, user rate limiting, error handling
- `C:\Users\jlawr\Desktop\DEV\alchemix-next\api\src\utils\` - Token blacklist, input validation utilities
- `C:\Users\jlawr\Desktop\DEV\alchemix-next\api\alchemix.db` - SQLite database (auto-generated)

---

## Documentation Structure

### Tier 1: Essential Context (LOAD FIRST)

- `C:\Users\jlawr\Desktop\DEV\alchemix-next\README.md` - Quick start guide, tech stack, project structure
- `C:\Users\jlawr\Desktop\DEV\alchemix-next\PROGRESS_SUMMARY.md` - Complete implementation details, what's built, what remains

### Tier 2: Reference (LOAD WHEN NEEDED)

- `C:\Users\jlawr\Desktop\DEV\alchemix-next\Documentation\SESSION_HISTORY.md` - Recent development sessions
- `C:\Users\jlawr\Desktop\DEV\alchemix-next\Documentation\PROJECT_STATUS.md` - Current implementation status
- `C:\Users\jlawr\Desktop\DEV\alchemix-next\Documentation\ACTIVE_TASKS.md` - Current task list

### Tier 3: Additional Documentation

- `C:\Users\jlawr\Desktop\DEV\alchemix-next\MONOREPO_SETUP.md` - Monorepo development workflow
- `C:\Users\jlawr\Desktop\DEV\alchemix-next\CHANGELOG.md` - Version history and changes
- `C:\Users\jlawr\Desktop\DEV\cocktail-analysis\` - Original vanilla JS app (legacy reference only)

---

## START HERE

1. **IMMEDIATELY READ** the essential files:
   - `C:\Users\jlawr\Desktop\DEV\alchemix-next\README.md`
   - `C:\Users\jlawr\Desktop\DEV\alchemix-next\PROGRESS_SUMMARY.md`

2. **BASED ON THE TASK**, selectively load:
   - `SESSION_HISTORY.md` - Recent work for context (5 sessions completed)
   - `PROJECT_STATUS.md` - Current feature completion status
   - `ACTIVE_TASKS.md` - Prioritized task list
   - `MONOREPO_SETUP.md` - Development workflow and scripts

3. **REFERENCE BACKEND CODE** when needed:
   - API routes in `/api/src/routes/`
   - Database schema in `/api/src/db.ts`
   - Type definitions in `src/types/`

---

## Important Development Guidelines

### Project Architecture

**This is a MONOREPO full-stack application:**
- Frontend: React/Next.js 14 with TypeScript (root directory)
- Backend: Express.js with TypeScript (`/api` folder)
- Database: SQLite with auto-initialization
- Single Git repository with both frontend and backend

**Development Workflow:**
- Use `npm run dev:all` to run both frontend and backend concurrently
- Use `npm run install:all` to install dependencies for both projects
- Frontend runs on port 3001, backend on port 3000
- Hot-reload enabled for both services

### Development Server Ports

```bash
# RECOMMENDED: Run both services concurrently
cd C:\Users\jlawr\Desktop\DEV\alchemix-next
npm run dev:all
# → Backend starts on port 3000
# → Frontend starts on port 3001

# OR run services separately:
# Backend only (from /api folder)
cd C:\Users\jlawr\Desktop\DEV\alchemix-next\api
npm run dev

# Frontend only (from root)
cd C:\Users\jlawr\Desktop\DEV\alchemix-next
npm run dev
```

### Environment Setup

**Backend** (`C:\Users\jlawr\Desktop\DEV\alchemix-next\api\.env`):

```env
# Server Configuration
PORT=3000
FRONTEND_URL=http://localhost:3001

# Security
JWT_SECRET=<secure-random-string>

# Database
DATABASE_PATH=./alchemix.db

# AI Integration
ANTHROPIC_API_KEY=<your-api-key-here>
```

**Frontend** (`C:\Users\jlawr\Desktop\DEV\alchemix-next\.env.local` - optional):

```env
# Only needed if you want to override the API URL
NEXT_PUBLIC_API_URL=http://localhost:3000
```

**Note**: Create the backend `.env` file from `.env.example` in the `/api` folder.

---

## Critical Rules & Best Practices

### Code Quality

- ✅ **TypeScript strict mode** - All code must be fully typed
- ✅ **React best practices** - Functional components, hooks, proper state management
- ✅ **Next.js App Router** - Use server components by default, 'use client' when needed
- ✅ **CSS Modules** - Component-scoped styling
- ✅ **Design system adherence** - Use CSS variables, 8px grid, color palette
- ✅ **Zustand for state** - Global state via store, local state via useState
- ✅ **Error handling** - Try/catch in async functions, error boundaries for components
- ⚠️ **Never store passwords in frontend** - All auth handled via API
- ⚠️ **Never hardcode API keys** - Use environment variables

### TypeScript Guidelines

```typescript
// ✅ Good: Fully typed
interface Bottle {
  id: number;
  name: string;
  'Liquor Type': string;
  // ...
}

const fetchBottles = async (): Promise<Bottle[]> => {
  const bottles = await inventoryApi.getAll();
  return bottles;
};

// ❌ Bad: Using 'any'
const fetchBottles = async (): Promise<any> => {
  // Don't do this!
};
```

### Component Structure

```tsx
// ✅ Good: Typed props, proper exports
interface CardProps {
  title: string;
  children: React.ReactNode;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({ title, children, onClick }) => {
  return (
    <div className={styles.card} onClick={onClick}>
      <h3>{title}</h3>
      {children}
    </div>
  );
};
```

### State Management Pattern

```tsx
// ✅ Use Zustand store for global state
import { useStore } from '@/lib/store';

export default function MyBarPage() {
  const { bottles, fetchBottles, isLoading } = useStore();

  useEffect(() => {
    fetchBottles();
  }, [fetchBottles]);

  return <div>{/* ... */}</div>;
}
```

### Testing Requirements

Before committing changes:

- ✅ TypeScript compiles without errors: `npm run type-check`
- ✅ ESLint passes: `npm run lint`
- ✅ Both servers running (Express on 3000, Next.js on 3001)
- ✅ No console errors in browser
- ✅ API requests succeed (check Network tab)
- ✅ Authentication flow works (login/signup/logout)
- ✅ UI matches AlcheMix design system

---

## Design System Reference

### Colors

```css
--color-primary: #3DD6C1;        /* Teal - primary actions, links */
--color-secondary: #F2A74B;      /* Orange - accents, secondary actions */
--color-ui-bg-base: #F8F5EB;     /* Warm beige - page background */
--color-ui-bg-surface: #FFFFFF;  /* White - cards, modals */
--color-text-body: #2D2C28;      /* Dark gray - body text */
--color-text-muted: #7B776D;     /* Light gray - secondary text */
```

### Typography

```css
--font-display: "Space Grotesk";  /* Headings */
--font-body: "Inter";             /* Body text */
```

### Spacing (8px Grid)

```css
--space-1: 8px;
--space-2: 16px;
--space-3: 24px;
--space-4: 32px;
--space-8: 64px;
```

### UI Components

Available components in `src/components/ui/`:

```tsx
import { Button, Card, Input } from '@/components/ui';

// Button: 3 variants (primary, outline, text), 3 sizes (sm, md, lg)
<Button variant="primary" size="md">Click Me</Button>

// Card: Padding options (none, sm, md, lg), hover effect
<Card padding="md" hover>Content</Card>

// Input: Label, error state, full-width
<Input label="Email" type="email" error="Invalid email" fullWidth />
```

---

## API Integration

### Backend Connection

Next.js app connects to Express backend via API proxy:

```javascript
// next.config.js (already configured)
async rewrites() {
  return [
    {
      source: '/api/:path*',
      destination: 'http://localhost:3000/api/:path*',
    },
  ];
}
```

### API Client Usage

```typescript
import { authApi, inventoryApi, recipeApi } from '@/lib/api';

// Authentication
const response = await authApi.login({ email, password });

// Inventory
const bottles = await inventoryApi.getAll();
await inventoryApi.add(newBottle);
await inventoryApi.update(id, updates);
await inventoryApi.delete(id);

// Or use Zustand store (recommended)
const { login, fetchBottles, addBottle } = useStore();
await login({ email, password });
await fetchBottles();
```

### API Endpoints (Express Backend)

All endpoints use JWT authentication (except login/signup):

**Authentication** (`/auth/*`)
- POST `/auth/signup` - Create account
- POST `/auth/login` - Authenticate user
- GET `/auth/me` - Get current user
- POST `/auth/logout` - Terminate session

**Inventory** (`/api/inventory`)
- GET `/api/inventory` - Get user's bottles
- POST `/api/inventory` - Add bottle
- PUT `/api/inventory/:id` - Update bottle
- DELETE `/api/inventory/:id` - Delete bottle

**Recipes** (`/api/recipes`)
- GET `/api/recipes` - Get user's recipes
- POST `/api/recipes` - Add recipe

**Favorites** (`/api/favorites`)
- GET `/api/favorites` - Get favorites
- POST `/api/favorites` - Add favorite
- DELETE `/api/favorites/:id` - Remove favorite

**AI** (`/api/messages`)
- POST `/api/messages` - Send message to Claude API

---

## Common Pitfalls & Solutions

### Port Conflicts

**Problem**: Express backend not running or wrong port
**Solution**:
```bash
# Make sure both services are running
cd C:\Users\jlawr\Desktop\DEV\alchemix-next
npm run dev:all

# Or check backend separately
cd api
npm run dev

# Check backend health
curl http://localhost:3000/health
```

### CORS Issues

**Problem**: API requests blocked by CORS
**Solution**: Backend CORS is configured for localhost:3001. If issues persist:
- Check backend `.env` has correct `FRONTEND_URL`
- Verify backend is running on port 3000
- Check browser console for specific CORS errors
- Ensure requests include proper headers

### TypeScript Errors

**Problem**: Type errors in IDE
**Solution**:
```bash
# Run type check
npm run type-check

# Common fix: ensure types are imported
import type { Bottle } from '@/types';
```

### State Not Persisting

**Problem**: User logged out on refresh
**Solution**: Zustand store uses localStorage persistence for auth:
- Check browser dev tools → Application → Local Storage
- Should see `alchemix-storage` key
- Contains `user`, `token`, `isAuthenticated`

### API Calls Failing

**Problem**: 401 Unauthorized errors
**Solution**:
- Check token in localStorage
- Verify JWT_SECRET matches between sessions
- Re-login to get fresh token

---

## File Structure Quick Reference

```
alchemix-next/
├── .claude/
│   ├── SESSION_START.md       ← You are here
│   └── SESSION_END.md
├── src/                        # FRONTEND
│   ├── app/                    # ✅ Next.js pages (ALL COMPLETE)
│   │   ├── layout.tsx          # ✅ Root layout with ToastProvider
│   │   ├── login/              # ✅ Login page
│   │   ├── dashboard/          # ✅ Dashboard with stats
│   │   ├── bar/                # ✅ My Bar inventory table
│   │   ├── ai/                 # ✅ AI Bartender chat
│   │   ├── recipes/            # ✅ Recipe library grid
│   │   ├── favorites/          # ✅ Favorites & History
│   │   └── account/            # ✅ Account settings
│   ├── components/
│   │   ├── ui/                 # ✅ Button, Card, Input, Spinner, SuccessCheckmark
│   │   ├── layout/             # ✅ TopNav
│   │   └── modals/             # ✅ CSV Upload, Add/Edit Bottle, Delete, Toast
│   ├── lib/
│   │   ├── api.ts              # ✅ Axios API client
│   │   └── store.ts            # ✅ Zustand store with persistence
│   ├── styles/
│   │   └── globals.css         # ✅ Design system
│   └── types/
│       └── index.ts            # ✅ TypeScript types
├── api/                        # BACKEND (MONOREPO)
│   ├── src/
│   │   ├── server.ts           # ✅ Express server setup
│   │   ├── db.ts               # ✅ SQLite database config
│   │   ├── routes/             # ✅ API routes (auth, inventory, recipes, favorites, messages)
│   │   └── middleware/         # ✅ Auth middleware, error handler
│   ├── alchemix.db             # SQLite database (auto-generated)
│   ├── package.json            # Backend dependencies
│   ├── tsconfig.json           # Backend TS config
│   └── .env.example            # Environment template
├── public/
│   ├── logo.png                # ✅ AlcheMix logo PNG
│   └── logo.svg                # ✅ AlcheMix logo SVG
├── Documentation/              # ✅ Session history, project status, active tasks
├── package.json                # ✅ Frontend deps + monorepo scripts
├── tsconfig.json               # ✅ Frontend TS config
├── next.config.js              # ✅ Next.js config + API proxy
├── README.md                   # ✅ Quick start guide
├── PROGRESS_SUMMARY.md         # ✅ Complete progress details
├── CHANGELOG.md                # ✅ Version history
└── MONOREPO_SETUP.md           # ✅ Monorepo workflow guide
```

---

## Required Actions After Reading This Prompt

After reading this entire prompt and the required files, Claude should:

1. ✅ Confirm you've read the essential files (README.md, PROGRESS_SUMMARY.md)
2. 🎯 Summarize current project status (what's built, what remains)
3. ❓ Ask what specific page or feature we'll be working on
4. 📋 Load relevant documentation based on the task
5. ⏸️ Wait for task specification before proceeding with changes

---

## Quick Reference Commands

### Installation & Setup

```bash
# Navigate to project
cd C:\Users\jlawr\Desktop\DEV\alchemix-next

# Install ALL dependencies (frontend + backend)
npm run install:all

# Create backend .env file
cd api
cp .env.example .env
# Edit .env with your JWT_SECRET and ANTHROPIC_API_KEY
cd ..
```

### Development

```bash
# RECOMMENDED: Start both services concurrently
npm run dev:all
# → Backend on http://localhost:3000
# → Frontend on http://localhost:3001

# OR run separately:
# Backend only
cd api && npm run dev

# Frontend only
npm run dev
```

### Testing & Validation

```bash
# Type check frontend
npm run type-check

# Type check backend
cd api && npm run type-check

# Lint check
npm run lint

# Check backend health
curl http://localhost:3000/health
```

### Build

```bash
# Build frontend for production
npm run build

# Build backend
cd api && npm run build
```

---

## Project Statistics

| Metric | Value |
|--------|-------|
| **Version** | 1.4.0-alpha (Security Hardened) |
| **Sessions Completed** | 6 (Nov 7-10, 2025) |
| **Framework** | Next.js 14 + Express.js |
| **Language** | TypeScript 5.3 (Frontend + Backend) |
| **State Management** | Zustand 4.5 |
| **Files Created** | 80+ (Frontend + Backend) |
| **Lines of Code** | ~5,000+ |
| **UI Components Built** | 10 (Button, Card, Input, Spinner, SuccessCheckmark, Modals, TopNav) |
| **Pages Built** | 7 (Login, Dashboard, Bar, AI, Recipes, Favorites, Account) ✅ |
| **Modal Components** | 5 (CSV Upload, Add/Edit Bottle, Delete, Toast) ✅ |
| **API Endpoints** | 20+ REST endpoints |
| **Database Tables** | 4 (users, bottles, recipes, favorites) |
| **Design System** | Complete (colors, typography, spacing, animations) |

---

## Current Progress - FEATURE COMPLETE ✅

### ✅ Frontend Complete

- [x] Next.js 14 project setup with TypeScript
- [x] Design system implementation (colors, fonts, spacing, animations)
- [x] AlcheMix logo integration (PNG + SVG)
- [x] TypeScript type definitions (25+ interfaces)
- [x] API client with Axios (auto-retry, interceptors)
- [x] Zustand store with localStorage persistence
- [x] UI components (Button, Card, Input, Spinner, SuccessCheckmark)
- [x] Root layout with TopNav and ToastProvider
- [x] All 7 pages (Login, Dashboard, Bar, AI, Recipes, Favorites, Account)
- [x] Modal system (CSV Upload, Add/Edit Bottle, Delete, Toast)
- [x] Full accessibility (ARIA labels, keyboard navigation, focus management)
- [x] Mobile responsive design

### ✅ Backend Complete (Sessions 5-6)

- [x] Express.js TypeScript backend in `/api` folder
- [x] SQLite database with auto-initialization
- [x] Authentication API (signup, login, logout, me)
- [x] Inventory API (full CRUD operations)
- [x] Recipes API (get, add, CSV import)
- [x] Favorites API (get, add, remove with input validation)
- [x] AI Messages API (Anthropic Claude integration)
- [x] JWT authentication with bcrypt password hashing
- [x] **Security - Phase 2+3 Complete (Session 6)**:
  - [x] Token Blacklist (in-memory Map, O(1) revocation)
  - [x] Token Versioning (session fixation protection)
  - [x] User Rate Limiting (sliding window, 100 req/user/15min)
  - [x] Security Headers (Helmet: HSTS, CSP, X-Frame-Options, Referrer-Policy)
  - [x] JWT Token IDs (jti for granular revocation)
  - [x] Input Validation (comprehensive XSS prevention)
  - [x] Strong Password Validation (8+ chars, complexity)
  - [x] IP Rate Limiting (5-100 req/IP/15min)
  - [x] Defense-in-Depth (6-layer security architecture)
- [x] **Documentation (Session 6)**: ~4,500 lines of enterprise-grade inline documentation
- [x] Error handling middleware
- [x] Database schema with foreign keys and indexes

### 🚀 Next Phase - Deployment

- [ ] Deploy frontend to Vercel
- [ ] Deploy backend to Railway
- [ ] Configure production environment variables
- [ ] Set up persistent storage for SQLite database
- [ ] Test full stack in production environment

---

## Development Workflow

### Starting a New Session

1. **Read this SESSION_START.md file**
2. **Read README.md and PROGRESS_SUMMARY.md**
3. **Check current status:**
   ```bash
   cd C:\Users\jlawr\Desktop\DEV\alchemix-next
   git status
   git log --oneline -5
   ```

4. **Ensure environment is set up:**
   ```bash
   # Check backend .env exists
   ls api/.env

   # If not, create from example
   cd api
   cp .env.example .env
   # Edit with your JWT_SECRET and ANTHROPIC_API_KEY
   cd ..
   ```

5. **Start both services:**
   ```bash
   # Run both frontend and backend concurrently
   npm run dev:all
   # → Backend: http://localhost:3000
   # → Frontend: http://localhost:3001
   ```

6. **Work on assigned task:**
   - All pages are complete - focus on enhancements, fixes, or deployment
   - Use existing components and patterns
   - Follow TypeScript best practices
   - Test in browser frequently
   - Check both frontend and backend logs for errors

7. **Before ending session:**
   - Run `npm run type-check` (frontend)
   - Run `cd api && npm run type-check` (backend)
   - Run `npm run lint`
   - Test all changes in browser
   - Update documentation (use SESSION_END.md)
   - Commit changes with descriptive messages

---

## Session Initialization Complete

✅ Ready to receive task specification.

**Next Steps:**
1. Confirm context loading complete
2. Identify the specific page or feature to work on
3. Begin implementation following AlcheMix design system
4. Maintain type safety and code quality standards

---

## Important Notes

⚠️ **Monorepo Structure:**
- Frontend and backend are in the same Git repository
- Use `npm run dev:all` to run both services concurrently
- Backend is in `/api` folder with its own package.json
- Both projects share TypeScript configuration patterns

⚠️ **TypeScript Requirement:**
- All code must be fully typed (frontend and backend)
- No `any` types unless absolutely necessary
- Run type-check for both projects before committing
- Strict mode enabled throughout

⚠️ **Design System Adherence:**
- Use CSS variables from `globals.css`
- Follow 8px spacing grid
- Use existing UI components (10 available)
- Maintain AlcheMix brand (teal/orange, scientific lab aesthetic)
- All modals have full accessibility and mobile support

⚠️ **Backend Configuration:**
- Backend requires `.env` file with JWT_SECRET and ANTHROPIC_API_KEY
- Database auto-initializes on first run
- CORS configured for localhost:3001
- Rate limiting: 100 requests per 15 minutes

⚠️ **Development Tips:**
- Application is feature-complete for local development
- Focus on enhancements, bug fixes, or deployment tasks
- Test authentication flow end-to-end
- Verify database persistence between restarts
- Check both terminal outputs for errors

---

**AlcheMix Full-Stack MVP Complete!** 🧪🍹✨
