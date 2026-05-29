# AI Bartender Pipeline Improvements

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reduce "not enough recipes found" failures and response latency in the AI bartender by removing fragile cross-session dedup, sending more candidates to Claude, and parallelizing the MemMachine search.

**Architecture:** Four independent changes to `AIService.ts`, ordered lowest-risk to highest-risk. Each change can ship and be tested separately. No new files, no new services — pure edits to the existing service and its tests. Task 4 (prompt condensation) is the only one requiring editorial judgment and carries the most regression risk; it's last for that reason.

**Tech Stack:** TypeScript, Express, Anthropic SDK (`claude-sonnet-4-6`), Vitest (tests in `api/src/services/AIService.test.ts`), Winston logger.

---

## Context You Need

`api/src/services/AIService.ts` is 2429 lines. The method you're touching most is `buildContextAwarePrompt` (starts ~line 1215). Key landmarks:

- **Line 1312–1354**: Cross-session dedup block (queries MemMachine chat history, merges into `alreadyRecommended`). **Task 1** removes this entirely.
- **Line 1013–1091**: `extractRecommendedFromMemMachineHistory` private method. **Task 1** removes this too.
- **Line 1594**: `processRecipesWithCraftability` call with `maxRecipes=10`. **Task 2** bumps to `20`.
- **Line 1734**: Broader-search fill: `10 - processedRecipes.length`. **Task 2** bumps to `20`.
- **Line 1478**: `getUserBottles` call. **Task 3** moves this earlier.
- **Line 1786–1860**: MemMachine `getEnhancedContext` call (runs sequentially after all DB queries). **Task 3** moves this to run in parallel.
- **Lines 1942–1990, 2053–2060, 2077–2085**: Ingredient rule repetitions. **Task 4** condenses.
- **Lines 2174–2202**: `FINAL VERIFICATION` self-check block. **Task 4** removes.

Run the test suite with:
```
cd api && npm test -- --testPathPattern=AIService
```

All 4 tasks are independent — you can stop after any of them and the code will be in a good state.

---

## Task 1: Remove Cross-Session Already-Recommended Tracking

**Why:** The MemMachine history parser (`extractRecommendedFromMemMachineHistory`) uses fragile regex matching against markdown formatting from past responses. For users with any conversation history, it can exclude dozens of recipes before Claude sees them. Within-conversation dedup (from `extractAlreadyRecommendedRecipes`) is sufficient and stays untouched.

**Files:**
- Modify: `api/src/services/AIService.ts`
- Modify: `api/src/services/AIService.test.ts`

---

### Step 1: Write a failing test verifying no MemMachine history query

In `api/src/services/AIService.test.ts`, find the existing `describe('AIService', ...)` block and add a new `describe` block for `buildContextAwarePrompt`. The test mocks `memoryService` and verifies `queryUserChatHistory` is never called.

```typescript
// In AIService.test.ts, add at top with other imports:
import * as memoryServiceModule from './MemoryService';

// Add this describe block inside describe('AIService', ...):
describe('buildContextAwarePrompt cross-session dedup', () => {
  it('should NOT query MemMachine chat history for already-recommended dedup', async () => {
    // Arrange - mock the DB queries to return minimal data
    vi.mock('../database/db', () => ({
      queryAll: vi.fn().mockResolvedValue([]),
      queryOne: vi.fn().mockResolvedValue(null),
    }));

    const queryUserChatHistorySpy = vi.spyOn(
      memoryServiceModule.memoryService,
      'queryUserChatHistory'
    ).mockResolvedValue({ episodic: [], semantic: [] });

    vi.spyOn(
      memoryServiceModule.memoryService,
      'getEnhancedContext'
    ).mockResolvedValue({ userContext: null, chatContext: null });

    // Act
    await aiService.buildContextAwarePrompt(1, 'something with rum', []);

    // Assert
    expect(queryUserChatHistorySpy).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('CRAFTABLE')
    );
  });
});
```

### Step 2: Run test to verify it fails

