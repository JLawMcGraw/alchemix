# AlcheMix - Modern Cocktail Lab Management

[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

Modern cocktail inventory and recipe management system with AI-powered bartender recommendations. Built with Next.js 14, TypeScript, and Zustand.

## ✨ Current Status

**Version:** v1.3.0-alpha (Full-Stack Monorepo)
**Phase:** Backend Complete - Ready for Deployment
**Last Updated:** November 9, 2025

### What's Working
- ✅ **Complete TypeScript monorepo** (Frontend + Backend) ⭐
- ✅ **Modern Express backend** with JWT auth, CRUD APIs ⭐
- ✅ **SQLite database** with auto-initialization ⭐
- ✅ Complete authentication flow (login/signup)
- ✅ All 7 pages implemented and functional
- ✅ Professional Lucide React icon system
- ✅ Toast notification system
- ✅ Production-ready modal system with full accessibility
- ✅ Real-time form validation with inline error messages
- ✅ Loading states and success animations
- ✅ Mobile responsive modals (<640px)
- ✅ WCAG 2.1 AA accessibility compliance
- ✅ CSV import functionality (bottles & recipes)
- ✅ Favorites management
- ✅ Full inventory table with filtering

### What Needs Work
- ⚠️ End-to-end testing with new backend
- ⚠️ Phase 1 deployment (Vercel + Railway)
- ⚠️ CSV import preview (optional enhancement)
- ⚠️ Recipe detail modal implementation
- ⚠️ Logo optimization for TopNav integration

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
npm run dev:api

# Terminal 2 - Frontend
npm run dev
```

## 📋 Prerequisites

- **Node.js v20.x LTS** (v24 not compatible with better-sqlite3)
- That's it! Backend is included in this monorepo.

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
│   │   ├── modals/            # Modal components (CSV, Add/Edit, Delete)
│   │   └── ui/                # UI components (Button, Card, Input, Toast, Spinner)
│   ├── lib/
│   │   ├── api.ts             # API client (Axios with interceptors)
│   │   └── store.ts           # Zustand store (auth, inventory, recipes)
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
- `POST /api/recipes/import` - Import recipes from CSV

**Favorites:**
- `GET /api/favorites` - Get user favorites
- `POST /api/favorites` - Add favorite
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

- Recipe detail modal/overlay
- Recipe creation and editing forms
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

## ⚙️ Environment Setup

### Frontend (.env.local)

Create `.env.local` in the Next.js project root:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000
```

### Backend (.env)

Update the Express backend `.env` file:

```env
JWT_SECRET=your_generated_secret_here
PORT=3000
FRONTEND_URL=http://localhost:3001
ANTHROPIC_API_KEY=your_api_key_here  # Optional, for AI Bartender
```

**Important:**
- Generate JWT_SECRET using: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- CORS is configured to accept requests from `FRONTEND_URL`

## 🚀 Getting Started

### First Time Setup

1. **Install Node.js v20 LTS** (required for better-sqlite3)
   ```bash
   node --version  # Should show v20.x
   ```

2. **Install Frontend Dependencies**
   ```bash
   cd alchemix-next
   npm install
   ```

3. **Install Backend Dependencies**
   ```bash
   cd ../cocktail-analysis
   npm install
   ```

4. **Configure Environment Variables** (see above)

### Running the Application

**Terminal 1 - Backend:**
```bash
cd cocktail-analysis
npm run server
# Server starts on http://localhost:3000
```

**Terminal 2 - Frontend:**
```bash
cd alchemix-next
npm run dev
# App starts on http://localhost:3001
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
# Type checking
npm run type-check

# Linting
npm run lint

# Build for production (test)
npm run build
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

## 🐛 Known Issues

1. **Untested Features**: Modal improvements not yet tested with real backend data
2. **CSV Preview**: No preview before importing CSV files (optional enhancement)
3. **Mobile Testing**: Responsive design not tested on actual devices yet
4. **Logo Asset**: Logo needs optimization before integration into TopNav
5. **Screen Reader Testing**: Accessibility not yet verified with actual screen readers

See `Documentation/ACTIVE_TASKS.md` for the complete task list.

## 🎯 Next Steps

**High Priority:**
1. **Test monorepo locally** - Run `npm run dev:all` and verify end-to-end functionality
2. **Deploy to production** - Vercel (frontend) + Railway (backend)
3. Create deployment guide for monorepo setup
4. Test modal improvements with real backend data
5. Test mobile responsive on actual devices (iPhone, Android)

**Medium Priority:**
6. Test accessibility with screen readers (NVDA, JAWS, VoiceOver)
7. Create recipe detail modal/overlay
8. Implement recipe creation/editing forms
9. Add CSV import preview with column mapping
10. Build account settings page

**Optional Enhancements:**
- Tooltip hints for complex form fields
- Field autocomplete/suggestions (Spirit types, locations)
- Advanced inventory filtering
- Bulk operations for inventory

See `Documentation/PROJECT_STATUS.md` for full implementation roadmap.

## 🤝 Related Projects

This is a complete rewrite of AlcheMix in React/Next.js with a modern TypeScript backend. The original vanilla JS version is in `../cocktail-analysis/` and serves as a reference for features and functionality.

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

- **Icons:** [Lucide React](https://lucide.dev/)
- **Fonts:** [Google Fonts](https://fonts.google.com/) (Space Grotesk, Inter)
- **Framework:** [Next.js](https://nextjs.org/)

---

**Built with ❤️ using Next.js 14 + Express + TypeScript**

**Current Version:** v1.3.0-alpha (Full-Stack Monorepo)
**Last Updated:** November 9, 2025
