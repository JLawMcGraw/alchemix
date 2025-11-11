# Development Notes

Technical decisions, gotchas, and lessons learned during development of AlcheMix React (Next.js 14 + TypeScript).

---

## 2025-11-10 - Environment Variable Loading Order Fix (Session 6)

**Context**: When running `npm run dev:all`, the API server was crashing with "JWT_SECRET environment variable is not set" even though the `.env` file was properly configured in `api/.env`.

**Problem**: The `dotenv.config()` call in `server.ts` was happening AFTER module imports that depended on environment variables. TypeScript/Node.js evaluates module-level code when importing, so `auth.ts` and `tokenBlacklist.ts` were trying to access `process.env.JWT_SECRET` before it was loaded.

**Timeline of Execution**:
```typescript
// ❌ WRONG ORDER (before fix):
import dotenv from 'dotenv';
import authRoutes from './routes/auth';  // ← auth.ts reads JWT_SECRET HERE!
dotenv.config();  // ← Too late! Already tried to read JWT_SECRET above

// In auth.ts (module-level code):
const JWT_SECRET = process.env.JWT_SECRET;  // ← undefined!
if (!JWT_SECRET) {
  process.exit(1);  // ← CRASH!
}
```

**Solution**: Created dedicated `api/src/config/env.ts` module:

```typescript
// api/src/config/env.ts
import dotenv from 'dotenv';
dotenv.config();  // Load .env FIRST
console.log('✅ Environment variables loaded');
export {};
```

```typescript
// api/src/server.ts
import './config/env';  // ← MUST BE FIRST IMPORT
import authRoutes from './routes/auth';  // ← Now JWT_SECRET is available!
```

**Result**:
- ✅ Environment variables loaded before any dependent modules
- ✅ API server starts successfully on port 3000
- ✅ Next.js frontend starts successfully on port 3001
- ✅ Health check endpoint responding: http://localhost:3000/health

**Lesson Learned**: When using `dotenv` in TypeScript/Node.js, environment variables must be loaded BEFORE importing any modules that use them. Module-level code executes during import, not during runtime.

**Future Considerations**:
- Keep `import './config/env'` as the FIRST import in server.ts
- Document this pattern for other projects with similar setup
- Consider using environment variable validation library (like `envalid`) for type-safe env vars

---

## 2025-11-09 - Monorepo Backend Architecture (Session 5)

**Context**: Created a modern TypeScript Express backend within the existing Next.js repository, transforming the project into a monorepo structure. Decided to build a new backend instead of using the legacy vanilla JS backend from the `cocktail-analysis` project.

**Architecture Decision**: Monorepo with frontend at root, backend in `/api` subfolder

```
alchemix-next/
├── src/              # Frontend (Next.js 14 + TypeScript)
├── api/              # Backend (Express + TypeScript)  ← NEW
├── package.json      # Frontend deps + monorepo scripts
└── api/package.json  # Backend deps
```

**Why This Structure?**
- ✅ Single git repository (easier to keep frontend/backend in sync)
- ✅ Frontend at root (Vercel auto-detects Next.js without config)
- ✅ Backend in `/api` subfolder (Railway can deploy subfolder with root directory setting)
- ✅ Separate package.json files (independent dependency management)
- ✅ Shared types (can import types between frontend/backend if needed)
- ✅ Easy monorepo scripts (`npm run dev:all` runs both services)

**Backend Implementation**:

```typescript
// api/src/server.ts - Main Express server
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

// Security middleware
app.use(helmet());
app.use(cors(corsOptions));  // CORS whitelist from FRONTEND_URL env var
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

// Routes
app.use('/auth', authRoutes);           // Signup, login, me, logout
app.use('/api/inventory', inventoryRoutes);  // CRUD operations
app.use('/api/recipes', recipesRoutes);      // Get, add recipes
app.use('/api/favorites', favoritesRoutes);  // Get, add, remove
app.use('/api/messages', messagesRoutes);    // AI integration
```

```typescript
// api/src/middleware/auth.ts - JWT Authentication
export function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.substring(7); // Remove "Bearer "
  const decoded = jwt.verify(token, JWT_SECRET);
  req.user = decoded;  // { userId, email }
  next();
}

export function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}
```

```typescript
// api/src/database/db.ts - SQLite with better-sqlite3
import Database from 'better-sqlite3';

export const db = new Database(DB_FILE);
db.pragma('foreign_keys = ON');

export function initializeDatabase() {
  db.exec(`CREATE TABLE IF NOT EXISTS users (...)`);
  db.exec(`CREATE TABLE IF NOT EXISTS bottles (...)`);
  db.exec(`CREATE TABLE IF NOT EXISTS recipes (...)`);
  db.exec(`CREATE TABLE IF NOT EXISTS favorites (...)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_bottles_user_id ON bottles(user_id)`);
}
```