```
cd api && npm test -- --testPathPattern=AIService
```

Expected: FAIL — the test fails because `queryUserChatHistory` is currently called with a string containing `'CRAFTABLE'`.

---

### Step 3: Remove `extractRecommendedFromMemMachineHistory` method

In `AIService.ts`, delete the entire method from line 1013 to 1091 (from the JSDoc comment through the closing `}`):

```typescript
// DELETE THIS ENTIRE METHOD (lines 1013-1091):
/**
 * Extract recommended recipes from MemMachine chat history (cross-session memory)
 * ...
 */
private extractRecommendedFromMemMachineHistory(
  ...
): Set<string> {
  ...
}
```

### Step 4: Remove the cross-session dedup block from `buildContextAwarePrompt`

Find the block starting around line 1311 with the comment `// Step 0: Build alreadyRecommended from BOTH current conversation AND MemMachine history`. Replace the entire block (lines 1311–1354) with just the single-line within-conversation call:

**Before (lines 1311–1354):**
```typescript
// Step 0: Build alreadyRecommended from BOTH current conversation AND MemMachine history
const alreadyRecommended = this.extractAlreadyRecommendedRecipes(conversationHistory, recipes);

// Query MemMachine chat history to get cross-session recommendations
// This prevents recommending the same recipes across multiple conversations
try {
  // Use broader query to find past AI responses - any cocktail-related conversation
  const chatHistory = await memoryService.queryUserChatHistory(
    userId,
    'cocktail recipe drink tonight make CRAFTABLE recommended'
  );

  logger.info('[AI-DIVERSITY] MemMachine chat history query result', {
    episodicCount: chatHistory.episodic?.length || 0,
    semanticCount: chatHistory.semantic?.length || 0,
    sampleEpisodic: chatHistory.episodic?.slice(0, 2).map(e => ({
      contentPreview: e.content?.substring(0, 100),
      startsWithAssistant: e.content?.startsWith('Assistant:')
    }))
  });

  if (chatHistory.episodic && chatHistory.episodic.length > 0) {
    const memMachineRecommended = this.extractRecommendedFromMemMachineHistory(
      chatHistory.episodic,
      recipes
    );
    // Merge MemMachine recommendations into alreadyRecommended
    for (const recipeName of memMachineRecommended) {
      alreadyRecommended.add(recipeName);
    }
    logger.info('[AI-DIVERSITY] Merged cross-session recommendations', {
      fromCurrentConvo: alreadyRecommended.size - memMachineRecommended.size,
      fromMemMachine: memMachineRecommended.size,
      total: alreadyRecommended.size,
      sampleRecipes: Array.from(alreadyRecommended).slice(0, 10)
    });
  } else {
    logger.info('[AI-DIVERSITY] No MemMachine chat history found - this is normal for new users or if MemMachine is empty');
  }
} catch (error) {
  logger.warn('[AI-DIVERSITY] Failed to query MemMachine chat history', {
    error: error instanceof Error ? error.message : 'Unknown'
  });
}
```

**After:**
```typescript
// Build alreadyRecommended from current conversation only
const alreadyRecommended = this.extractAlreadyRecommendedRecipes(conversationHistory, recipes);

if (alreadyRecommended.size > 0) {
  logger.info('[AI-DIVERSITY] Recipes already recommended this conversation', {
    count: alreadyRecommended.size,
    recipes: Array.from(alreadyRecommended).slice(0, 10)
  });
}
```

### Step 5: Run tests to verify they pass

```
cd api && npm test -- --testPathPattern=AIService
```

Expected: All tests PASS. If any existing tests reference `extractRecommendedFromMemMachineHistory`, delete those test cases.

### Step 6: Commit

```
git add api/src/services/AIService.ts api/src/services/AIService.test.ts
git commit -m "feat(ai): remove cross-session recipe dedup via MemMachine history parsing"
```

---

## Task 2: Increase Candidate Recipe Cap from 10 to 20

