> **SUPERSEDED (2026-06-12):** Tasks 1–2 landed as commits c836555/4ffbd3b. Tasks 3–4 are superseded by docs/plans/2026-06-12-explore-fallback-review-fixes.md, which incorporates the 2026-06-12 code-review fixes.

# AI Explore Fallback Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Surface fresh craftable recipes when the user requests variety or when keyword search returns fewer than 3 recipes, eliminating the "I can only see what search surfaces" dead end.

**Architecture:** The AI bartender's recipe access is 100% gated behind keyword search. When a user says "show me something new" or "what haven't I tried?", there are no ingredient keywords to detect, so `ingredientMatchContext` is empty and Claude receives zero recipes. Fix this with two additions to `AIService`: (1) `detectExploreIntent()` recognises exploratory queries, (2) `getRandomCraftableSample()` queries 150 random recipes from the full DB and runs them through the existing craftability pipeline. Wire both into `buildContextAwarePrompt` as a final step that fires when the user wants variety OR when all prior search passes together returned fewer than 3 results.

**Tech Stack:** TypeScript, Express.js, PostgreSQL (`queryAll` from `../database/db`), Vitest

---

## Background: How the Search Pipeline Works

`buildContextAwarePrompt` (AIService.ts ~line 1136) assembles the system prompt sent to Claude for each message. The critical path for recipe suggestions:

1. Detect concept keywords ("tiki", "spirit-forward") → SQL lookup by cocktail name
2. Detect ingredient keywords ("rum", "lime") → SQL `LIKE '%rum%'` on `ingredients` column
3. If neither found, try extracting 4+ char words from query as potential ingredient terms
4. `processRecipesWithCraftability()` scores every matched recipe: ✅ CRAFTABLE / ⚠️ NEAR-MISS / ❌ MISSING
5. If craftable < 2 and concepts/ingredients were detected, run a "broader search" with fallback terms
6. Build `ingredientMatchContext` string — this is the **ALLOWED RECIPE LIST** Claude may recommend from

**The bug:** When a query has no ingredient or concept keywords ("what haven't I tried?"), steps 1–5 find nothing. `ingredientMatchContext` stays empty. Claude receives only the bar stock, zero recipes, and honestly says "I can only see what search surfaces." There is no fallback to sample random craftable recipes from the 800-recipe DB.

---

## Task 1: Add `detectExploreIntent` method

**Files:**
- Modify: `api/src/services/AIService.ts` — add private method after `detectIngredientFlexibility` (~line 340)
- Test: `api/src/services/AIService.test.ts` — add describe block

**Step 1: Write the failing tests**

Add this describe block inside the outer `describe('AIService', ...)`:

```typescript
describe('detectExploreIntent', () => {
  it('should detect "haven\'t tried" phrasing', () => {
    expect((aiService as any).detectExploreIntent("what haven't I tried?")).toBe(true);
    expect((aiService as any).detectExploreIntent("I haven't made many of these")).toBe(true);
    expect((aiService as any).detectExploreIntent("recipes I haven't had before")).toBe(true);
  });

  it('should detect "something new/different" phrasing', () => {
    expect((aiService as any).detectExploreIntent("show me something new")).toBe(true);
    expect((aiService as any).detectExploreIntent("I want something different")).toBe(true);
    expect((aiService as any).detectExploreIntent("anything fresh tonight")).toBe(true);
  });

  it('should detect "more options / what else" phrasing', () => {
    expect((aiService as any).detectExploreIntent("what else can I make?")).toBe(true);
    expect((aiService as any).detectExploreIntent("show me more options")).toBe(true);
    expect((aiService as any).detectExploreIntent("any other suggestions?")).toBe(true);
    expect((aiService as any).detectExploreIntent("there must be more I haven't had")).toBe(true);
  });

  it('should detect surprise / exploration phrasing', () => {
    expect((aiService as any).detectExploreIntent("surprise me")).toBe(true);
    expect((aiService as any).detectExploreIntent("more ideas please")).toBe(true);
    expect((aiService as any).detectExploreIntent("keep going")).toBe(true);
  });

  it('should NOT detect specific ingredient requests', () => {
    expect((aiService as any).detectExploreIntent("show me something with rum")).toBe(false);
    expect((aiService as any).detectExploreIntent("what tiki drinks can I make")).toBe(false);
    expect((aiService as any).detectExploreIntent("give me a daiquiri")).toBe(false);
    expect((aiService as any).detectExploreIntent("I want whiskey sours")).toBe(false);
  });
});
```