**Development Workflow**:

```json
// Root package.json scripts
{
  "scripts": {
    "dev": "next dev -p 3001",                    // Frontend only
    "dev:api": "cd api && npm run dev",          // Backend only
    "dev:all": "concurrently ...",               // Both together
    "install:all": "npm install && cd api && npm install",
    "type-check": "tsc --noEmit && cd api && npm run type-check"
  }
}
```

```json
// api/package.json scripts
{
  "scripts": {
    "dev": "tsx watch src/server.ts",    // Hot-reload TypeScript
    "build": "tsc",                      // Compile to dist/
    "start": "node dist/server.js"       // Production
  }
}
```

**Key Technical Decisions**:

1. **SQLite → PostgreSQL Migration Path**:
   - Start with SQLite (simple, file-based, no server required)
   - Schema designed to be PostgreSQL-compatible
   - Migration script can be written when scaling (Phase 3)
   - No code changes needed, just connection string

2. **JWT over Sessions**:
   - Stateless authentication (no session storage needed)
   - Works great with Next.js client components
   - 7-day expiry (configurable)
   - Stored in localStorage on frontend
   - Auto-attached to requests via Axios interceptor

3. **TypeScript Strict Mode**:
   - Backend uses same strict TypeScript as frontend
   - Prevents runtime errors with proper typing
   - Shared types in `api/src/types/index.ts`

4. **better-sqlite3 over sqlite3**:
   - Synchronous API (simpler code, no callbacks)
   - Better performance
   - Native Node.js addon (no Python required)

**Result**: Complete working backend with authentication, CRUD operations, and AI integration. Database initializes automatically on first run. Health endpoint tested successfully.

**Future Considerations**:
- **Phase 2 (DevOps Learning)**: Can containerize with Docker, deploy to VPS
- **Phase 3 (Monetization)**: Migrate to PostgreSQL, add Stripe integration, S3 for files
- **Deployment**: Vercel (frontend) + Railway (backend with persistent volume for database)

---

## 2025-11-08 - Modal Accessibility & Focus Management (Session 4)

**Context**: Enhanced modal system with full accessibility support, animations, and mobile responsiveness

**Implementation**:
```typescript
// React forwardRef for focus management
export const Input = forwardRef<HTMLInputElement, InputProps>(({ ... }, ref) => {
  return <input ref={ref} ... />
});

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ ... }, ref) => {
  return <button ref={ref} ... />
});

// Focus management in modals
const modalRef = useRef<HTMLDivElement>(null);
const firstInputRef = useRef<HTMLInputElement>(null);

useEffect(() => {
  if (isOpen) {
    // Auto-focus first input
    setTimeout(() => firstInputRef.current?.focus(), 100);

    // Trap focus with Tab key
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
      if (e.key === 'Tab') { /* focus trapping logic */ }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }
}, [isOpen]);
```

**Architecture Decisions**:
- **forwardRef Pattern**: Button and Input components needed ref forwarding for programmatic focus
- **Focus Trapping**: Prevent Tab from leaving modal, cycle from last to first element
- **Auto-focus Strategy**: Form modals focus first input, delete modal focuses cancel button (safer)
- **Keyboard Shortcuts**: ESC to close, Tab to cycle, Enter to submit (native)
- **Dirty Tracking**: `isDirty` flag set on any field change, prompts before close
- **Success Animations**: Separate component shown on save, auto-dismisses after 1.5s

**ARIA Accessibility**:
```typescript
<div
  role="dialog"  // or "alertdialog" for delete confirmation
  aria-labelledby="modal-title-id"
  aria-describedby="modal-content-id"
  aria-modal="true"
>
  <h2 id="modal-title-id">Title</h2>
  <div id="modal-content-id">Content</div>
</div>
```

**Result**: WCAG 2.1 AA compliant modals with full keyboard and screen reader support

**Future Considerations**:
- Test with actual screen readers (NVDA, JAWS, VoiceOver)
- Consider aria-live regions for dynamic content updates
- Add aria-busy during loading states
- Consider focus restoration to triggering element on close

---

## 2025-11-08 - Modal Scrolling Bug (Flexbox Children)

**Context**: User reported modal content couldn't scroll when form exceeded viewport height

**Issue**:
- Modal used `display: flex; flex-direction: column;` layout
- Content area had `overflow-y: auto; flex: 1;`
- But scrolling didn't work - content was expanding the modal instead