**Why:** The current 10-recipe cap means the pipeline's curatorial decisions are invisible to Claude. If 10 candidates pass the spirit filter but only 3 are new, Claude sees 3 options. With a 20-cap, the same scenario gives Claude 13 options, making responses meaningfully better.

**Files:**
- Modify: `api/src/services/AIService.ts`
- Modify: `api/src/services/AIService.test.ts`

---

### Step 1: Write a failing test

```typescript
// In AIService.test.ts, inside describe('buildContextAwarePrompt...'):
it('should pass maxRecipes=20 to processRecipesWithCraftability', async () => {
  // We verify the formatted context can contain up to 20 recipes.
  // Since processRecipesWithCraftability is private, test via the public surface:
  // build a prompt with 25 matching recipes and verify the ALLOWED RECIPE LIST
  // contains more than 10 entries.

  // This test is an integration-style check — set up 25 fake recipes in the DB mock
  // and verify the prompt output has >10 items in the ALLOWED RECIPE LIST section.

  const manyRecipes = Array.from({ length: 25 }, (_, i) => ({
    id: i + 1,
    user_id: 1,
    name: `Test Recipe ${i + 1}`,
    category: 'Sour',
    spirit_type: 'rum',
    ingredients: JSON.stringify(['rum', 'lime juice', 'sugar']),
    memmachine_uid: null,
  }));

  vi.mock('../database/db', () => ({
    queryAll: vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('FROM recipes')) return Promise.resolve(manyRecipes);
      if (sql.includes('FROM inventory_items')) return Promise.resolve([
        { id: 1, user_id: 1, name: 'Plantation 3 Stars', type: 'Rum', stock_number: 1 }
      ]);
      return Promise.resolve([]);
    }),
    queryOne: vi.fn().mockResolvedValue(null),
  }));

  const [, dynamicBlock] = await aiService.buildContextAwarePrompt(1, 'rum cocktails', []);

  // Count entries in the ALLOWED RECIPE LIST
  const allowedSection = dynamicBlock.text.match(/ALLOWED RECIPE LIST[\s\S]*?Total allowed: (\d+)/);
  const count = allowedSection ? parseInt(allowedSection[1]) : 0;

  expect(count).toBeGreaterThan(10);
});
```

### Step 2: Run test to verify it fails

```
cd api && npm test -- --testPathPattern=AIService
```

Expected: FAIL — count is ≤10 because the current cap is 10.

---

### Step 3: Change the cap in `buildContextAwarePrompt`

**Change 1** — first pass call (around line 1594):

```typescript
// Before:
let { formatted, craftableCount, nearMissCount, missingCount, processedRecipes, spiritMismatchCount, previouslyRecommendedIncluded } =
  this.processRecipesWithCraftability(ingredientRecipes, userBottles, alreadyRecommended, 10, requiredSpiritType, true, userIsFlexible, 4, specificIngredientsList);

// After:
let { formatted, craftableCount, nearMissCount, missingCount, processedRecipes, spiritMismatchCount, previouslyRecommendedIncluded } =
  this.processRecipesWithCraftability(ingredientRecipes, userBottles, alreadyRecommended, 20, requiredSpiritType, true, userIsFlexible, 4, specificIngredientsList);
```

**Change 2** — broader search fill (around line 1734):

```typescript
// Before:
const additionalProcessed = this.processRecipesWithCraftability(
  additionalRecipes,
  userBottles,
  new Set([...alreadyRecommended, ...processedRecipes]),
  10 - processedRecipes.length, // Fill up to 10 total
  ...

// After:
const additionalProcessed = this.processRecipesWithCraftability(
  additionalRecipes,
  userBottles,
  new Set([...alreadyRecommended, ...processedRecipes]),
  20 - processedRecipes.length, // Fill up to 20 total
  ...
```

### Step 4: Run tests to verify they pass

```
cd api && npm test -- --testPathPattern=AIService
```

Expected: All tests PASS.

### Step 5: Commit

```
git add api/src/services/AIService.ts api/src/services/AIService.test.ts
git commit -m "feat(ai): increase candidate recipe cap from 10 to 20 for better Claude curation"
```

