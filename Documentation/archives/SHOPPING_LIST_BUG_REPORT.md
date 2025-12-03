# Shopping List Ingredient Matching Bug - Comprehensive Report

**Date**: 2025-11-25
**Severity**: CRITICAL - Feature non-functional
**Status**: BLOCKED - Code correct but not loading

---

## Executive Summary

Implemented comprehensive ingredient parsing improvements for the smart shopping list feature. All code changes are verified correct in both TypeScript source and compiled JavaScript. All 301 unit tests pass. However, the changes do not take effect in the running application despite clearing all caches and restarting the server multiple times.

**Impact**: Users see unparsed ingredient names (e.g., "Drops Pernod", "Handful Of Crushed Ice") in near-miss recipes instead of the parsed names that should match their inventory.

---

## What Should Happen vs. What Is Happening

### Expected Behavior (Working in Tests)
1. Recipe ingredient: `"6 Drops Pernod"`
2. Parse to: `"pernod"`
3. Check synonyms: `["pastis", "absinthe"]`
4. Match against user's "Pernod" in inventory
5. Recipe marked as craftable ✅

### Actual Behavior (In Running App)
1. Recipe ingredient: `"6 Drops Pernod"`
2. Displays in UI: `"Drops Pernod"` (partially parsed? or different code path?)
3. Does NOT match user's "Pernod" in inventory
4. Recipe shows in "Near Misses" as missing "Drops Pernod" ❌

---

## Code Changes That Should Be Active (But Aren't)

### File: `api/src/routes/shoppingList.ts`

#### 1. Jamaican Rum Synonyms (Lines 63-69)
```typescript
// Dark/Gold/Aged rum variants
'gold rum': ['amber rum', 'aged rum', 'dark rum', 'gold puerto rican rum', 'gold jamaican rum'],
'amber rum': ['gold rum', 'aged rum', 'dark rum'],
'aged rum': ['gold rum', 'amber rum', 'dark rum'],
'dark rum': ['gold rum', 'amber rum', 'aged rum', 'gold puerto rican rum', 'gold jamaican rum', 'jamaican rum'],
'gold puerto rican rum': ['gold rum', 'dark rum', 'aged rum', 'amber rum'],
'gold jamaican rum': ['gold rum', 'dark rum', 'aged rum', 'amber rum', 'jamaican rum'],
'jamaican rum': ['dark rum', 'gold rum', 'gold jamaican rum'],
```

**Purpose**: "1 ounce gold Jamaican rum" should match any dark/gold rum in inventory

---

#### 2. Chambord Synonyms (Lines 115-118)
```typescript
// Liqueur equivalencies
'chambord': ['black raspberry liqueur', 'raspberry liqueur'],
'black raspberry liqueur': ['chambord', 'raspberry liqueur'],
'raspberry liqueur': ['chambord', 'black raspberry liqueur'],
```

**Purpose**: Chambord and "Black Raspberry Liqueur" should be interchangeable

---

#### 3. Fraction Parsing Fix (Lines 168-186)
```typescript
// IMPORTANT: Order matters! Match fractions BEFORE simple numbers

// Remove mixed fractions: "2 1/2 oz"
normalized = normalized.replace(/^\d+\s+\d+\s*\/\s*\d+\s*(ounces?|oz|ml|cl|l|tsp|tbsp|cups?)?/i, '').trim();

// Then remove simple ASCII fractions: "1/2 oz", "3/4 ounce"
normalized = normalized.replace(/^\d+\s*\/\s*\d+\s*(ounces?|oz|ml|cl|l|tsp|tbsp|cups?)?/i, '').trim();

// Remove complex patterns: "8 ounces (1 cup)"
normalized = normalized.replace(/^\d+\s*(ounces?|oz|ml|cl|l|tsp|tbsp|cups?)\s*\([^)]+\)\s*/i, '').trim();

// Remove number ranges: "4 to 6 mint leaves" -> "mint leaves"
// IMPORTANT: Must come BEFORE decimal number removal
normalized = normalized.replace(/^\d+\s+to\s+\d+\s*/i, '').trim();

// Remove decimal numbers with word boundary
// IMPORTANT: Use word boundary \b after unit to prevent "2 l" from matching "2 lime"
normalized = normalized.replace(/^\d+\.?\d*\s*(ounces?|oz|ml|cl|liters?|l|tsp|tbsp|cups?|dashes|dash)\b/i, '').trim();
```