**Step 2: Run tests to confirm they fail**

```
cd api && npm run test:unit -- --reporter=verbose 2>&1 | grep -A 2 "detectExploreIntent"
```

Expected: `detectExploreIntent is not a function` or similar.

**Step 3: Implement the method**

Add this private method to `AIService` class, after `detectIngredientFlexibility` (around line 340):

```typescript
private detectExploreIntent(query: string): boolean {
  const lowerQuery = query.toLowerCase();

  const explorePatterns = [
    /haven'?t\s+(tried|made|had|seen|done)/i,
    /something\s+(new|different|else|fresh)/i,
    /anything\s+(new|different|else|fresh)/i,
    /what\s+else/i,
    /show\s+me\s+more/i,
    /more\s+options/i,
    /more\s+suggestions/i,
    /more\s+ideas/i,
    /more\s+recipes/i,
    /other\s+options/i,
    /any\s+other/i,
    /what\s+other/i,
    /surprise\s+me/i,
    /never\s+(tried|made|had)/i,
    /what\s+haven'?t\s+i/i,
    /new\s+to\s+me/i,
    /fresh\s+options/i,
    /anything\s+else/i,
    /there\s+must\s+be\s+more/i,
    /keep\s+going/i,
    /what\s+more/i,
  ];

  for (const pattern of explorePatterns) {
    if (pattern.test(lowerQuery)) {
      logger.info('[AI-EXPLORE] Detected explore intent', {
        pattern: pattern.toString(),
        query: lowerQuery.substring(0, 100),
      });
      return true;
    }
  }

  return false;
}
```

**Step 4: Run tests to confirm they pass**

```
cd api && npm run test:unit -- --reporter=verbose 2>&1 | grep -A 5 "detectExploreIntent"
```

Expected: all 5 test cases green.

**Step 5: Commit**

```
git add api/src/services/AIService.ts api/src/services/AIService.test.ts
git commit -m "feat(ai): add detectExploreIntent for variety/explore queries"
```

---

## Task 2: Add `getRandomCraftableSample` method

**Files:**
- Modify: `api/src/services/AIService.ts` — add private method after `getBroaderSearchTerms` (~line 876)
- Test: `api/src/services/AIService.test.ts`

**Step 1: Write the failing tests**

Add inside the outer `describe('AIService', ...)`:

```typescript
describe('getRandomCraftableSample', () => {
  afterEach(() => vi.restoreAllMocks());

  it('should return empty result when DB returns no recipes', async () => {
    const dbModule = await import('../database/db');
    vi.spyOn(dbModule, 'queryAll').mockResolvedValue([]);

    const result = await (aiService as any).getRandomCraftableSample(1, [], new Set(), 10);

    expect(result.processedRecipes).toHaveLength(0);
    expect(result.craftableCount).toBe(0);
    expect(result.nearMissCount).toBe(0);
    expect(result.formatted).toBe('');
  });

  it('should exclude names in the excludeNames set', async () => {
    const dbModule = await import('../database/db');
    const shoppingModule = await import('./ShoppingListService');

    const recipes = [
      { id: 1, user_id: 1, name: 'Daiquiri', category: 'Sour', ingredients: JSON.stringify(['rum', 'lime']), memmachine_uid: null },
      { id: 2, user_id: 1, name: 'Mojito', category: 'Highball', ingredients: JSON.stringify(['rum', 'mint', 'lime']), memmachine_uid: null },
    ];

    vi.spyOn(dbModule, 'queryAll').mockResolvedValue(recipes);
    vi.spyOn(shoppingModule.shoppingListService, 'isCraftable').mockReturnValue(true);
    vi.spyOn(shoppingModule.shoppingListService, 'findMissingIngredients').mockReturnValue([]);

    const excludeNames = new Set(['Daiquiri']);
    const result = await (aiService as any).getRandomCraftableSample(1, [{ name: 'Rum', liquorType: 'rum', detailedClassification: null }], excludeNames, 10);

    expect(result.processedRecipes).not.toContain('Daiquiri');
    expect(result.processedRecipes).toContain('Mojito');
  });

  it('should not return more recipes than the limit', async () => {
    const dbModule = await import('../database/db');
    const shoppingModule = await import('./ShoppingListService');

    const recipes = Array.from({ length: 30 }, (_, i) => ({
      id: i + 1, user_id: 1, name: `Recipe ${i + 1}`, category: 'Sour',
      ingredients: JSON.stringify(['rum', 'lime']), memmachine_uid: null,
    }));

    vi.spyOn(dbModule, 'queryAll').mockResolvedValue(recipes);
    vi.spyOn(shoppingModule.shoppingListService, 'isCraftable').mockReturnValue(true);
    vi.spyOn(shoppingModule.shoppingListService, 'findMissingIngredients').mockReturnValue([]);

    const result = await (aiService as any).getRandomCraftableSample(1, [{ name: 'Rum', liquorType: 'rum', detailedClassification: null }], new Set(), 5);

    expect(result.processedRecipes.length).toBeLessThanOrEqual(5);
  });

  it('should handle DB errors gracefully and return empty result', async () => {
    const dbModule = await import('../database/db');
    vi.spyOn(dbModule, 'queryAll').mockRejectedValue(new Error('DB connection failed'));

    const result = await (aiService as any).getRandomCraftableSample(1, [], new Set(), 10);

    expect(result.processedRecipes).toHaveLength(0);
    expect(result.formatted).toBe('');
  });
});
```