---

## Task 3: Parallelize MemMachine and `getUserBottles` with DB Queries

**Why:** `memoryService.getEnhancedContext` and `shoppingListService.getUserBottles` are both network/DB calls that run after all the sequential PostgreSQL ingredient queries complete. Both are independent of the ingredient query results. Running them in parallel cuts response latency by the time of whichever is slowest (typically MemMachine at ~500–2000ms).

**Files:**
- Modify: `api/src/services/AIService.ts`
- Modify: `api/src/services/AIService.test.ts`

---

### Step 1: Write failing tests

```typescript
// In AIService.test.ts:
describe('buildContextAwarePrompt parallelism', () => {
  it('should start MemMachine and getUserBottles before sequential DB ingredient queries resolve', async () => {
    let memMachineCallTime = 0;
    let getUserBottlesCallTime = 0;
    let firstIngredientQueryStartTime = 0;

    vi.spyOn(memoryServiceModule.memoryService, 'getEnhancedContext')
      .mockImplementation(async () => {
        memMachineCallTime = Date.now();
        return { userContext: null, chatContext: null };
      });

    vi.spyOn(shoppingListServiceModule.shoppingListService, 'getUserBottles')
      .mockImplementation(async () => {
        getUserBottlesCallTime = Date.now();
        return [];
      });

    // The DB mock simulates slow ingredient queries
    vi.mock('../database/db', () => ({
      queryAll: vi.fn().mockImplementation(async (sql: string) => {
        if (sql.includes('LOWER(ingredients) LIKE')) {
          // Slow ingredient query
          if (firstIngredientQueryStartTime === 0) firstIngredientQueryStartTime = Date.now();
          await new Promise(r => setTimeout(r, 50));
          return [];
        }
        return [];
      }),
      queryOne: vi.fn().mockResolvedValue(null),
    }));

    await aiService.buildContextAwarePrompt(1, 'rum cocktails', []);

    // MemMachine and getUserBottles should have been called before or concurrent with ingredient queries
    // (not strictly before, but within a short window - they start before ingredient queries finish)
    expect(memMachineCallTime).toBeGreaterThan(0);
    expect(getUserBottlesCallTime).toBeGreaterThan(0);
  });

  it('should still return results if MemMachine fails', async () => {
    vi.spyOn(memoryServiceModule.memoryService, 'getEnhancedContext')
      .mockRejectedValue(new Error('MemMachine down'));

    vi.mock('../database/db', () => ({
      queryAll: vi.fn().mockResolvedValue([]),
      queryOne: vi.fn().mockResolvedValue(null),
    }));

    // Should not throw even though MemMachine fails
    const result = await aiService.buildContextAwarePrompt(1, 'rum cocktails', []);
    expect(result).toHaveLength(2);
    expect(result[0].text).toBeTruthy();
  });
});
```

### Step 2: Run tests to verify they fail

```
cd api && npm test -- --testPathPattern=AIService
```

Expected: FAIL — parallelism test fails because MemMachine currently runs sequentially after ingredient queries.

---

### Step 3: Launch MemMachine and `getUserBottles` early in the `userMessage` block

Find the start of the `if (userMessage && userMessage.trim().length > 0)` block (around line 1360). The `expandedQuery` computation already happens at line 1786 inside the MemMachine try block. Move it earlier and start both async calls as promises immediately:

**Before** (the MemMachine try block, around line 1783–1860):
```typescript
// Step 4: Also get MemMachine semantic results (for general context)
try {
  // Expand query with cocktail ingredients for better semantic search
  let expandedQuery = expandSearchQuery(userMessage);
  // ... tasting notes enrichment ...
  const { userContext, chatContext } = await memoryService.getEnhancedContext(userId, expandedQuery);
  // ... format results ...
} catch (error) {
  logger.warn('MemMachine unavailable', { ... });
}
```

**After** — place these two lines RIGHT AFTER the `if (userMessage ...)` opening brace (before the concept-match loop at line 1365):

