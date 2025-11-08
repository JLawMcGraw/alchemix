# Development Notes

Technical decisions, gotchas, and lessons learned during development of AlcheMix React (Next.js 14 + TypeScript).

---

## 2025-11-07 - Node.js v24 Incompatibility with better-sqlite3

**Context**: Attempted to install backend dependencies on new PC with Node.js v24.11.0

**Issue**:
- better-sqlite3 failed to compile with node-gyp errors
- Python 3.14 missing `distutils` module (removed in Python 3.12+)
- No prebuilt binaries available for Node.js v24

**Decision**: Downgraded to Node.js v20.19.5 LTS

**Details**:
```bash
# Uninstall Node.js v24 via Windows Settings
# Download and install Node.js v20.19.5 LTS from nodejs.org
# Verify installation
node --version  # v20.19.5
npm --version   # 10.8.2

# Install dependencies successfully
cd C:\Users\jlawr\Desktop\DEV\cocktail-analysis
npm install  # Success!
```

**Result**: All dependencies installed successfully, backend server starts correctly

**Future Considerations**:
- Stick with Node.js LTS versions for production
- better-sqlite3 may not support bleeding-edge Node versions immediately
- Consider migrating to @prisma/client or other ORMs for better compatibility

---

## 2025-11-07 - CORS Configuration for Next.js Frontend

**Context**: Frontend on port 3001 couldn't communicate with Express backend on port 3000

**Issue**:
- Express CORS configured for `http://localhost:5173` (old Vite frontend)
- Next.js on port 3001 being blocked
- Signup/login requests returning CORS errors

**Decision**: Added FRONTEND_URL environment variable to backend .env

**Details**:
```env
# C:\Users\jlawr\Desktop\DEV\cocktail-analysis\.env
JWT_SECRET=ae97ffa0970760aad2777e5bc67c384e654a346f59c877d5852c468f08c62471
PORT=3000
FRONTEND_URL=http://localhost:3001
```

```javascript
// server/server.cjs already had:
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
```

**Result**: CORS headers now allow Next.js frontend, authentication works

**Future Considerations**:
- For production, set FRONTEND_URL to actual domain
- Consider wildcard for development if using multiple ports
- Keep credentials: true for cookie-based auth

---

## 2025-11-07 - Array Initialization Bug in Zustand Store

**Context**: Pages crashed with "bottles.filter is not a function" on initial load

**Issue**:
- Zustand store initializes with empty arrays: `bottles: []`
- But on first render before `fetchBottles()` completes, React reads store
- Store persistence was returning `undefined` for some properties
- `.map()`, `.filter()`, `.slice()` called on `undefined` crashed the app

**Decision**: Added defensive `Array.isArray()` checks in all page components

**Details**:
```typescript
// BAD - crashes if bottles is undefined
const lowStockCount = bottles.filter(b => b['Quantity (ml)'] < 200).length;

// GOOD - always safe
const bottlesArray = Array.isArray(bottles) ? bottles : [];
const lowStockCount = bottlesArray.filter(b => b['Quantity (ml)'] < 200).length;
```

Applied to:
- Dashboard: `bottlesArray`, `recipesArray`, `favoritesArray`
- My Bar: `bottlesArray`
- Recipes: `recipesArray`, `favoritesArray`
- Favorites: `favoritesArray`, `chatArray`
- AI: `chatArray`

**Result**: All pages load without errors, gracefully handle empty states

**Future Considerations**:
- Consider TypeScript utility type to enforce array types
- Add loading states to show spinner while fetching
- Investigate why Zustand persistence returns undefined (may be expected behavior)

---

## 2025-11-07 - Lucide React Icon Integration

**Context**: User feedback that emoji icons looked unprofessional

**Decision**: Replaced all emoji with Lucide React SVG icons

**Details**:
```bash
npm install lucide-react
```

```typescript
// TopNav.tsx
import { Home, Wine, Sparkles, BookOpen, Star, LogOut } from 'lucide-react';

// Usage
<Wine size={18} />
<Star size={20} fill={isFavorited ? 'currentColor' : 'none'} />
```

Icons used:
- `Home` - Dashboard nav
- `Wine` - My Bar nav and bottle icons
- `Sparkles` - AI Bartender
- `BookOpen` - Recipes
- `Star` - Favorites (with fill state)
- `LogOut` - User menu
- `Upload` - Import CSV buttons
- `Plus` - Add buttons
- `Edit2` - Edit actions
- `Trash2` - Delete actions
- `X` - Close/remove
- `User` - User messages
- `Send` - Send message
- `Martini` - Empty states and recipe cards

**Result**: Professional, scalable icons with consistent styling

**Future Considerations**:
- Lucide has 1000+ icons if we need more
- Icons are tree-shakeable (only imported icons are bundled)
- Can customize size, color, strokeWidth per instance
- Consider creating icon wrapper component for consistent sizing

---