**Step 2: Run tests to confirm they fail**

```
cd api && npm run test:unit -- --reporter=verbose 2>&1 | grep -A 5 "getRandomCraftableSample"
```

Expected: `getRandomCraftableSample is not a function`.

**Step 3: Implement the method**

Add this private method after `getBroaderSearchTerms` (~line 876):

```typescript
private async getRandomCraftableSample(
  userId: number,
  userBottles: { name: string; liquorType: string | null; detailedClassification: string | null }[],
  excludeNames: Set<string>,
  limit: number = 20
): Promise<{ formatted: string; processedRecipes: string[]; craftableCount: number; nearMissCount: number }> {
  try {
    const randomRecipes = await queryAll<RecipeRecord>(`
      SELECT id, user_id, name, category, ingredients, memmachine_uid
      FROM recipes
      WHERE user_id = $1
      ORDER BY RANDOM()
      LIMIT 150
    `, [userId]);

    logger.info('[AI-EXPLORE] Random sample fetched', {
      total: randomRecipes.length,
      excluded: excludeNames.size,
    });

    const result = this.processRecipesWithCraftability(
      randomRecipes,
      userBottles,
      excludeNames,
      limit,
      null,  // no spirit type constraint for explore mode
      true,  // skipAlreadyRecommended — excludeNames handles the exclusion
      false,
      4,
      []
    );

    logger.info('[AI-EXPLORE] Random sample processed', {
      craftable: result.craftableCount,
      nearMiss: result.nearMissCount,
      total: result.processedRecipes.length,
    });

    return {
      formatted: result.formatted,
      processedRecipes: result.processedRecipes,
      craftableCount: result.craftableCount,
      nearMissCount: result.nearMissCount,
    };
  } catch (error) {
    logger.warn('[AI-EXPLORE] Random sample failed', { error });
    return { formatted: '', processedRecipes: [], craftableCount: 0, nearMissCount: 0 };
  }
}
```

**Step 4: Run tests to confirm they pass**

```
cd api && npm run test:unit -- --reporter=verbose 2>&1 | grep -A 5 "getRandomCraftableSample"
```

Expected: all 4 test cases green.

**Step 5: Commit**

```
git add api/src/services/AIService.ts api/src/services/AIService.test.ts
git commit -m "feat(ai): add getRandomCraftableSample for explore-mode recipe surfacing"
```

---

## Task 3: Wire explore fallback into `buildContextAwarePrompt`

This is the integration step. Two changes to `buildContextAwarePrompt`:

1. **Detect explore intent early** — before any async DB work, so we can use it in the fallback condition
2. **Add Step 3d** — after the broader search (Step 3c, ~line 1683), run the explore fallback when needed

**Files:**
- Modify: `api/src/services/AIService.ts` — two insertion points inside `buildContextAwarePrompt`
- Test: `api/src/services/AIService.test.ts`