```typescript
if (userMessage && userMessage.trim().length > 0) {
  // Start MemMachine and getUserBottles immediately — they're independent of ingredient detection
  const expandedQuery = expandSearchQuery(userMessage);
  const memMachinePromise = memoryService.getEnhancedContext(userId, expandedQuery)
    .catch((err: Error) => {
      logger.warn('MemMachine unavailable', { error: err.message });
      return null;
    });
  const userBottlesPromise = shoppingListService.getUserBottles(userId);

  const lowerMessage = userMessage.toLowerCase();
  // ... rest of the existing code unchanged ...
```

Then remove the existing `getUserBottles` call at line 1478:
```typescript
// DELETE this line (around 1478):
const userBottles = await shoppingListService.getUserBottles(userId);
```

And replace it with:
```typescript
// Await the already-in-flight promise
const userBottles = await userBottlesPromise;
```

Then replace the MemMachine try block (lines 1783–1860) with an await of the already-in-flight promise:

```typescript
// Step 4: Await MemMachine results (already running in parallel)
try {
  // Enrich query with bottle tasting notes if available (reuses mentionedBottlesForSpirit from step 2c)
  let queryForMemMachine = expandedQuery;
  if (mentionedBottlesForSpirit.length > 0) {
    const tastingContext = mentionedBottlesForSpirit
      .filter(b => b.tastingNotes)
      .map(b => `${b.name} flavor profile: ${b.tastingNotes}`)
      .join('. ');
    if (tastingContext) {
      queryForMemMachine = `${expandedQuery}. ${tastingContext}`;
      logger.info('[AI-SEARCH] Enriched MemMachine query with bottle tasting notes', {
        bottles: mentionedBottlesForSpirit.map(b => b.name),
      });
    }
  }

  // Note: if tasting notes were added, we need to re-query with the enriched query.
  // Otherwise use the already-resolved promise.
  const memMachineResult = queryForMemMachine !== expandedQuery
    ? await memoryService.getEnhancedContext(userId, queryForMemMachine).catch(() => null)
    : await memMachinePromise;

  if (!memMachineResult) {
    logger.info('MemMachine: No results or unavailable');
  } else {
    const { userContext, chatContext } = memMachineResult;
    logger.info('MemMachine: Results received', {
      hasUserContext: !!userContext,
      episodicCount: userContext?.episodic?.length || 0,
      semanticCount: userContext?.semantic?.length || 0,
      hasChatContext: !!chatContext,
      chatEpisodicCount: chatContext?.episodic?.length || 0
    });

    if (userContext) {
      const formattedContext = await memoryService.formatContextForPrompt(
        userContext,
        userId,
        true,
        10,
        alreadyRecommended,
        requiredSpiritType
      );
      memoryContext += formattedContext;
    }

    if (chatContext && chatContext.episodic && chatContext.episodic.length > 0) {
      memoryContext += '\n\n## 💬 CONVERSATION HISTORY & USER PREFERENCES\n';
      memoryContext += 'The user has mentioned these things in past conversations:\n';

      const seenContent = new Set<string>();
      const relevantChats = chatContext.episodic
        .filter(ep => {
          const key = ep.content?.substring(0, 100);
          if (!key || seenContent.has(key)) return false;
          seenContent.add(key);
          return true;
        })
        .slice(0, 5);

      relevantChats.forEach(ep => {
        memoryContext += `- ${ep.content}\n`;
      });

      memoryContext += '\n**Use this context to personalize recommendations.**\n';
    }
  }
} catch (error) {
  logger.warn('MemMachine unavailable', { error: error instanceof Error ? error.message : 'Unknown error' });
}
```

### Step 4: Run tests

```
cd api && npm test -- --testPathPattern=AIService
```

Expected: All tests PASS.

### Step 5: Commit

```
git add api/src/services/AIService.ts api/src/services/AIService.test.ts
git commit -m "perf(ai): parallelize MemMachine and getUserBottles with ingredient DB queries"
```

---

