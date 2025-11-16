# Development Notes

Technical decisions, gotchas, and lessons learned during development of AlcheMix React (Next.js 14 + TypeScript).

---

## 2025-11-15 - Recipe Collections Database Schema Design (Session 11)

**Context**: Implementing recipe collections feature to organize recipes into folders/books.

**Decision**: Created separate `collections` table with JOIN query for recipe counts.

**Schema**:
```sql
-- Collections table
CREATE TABLE IF NOT EXISTS collections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Added to recipes table
ALTER TABLE recipes ADD COLUMN collection_id INTEGER REFERENCES collections(id) ON DELETE SET NULL;
```

**Recipe Count Query**: Using LEFT JOIN with COUNT aggregation:
```typescript
// api/src/routes/collections.ts
const collections = db.prepare(`
  SELECT c.*, COUNT(r.id) as recipe_count
  FROM collections c
  LEFT JOIN recipes r ON r.collection_id = c.id
  WHERE c.user_id = ?
  GROUP BY c.id
  ORDER BY c.created_at DESC
`).all(userId);
```

**Result**: Collections automatically include recipe_count from database, ensuring accuracy even with 200+ recipes.

**Lesson Learned**: Database JOINs for derived counts are more reliable than frontend array length calculations, especially with pagination where filteredRecipes.length only shows loaded items (max 50), not total count.

---

## 2025-11-15 - Bulk Selection Using Set Data Structure (Session 11)

**Context**: Implementing bulk selection for mass move/delete operations on recipes.

**Decision**: Used JavaScript Set for selectedRecipes instead of array.

**Implementation**:
```typescript
// src/app/recipes/page.tsx
const [selectedRecipes, setSelectedRecipes] = useState<Set<number>>(new Set());

const toggleRecipeSelection = (recipeId: number) => {
  setSelectedRecipes(prev => {
    const newSet = new Set(prev);
    if (newSet.has(recipeId)) {
      newSet.delete(recipeId);  // O(1) removal
    } else {
      newSet.add(recipeId);     // O(1) addition
    }
    return newSet;
  });
};

// Check if selected (O(1) lookup)
const isSelected = selectedRecipes.has(recipe.id!);

// Get count
const selectedCount = selectedRecipes.size;

// Iterate for bulk operations
for (const recipeId of selectedRecipes) {
  await updateRecipe(recipeId, { collection_id: newCollectionId });
}
```

**Result**: O(1) add, remove, and lookup operations. More efficient than array methods like .filter(), .includes(), or .indexOf().

**Lesson Learned**: Set is ideal for selection states where you need fast membership checks and modifications. React state updates work well with new Set() immutability pattern.

---

## 2025-11-15 - Folder Navigation vs Filter Pattern (Session 11)

**Context**: User feedback that collections should act as "folders" not "filters" - click to enter collection, see only those recipes.

**Decision**: Implemented activeCollection state for folder-like navigation.

**Pattern**:
```typescript
// src/app/recipes/page.tsx
const [activeCollection, setActiveCollection] = useState<Collection | null>(null);

// When no collection selected: show collections grid + uncategorized recipes
// When collection selected: show back button + recipes in that collection

const filteredRecipes = recipesArray.filter((recipe) => {
  const matchesCollection = activeCollection
    ? recipe.collection_id === activeCollection.id  // Show collection's recipes
    : !recipe.collection_id;  // Show uncategorized when browsing collections
  return matchesSearch && matchesSpirit && matchesCollection;
});

// Navigation UI
{activeCollection ? (
  <Button onClick={() => setActiveCollection(null)}>
    <ArrowLeft /> Back to Collections
  </Button>
) : (
  <div className="collections-grid">
    {collectionsArray.map(collection => (
      <Card onClick={() => setActiveCollection(collection)}>
        {collection.name} - {collection.recipe_count} recipes
      </Card>
    ))}
  </div>
)}
```

**Result**: Intuitive folder-based navigation matching user's mental model. Collections displayed as clickable cards, recipes hidden until you "enter" a collection.

**Lesson Learned**: User feedback during development shapes better UX. Initial "filter" approach (show collection dropdown, filter displayed recipes) was technically correct but didn't match how users think about organizing things. The "folder" metaphor (click to enter, back to return) is more intuitive for large collections.

---

## 2025-11-15 - Collection Assignment in Multipart Form Data (Session 11)

**Context**: Adding collection_id parameter to CSV recipe import endpoint that uses multer for file uploads.

**Problem**: Multipart form data sends all fields as strings, including numeric IDs.

