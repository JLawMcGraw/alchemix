# AlcheMix - Modern Cocktail Lab Management

[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

Modern cocktail inventory and recipe management system with AI-powered bartender recommendations. Built with Next.js 14, TypeScript, and Zustand.

## ✨ Current Status

**Version:** v1.1.0-alpha (Modal System in Development)
**Phase:** Core Features Implementation
**Last Updated:** November 7, 2025

### What's Working
- ✅ Complete authentication flow (login/signup)
- ✅ All 7 pages implemented and functional
- ✅ Professional Lucide React icon system
- ✅ Toast notification system
- ✅ Modal system for CRUD operations
- ✅ CSV import functionality (bottles & recipes)
- ✅ Favorites management
- ✅ Full inventory table with filtering

### What Needs Work
- ⚠️ Modal UX refinement required (user feedback)
- ⚠️ Form validation improvements needed
- ⚠️ CSV import preview missing
- ⚠️ Loading states needed for async operations
- ⚠️ Mobile responsive testing incomplete

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Server will start on http://localhost:3001
```

## 📋 Prerequisites

- **Node.js v20.x LTS** (v24 not compatible with better-sqlite3)
- **Express backend running on port 3000** (from `cocktail-analysis` project)
- Backend `.env` file configured with `FRONTEND_URL=http://localhost:3001`

## 🏗️ Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript 5.3
- **State Management:** Zustand 4.5 (with localStorage persistence)
- **HTTP Client:** Axios 1.6 (with interceptors)
- **UI Components:** Custom components + Lucide React icons
- **Styling:** CSS Modules + Global CSS Variables
- **Backend:** Express API (running separately on port 3000)
- **Database:** SQLite (via better-sqlite3 in backend)

## 📁 Project Structure

```
alchemix-next/
├── src/
│   ├── app/                     # Next.js App Router pages
│   │   ├── login/              # Login/signup page
│   │   ├── dashboard/          # Dashboard with stats & overview
│   │   ├── bar/                # My Bar (inventory management)
│   │   ├── ai/                 # AI Bartender chat interface
│   │   ├── recipes/            # Recipe library with search/filter
│   │   ├── favorites/          # Favorites & chat history
│   │   └── layout.tsx          # Root layout with TopNav + ToastProvider
│   ├── components/
│   │   ├── layout/             # Layout components (TopNav)
│   │   ├── modals/             # Modal components (CSV, Add/Edit, Delete)
│   │   └── ui/                 # UI components (Button, Card, Input, Toast)
│   ├── lib/
│   │   ├── api.ts              # API client (Axios with interceptors)
│   │   └── store.ts            # Zustand store (auth, inventory, recipes)
│   ├── styles/
│   │   └── globals.css         # Design system CSS variables
│   └── types/
│       └── index.ts            # TypeScript type definitions
├── public/
│   └── logo.png                # AlcheMix logo
└── Documentation/              # Project documentation
    ├── SESSION_HISTORY.md      # Development session records
    ├── PROJECT_STATUS.md       # Current implementation status
    ├── ACTIVE_TASKS.md         # Prioritized task list
    ├── DEV_NOTES.md            # Technical decisions & gotchas
    └── metrics/                # Session effectiveness tracking
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
- Core UI components (Button, Card, Input, Toast)
- Zustand store with localStorage persistence
- Axios API client with interceptors
- Comprehensive TypeScript types

**Pages (Phase 2):**
- Login/Signup page with form validation
- Dashboard with stats and overview cards
- My Bar inventory page with table and filtering
- AI Bartender chat interface
- Recipe library with search and filters
- Favorites & History page with tabs
- Professional Lucide React icon system

**Modals & Notifications (Phase 3):**
- CSV upload modal (bottles and recipes)
- Add bottle modal (12-field form)
- Edit bottle modal (pre-filled editing)
- Delete confirmation modal
- Toast notification system (ToastProvider)
- Full CRUD operations on My Bar page
- Success/error feedback for all actions

### ⚠️ Needs Refinement

- Modal UX/UI improvements
- Form validation (client-side, real-time)
- CSV import preview before upload
- Loading states during async operations
- Mobile responsive testing

### 🚧 Planned Features

- Recipe detail modal/overlay
- Recipe creation and editing forms
- Advanced inventory filtering
- Bulk operations for inventory
- Loading spinners for all async operations
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

1. **Modal UX**: User feedback indicates modals need UX refinement
2. **Form Validation**: Only basic browser validation implemented
3. **CSV Preview**: No preview before importing CSV files
4. **Loading States**: Missing loading indicators for async operations
5. **Mobile**: Responsive design not fully tested on mobile devices

See `Documentation/ACTIVE_TASKS.md` for the complete task list.

## 🎯 Next Steps

**High Priority:**
1. Refine modal system based on user feedback
2. Add comprehensive form validation
3. Implement CSV preview functionality
4. Add loading states throughout the app
5. Create recipe detail modal

**Medium Priority:**
6. Mobile responsive testing and fixes
7. Implement recipe creation/editing
8. Add error boundary components
9. Build account settings page

See `Documentation/PROJECT_STATUS.md` for full implementation roadmap.

## 🤝 Related Projects

This is the new React version of AlcheMix. The original vanilla JS version is in `../cocktail-analysis/` and serves as the Express backend for this application.

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

- **Icons:** [Lucide React](https://lucide.dev/)
- **Fonts:** [Google Fonts](https://fonts.google.com/) (Space Grotesk, Inter)
- **Framework:** [Next.js](https://nextjs.org/)

---

**Built with ❤️ using Next.js 14 + TypeScript + Zustand**

**Current Version:** v1.1.0-alpha
**Last Updated:** November 7, 2025