## Task 4: Condense System Prompt

**Why:** The "ZERO INGREDIENT NAMES" rule appears in 6 formulations across the static prompt, causing Claude to follow rules rather than be helpful. The `FINAL VERIFICATION` self-check at the end wastes output tokens on internal reasoning that's unreliable. This task consolidates to one clear statement of each rule.

**Risk note:** This is the most editorial task. The ingredient rule is being relaxed slightly — from "zero ingredient names" to "no full lists; 1-2 key ingredients to explain why a recipe fits are OK." Test after this task by manually prompting the AI bartender with a specific query (e.g., "what can I make with falernum?") and verifying Claude describes the drink experience rather than dumping specs.

**Files:**
- Modify: `api/src/services/AIService.ts`

---

### Step 1: Write a test asserting the FINAL VERIFICATION block is absent from built prompts

```typescript
// In AIService.test.ts:
describe('buildContextAwarePrompt system prompt content', () => {
  it('should not contain FINAL VERIFICATION self-check in static content', async () => {
    vi.mock('../database/db', () => ({
      queryAll: vi.fn().mockResolvedValue([]),
      queryOne: vi.fn().mockResolvedValue(null),
    }));
    vi.spyOn(memoryServiceModule.memoryService, 'getEnhancedContext')
      .mockResolvedValue({ userContext: null, chatContext: null });

    const [staticBlock] = await aiService.buildContextAwarePrompt(1, '', []);
    expect(staticBlock.text).not.toContain('FINAL VERIFICATION');
    expect(staticBlock.text).not.toContain('STOP. Before you write your response');
  });

  it('should contain the ingredient rule exactly once', async () => {
    vi.mock('../database/db', () => ({
      queryAll: vi.fn().mockResolvedValue([]),
      queryOne: vi.fn().mockResolvedValue(null),
    }));
    vi.spyOn(memoryServiceModule.memoryService, 'getEnhancedContext')
      .mockResolvedValue({ userContext: null, chatContext: null });

    const [staticBlock] = await aiService.buildContextAwarePrompt(1, '', []);
    const occurrences = (staticBlock.text.match(/INGREDIENT NAMES/g) || []).length;
    expect(occurrences).toBeLessThanOrEqual(2); // One heading + one mention max
  });
});
```

### Step 2: Run tests to verify they fail

```
cd api && npm test -- --testPathPattern=AIService
```

Expected: FAIL — FINAL VERIFICATION is present, and "INGREDIENT NAMES" appears many times.

---

### Step 3: Remove the FINAL VERIFICATION block

In `buildContextAwarePrompt`, find the dynamic content string (the `const dynamicContent = \`...\`` section, around line 2142). Near the end, delete this entire block (lines 2174–2202):

```typescript
// DELETE THIS ENTIRE BLOCK:
## ⛔⛔⛔ FINAL VERIFICATION — READ BEFORE RESPONDING ⛔⛔⛔

**STOP. Before you write your response, verify:**

1. ☐ **INGREDIENT NAME CHECK** — Scan your response for ANY of these FORBIDDEN words:
   lime, lemon, orange, grapefruit, pineapple, passion fruit,
   orgeat, falernum, chartreuse, maraschino, campari, vermouth,
   syrup, bitters, juice, liqueur, cordial, shrub, honey, grenadine

   (Spirit categories like "gin cocktail" or "rum punch" are OK for context)

   **If ANY forbidden word appears → DELETE THE SENTENCE and rewrite as flavor description.**

   Example fix: "uses orgeat and pineapple juice" → "tropical and nutty-sweet"
   Example fix: "your Beefeater would shine here" → "a crisp, botanical gin cocktail"

2. ☐ **RECIPE SOURCE CHECK** — Are ALL recipes from the ALLOWED RECIPE LIST?
   - If a recipe is NOT in the list → Remove it completely
   - Classic cocktails from your training data = NOT ALLOWED

3. ☐ **QUANTITY CHECK** — Count your recommendations. Did you recommend 3+ options?
   - Count the recipe names in your response
   - If count < 3 AND search results had 3+ craftable recipes → ADD MORE
   - Users want choices, not a single "best" pick

4. ☐ **INVENTION CHECK** — Did you make up any recipe or variant?
   - If YES → Remove it. Only use the user's database.

**IF YOU FAIL ANY CHECK, REWRITE YOUR RESPONSE BEFORE SUBMITTING.**
```