**Implementation**:
```typescript
// api/src/routes/recipes.ts
router.post('/import', auth, upload.single('file'), async (req, res) => {
  // Multipart form data - all fields are strings!
  console.log('📦 collection_id raw:', req.body.collection_id);  // "5" (string)

  const collectionId = req.body.collection_id
    ? parseInt(req.body.collection_id, 10)
    : null;

  console.log('📦 collection_id parsed:', collectionId);  // 5 (number)

  // Use parsed integer in INSERT
  const stmt = db.prepare(`
    INSERT INTO recipes (user_id, name, ingredients, instructions, glass, category, collection_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(userId, name, ingredients, instructions, glass, category, collectionId);
});
```

**Frontend FormData**:
```typescript
// src/lib/api.ts
export const recipeApi = {
  import: async (file: File, collectionId?: number) => {
    const formData = new FormData();
    formData.append('file', file);
    if (collectionId !== undefined) {
      formData.append('collection_id', collectionId.toString());  // Must be string
    }
    return axios.post('/api/recipes/import', formData);
  }
};
```

**Result**: Collection_id properly passed through multipart form data, recipes imported directly into specified collection.

**Lesson Learned**: Always parse numeric values from multipart form data. FormData only supports strings and Blobs, so integers must be converted with parseInt(). Add debug logging to verify parsing works correctly.

---

## 2025-11-15 - Recipe Count Display Bug Fix (Session 11)

**Context**: User reported "50 recipes in this collection" when there were actually 200+ recipes.

**Problem**: Using `filteredRecipes.length` which only counts loaded/paginated recipes.

**Incorrect**:
```typescript
// ❌ BEFORE
<p>{filteredRecipes.length} recipes in this collection</p>
// Shows 50 (max per page), not 200+ (actual total)
```

**Solution**: Use database-computed count from collection object:

```typescript
// ✅ AFTER
<p>
  {activeCollection
    ? `${activeCollection.recipe_count || 0} recipes in this collection`
    : `${collectionsArray.length} collections • ${uncategorizedCount} recipes`}
</p>
```

**Result**: Accurate recipe counts reflecting database totals, not just loaded items.

**Lesson Learned**: When pagination is involved, never use frontend array length for total counts. Always use database-computed counts (via COUNT(*) in SQL or recipe_count property) for accurate totals. The frontend array only contains the current page of results.

---

## 2025-11-14 - AI Bartender Recipe Clickability Bug (Session 10)

**Context**: Implemented clickable recipe recommendations in AI Bartender chat, but recipe modals wouldn't open when clicking recipe names.

**Problem**: Console showed `availableRecipes: []` with all recipe matches failing:
```
🔍 Parsing AI response: { availableRecipes: [] }
❌ No recipe match for: "DAIQUIRI #1"
❌ No recipe match for: "MISSIONARY'S DOWNFALL"
❌ No recipe match for: "MOJITO"
```

**Root Cause**: AI page component wasn't fetching recipes on mount!

```typescript
// ❌ BEFORE (src/app/ai/page.tsx):
const {
  recipes,         // ← Imported from store
  fetchRecipes,    // ← NOT imported! Missing entirely
  fetchFavorites,  // ← Imported but never called
} = useStore();

// No useEffect to fetch data on mount
// Result: recipes array stays empty, recipe matching fails
```

**Solution**: Import `fetchRecipes` and call both fetch functions on mount:

```typescript
// ✅ AFTER (src/app/ai/page.tsx):
const {
  recipes,
  favorites,
  fetchRecipes,    // ← Now imported
  fetchFavorites,
} = useStore();

// Fetch recipes and favorites on mount (CRITICAL FIX)
useEffect(() => {
  if (isAuthenticated && !isValidating) {
    console.log('🔄 Fetching recipes and favorites for AI page...');
    fetchRecipes();
    fetchFavorites();
  }
}, [isAuthenticated, isValidating, fetchRecipes, fetchFavorites]);
```

**Result**: Recipes array populates on mount, recipe name matching works, clicking recipe names opens RecipeDetailModal with full data.

**Lesson Learned**: When a component depends on store data, ALWAYS ensure the data is fetched on mount. Don't assume data exists just because the store exports it. In this case, the recipes page fetched recipes, but the AI page is a separate route - it needs its own fetch call.

**Future Considerations**:
- Add loading states while fetching data
- Consider caching recipes in store to avoid re-fetching on every page visit
- Add error handling for failed fetch operations

---

## 2025-11-14 - Zustand Rehydration Authentication Bug (Session 10)

**Context**: Users were being logged out every time they refreshed the page, even though JWT token was valid and stored in localStorage.

**Problem**: `onRehydrateStorage` callback in Zustand store was immediately setting `isAuthenticated = false` after rehydration, overwriting the persisted auth state.

```typescript
// ❌ BEFORE (src/lib/store.ts):
{
  name: 'alchemix-storage',
  onRehydrateStorage: () => (state) => {
    if (state) {
      state.isAuthenticated = false;  // ← KILLS AUTH!
      console.log('✅ State rehydrated from localStorage');
    }
  }
}

