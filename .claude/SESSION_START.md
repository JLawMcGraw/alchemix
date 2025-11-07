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
- **Phase**: Active Development - Foundation Complete, Pages In Progress
- **Version**: 1.0.0 (MVP)
- **Status**: Design system complete, core components built, API client ready, pages to be built

### Tech Stack
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript 5.3
- **State Management**: Zustand 4.5
- **HTTP Client**: Axios 1.6
- **Styling**: CSS Modules + Global CSS Variables
- **Backend**: Express.js API (shared with original app - running on port 3000)
- **Database**: SQLite (via Express backend)
- **Authentication**: JWT + bcrypt (via Express backend)
- **AI Integration**: Anthropic Claude API (via Express backend)

### Key Directories
- `C:\Users\jlawr\Desktop\DEV\alchemix-next\src\app\` - Next.js App Router pages
- `C:\Users\jlawr\Desktop\DEV\alchemix-next\src\components\` - React components (ui/, layout/, features/)
- `C:\Users\jlawr\Desktop\DEV\alchemix-next\src\lib\` - API client, Zustand store, utilities
- `C:\Users\jlawr\Desktop\DEV\alchemix-next\src\styles\` - Design system CSS
- `C:\Users\jlawr\Desktop\DEV\alchemix-next\src\types\` - TypeScript type definitions
- `C:\Users\jlawr\Desktop\DEV\alchemix-next\public\` - Static assets (logo, fonts)

---

## Documentation Structure

### Tier 1: Essential Context (LOAD FIRST)

- `C:\Users\jlawr\Desktop\DEV\alchemix-next\README.md` - Quick start guide, tech stack, project structure
- `C:\Users\jlawr\Desktop\DEV\alchemix-next\PROGRESS_SUMMARY.md` - Complete implementation details, what's built, what remains

### Tier 2: Reference (LOAD WHEN NEEDED)

- `C:\Users\jlawr\Desktop\DEV\alchemix-next\Documentation\SESSION_HISTORY.md` - Recent development sessions
- `C:\Users\jlawr\Desktop\DEV\alchemix-next\Documentation\PROJECT_STATUS.md` - Current implementation status
- `C:\Users\jlawr\Desktop\DEV\alchemix-next\Documentation\ACTIVE_TASKS.md` - Current task list

### Tier 3: Legacy Reference (ORIGINAL APP)

- `C:\Users\jlawr\Desktop\DEV\cocktail-analysis\` - Original vanilla JS app (kept as reference)
- Useful for understanding API contracts, data structures, and business logic

---

## START HERE

1. **IMMEDIATELY READ** the essential files:
   - `C:\Users\jlawr\Desktop\DEV\alchemix-next\README.md`
   - `C:\Users\jlawr\Desktop\DEV\alchemix-next\PROGRESS_SUMMARY.md`

2. **BASED ON THE TASK**, selectively load:
   - `SESSION_HISTORY.md` - Recent work for context
   - `PROJECT_STATUS.md` - Current feature completion status
   - `ACTIVE_TASKS.md` - Prioritized task list

3. **REFERENCE ORIGINAL APP** when needed:
   - API endpoint contracts
   - Data schemas (Bottle, Recipe, etc.)
   - Business logic (recipe matching, fuzzy search)

---

## Important Development Guidelines

### Project Architecture

**This is a PARALLEL development project:**
- Original app: `C:\Users\jlawr\Desktop\DEV\cocktail-analysis\` (Vanilla JS)
- New app: `C:\Users\jlawr\Desktop\DEV\alchemix-next\` (React/Next.js)
- **Shared backend**: Both apps use the same Express API on port 3000

**Development Workflow:**
- Old app continues to work (reference only)
- New app is being built from scratch
- Both can run simultaneously (different ports)

### Development Server Ports

```bash
# Express Backend (SHARED - required for both apps)
# Port: 3000
cd C:\Users\jlawr\Desktop\DEV\cocktail-analysis
npm run server

# AlcheMix Next.js App (NEW)
# Port: 3001
cd C:\Users\jlawr\Desktop\DEV\alchemix-next
npm run dev
```

### Environment Setup

**Next.js App** (`C:\Users\jlawr\Desktop\DEV\alchemix-next\.env.local`):

```env
# API Base URL (points to Express backend)
NEXT_PUBLIC_API_URL=http://localhost:3000
```

**Express Backend** (uses existing `.env` from original project):

```env
PORT=3000
JWT_SECRET=<secure-random-string>
DATABASE_PATH=./server/database/cocktail-analyzer.db
ANTHROPIC_API_KEY=<optional>
```

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
# Make sure Express is running on port 3000
cd C:\Users\jlawr\Desktop\DEV\cocktail-analysis
npm run server

# Check it's responding
curl http://localhost:3000/api/health
```

### CORS Issues