**Fixes**:
- "3/4 ounce fresh lime juice" → "lime juice" (was: "/4 lime juice")
- "2 lime wedges" → "lime wedges" (was: "ime wedges" - the "l" was being stripped!)
- "4 to 6 mint leaves" → "mint leaves" (was: "6 mint leaves")

---

#### 4. Aged Rum Detection (Line 289)
```typescript
// Special handling: Detect aged rum indicators after brand removal
// "Bacardi 8" -> "8 rum" should become "dark rum"
// "Havana Club 7" -> "7" should become "dark rum"
// Pattern: standalone number or Spanish age terms, optionally followed by "rum"
if (/^(añejo|anejo|reserva|\d+)(\s+rum)?$/.test(normalized)) {
  normalized = 'dark rum';
}
```

**Purpose**: "1 1/2 ounces Bacardi 8 rum" → parses to "8 rum" or "8" → converts to "dark rum"

---

## Verification Steps Taken

### 1. Source Code Verification ✅
```bash
cd api
grep -n "(\s+rum)?" src/routes/shoppingList.ts
# Output: Line 289 contains the regex (correct)

grep "liters.*dash.*\\b" src/routes/shoppingList.ts
# Output: Shows word boundary in decimal regex (correct)
```

### 2. Compiled JavaScript Verification ✅
```bash
cd api/dist/routes
grep -A2 "añejo.*rum.*test" shoppingList.js
# Output: Compiled code contains correct regex

grep "liters.*dash.*\\\\b" shoppingList.js
# Output: Word boundary present in compiled code
```

### 3. Unit Tests ✅
```bash
cd api
npm test
# Output: ✅ 301/301 tests passing
```

### 4. Isolation Tests ✅
Created standalone test scripts that import the parsing logic:
- "6 Drops Pernod" → "pernod" ✅
- "A Handful of Crushed Ice" → "ice" ✅
- "1 1/2 ounces Bacardi 8 rum" → "dark rum" ✅
- "3/4 ounce fresh lime juice" → "lime juice" ✅

**All parsing works perfectly in isolation!**

### 5. Cache Clearing Attempts ❌
```bash
# Cleared TSX cache
rm -rf api/node_modules/.tsx api/node_modules/.cache

# Cleared compiled output
rm -rf api/dist

# Rebuilt
cd api && npm run build

# Server restarted multiple times
# Browser hard refresh (Ctrl+Shift+R)
```

**Result**: No change in application behavior

---

## Technical Details

### Architecture
- **Frontend**: Next.js 14 (React) on port 3000
- **Backend**: Express + TypeScript on port 3001
- **Dev Server**: `tsx watch src/server.ts` (runs TypeScript directly, no compilation)
- **Production Build**: `tsc` compiles to `dist/` folder

### Data Flow
1. Frontend fetches: `GET /api/shopping-list/smart` (authenticated)
2. Backend route: `api/src/routes/shoppingList.ts` line 602
3. Calls: `parseIngredientName(ingredient)` for each ingredient (line 478, 518)
4. Returns: `findMissingIngredients()` which pushes parsed names to array (line 548)
5. API response includes: `nearMissRecipes.map(r => ({ ..., missingIngredient: r.missingIngredients[0] }))`
6. Frontend displays: `{recipe.missingIngredient}` (line 520 of `src/app/shopping-list/page.tsx`)

### What User Sees
- Location: Shopping List page → Click "Near Misses" white box
- Display: Recipe cards showing "Missing: [ingredient name]"
- Problem: Shows "Drops Pernod" instead of "pernod"