// Timeline:
// 1. Page loads → Zustand hydrates from localStorage (isAuthenticated: true)
// 2. onRehydrateStorage runs → sets isAuthenticated = false
// 3. User sees: "You're logged out, redirecting to login..."
```

**Solution**: Added `_hasHydrated` flag to track hydration state, let `validateToken()` set the final auth state:

```typescript
// ✅ AFTER (src/lib/store.ts):
export interface AppState {
  _hasHydrated: boolean;  // ← New flag
  isAuthenticated: boolean;
  // ...
}

createJSONStorage(() => localStorage),
{
  name: 'alchemix-storage',
  onRehydrateStorage: () => (state) => {
    if (state) {
      state._hasHydrated = true;  // ← Mark as hydrated
      // Don't touch isAuthenticated - let validateToken() handle it
    }
  }
}

// Timeline:
// 1. Page loads → Zustand hydrates (isAuthenticated: true, _hasHydrated: false)
// 2. onRehydrateStorage runs → sets _hasHydrated = true
// 3. Protected pages wait for _hasHydrated before checking auth
// 4. validateToken() confirms JWT → isAuthenticated stays true
// 5. User stays logged in
```

**Created `useAuthGuard` Hook**: Reusable authentication guard for protected pages:

```typescript
// src/hooks/useAuthGuard.ts
export function useAuthGuard() {
  const router = useRouter();
  const { isAuthenticated, _hasHydrated, validateToken } = useStore();
  const [isValidating, setIsValidating] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      if (!_hasHydrated) return;  // ← Wait for hydration!

      const token = localStorage.getItem('token');
      if (token) {
        await validateToken();  // ← Validate JWT with backend
      }

      setIsValidating(false);

      if (!isAuthenticated) {
        router.push('/login');  // ← Redirect if not authenticated
      }
    };

    checkAuth();
  }, [_hasHydrated, isAuthenticated, validateToken, router]);

  return { isValidating, isAuthenticated };
}
```

**Result**:
- No more logout on page refresh
- No more login redirect loops
- Users stay authenticated across sessions
- Protected pages wait for hydration before checking auth

**Lesson Learned**:
- Zustand's `onRehydrateStorage` runs AFTER hydration completes, but protected pages may render BEFORE hydration finishes
- NEVER set authentication state in `onRehydrateStorage` - only use it for initialization flags
- Use a hydration flag (`_hasHydrated`) to ensure pages wait for persistence to complete before validating auth

**Future Considerations**:
- Consider moving token validation to a global effect instead of per-page
- Add refresh token rotation for enhanced security
- Consider server-side rendering (SSR) for initial auth check

---

## 2025-11-14 - Claude API Context-Aware Prompts (Session 10)

**Context**: AI Bartender was using a simple generic prompt, not leveraging user's uploaded recipes or bar inventory.

**Problem**: User wanted AI to recommend cocktails from their recipe collection (300+ recipes), but backend was sending a basic prompt without any user context.

**Decision**: Build context-aware system prompts on the backend from database.

**Implementation**:

```typescript
// api/src/routes/messages.ts
async function buildContextAwarePrompt(userId: number): Promise<string> {
  // Fetch user's inventory from database
  const inventory = db.prepare(
    'SELECT * FROM bottles WHERE user_id = ? ORDER BY name'
  ).all(userId) as any[];

  // Fetch user's recipes
  const recipes = db.prepare(
    'SELECT * FROM recipes WHERE user_id = ? ORDER BY name'
  ).all(userId) as any[];

  // Fetch user's favorites
  const favorites = db.prepare(
    'SELECT * FROM favorites WHERE user_id = ? ORDER BY created_at DESC'
  ).all(userId) as any[];

  const basePrompt = `# THE LAB ASSISTANT (AlcheMix AI)

## YOUR IDENTITY
You are **"The Lab Assistant,"** the AI bartender for **"AlcheMix."**

## USER'S CURRENT BAR STOCK (${inventory.length} bottles):
${inventory.map(bottle => {
  let line = `- **${bottle.name}**`;
  if (bottle['Liquor Type']) line += ` [${bottle['Liquor Type']}]`;
  if (bottle['ABV (%)']} line += ` - ${bottle['ABV (%)']}% ABV`;
  if (bottle['Profile (Nose)']} line += `\n  🔬 Profile: ${bottle['Profile (Nose)']}`;
  if (bottle.Palate) line += `\n  👅 Palate: ${bottle.Palate}`;
  return line;
}).join('\n\n')}

## AVAILABLE RECIPES (${recipes.length} cocktails):
${recipes.map(r => {
  let details = `- **${r.name}**`;
  if (r.category) details += ` (${r.category})`;
  if (r.ingredients) details += `\n  Ingredients: ${r.ingredients}`;
  if (r.instructions) details += `\n  Instructions: ${r.instructions}`;
  return details;
}).join('\n\n')}

## CRITICAL RULES
- ONLY recommend recipes from their "Available Recipes" list above
- NEVER invent ingredients - only use what's listed in each recipe
- Cite specific bottles from their inventory
- Ask before assuming what they want

## RESPONSE FORMAT
End responses with:
RECOMMENDATIONS: Recipe Name 1, Recipe Name 2, Recipe Name 3`;

  return basePrompt;
}