**Step 1: Write the failing integration tests**

Add inside `describe('AIService', ...)`:

```typescript
describe('buildContextAwarePrompt explore fallback', () => {
  afterEach(() => vi.restoreAllMocks());

  it('should include explore recipes when query has no keywords and DB has craftable recipes', async () => {
    const dbModule = await import('../database/db');
    const shoppingModule = await import('./ShoppingListService');

    // Inventory has rum
    const inventory = [{ id: 1, user_id: 1, name: 'Plantation 3 Stars', type: 'Rum', stock_number: 1, spirit_classification: null, profile_nose: null, palate: null, finish: null, abv: '41' }];
    // DB has 5 craftable rum recipes but query has no keywords
    const recipes = Array.from({ length: 5 }, (_, i) => ({
      id: i + 1, user_id: 1, name: `Rum Recipe ${i + 1}`, category: 'Sour',
      ingredients: JSON.stringify(['rum', 'lime juice', 'sugar']), memmachine_uid: null,
    }));

    vi.spyOn(dbModule, 'queryAll').mockImplementation(async (sql: string) => {
      if (sql.includes('FROM inventory_items') && !sql.includes('ORDER BY RANDOM')) return inventory;
      if (sql.includes('FROM recipes') || sql.includes('ORDER BY RANDOM')) return recipes;
      return [];
    });
    vi.spyOn(dbModule, 'queryOne').mockResolvedValue(null);
    vi.spyOn(memoryServiceModule.memoryService, 'getEnhancedContext').mockResolvedValue({ userContext: null, chatContext: null });
    vi.spyOn(shoppingModule.shoppingListService, 'isCraftable').mockReturnValue(true);
    vi.spyOn(shoppingModule.shoppingListService, 'getUserBottles').mockResolvedValue([{ name: 'Plantation 3 Stars', liquorType: 'Rum', detailedClassification: null }]);
    vi.spyOn(shoppingModule.shoppingListService, 'findMissingIngredients').mockReturnValue([]);

    // "what haven't I tried" has no ingredient keywords — should still surface recipes via explore
    const [, dynamicBlock] = await aiService.buildContextAwarePrompt(1, "what haven't I tried?", []);

    expect(dynamicBlock.text).toContain('ALLOWED RECIPE LIST');
    expect(dynamicBlock.text).toContain('Rum Recipe');
  });

  it('should run explore fallback when all search passes return fewer than 3 recipes', async () => {
    const dbModule = await import('../database/db');
    const shoppingModule = await import('./ShoppingListService');

    const inventory = [{ id: 1, user_id: 1, name: 'Bourbon', type: 'Whiskey', stock_number: 1, spirit_classification: null, profile_nose: null, palate: null, finish: null, abv: '43' }];
    // Returns recipes only on RANDOM() explore query
    const exploreRecipes = Array.from({ length: 5 }, (_, i) => ({
      id: i + 1, user_id: 1, name: `Whiskey Recipe ${i + 1}`, category: 'Stirred',
      ingredients: JSON.stringify(['bourbon', 'bitters', 'sugar']), memmachine_uid: null,
    }));

    vi.spyOn(dbModule, 'queryAll').mockImplementation(async (sql: string) => {
      if (sql.includes('FROM inventory_items') && !sql.includes('ORDER BY RANDOM')) return inventory;
      if (sql.includes('FROM favorites')) return [];
      // Only the RANDOM() explore query returns recipes
      if (sql.includes('ORDER BY RANDOM()')) return exploreRecipes;
      return [];
    });
    vi.spyOn(dbModule, 'queryOne').mockResolvedValue(null);
    vi.spyOn(memoryServiceModule.memoryService, 'getEnhancedContext').mockResolvedValue({ userContext: null, chatContext: null });
    vi.spyOn(shoppingModule.shoppingListService, 'isCraftable').mockReturnValue(true);
    vi.spyOn(shoppingModule.shoppingListService, 'getUserBottles').mockResolvedValue([{ name: 'Bourbon', liquorType: 'Whiskey', detailedClassification: null }]);
    vi.spyOn(shoppingModule.shoppingListService, 'findMissingIngredients').mockReturnValue([]);

    // "any recommendations" has no keywords → keyword search returns nothing → explore fallback fires
    const [, dynamicBlock] = await aiService.buildContextAwarePrompt(1, 'any recommendations?', []);

    expect(dynamicBlock.text).toContain('ALLOWED RECIPE LIST');
    expect(dynamicBlock.text).toContain('Whiskey Recipe');
  });

  it('should NOT run explore fallback when keyword search already found 3+ craftable recipes', async () => {
    const dbModule = await import('../database/db');
    const shoppingModule = await import('./ShoppingListService');

    const inventory = [{ id: 1, user_id: 1, name: 'Plantation 3 Stars', type: 'Rum', stock_number: 1, spirit_classification: null, profile_nose: null, palate: null, finish: null, abv: '41' }];
    const rumRecipes = Array.from({ length: 10 }, (_, i) => ({
      id: i + 1, user_id: 1, name: `Rum Recipe ${i + 1}`, category: 'Sour',
      ingredients: JSON.stringify(['rum', 'lime juice', 'sugar']), memmachine_uid: null,
    }));

    const queryAllSpy = vi.spyOn(dbModule, 'queryAll').mockImplementation(async (sql: string) => {
      if (sql.includes('FROM inventory_items') && !sql.includes('ORDER BY RANDOM')) return inventory;
      if (sql.includes('FROM recipes') || sql.includes('LIKE')) return rumRecipes;
      return [];
    });
    vi.spyOn(dbModule, 'queryOne').mockResolvedValue(null);
    vi.spyOn(memoryServiceModule.memoryService, 'getEnhancedContext').mockResolvedValue({ userContext: null, chatContext: null });
    vi.spyOn(shoppingModule.shoppingListService, 'isCraftable').mockReturnValue(true);
    vi.spyOn(shoppingModule.shoppingListService, 'getUserBottles').mockResolvedValue([{ name: 'Plantation 3 Stars', liquorType: 'Rum', detailedClassification: null }]);
    vi.spyOn(shoppingModule.shoppingListService, 'findMissingIngredients').mockReturnValue([]);

    // "rum cocktails" → keyword search finds 10 craftable recipes → no explore fallback needed
    await aiService.buildContextAwarePrompt(1, 'rum cocktails', []);

    // Verify: the ORDER BY RANDOM() explore query was NOT called
    const randomQueryCalls = queryAllSpy.mock.calls.filter(
      ([sql]) => typeof sql === 'string' && sql.includes('ORDER BY RANDOM()') && sql.includes('LIMIT 150')
    );
    expect(randomQueryCalls).toHaveLength(0);
  });
});
```