### Step 4: Condense the ingredient rule in static content

Find the `## 🚨 HOW TO RESPOND (ALWAYS FOLLOW THESE RULES)` section in `staticContent` (around line 1940). Replace the entire "ABSOLUTE RULE: ZERO INGREDIENT NAMES" block AND its downstream repetitions in the `RECIPE RECOMMENDATION PRIORITY` and `RESPONSE FORMAT` sections with this single consolidated rule:

```typescript
// REPLACE the current ingredient rule section with:
### 🍹 HOW TO DESCRIBE COCKTAILS
**Don't list ingredients. Describe the experience.**

Users can click any recipe name to see the full spec. Your job is to explain *why* a recipe fits, not *what's in it*.

**Allowed:**
- Spirit categories for context: "a gin sour", "rum-based tiki classic", "whiskey drink"
- 1–2 *key* ingredients **only when they directly explain the match** — e.g., if the user asked "what can I make with falernum?" it's fine to say "this one features falernum prominently." Don't volunteer ingredient names otherwise.
- Flavor descriptions: "tropical and nutty-sweet", "herbal backbone with bright citrus"

**Forbidden:**
- Full ingredient lists (bullet or prose): "rum, lime juice, orgeat, pineapple"
- Measurements: "1 oz lime juice, ¾ oz demerara"
- Guessing what the user has: "your Beefeater would be perfect here"

**Format:** One sentence on flavor profile, one on drinking experience. That's it.
✅ "**Navy Grog** — Multi-layered tropical depth with smoky spice. A slow sipper that rewards patience."
❌ "**Navy Grog** — Uses three rums, lime, grapefruit, honey..." (ingredient list)
```

Then in the `RECIPE RECOMMENDATION PRIORITY` section (around lines 2053–2060), remove the inline ingredient-rule reminders — they're now redundant. The lines to delete are:

```typescript
// DELETE these lines from RECIPE RECOMMENDATION PRIORITY:
- ✅ Focus on WHY the recipe fits, not WHAT's in it (remember: NO INGREDIENT LISTS!)
```

And in `RESPONSE FORMAT` (around lines 2077–2085), remove the full examples block (the ❌ Bad examples listing ingredients) — keep only the ✅ Good examples.

### Step 5: Run tests

```
cd api && npm test -- --testPathPattern=AIService
```

Expected: All tests PASS.

### Step 6: Manual smoke test

Start the dev server and open the AI Bartender page. Send these queries and verify the responses are natural:

1. `"what can I make with falernum?"` — should mention falernum in context, describe experience, not list specs
2. `"show me rum cocktails"` — should give 3–4 options with flavor descriptions, no ingredient lists
3. `"looking for options tonight"` — should ask a clarifying question, not dump recipes
4. `"what tiki drinks can I make?"` — should go straight to recommendations with craftability markers

### Step 7: Commit

```
git add api/src/services/AIService.ts api/src/services/AIService.test.ts
git commit -m "feat(ai): condense system prompt - remove FINAL VERIFICATION, consolidate ingredient rule"
```

---

## Summary

| Task | Change | Risk | Impact |
|------|--------|------|--------|
| 1 | Remove cross-session dedup | Low | High — fixes "no recipes found" for active users |
| 2 | Recipe cap 10 → 20 | Very Low | Medium — Claude sees more candidates |
| 3 | Parallelize MemMachine | Low | Medium — latency win, graceful degradation |
| 4 | Condense prompt | Medium | High — more natural responses, fewer rule-following failures |

All tasks modify only `api/src/services/AIService.ts` and its test file. No schema changes, no new routes, no frontend changes.