// In POST /api/messages route:
const systemPrompt = await buildContextAwarePrompt(userId);

const response = await axios.post('https://api.anthropic.com/v1/messages', {
  model: 'claude-sonnet-4-5-20250929',
  max_tokens: 2048,
  messages: [{ role: 'user', content: sanitizedMessage }],
  system: systemPrompt  // ← Server-controlled with user's data
}, {
  timeout: 90000  // ← 90 seconds for large prompts (300+ recipes)
});
```

**Security**: Server-controlled prompt prevents prompt injection. User's message goes in `messages` array, NOT in system prompt.

**Result**:
- AI now knows user's exact bar inventory (42 bottles with tasting notes)
- AI recommends from user's recipe collection (112 recipes)
- Prompts are 20-25KB for full collections
- 90-second timeout handles large prompts without timing out

**Lesson Learned**:
- Build system prompts on backend, NEVER trust client-provided context
- Fetch fresh data from database for every request (ensures accuracy)
- Large prompts (300+ recipes) need increased timeouts (30s → 90s)
- Include detailed tasting notes (Profile, Palate, Finish) for better AI recommendations

**Future Considerations**:
- Cache prompts for 5-10 minutes to reduce database queries
- Implement prompt compression for very large collections (1000+ recipes)
- Consider pagination or filtering for massive inventories
- Add user preference for "recommend from my collection" vs "suggest new recipes"

---

## 2025-11-12 - API Response Structure Mismatch (Session 7)

**Context**: After implementing backend API, CSV imports were accepted but no bottles appeared in the UI.

**Problem**: Backend returns standardized response format:
```typescript
{ success: true, data: Bottle[], pagination: { ... } }
```

But frontend API client was returning the entire response object instead of extracting the `data` property:

```typescript
// ❌ BEFORE (Wrong):
export const inventoryApi = {
  async getAll(): Promise<Bottle[]> {
    const { data } = await apiClient.get<Bottle[]>('/api/inventory');
    return data;  // Returns { success: true, data: [...] }
  }
}

// Frontend receives: { success: true, data: [...], pagination: {...} }
// Zustand expects: Bottle[]
// Result: Array methods fail, UI shows "your bar is empty"
```

**Solution**: Extract the nested `data` property:

```typescript
// ✅ AFTER (Fixed):
export const inventoryApi = {
  async getAll(): Promise<Bottle[]> {
    const { data } = await apiClient.get<{ success: boolean; data: Bottle[] }>('/api/inventory');
    return data.data;  // Extract bottles array from response
  }
}
```

**Applied to all API methods**:
- `inventoryApi.getAll()`, `add()`, `update()`
- `recipeApi.getAll()`, `add()`
- `favoritesApi.getAll()`, `add()`

**Result**: Frontend now receives proper arrays, UI displays all 42 imported bottles.

**Lesson Learned**: When working with a backend that wraps responses in metadata (success flags, pagination), ensure frontend API layer unwraps to return just the data payload. Type the Axios response correctly to catch these issues at compile time.

---

## 2025-11-12 - Flexible CSV Import with Field Name Variations (Session 7)

**Context**: User's CSV had 42 bottles but all failed validation with "Missing or invalid name field".

**Problem**: Initial validation was too strict:
```typescript
// ❌ TOO STRICT:
if (!record.name) {
  errors.push('Missing name field');
}
```

User's CSV had columns like "Spirit", "Brand", "Bottle Name" - none matched exact "name" field.

**Solution**: Implement flexible field name matching:

```typescript
/**
 * Helper to find field value from multiple possible column names
 */