**Step 2: Run tests to confirm they fail**

```
cd api && npm run test:unit -- --reporter=verbose 2>&1 | grep -A 3 "explore fallback"
```

Expected: tests fail because explore fallback doesn't exist yet.

**Step 3: Implement the wiring**

**Change A** — detect explore intent early in `buildContextAwarePrompt`. Find the line (~1248):
```typescript
const expandedQuery = expandSearchQuery(userMessage);
```
Add immediately after it:
```typescript
const exploreIntent = this.detectExploreIntent(userMessage);
if (exploreIntent) {
  logger.info('[AI-EXPLORE] Explore intent detected in user message', {
    message: userMessage.substring(0, 100),
  });
}
```

**Change B** — add Step 3d after the broader search block. Find the comment (~line 1685):
```typescript
// Step 3c: Format final context
if (formatted.length > 0) {
```
Insert this block immediately BEFORE that line:

```typescript
// Step 3d: EXPLORE FALLBACK
// Fires when: (a) user explicitly asked for variety/new recommendations, OR
// (b) all prior search passes found fewer than 3 recipes total.
// Queries 150 random recipes from the full DB, runs craftability, appends to results.
const needsMoreRecipes = processedRecipes.length < 3;
if (exploreIntent || needsMoreRecipes) {
  logger.info('[AI-EXPLORE] Running explore fallback', {
    reason: exploreIntent ? 'explore intent detected' : 'insufficient results from keyword search',
    existingCount: processedRecipes.length,
    alreadyRecommendedCount: alreadyRecommended.size,
  });

  const exploreExcluded = new Set([...alreadyRecommended, ...processedRecipes]);
  const exploreLimit = Math.max(20 - processedRecipes.length, 5);

  const exploreSample = await this.getRandomCraftableSample(
    userId,
    userBottles,
    exploreExcluded,
    exploreLimit
  );

  if (exploreSample.processedRecipes.length > 0) {
    formatted += exploreSample.formatted;
    craftableCount += exploreSample.craftableCount;
    nearMissCount += exploreSample.nearMissCount;
    processedRecipes.push(...exploreSample.processedRecipes);

    logger.info('[AI-EXPLORE] Explore fallback added recipes', {
      added: exploreSample.processedRecipes.length,
      newTotal: processedRecipes.length,
      exploreIntent,
    });
  }
}
```