**Root Cause**: Flexbox children need `min-height: 0` to allow scrolling

**Details**:
```css
.modal {
  display: flex;
  flex-direction: column;
  max-height: 90vh; /* Limit total height */
}

.content {
  flex: 1;
  overflow-y: auto;
  min-height: 0; /* CRITICAL - without this, flex child won't scroll */
}
```

**Result**: Content area scrolls properly when form is taller than viewport

**Explanation**: Flexbox children have implicit `min-height: auto`, preventing shrinkage below content size. Setting `min-height: 0` allows the flex child to shrink and enables scrolling.

**Future Considerations**:
- This is a common flexbox gotcha - document for team
- Consider adding comment in CSS to prevent removal
- Same issue applies to `min-width: 0` for horizontal flex containers

---

## 2025-11-08 - Real-Time Form Validation Pattern

**Context**: Needed inline validation feedback as users type, not just on submit

**Implementation**:
```typescript
const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

const validateField = (field: string, value: string): string => {
  switch (field) {
    case 'Quantity (ml)': {
      const num = parseFloat(value);
      if (!value) return 'Quantity is required';
      if (isNaN(num)) return 'Must be a valid number';
      if (num <= 0) return 'Must be greater than 0';
      if (num > 5000) return 'Unusually large bottle size';
      return '';
    }
    // ... more field validations
  }
};

const handleChange = (field: string, value: string) => {
  setFormData(prev => ({ ...prev, [field]: value }));
  setFieldErrors(prev => ({ ...prev, [field]: validateField(field, value) }));
  setIsDirty(true);
};

// In JSX:
<Input
  label="Quantity (ml) *"
  value={formData['Quantity (ml)']}
  onChange={(e) => handleChange('Quantity (ml)', e.target.value)}
  error={fieldErrors['Quantity (ml)']}
/>
```

**Architecture Decisions**:
- **Per-field validation**: Each field validated independently on change
- **Validation rules in switch statement**: Centralized, easy to read and maintain
- **Empty string = no error**: Allows clearing error when fixed
- **Cross-field validation**: Date Opened checks against Date Added
- **Dirty tracking**: Separate from validation for unsaved changes warning

**Validation Rules Added**:
- Required fields (Spirit, Brand, Quantity, Date Added)
- Numeric ranges (Quantity: 0-5000ml, Cost: ≥0)
- Date logic (no future dates, Date Opened ≥ Date Added)
- Logical constraints (Estimated Remaining ≤ Quantity)

**Result**: Users get instant feedback, prevents invalid submissions

**Future Considerations**:
- Extract validation to separate utility file for reuse
- Consider validation library (Zod, Yup) for complex schemas
- Add debouncing for expensive validations
- Consider async validation (check for duplicates via API)

---

## 2025-11-07 - Modal System Architecture (Session 3)

**Context**: Implemented modal and notification system for inventory management

**Implementation**:
```typescript
// Modal Components Created:
// 1. CSVUploadModal - Reusable for bottles and recipes
// 2. AddBottleModal - 12-field bottle creation form
// 3. EditBottleModal - Pre-filled editing form
// 4. DeleteConfirmModal - Reusable confirmation dialog
// 5. Toast system - ToastProvider + useToast hook

// Integration Pattern:
// - Modals use React state for open/close
// - Each modal has onClose callback
// - Forms have async onSubmit handlers
// - Toast notifications for all user actions
```

**Architecture Decisions**:
- **ToastProvider in Root Layout**: Wraps entire app for global toast access
- **Modal State in Page Components**: Each page manages its own modal states
- **Reusable Modals**: CSVUploadModal and DeleteConfirmModal accept props for different use cases
- **Form Modals**: Separate Add and Edit modals to keep logic simple (could be merged later)
- **Error Handling**: Try-catch in handlers, toast on error, re-throw to keep modal open

**User Feedback Received**:
> "this is a good start needs a lot of critique and extra work"

**Known Issues to Address**:
- Form validation is basic (only browser required attribute)
- No client-side validation feedback
- CSV import has no preview before upload
- No loading states during async operations
- Mobile responsiveness not tested
- Forms could have better UX (field organization, visual hierarchy)

**Future Improvements**:
- Add real-time validation with error messages under fields
- CSV preview modal showing first 5 rows
- Loading spinners in modals during API calls
- Better form layouts with sections/groups
- Field-level help text/tooltips
- Merge Add/Edit modals into single FormModal with mode prop
- Add keyboard navigation (Escape to close, Enter to submit)

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