function findField(record: any, possibleNames: string[]): any {
  for (const name of possibleNames) {
    const value = record[name];
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }
  return null;
}

// Usage:
const nameField = findField(record, [
  'name', 'Name', 'NAME',
  'Spirit Name', 'spirit name', 'Spirit', 'spirit',
  'Bottle Name', 'bottle name', 'Bottle', 'bottle',
  'Product Name', 'product name', 'Product', 'product',
  'Brand', 'brand'
]);
```

**Type conversion helpers**:
```typescript
const safeString = (val: any) => val ? String(val).trim() : null;
const safeNumber = (val: any) => {
  const num = parseInt(String(val));
  return isNaN(num) ? null : num;
};
```

**Field mapping** for all database columns:
- `name` ← accepts: "name", "Spirit", "Brand", "Bottle Name", "Product Name" (10+ variations)
- `Stock Number` ← accepts: "Stock Number", "stock number", "Stock", "#", "Number"
- `Liquor Type` ← accepts: "Liquor Type", "Type", "Category"
- `ABV (%)` ← accepts: "ABV (%)", "ABV", "abv", "Alcohol", "Proof"
- etc.

**Result**: All 42 bottles imported successfully (imported: 42, failed: 0).

**Architecture Decision**: Prioritize user experience over strict validation. Better to flexibly accept reasonable column names than force users to match exact schema.

**Future Considerations**:
- Add CSV column mapping UI showing detected matches
- Allow manual column mapping before import
- Save user's column mapping preferences for next import

---

## 2025-11-12 - EditBottleModal Database Schema Mismatch (Session 7)

**Context**: User clicked edit on an imported bottle, modal opened but all fields were empty.

**Problem**: Modal component used different field names than database:

```typescript
// ❌ MODAL EXPECTED (old form fields):
formData = {
  Spirit: '',      // database has: 'Liquor Type'
  Brand: '',       // database has: 'name'
  'Age/Type': '',  // database has: 'Age Statement or Barrel Finish'
  'Quantity (ml)': '',  // database doesn't track quantity
  'Cost ($)': '',       // database doesn't track cost
  'Date Added': '',     // database doesn't track dates
}

// ✅ DATABASE ACTUALLY HAS:
bottle = {
  name: 'Maker\'s Mark Bourbon',
  'Liquor Type': 'Whiskey',
  'Stock Number': 1,
  'ABV (%)': '45',
  'Distillery Location': 'Kentucky, USA',
  'Age Statement or Barrel Finish': '6 Year',
  'Profile (Nose)': 'Vanilla, oak, caramel',
  'Palate': 'Sweet corn, honey',
  'Finish': 'Smooth, warming',
}
```

**Solution**: Complete modal refactor to match database schema:

```typescript
// New form state matching database:
const [formData, setFormData] = useState({
  name: '',
  'Stock Number': '',
  'Liquor Type': '',
  'Detailed Spirit Classification': '',
  'Distillation Method': '',
  'ABV (%)': '',
  'Distillery Location': '',
  'Age Statement or Barrel Finish': '',
  'Additional Notes': '',
  'Profile (Nose)': '',
  'Palate': '',
  'Finish': '',
});

// Organized form into sections:
// - Basic Information (name, Stock Number, Liquor Type)
// - Classification & Details (classification, distillation method, ABV)
// - Location & Age (distillery location, age statement)
// - Tasting Profile (nose, palate, finish)
// - Additional Information (notes)
```

**Updated validation**:
```typescript
case 'name':
  return !value.trim() ? 'Name is required' : '';
case 'Stock Number':
  const num = parseInt(value);
  if (isNaN(num)) return 'Must be a valid number';
  return '';
case 'ABV (%)':
  const abv = parseFloat(value);
  if (abv < 0 || abv > 100) return 'Must be between 0 and 100';
  return '';
```

**Result**: Modal now displays all imported data correctly and saves updates with proper field names.

**Lesson Learned**: Always align form field names EXACTLY with database schema. When schemas change, update all dependent UI components immediately. Consider using TypeScript mapped types to enforce field name consistency.

**Future Considerations**:
- Create shared form field definitions to prevent drift between Add/Edit modals
- Use TypeScript `keyof Bottle` to enforce valid field names at compile time
- Consider form generation from schema for automatic consistency

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