**Problem**: API requests blocked by CORS
**Solution**: Express backend already configured for localhost. If issues persist, check:
- Express is running
- `cors` middleware is enabled in `server.cjs`
- Request includes credentials if needed

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
├── src/
│   ├── app/                    # Next.js pages
│   │   ├── layout.tsx          # Root layout (to be built)
│   │   ├── page.tsx            # Home page (to be built)
│   │   ├── login/              # Login page (to be built)
│   │   ├── dashboard/          # Dashboard (to be built)
│   │   ├── bar/                # My Bar inventory (to be built)
│   │   ├── ai/                 # AI Bartender (to be built)
│   │   ├── recipes/            # Recipe library (to be built)
│   │   └── favorites/          # Favorites & History (to be built)
│   ├── components/
│   │   ├── ui/                 # ✅ Button, Card, Input (DONE)
│   │   ├── layout/             # TopNav, Footer (to be built)
│   │   └── features/           # RecipeCard, InventoryTable, etc. (to be built)
│   ├── lib/
│   │   ├── api.ts              # ✅ API client (DONE)
│   │   └── store.ts            # ✅ Zustand store (DONE)
│   ├── styles/
│   │   └── globals.css         # ✅ Design system (DONE)
│   └── types/
│       └── index.ts            # ✅ TypeScript types (DONE)
├── public/
│   └── logo.png                # ✅ AlcheMix logo (DONE)
├── Documentation/              # Session docs (to be created as needed)
├── package.json                # ✅ Dependencies configured
├── tsconfig.json               # ✅ TypeScript config
├── next.config.js              # ✅ Next.js config + API proxy
├── README.md                   # ✅ Quick start guide
└── PROGRESS_SUMMARY.md         # ✅ Complete progress details
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

# Install dependencies
npm install

# Type check
npm run type-check

# Lint check
npm run lint
```

### Development

```bash
# Start Express backend (REQUIRED - different terminal)
cd C:\Users\jlawr\Desktop\DEV\cocktail-analysis
npm run server
# → Runs on port 3000

# Start Next.js dev server (main project)
cd C:\Users\jlawr\Desktop\DEV\alchemix-next
npm run dev
# → Runs on port 3001
# → Open http://localhost:3001
```

### Build

```bash
# Build for production
npm run build

# Start production server
npm start
```

---

## Project Statistics

| Metric | Value |
|--------|-------|
| **Version** | 1.0.0 (MVP) |
| **Framework** | Next.js 14 |
| **Language** | TypeScript 5.3 |
| **State Management** | Zustand 4.5 |
| **Files Created** | 22 (Phase 1) |
| **Lines of Code** | ~1,200 (Phase 1) |
| **Components Built** | 3 (Button, Card, Input) |
| **Pages To Build** | 7 (login, dashboard, bar, ai, recipes, favorites, account) |
| **API Endpoints** | 15+ (via Express backend) |
| **Design System** | Complete (colors, typography, spacing) |

---

## Current Progress (Phase 1 Complete)

### ✅ Completed

- [x] Next.js 14 project setup with TypeScript
- [x] Design system implementation (colors, fonts, spacing)
- [x] AlcheMix logo integration
- [x] TypeScript type definitions (15+ interfaces)
- [x] API client with Axios (connects to Express backend)
- [x] Zustand store (auth, inventory, recipes, favorites, AI)
- [x] Core UI components (Button, Card, Input)
- [x] Configuration files (package.json, tsconfig.json, next.config.js)
- [x] Documentation (README.md, PROGRESS_SUMMARY.md)

### 🚧 In Progress / Pending

- [ ] Install dependencies (`npm install`)
- [ ] Root layout with top navigation
- [ ] Login page
- [ ] Dashboard page
- [ ] My Bar page (inventory table)
- [ ] AI Bartender page (chat interface)
- [ ] Recipes page (grid view)
- [ ] Favorites page (favorites + history tabs)

---

## Development Workflow

### Starting a New Session

1. **Read this SESSION_START.md file**
2. **Read README.md and PROGRESS_SUMMARY.md**
3. **Check current status:**
   ```bash
   cd C:\Users\jlawr\Desktop\DEV\alchemix-next
   git status
   npm run type-check
   ```

4. **Start development servers:**
   ```bash
   # Terminal 1: Express backend
   cd C:\Users\jlawr\Desktop\DEV\cocktail-analysis
   npm run server

   # Terminal 2: Next.js frontend
   cd C:\Users\jlawr\Desktop\DEV\alchemix-next
   npm run dev
   ```

5. **Work on assigned task:**
   - Build pages using design system
   - Use existing components from `src/components/ui/`
   - Follow TypeScript best practices
   - Test frequently in browser

6. **Before ending session:**
   - Run `npm run type-check`
   - Run `npm run lint`
   - Test all changes in browser
   - Update documentation (use SESSION_END.md)

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

⚠️ **Parallel Development:**
- This is a NEW React app being built alongside the original
- Original app (`cocktail-analysis`) remains functional as reference
- Both apps share the same Express backend

⚠️ **TypeScript Requirement:**
- All code must be fully typed
- No `any` types unless absolutely necessary
- Run `npm run type-check` frequently

⚠️ **Design System Adherence:**
- Use CSS variables from `globals.css`
- Follow 8px spacing grid
- Use existing UI components when possible
- Maintain AlcheMix brand (teal/orange, scientific lab feel)

⚠️ **Backend Dependency:**
- Express backend MUST be running on port 3000
- Next.js app proxies API requests to Express
- JWT tokens handled automatically by API client

---

**Ready to build AlcheMix!** 🧪🍹