### Database Evidence
Query showing actual ingredient strings in database:
```sql
SELECT id, name, ingredients FROM recipes WHERE user_id = 1 AND ingredients LIKE '%Pernod%';
```

Results:
- `"6 drops (1/8 teaspoon) Pernod Dash"`
- `"6 drops Pernod"`
- `"A handful of crushed ice"`

**These parse correctly in tests to**: "pernod", "pernod", "ice"

---

## Debugging Hypotheses

### Hypothesis 1: TSX Module Caching
**Theory**: `tsx watch` caches compiled modules in an undiscovered location

**Evidence**:
- TSX cache directories cleared: `node_modules/.tsx`, `node_modules/.cache`
- Server restarted multiple times
- Changes still not active

**Next Steps**:
- Try running from compiled dist: `node dist/server.js` instead of `tsx watch`
- Delete entire `node_modules` and reinstall (nuclear option)
- Check if TSX has other cache locations

### Hypothesis 2: Duplicate Function Definition
**Theory**: There might be two `parseIngredientName` functions and the old one is being called

**Evidence**:
- None found yet

**Next Steps**:
- Search entire codebase for duplicate function definitions:
  ```bash
  grep -rn "function parseIngredientName" api/src/
  grep -rn "const parseIngredientName" api/src/
  ```

### Hypothesis 3: Environment Variable or Config Issue
**Theory**: Some configuration is causing old code to be loaded

**Evidence**:
- None

**Next Steps**:
- Check if any environment variables affect module resolution
- Look for `.env` files that might change behavior

### Hypothesis 4: Frontend Caching/Transformation
**Theory**: Frontend is doing additional parsing that overrides backend

**Evidence**:
- Frontend has `parseIngredients()` function but it only converts JSON to array (line 168-177 of page.tsx)
- No evidence of ingredient name transformation on frontend

**Next Steps**:
- Add console.log to frontend to see what API actually returns
- Check browser Network tab to see raw API response

---

## Debugging Steps for Next Session

### Step 1: Add Trace Logging
Add console.log to verify function is being called:

```typescript
// In api/src/routes/shoppingList.ts, line 147
function parseIngredientName(ingredientStr: string): string | string[] {
  console.log(`[DEBUG parseIngredientName] Input: "${ingredientStr}"`);

  if (!ingredientStr || typeof ingredientStr !== 'string') {
    return '';
  }

  // ... rest of function ...

  console.log(`[DEBUG parseIngredientName] Output: "${normalized}"`);
  return normalized;
}
```

**Expected**: Should see console logs in terminal when API is called
**If no logs**: Function not being called (duplicate function issue)
**If logs show old behavior**: Module caching issue

### Step 2: Check for Duplicate Functions
```bash
cd api
grep -rn "function parseIngredientName" src/
grep -rn "parseIngredientName.*=.*function" src/
grep -rn "parseIngredientName.*=.*=>" src/
```

### Step 3: Try Running from Compiled Dist
```bash
cd api
npm run build
node dist/server.js
```

If this works, it confirms TSX caching issue.

### Step 4: Check Browser Network Tab
1. Open DevTools → Network tab
2. Click "Near Misses" in Shopping List
3. Find `/api/shopping-list/smart` request
4. Check response JSON → `nearMissRecipes[0].missingIngredient`

**Expected**: Should see "pernod"
**If seeing "Drops Pernod"**: Backend is returning wrong data (not parsing)
**If seeing "pernod"**: Frontend issue (unlikely based on code review)

### Step 5: Nuclear Option
```bash
cd api
rm -rf node_modules package-lock.json
npm install
npm run build
npm run dev
```

---

## Test Data for Reproduction

### User Inventory (User ID 1)
- Pernod (Type: Pastis, Classification: "Pastis (anise-flavored liqueur)")
- Cruzan Estate Diamond Dark Rum
- Grenadine (Classification: "Pomegranate Syrup")
- 46 total items in stock

