# AlcheMix - Next.js React App

Modern cocktail lab management system built with Next.js 14, TypeScript, and Zustand.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Server will start on http://localhost:3001
```

## 📋 Prerequisites

- Node.js >= 18.0.0
- **Express backend running on port 3000** (from the old `cocktail-analysis` project)

## 🏗️ Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **State Management:** Zustand
- **HTTP Client:** Axios
- **Styling:** CSS Modules + Global CSS Variables
- **Backend:** Express API (running separately on port 3000)

## 📁 Project Structure

```
alchemix-next/
├── src/
│   ├── app/                # Next.js App Router pages
│   │   ├── login/         # Login page
│   │   ├── dashboard/     # Dashboard page
│   │   ├── bar/           # My Bar (inventory)
│   │   ├── ai/            # AI Bartender
│   │   ├── recipes/       # Recipe library
│   │   └── favorites/     # Favorites & History
│   ├── components/
│   │   └── ui/            # Reusable UI components (Button, Card, Input)
│   ├── lib/
│   │   ├── api.ts         # API client (connects to Express)
│   │   └── store.ts       # Zustand store
│   ├── styles/
│   │   └── globals.css    # Design system variables
│   └── types/
│       └── index.ts       # TypeScript types
└── public/
    └── logo.png           # AlcheMix logo
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

**API Endpoints:**
- `POST /auth/login` - User login
- `POST /auth/signup` - User registration
- `GET /api/inventory` - Get bottles
- `POST /api/inventory` - Add bottle
- `GET /api/recipes` - Get recipes
- `POST /api/messages` - AI chat

## 📦 Features

**MVP (Phase 1):**
- ✅ Design system setup
- ✅ Core UI components (Button, Card, Input)
- ✅ Zustand state management
- ✅ API client with Axios
- ✅ TypeScript types
- 🚧 Login page
- 🚧 Dashboard
- 🚧 My Bar (inventory table)
- 🚧 AI Bartender chat
- 🚧 Recipe library
- 🚧 Favorites

**Post-MVP:**
- 4-step CSV upload flow
- History tab with chat sessions
- Toast notifications
- Advanced filters
- Empty state illustrations

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

## ⚙️ Environment Variables

Create `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000
```

## 📝 Next Steps

1. Install dependencies: `npm install`
2. Start Express backend (from cocktail-analysis folder)
3. Run Next.js dev server: `npm run dev`
4. Build remaining pages (Login, Dashboard, etc.)
5. Test authentication flow
6. Implement all MVP features

## 🤝 Related Projects

This is the new React version of the AlcheMix app. The original vanilla JS version is in `../cocktail-analysis/` and will remain as a reference during migration.

---

**Built with Next.js 14 + TypeScript + Zustand**