**Step 4: Run tests to confirm they pass**

```
cd api && npm run test:unit -- --reporter=verbose 2>&1 | grep -A 3 "explore fallback"
```

Expected: all 3 integration tests green.

**Step 5: Run the full test suite to check for regressions**

```
cd api && npm test 2>&1 | tail -20
```

Expected: all tests pass (960 backend tests).

**Step 6: Commit**

```
git add api/src/services/AIService.ts api/src/services/AIService.test.ts
git commit -m "feat(ai): wire explore fallback — surface random craftable recipes when search is thin"
```

---

## Task 4: Update prompt to acknowledge explore mode

When the explore fallback fires, the `ingredientMatchContext` section header says `## 🎯 MATCHED RECIPES (PRIORITIZE THESE)` which is misleading — these are random, not specifically matched. Update the section header logic to differentiate.

**Files:**
- Modify: `api/src/services/AIService.ts` — inside `buildContextAwarePrompt`, the `ingredientMatchContext` assembly block (~line 1686)

**Step 1: No test needed** — this is a prompt string change, not logic. The existing integration tests verify the section appears; the exact header text isn't asserted.

**Step 2: Implement**

Find the block that sets `ingredientMatchContext` (~line 1686):
```typescript
if (formatted.length > 0) {
  ingredientMatchContext = `\n\n## 🎯 MATCHED RECIPES (PRIORITIZE THESE)\n`;
  ingredientMatchContext += `${searchDescription}\n`;
  ingredientMatchContext += `These recipes match the user's request:\n`;
```

Replace with:

```typescript
if (formatted.length > 0) {
  const isExploreOnly = exploreIntent && processedRecipes.length > 0 && detectedIngredients.length === 0 && matchedConcepts.length === 0;
  const sectionHeader = isExploreOnly
    ? `## 🎲 EXPLORE RESULTS (random craftable selection)`
    : `## 🎯 MATCHED RECIPES (PRIORITIZE THESE)`;
  const sectionIntro = isExploreOnly
    ? `The user wants variety or something new. These are randomly sampled craftable recipes from their full collection:\n`
    : `${searchDescription}\nThese recipes match the user's request:\n`;

  ingredientMatchContext = `\n\n${sectionHeader}\n`;
  ingredientMatchContext += sectionIntro;
  ingredientMatchContext += `⚠️ **NOTE: Ingredients below are what RECIPES REQUIRE, not what user HAS. Check BAR STOCK at end of prompt for user's actual bottles.**\n\n`;
```

**Step 3: Run tests**

```
cd api && npm test 2>&1 | tail -10
```

Expected: all tests pass.

**Step 4: Commit**

```
git add api/src/services/AIService.ts
git commit -m "feat(ai): differentiate explore vs matched recipe section headers in prompt"
```

---

## Verification

After all tasks complete, smoke test in the running app:

1. Start the dev server: `npm run dev:all`
2. Open the AI Bartender at `http://localhost:3001/ai`
3. Ask: **"what haven't I tried?"** — should receive 3–5 craftable recipe suggestions (not "I can only see what search surfaces")
4. Ask: **"any recommendations?"** — same result, random but real recipes
5. Ask: **"show me something with rum"** — should still work via keyword search (not explore mode), verify no regressions
6. In a long conversation, keep asking "what else?" / "show me more" — each response should surface new recipes from the 800-recipe DB without repeating

---

## Test Count Impact

- Task 1: +5 unit tests (detectExploreIntent)
- Task 2: +4 unit tests (getRandomCraftableSample)
- Task 3: +3 integration tests (buildContextAwarePrompt explore fallback)
- Task 4: 0 new tests

**Total new tests: +12** (960 → 972 backend tests)