### Problematic Recipes
1. **Beachcomber's Gold (Chicago)**
   - Ingredient: `"6 drops (1/8 teaspoon) Pernod Dash"`
   - Should parse to: `"pernod"`
   - Should match: User's Pernod ✅

2. **Derby Daiquiri**
   - Ingredient: `"A handful of crushed ice"`
   - Should parse to: `"ice"`
   - Should match: ALWAYS_AVAILABLE ✅

3. **Recipes with "Bacardi 8"** (hypothetical)
   - Ingredient: `"1 1/2 ounces Bacardi 8 rum"`
   - Should parse to: `"dark rum"`
   - Should match: User's dark rums ✅

---

## Code Files Reference

### Modified Files
1. **`api/src/routes/shoppingList.ts`** - Main parsing logic
   - Lines 52-119: SYNONYMS map
   - Lines 142-290: `parseIngredientName()` function
   - Lines 337-344: ALWAYS_AVAILABLE set
   - Lines 370-435: `hasIngredient()` matching logic
   - Lines 510-552: `findMissingIngredients()` function
   - Lines 602-810: `/api/shopping-list/smart` endpoint

2. **`api/src/routes/shoppingList.test.ts`** - Unit tests (301 passing)

3. **`api/src/tests/setup.ts`** - Test database schema

### Frontend Display
- **`src/app/shopping-list/page.tsx`**
  - Line 520: `{recipe.missingIngredient}` - Where ingredient is displayed
  - Line 200: Filters recipes by `recipe.missingIngredient === ingredient`

---

## Environment Info

- **OS**: Windows 11
- **Node.js**: v20.12.2
- **Package Manager**: npm
- **TypeScript**: 5.3.3
- **tsx**: Latest (via `npm run dev`)
- **Database**: SQLite (better-sqlite3)
- **Location**: `api/data/alchemix.db`

---

## Success Criteria

The bug is fixed when:
1. Navigate to Shopping List page
2. Click "Near Misses" white box
3. Recipe cards show "Missing: pernod" (lowercase, parsed)
4. Recipe cards show "Missing: ice" (not "Handful Of Crushed Ice")
5. Recipes with these ingredients are removed from Near Misses (because user has them)

---

## Additional Resources

### Run Tests
```bash
cd api
npm test
# Should show 301/301 passing
```

### Check Compiled Code
```bash
cd api/dist/routes
grep -A5 "function parseIngredientName" shoppingList.js
```

### View Database
```bash
cd api
node -e "
const db = require('better-sqlite3')('data/alchemix.db');
const recipes = db.prepare('SELECT name, ingredients FROM recipes WHERE user_id = 1 AND ingredients LIKE \"%Pernod%\" LIMIT 3').all();
console.log(JSON.stringify(recipes, null, 2));
db.close();
"
```

### Test Parsing in Isolation
```javascript
// Create: api/test_parsing.js
const testInput = "6 drops (1/8 teaspoon) Pernod Dash";
// Copy parseIngredientName function from shoppingList.ts
// Call it and console.log result
// Should output: "pernod"
```

---

## Contact for Help

When asking for help, provide:
1. This document
2. Output of: `cd api && npm test`
3. Output of: `cd api && grep -A2 "añejo.*rum.*test" dist/routes/shoppingList.js`
4. Screenshot of Shopping List page showing "Drops Pernod" in Near Misses
5. Browser DevTools Network tab screenshot of `/api/shopping-list/smart` response

---

## Timeline

- **Session Start**: Multiple ingredient matching issues reported
- **Code Changes**: Implemented comprehensive parsing improvements
- **Testing**: All 301 tests passing, isolation tests working
- **Problem Discovered**: Changes not loading in running application
- **Debugging Attempts**: Cache clearing, server restarts, code verification
- **Status**: BLOCKED - Need fresh perspective or deeper debugging

---

**Last Updated**: 2025-11-25
**Next Action**: Follow debugging steps above or seek assistance with module caching issue
