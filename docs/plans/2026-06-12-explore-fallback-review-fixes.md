# Explore Fallback — Code Review Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all 10 findings from the 2026-06-12 code review of the explore-mode commits (`detectExploreIntent` + `getRandomCraftableSample`), then wire the feature into `buildContextAwarePrompt` so it actually runs.

**Architecture:** The two explore-mode methods landed on `main` but nothing calls them (review finding #1), and the review found 8 behavioral bugs that would fire once wired plus a cleanup bundle. This plan fixes bottom-up: shared helpers first (pattern matching with apostrophe normalization, recipe-query DRY), then a non-behavioral options-object refactor of `processRecipesWithCraftability`, then the `getRandomCraftableSample` contract fixes (spirit constraint, no-missing-backfill, error flag, relaxed re-pass), then the exclusion-set fixes in `extractAlreadyRecommendedRecipes`, and finally the wiring + prompt header. Each task is independently committable and keeps the full suite green.

**Tech Stack:** TypeScript (strict), Express.js, PostgreSQL (`pg` via `queryAll`), Vitest, Winston logger.

**Supersedes:** `docs/plans/2026-06-05-ai-explore-fallback.md` Tasks 3–4 (the wiring tasks there are replaced by Tasks 6–7 here, which incorporate the review fixes). Tasks 1–2 of that plan are already on `main` as commits `c836555` and `4ffbd3b`.

---

## Review Findings → Task Map

| # | Finding (severity order) | Fixed in |
|---|--------------------------|----------|
| 1 | Feature is dead code — nothing calls either method | Task 6 |
| 2 | Explore patterns over-match constrained queries; explore drops the spirit constraint (`null`) | Tasks 4, 6 |
| 3 | `includeMissingRecipes=false` still backfills uncapped ❌ MISSING recipes into the "craftable sample" | Tasks 3, 4 |
| 4 | Curly apostrophe (U+2019) defeats `/haven'?t/` patterns | Task 1 |
| 5 | excludeNames built from a 500-row alphabetical cap; random sample queries the full table → repeats past row 500 | Task 5 |
| 6 | Fuzzy extraction vs exact `Set.has` — DB name variants ('SC Daiquiri') leak past exclusion | Task 5 |
| 7 | `/what\s+else/`, `/what\s+other/` fire both `detectIngredientFlexibility` and `detectExploreIntent`, no precedence | Tasks 1, 6 |
| 8 | catch swallows DB failure — indistinguishable from "user has no recipes" | Tasks 4, 6 |
| 9 | No relaxed second pass in explore; return type drops accounting fields | Task 4 |
| 10 | Cleanup bundle: positional-arg defaults, result re-wrap, redundant toLowerCase, dead pattern, 3rd SQL copy, per-call regex array | Tasks 1, 2, 3, 4 |

**Key design decisions (made during planning):**

- **Spirit constraint inheritance (finding #2):** `detectExploreIntent` stays lexical. The fix is in the wiring: explore mode inherits the request's spirit constraint (`requiredSpiritType` from bottle mentions, or a base spirit named in the query) instead of hardcoding `null`. "Show me more rum drinks" → explore fires, but constrained to rum. Pure explore ("surprise me") → no constraint, as intended.
- **Missing-recipe policy (finding #3):** new `includeMissingInOutput` option on `processRecipesWithCraftability`, default `true` (preserves all existing callers' behavior exactly). Explore passes `false` so its output contains only ✅ CRAFTABLE / ⚠️ NEAR-MISS recipes.
- **Precedence (finding #7):** when a query fires both detectors, flexibility governs the keyword passes (as today) and explore only appends afterwards. The overlap becomes harmless because explore now inherits constraints and excludes already-shown recipes; a comment + test document this.
- **Relaxed re-pass (finding #9):** lives inside `getRandomCraftableSample` (it owns the fetched rows), mirroring the existing second-pass at AIService.ts:1638. It re-offers previously recommended recipes with the 🔄 marker only when fewer than 3 fresh craftable+near-miss results exist.
- **Error signaling (finding #8):** `getRandomCraftableSample` returns `ok: boolean`. When explore fails AND no other pass produced recipes, the wiring injects a "recipe search unavailable" prompt note so Claude reports a temporary problem instead of "you have no recipes".

---

## Task 1: Shared pattern helper, apostrophe normalization, pattern consolidation

Fixes findings **#4** (curly apostrophe), **#7** (shared helper part), **#10c** (redundant `toLowerCase`), **#10d** (dead `/anything\s+else/` pattern), **#10g** (regex arrays rebuilt per call).

**Files:**
- Modify: `api/src/services/AIService.ts:295-384` (`detectIngredientFlexibility`, `detectExploreIntent`, new module constants + helper)
- Test: `api/src/services/AIService.test.ts` (existing `detectExploreIntent` describe block, ~line 511)

**Step 1: Write the failing tests**

Add these tests inside the existing `describe('detectExploreIntent', ...)` block in `api/src/services/AIService.test.ts`:

```typescript
it('should detect explore intent with curly apostrophes (mobile smart punctuation)', () => {
  expect((aiService as any).detectExploreIntent('what haven’t I tried?')).toBe(true);
  expect((aiService as any).detectExploreIntent('I haven’t made many of these')).toBe(true);
});

it('should still detect explore phrasing on spirit-constrained follow-ups (constraint is handled by the caller)', () => {
  // These intentionally return true — the wiring inherits the spirit constraint (see Task 6)
  expect((aiService as any).detectExploreIntent('show me more rum drinks')).toBe(true);
  expect((aiService as any).detectExploreIntent('any other daiquiri variations?')).toBe(true);
});
```

**Step 2: Run tests to confirm the apostrophe test fails**

```bash
cd api && npx vitest run src/services/AIService.test.ts -t "curly apostrophes" 2>&1 | tail -10
```

Expected: 1 test FAILS (`expected false to be true`). The constrained-follow-up test already passes (documents current behavior).

**Step 3: Implement**

In `api/src/services/AIService.ts`, add two module-level constants immediately **above** the `class AIService` declaration (after the `expandSearchQuery` function):

```typescript
/**
 * Patterns signaling the user is flexible about missing ingredients.
 * Tested via matchesAnyPattern (apostrophes normalized, /i flags).
 */
const FLEXIBILITY_PATTERNS: RegExp[] = [
  // Explicit statements about not caring
  /doesn'?t?\s+matter.*(?:missing|ingredient|have)/i,
  /don'?t\s+care.*(?:missing|ingredient|have)/i,
  /(?:missing|ingredient).*doesn'?t?\s+matter/i,
  /(?:missing|ingredient).*don'?t\s+care/i,
  // Willingness to shop/buy
  /willing\s+to\s+(?:shop|buy|get|pick\s*up)/i,
  /can\s+(?:shop|buy|get|pick\s*up)/i,
  /i'?ll\s+(?:shop|buy|get|pick\s*up)/i,
  /happy\s+to\s+(?:shop|buy|get)/i,
  // Even if missing
  /even\s+if.*(?:missing|don'?t\s+have|need\s+to\s+buy)/i,
  // Show me everything / all options
  /show\s+(?:me\s+)?(?:all|every)/i,
  /all\s+(?:options|recipes|suggestions)/i,
  /what\s+(?:else|other)/i,
  // Aspirational / future buying
  /what\s+(?:should|could)\s+i\s+(?:buy|get|pick\s*up)/i,
  /what.*(?:buy|shop\s+for|add\s+to)/i,
  /shopping\s+list/i,
  // Direct requests for unavailable recipes
  /recipes?\s+i\s+can'?t\s+make/i,
  /what\s+(?:am\s+i|i'?m)\s+missing/i
];

/**
 * Patterns signaling variety/explore intent ("what haven't I tried?").
 * Consolidated from 21 to 12 patterns with identical coverage; the dead
 * /anything\s+else/ entry (subsumed by /(?:some|any)thing\s+.../) was removed.
 * NOTE: these intentionally fire on constrained follow-ups like "show me more
 * rum drinks" — the caller (buildContextAwarePrompt Step 3d) inherits the
 * spirit constraint rather than this detector trying to be clever.
 */
const EXPLORE_PATTERNS: RegExp[] = [
  /haven'?t\s+(tried|made|had|seen|done)/i,
  /never\s+(tried|made|had)/i,
  /(?:some|any)thing\s+(new|different|else|fresh)/i,
  /what\s+(else|other|more|haven'?t\s+i)/i,
  /show\s+me\s+more/i,
  /more\s+(options|suggestions|ideas|recipes)/i,
  /other\s+options/i,
  /any\s+other/i,
  /surprise\s+me/i,
  /new\s+to\s+me/i,
  /fresh\s+options/i,
  /there\s+must\s+be\s+more/i,
  /keep\s+going/i,
];
```

Then **replace** the bodies of `detectIngredientFlexibility` (lines 295-340) and `detectExploreIntent` (lines 346-384) and add the shared helper. Keep both methods' JSDoc comments:

```typescript
  /**
   * Test a query against a pattern list with smart-punctuation normalization.
   * Curly apostrophes (U+2018/U+2019, the default on iOS/Android keyboards)
   * are normalized to ASCII so /haven'?t/-style patterns match phone input.
   * All patterns carry the /i flag, so no lowercasing is needed.
   */
  private matchesAnyPattern(query: string, patterns: RegExp[], logTag: string): boolean {
    const normalized = query.replace(/[‘’]/g, "'");
    for (const pattern of patterns) {
      if (pattern.test(normalized)) {
        logger.info(`${logTag} Pattern matched`, {
          pattern: pattern.toString(),
          query: query.substring(0, 100),
        });
        return true;
      }
    }
    return false;
  }

  /**
   * Detect if user is flexible about missing ingredients
   * Returns true if user indicates they're willing to shop or don't care about missing ingredients
   */
  private detectIngredientFlexibility(query: string): boolean {
    return this.matchesAnyPattern(query, FLEXIBILITY_PATTERNS, '[AI-SEARCH]');
  }

  /**
   * Detect if user wants to explore new/random recipes rather than a specific ingredient request.
   * Returns true when the query signals variety, surprise, or "what haven't I tried?" intent.
   * May also fire on constrained follow-ups ("show me more rum drinks") — the caller
   * is responsible for inheriting the constraint (see buildContextAwarePrompt Step 3d).
   */
  private detectExploreIntent(query: string): boolean {
    return this.matchesAnyPattern(query, EXPLORE_PATTERNS, '[AI-EXPLORE]');
  }
```

**Step 4: Run the AIService suite to verify everything passes**

```bash
cd api && npx vitest run src/services/AIService.test.ts 2>&1 | tail -10
```

Expected: all tests pass (the 21→12 consolidation preserves every existing positive/negative test case — verified during planning against all 17 existing assertions).

**Step 5: Commit**

```bash
git add api/src/services/AIService.ts api/src/services/AIService.test.ts
git commit -m "fix(ai): normalize curly apostrophes + dedupe intent-pattern matching into shared helper"
```

---

## Task 2: Extract `queryRandomRecipes` helper and shared column list

Fixes finding **#10e** (3rd copy of the recipes SELECT).

**Files:**
- Modify: `api/src/services/AIService.ts:390-460` (`queryRecipesByName`, `queryRecipesWithIngredient`), `:929-935` (inline SQL in `getRandomCraftableSample`)
- Test: `api/src/services/AIService.test.ts`

**Step 1: Write the failing test**

Add a new describe block after `describe('getRandomCraftableSample', ...)`:

```typescript
describe('queryRandomRecipes', () => {
  afterEach(() => vi.restoreAllMocks());

  it('should query random recipes for the user with the given limit', async () => {
    const dbModule = await import('../database/db');
    const spy = vi.spyOn(dbModule, 'queryAll').mockResolvedValue([]);

    await (aiService as any).queryRandomRecipes(7, 150);

    expect(spy).toHaveBeenCalledTimes(1);
    const [sql, params] = spy.mock.calls[0];
    expect(sql).toContain('ORDER BY RANDOM()');
    expect(sql).toContain('LIMIT $2');
    expect(params).toEqual([7, 150]);
  });
});
```

**Step 2: Run test to confirm it fails**

```bash
cd api && npx vitest run src/services/AIService.test.ts -t "queryRandomRecipes" 2>&1 | tail -10
```

Expected: FAIL — `queryRandomRecipes is not a function`.

**Step 3: Implement**

Add a module-level constant next to the pattern constants from Task 1:

```typescript
/** Column list shared by every recipes SELECT in this service (matches RecipeRecord). */
const RECIPE_COLUMNS = 'id, user_id, name, category, ingredients, memmachine_uid';
```

Add the new helper after `queryRecipesWithIngredient` (~line 460). Note it deliberately does **not** catch — `getRandomCraftableSample`'s catch needs to see the failure to set `ok: false` (Task 4):

```typescript
  /**
   * Fetch a random sample of the user's recipes (explore mode).
   * Throws on DB failure — the caller is responsible for error handling
   * so it can distinguish "DB down" from "user has no recipes".
   */
  private async queryRandomRecipes(userId: number, limit: number): Promise<RecipeRecord[]> {
    return queryAll<RecipeRecord>(`
      SELECT ${RECIPE_COLUMNS}
      FROM recipes
      WHERE user_id = $1
      ORDER BY RANDOM()
      LIMIT $2
    `, [userId, limit]);
  }
```

Update the inline SQL in `queryRecipesByName` (line 394-400), `queryRecipesWithIngredient` (line 432-438), and `getRandomCraftableSample` (line 929-935) to use the constant. For `getRandomCraftableSample`, replace the whole inline query with:

```typescript
      const randomRecipes = await this.queryRandomRecipes(userId, 150);
```

(In `queryRecipesByName`/`queryRecipesWithIngredient`, only the column list inside the template literal changes: `SELECT ${RECIPE_COLUMNS}`.)

**Step 4: Run the AIService suite**

```bash
cd api && npx vitest run src/services/AIService.test.ts 2>&1 | tail -10
```

Expected: all pass. (The existing `getRandomCraftableSample` tests mock `queryAll` directly, so they are unaffected by the extraction.)

**Step 5: Commit**

```bash
git add api/src/services/AIService.ts api/src/services/AIService.test.ts
git commit -m "refactor(ai): extract queryRandomRecipes and shared RECIPE_COLUMNS constant"
```

---

## Task 3: Options-object refactor of `processRecipesWithCraftability` + `includeMissingInOutput`

Fixes findings **#10a** (positional-defaults debt — the altitude fix the review called "overdue") and provides the mechanism for **#3** (missing-recipe backfill).

This is a behavior-preserving refactor for all existing callers: `includeMissingInOutput` defaults to `true`, which is today's behavior.

**Files:**
- Modify: `api/src/services/AIService.ts:665-871` (signature + destructuring + sort), call sites at `:1618-1619`, `:1646-1656`, `:1751-1761`, `:942-952`
- Test: `api/src/services/AIService.test.ts`

**Step 1: Write the failing test**

Add inside the existing `describe('getRandomCraftableSample', ...)` block (this drives the new option through the only caller that will use it; direct unit tests of a private method's options come via this path):

```typescript
it('should omit recipes with 2+ missing ingredients entirely (no ❌ MISSING backfill)', async () => {
  const dbModule = await import('../database/db');
  const shoppingModule = await import('./ShoppingListService');

  const recipes = [
    { id: 1, user_id: 1, name: 'Craftable One', category: 'Sour', ingredients: JSON.stringify(['rum', 'lime']), memmachine_uid: null },
    { id: 2, user_id: 1, name: 'Missing Many', category: 'Tiki', ingredients: JSON.stringify(['rum', 'orgeat', 'falernum', 'allspice dram', 'absinthe']), memmachine_uid: null },
  ];

  vi.spyOn(dbModule, 'queryAll').mockResolvedValue(recipes);
  vi.spyOn(shoppingModule.shoppingListService, 'isCraftable').mockImplementation(
    (_ings: string[], _bottles: unknown, name?: string) => name === 'Craftable One'
  );
  vi.spyOn(shoppingModule.shoppingListService, 'findMissingIngredients').mockReturnValue(['orgeat', 'falernum', 'allspice dram', 'absinthe']);

  const result = await (aiService as any).getRandomCraftableSample(1, [{ name: 'Rum', liquorType: 'rum', detailedClassification: null }], new Set(), 10);

  expect(result.processedRecipes).toContain('Craftable One');
  expect(result.processedRecipes).not.toContain('Missing Many');
  expect(result.formatted).not.toContain('❌');
});
```

> Check the real `isCraftable` signature in `api/src/services/ShoppingListService.ts` before writing the mockImplementation — at review time it was `(ingredients, userBottles, recipeName)`.

**Step 2: Run test to confirm it fails**

```bash
cd api && npx vitest run src/services/AIService.test.ts -t "MISSING backfill" 2>&1 | tail -10
```

Expected: FAIL — `Missing Many` IS in processedRecipes (the uncapped backfill at line 838 includes it).

**Step 3: Implement the refactor**

3a. Add the types above the method (or with the other module-level declarations):

```typescript
interface CraftabilityOptions {
  /** Max recipes in the formatted output (default 10) */
  maxRecipes?: number;
  /** Skip recipes whose base spirit doesn't match (default null = no constraint) */
  requiredSpiritType?: string | null;
  /** Skip recipes in the alreadyRecommended set (default true; false = relaxed pass) */
  skipAlreadyRecommended?: boolean;
  /** Include recipes with 2+ missing ingredients, relevance-sorted (flexible users; default false) */
  includeMissingRecipes?: boolean;
  /** Cap on missing ingredients when includeMissingRecipes is true (default 4) */
  maxMissingIngredients?: number;
  /** Specific/rare ingredients to prioritize for relevance scoring (default []) */
  specificIngredients?: string[];
  /**
   * When false, recipes with 2+ missing ingredients are omitted from the output
   * entirely instead of backfilling after craftable/near-miss (default true,
   * which preserves the historical behavior). Explore mode passes false so a
   * "craftable sample" never contains ❌ MISSING recipes.
   */
  includeMissingInOutput?: boolean;
}

type CraftabilityResult = {
  formatted: string;
  craftableCount: number;
  nearMissCount: number;
  processedRecipes: string[];
  spiritMismatchCount: number;
  previouslyRecommendedIncluded: string[];
  missingCount: number;
};
```

3b. Change the signature (line 665-675). Keep the JSDoc, moving the param docs onto the interface:

```typescript
  private processRecipesWithCraftability(
    recipes: RecipeRecord[],
    userBottles: { name: string; liquorType: string | null; detailedClassification: string | null }[],
    alreadyRecommended: Set<string>,
    options: CraftabilityOptions = {}
  ): CraftabilityResult {
    const {
      maxRecipes = 10,
      requiredSpiritType = null,
      skipAlreadyRecommended = true,
      includeMissingRecipes = false,
      maxMissingIngredients = 4,
      specificIngredients = [],
      includeMissingInOutput = true,
    } = options;
```

The method body is unchanged **except** the `else` branch of the sort combination (line 836-839):

```typescript
    } else {
      // Normal order: craftable first, then near-miss, then missing.
      // Explore mode (includeMissingInOutput=false) omits missing entirely —
      // a "craftable sample" must not backfill with ❌ MISSING recipes.
      sortedRecipes = includeMissingInOutput
        ? [...craftableRecipes, ...nearMissRecipes, ...missingRecipes]
        : [...craftableRecipes, ...nearMissRecipes];
    }
```

3c. Update the four call sites:

`:1618-1619` (first pass):
```typescript
      let { formatted, craftableCount, nearMissCount, missingCount, processedRecipes, spiritMismatchCount, previouslyRecommendedIncluded } =
        this.processRecipesWithCraftability(ingredientRecipes, userBottles, alreadyRecommended, {
          maxRecipes: 20,
          requiredSpiritType,
          includeMissingRecipes: userIsFlexible,
          specificIngredients: specificIngredientsList,
        });
```

`:1646-1656` (relaxed second pass):
```typescript
        const secondPassResult = this.processRecipesWithCraftability(ingredientRecipes, userBottles, alreadyRecommended, {
          maxRecipes: MIN_GOOD_RECOMMENDATIONS - goodRecommendationsCount, // Only fill the gap
          requiredSpiritType,
          skipAlreadyRecommended: false, // Re-offer previously recommended (🔄 marker)
          includeMissingRecipes: userIsFlexible,
          specificIngredients: specificIngredientsList,
        });
```

`:1751-1761` (broader search):
```typescript
          const additionalProcessed = this.processRecipesWithCraftability(
            additionalRecipes,
            userBottles,
            new Set([...alreadyRecommended, ...processedRecipes]),
            {
              maxRecipes: 20 - processedRecipes.length, // Fill up to 20 total
              requiredSpiritType, // Apply same spirit constraint to broader search
              includeMissingRecipes: userIsFlexible,
              specificIngredients: specificIngredientsList,
            }
          );
```

`:942-952` (inside `getRandomCraftableSample` — interim update; Task 4 rewrites this method fully):
```typescript
      const result = this.processRecipesWithCraftability(randomRecipes, userBottles, excludeNames, {
        maxRecipes: limit,
        includeMissingInOutput: false,
      });
```

**Step 4: Type-check, then run the full backend suite**

```bash
cd api && npm run type-check && npm test 2>&1 | tail -10
```

Expected: type-check clean, all tests pass (including the Step 1 test, now green).

**Step 5: Commit**

```bash
git add api/src/services/AIService.ts api/src/services/AIService.test.ts
git commit -m "refactor(ai): options object for processRecipesWithCraftability + includeMissingInOutput policy"
```

---

## Task 4: Fix `getRandomCraftableSample` — spirit constraint, error flag, full result, relaxed re-pass

Fixes findings **#2b** (hardcoded null constraint), **#8** (swallowed error), **#9** (no relaxed pass + dropped fields), **#10b/f** (result re-wrap, log levels).

**Files:**
- Modify: `api/src/services/AIService.ts:922-970`
- Test: `api/src/services/AIService.test.ts` (existing `getRandomCraftableSample` block)

**Step 1: Write/adjust the failing tests**

In the existing `describe('getRandomCraftableSample', ...)` block:

(a) **Update** the DB-error test — it must now distinguish failure from emptiness:

```typescript
it('should handle DB errors gracefully and return empty result with ok=false', async () => {
  const dbModule = await import('../database/db');
  vi.spyOn(dbModule, 'queryAll').mockRejectedValue(new Error('DB connection failed'));

  const result = await (aiService as any).getRandomCraftableSample(1, [], new Set(), 10);

  expect(result.processedRecipes).toHaveLength(0);
  expect(result.formatted).toBe('');
  expect(result.ok).toBe(false);
});
```

(b) **Update** the empty-DB test: add `expect(result.ok).toBe(true);` (no recipes is a *successful* empty result).

(c) **Update** the exclude-names test: the new relaxed re-pass re-offers excluded recipes when fewer than 3 fresh results exist, so give it enough fresh recipes that the re-pass doesn't fire, and assert the 🔄 accounting stays empty:

```typescript
it('should exclude names in the excludeNames set when enough fresh recipes exist', async () => {
  const dbModule = await import('../database/db');
  const shoppingModule = await import('./ShoppingListService');

  const recipes = ['Daiquiri', 'Mojito', 'Mai Tai', 'Ti Punch'].map((name, i) => ({
    id: i + 1, user_id: 1, name, category: 'Sour',
    ingredients: JSON.stringify(['rum', 'lime']), memmachine_uid: null,
  }));

  vi.spyOn(dbModule, 'queryAll').mockResolvedValue(recipes);
  vi.spyOn(shoppingModule.shoppingListService, 'isCraftable').mockReturnValue(true);
  vi.spyOn(shoppingModule.shoppingListService, 'findMissingIngredients').mockReturnValue([]);

  const result = await (aiService as any).getRandomCraftableSample(1, [{ name: 'Rum', liquorType: 'rum', detailedClassification: null }], new Set(['Daiquiri']), 10);

  expect(result.processedRecipes).not.toContain('Daiquiri');
  expect(result.processedRecipes).toEqual(expect.arrayContaining(['Mojito', 'Mai Tai', 'Ti Punch']));
  expect(result.previouslyRecommendedIncluded).toHaveLength(0);
});
```

(d) **Add** the relaxed re-pass test:

```typescript
it('should re-offer previously recommended recipes with 🔄 accounting when fewer than 3 fresh results exist', async () => {
  const dbModule = await import('../database/db');
  const shoppingModule = await import('./ShoppingListService');

  // 3 craftable recipes, 2 already recommended → only 1 fresh → relaxed pass fires
  const recipes = ['Daiquiri', 'Mojito', 'Mai Tai'].map((name, i) => ({
    id: i + 1, user_id: 1, name, category: 'Sour',
    ingredients: JSON.stringify(['rum', 'lime']), memmachine_uid: null,
  }));

  vi.spyOn(dbModule, 'queryAll').mockResolvedValue(recipes);
  vi.spyOn(shoppingModule.shoppingListService, 'isCraftable').mockReturnValue(true);
  vi.spyOn(shoppingModule.shoppingListService, 'findMissingIngredients').mockReturnValue([]);

  const result = await (aiService as any).getRandomCraftableSample(
    1,
    [{ name: 'Rum', liquorType: 'rum', detailedClassification: null }],
    new Set(['Daiquiri', 'Mojito']),
    10
  );

  // Fresh recipe always present; excluded ones return only via the relaxed pass with accounting
  expect(result.processedRecipes).toContain('Mai Tai');
  expect(result.previouslyRecommendedIncluded.length).toBeGreaterThan(0);
  expect(result.formatted).toContain('🔄');
});
```

(e) **Add** the spirit-constraint test:

```typescript
it('should respect a spirit type constraint when provided', async () => {
  const dbModule = await import('../database/db');
  const shoppingModule = await import('./ShoppingListService');

  const recipes = [
    { id: 1, user_id: 1, name: 'Daiquiri', category: 'Sour', ingredients: JSON.stringify(['white rum', 'lime juice', 'sugar']), memmachine_uid: null },
    { id: 2, user_id: 1, name: 'Martini', category: 'Stirred', ingredients: JSON.stringify(['gin', 'dry vermouth']), memmachine_uid: null },
  ];

  vi.spyOn(dbModule, 'queryAll').mockResolvedValue(recipes);
  vi.spyOn(shoppingModule.shoppingListService, 'isCraftable').mockReturnValue(true);
  vi.spyOn(shoppingModule.shoppingListService, 'findMissingIngredients').mockReturnValue([]);

  const result = await (aiService as any).getRandomCraftableSample(
    1,
    [{ name: 'Rum', liquorType: 'rum', detailedClassification: null }],
    new Set(),
    10,
    'rum' // requiredSpiritType
  );

  expect(result.processedRecipes).toContain('Daiquiri');
  expect(result.processedRecipes).not.toContain('Martini');
});
```

> Before relying on this test, read `recipeMatchesSpiritConstraint` in AIService.ts to confirm `'rum'` is a valid normalized constraint value and that a gin recipe fails it. Adjust the ingredient strings if the matcher works differently.

**Step 2: Run tests to confirm new ones fail**

```bash
cd api && npx vitest run src/services/AIService.test.ts -t "getRandomCraftableSample" 2>&1 | tail -15
```

Expected: ok-flag, relaxed-re-pass, and spirit-constraint tests FAIL; others pass.

**Step 3: Implement — replace the entire method (lines 922-970)**

```typescript
  /**
   * Explore mode: fetch a random sample of the user's recipes and return only
   * craftable / near-miss ones, excluding names already shown this conversation.
   * If fewer than 3 fresh results exist, a relaxed re-pass re-offers previously
   * recommended recipes with the 🔄 marker (mirrors the keyword path's second pass).
   * Returns ok=false on DB failure so the caller can distinguish "DB down" from
   * "user has no recipes".
   */
  private async getRandomCraftableSample(
    userId: number,
    userBottles: { name: string; liquorType: string | null; detailedClassification: string | null }[],
    excludeNames: Set<string>,
    limit: number = 20,
    requiredSpiritType: string | null = null
  ): Promise<CraftabilityResult & { ok: boolean }> {
    try {
      const randomRecipes = await this.queryRandomRecipes(userId, 150);

      logger.debug('[AI-EXPLORE] Random sample fetched', {
        total: randomRecipes.length,
        excluded: excludeNames.size,
      });

      const result = this.processRecipesWithCraftability(randomRecipes, userBottles, excludeNames, {
        maxRecipes: limit,
        requiredSpiritType,
        includeMissingInOutput: false,
      });

      // Relaxed re-pass: when nearly everything craftable was already recommended,
      // re-offer prior recipes (🔄 marker) instead of returning an empty explore list.
      const MIN_GOOD = 3;
      const goodCount = result.craftableCount + result.nearMissCount;
      if (goodCount < MIN_GOOD && excludeNames.size > 0) {
        const remaining = randomRecipes.filter(r => !result.processedRecipes.includes(r.name));
        const relaxed = this.processRecipesWithCraftability(remaining, userBottles, excludeNames, {
          maxRecipes: MIN_GOOD - goodCount,
          requiredSpiritType,
          skipAlreadyRecommended: false,
          includeMissingInOutput: false,
        });
        result.formatted += relaxed.formatted;
        result.craftableCount += relaxed.craftableCount;
        result.nearMissCount += relaxed.nearMissCount;
        result.processedRecipes.push(...relaxed.processedRecipes);
        result.previouslyRecommendedIncluded.push(...relaxed.previouslyRecommendedIncluded);
      }

      logger.debug('[AI-EXPLORE] Random sample processed', {
        craftable: result.craftableCount,
        nearMiss: result.nearMissCount,
        total: result.processedRecipes.length,
        reOffered: result.previouslyRecommendedIncluded.length,
      });

      return { ...result, ok: true };
    } catch (error) {
      logger.warn('[AI-EXPLORE] Random sample failed', { error });
      return {
        formatted: '',
        processedRecipes: [],
        craftableCount: 0,
        nearMissCount: 0,
        missingCount: 0,
        spiritMismatchCount: 0,
        previouslyRecommendedIncluded: [],
        ok: false,
      };
    }
  }
```

Notes on what changed and why:
- Returns the **full** `CraftabilityResult` (spread, not field-copies) + `ok` — fixes the re-wrap (#10b) and the dropped accounting fields (#9).
- `requiredSpiritType` parameter — the wiring passes the inherited constraint (#2b).
- Relaxed re-pass operates on `remaining` (rows not already in the output), so it cannot duplicate recipes already shown (#9).
- The two routine logs drop from `info` to `debug` (#10f); the intent-detection log stays `info` via the shared helper.

**Step 4: Run the suite**

```bash
cd api && npx vitest run src/services/AIService.test.ts 2>&1 | tail -10
```

Expected: all pass.

**Step 5: Commit**

```bash
git add api/src/services/AIService.ts api/src/services/AIService.test.ts
git commit -m "fix(ai): getRandomCraftableSample — spirit constraint, ok flag, full result, relaxed re-pass"
```

---

## Task 5: Fix the exclusion set — all fuzzy matches, uncapped name list

Fixes findings **#5** (500-row alphabetical cap) and **#6** (fuzzy-extract vs exact-check asymmetry).

**Files:**
- Modify: `api/src/services/AIService.ts:1032-1106` (`extractAlreadyRecommendedRecipes`), `:1239-1247` + `:1327` (`buildContextAwarePrompt` queries)
- Test: `api/src/services/AIService.test.ts`

**Step 1: Write the failing tests**

Add a new describe block:

```typescript
describe('extractAlreadyRecommendedRecipes', () => {
  it('should add ALL fuzzy-matching DB variants, not just the first', () => {
    const history = [
      { role: 'assistant' as const, content: 'You should try the **Daiquiri** tonight!' },
    ];
    const recipes = [{ name: 'Daiquiri' }, { name: 'SC Daiquiri' }, { name: 'Martini' }];

    const result = (aiService as any).extractAlreadyRecommendedRecipes(history, recipes);

    // Both variants match "daiquiri" fuzzily; both must be excluded so the
    // exact Set.has() check in processRecipesWithCraftability catches either.
    expect(result.has('Daiquiri')).toBe(true);
    expect(result.has('SC Daiquiri')).toBe(true);
    expect(result.has('Martini')).toBe(false);
  });
});
```

**Step 2: Run test to confirm it fails**

```bash
cd api && npx vitest run src/services/AIService.test.ts -t "fuzzy-matching DB variants" 2>&1 | tail -10
```

Expected: FAIL — `result.has('SC Daiquiri')` is false (`findMatchingRecipe` returns only the first match).

**Step 3: Implement**

3a. In `extractAlreadyRecommendedRecipes`, replace the single-result helper with an all-results helper (lines 1046-1071):

```typescript
    // Helper for fuzzy matching (handles "the X", "X Punch" vs "X", prefixes like "SC").
    // Returns ALL matching DB names: the downstream skip check is an exact
    // Set.has(recipe.name), so every variant ('Daiquiri' AND 'SC Daiquiri')
    // must enter the set or variants leak past the exclusion.
    const findMatchingRecipes = (text: string): string[] => {
      const cleaned = text.toLowerCase().trim()
        .replace(/\*\*/g, '')  // Remove bold markers
        .replace(/^(the|a)\s+/i, '')  // Remove leading articles
        .replace(/\s*#\d+$/i, '')  // Remove #N suffix
        .trim();

      const matches = new Set<string>();

      if (recipeNameMap.has(cleaned)) {
        matches.add(recipeNameMap.get(cleaned)!);
      }

      for (const [lowerName, originalName] of recipeNameMap.entries()) {
        const strippedDbName = lowerName.replace(/^(sc|classic|traditional|original|the|a)\s+/i, '').trim();
        if (cleaned === strippedDbName ||
            cleaned.includes(lowerName) ||
            lowerName.includes(cleaned) ||
            cleaned.includes(strippedDbName) ||
            strippedDbName.includes(cleaned)) {
          matches.add(originalName);
        }
      }
      return [...matches];
    };
```

Update the three call sites inside the history loop (lines 1080, 1088, 1094) from the single-match form to:

```typescript
            for (const match of findMatchingRecipes(rec)) recommended.add(match);
```
```typescript
          for (const found of findMatchingRecipes(match[1])) recommended.add(found);
```
(same shape for the dash-formatted block)

3b. In `buildContextAwarePrompt`, decouple the exclusion-set name list from the 500-row prompt-display cap. After the existing `recipes` query (line 1244-1247), add:

```typescript
    // Name-only list for the already-recommended exclusion set. Deliberately
    // UNCAPPED: the explore fallback samples the full table, so the exclusion
    // set must cover every recipe — the MAX_RECIPES cap above only bounds the
    // prompt's recipe display list. Names are tiny; this is cheap even at 10k rows.
    const recipeNames = await queryAll<{ name: string }>(
      'SELECT name FROM recipes WHERE user_id = $1',
      [userId]
    );
```

And change line 1327 from:

```typescript
    const alreadyRecommended = this.extractAlreadyRecommendedRecipes(conversationHistory, recipes);
```
to:
```typescript
    const alreadyRecommended = this.extractAlreadyRecommendedRecipes(conversationHistory, recipeNames);
```

> Existing integration tests mock `queryAll` by matching SQL substrings. Any mock matching `sql.includes('FROM recipes')` will also catch the new name-only query — returning full recipe rows there is harmless (`extractAlreadyRecommendedRecipes` only reads `.name`). Check failures here first if the suite breaks.

**Step 4: Run the full backend suite + type-check**

```bash
cd api && npm run type-check && npm test 2>&1 | tail -10
```

Expected: all pass.

**Step 5: Commit**

```bash
git add api/src/services/AIService.ts api/src/services/AIService.test.ts
git commit -m "fix(ai): exclusion set covers all fuzzy variants and the full recipe table"
```

---

## Task 6: Wire the explore fallback into `buildContextAwarePrompt`

Fixes findings **#1** (dead code), **#2a** (constraint inheritance), **#7** (explicit precedence), **#8** (degraded-mode prompt note).

**Files:**
- Modify: `api/src/services/AIService.ts` — two insertion points in `buildContextAwarePrompt` (~line 1342 and ~line 1778)
- Test: `api/src/services/AIService.test.ts`

**Step 1: Write the failing integration tests**

Add a new describe block. Look at how existing `buildContextAwarePrompt` tests in this file mock `queryAll`/`queryOne`/`memoryService`/`shoppingListService` and mirror that setup style exactly (including the `memoryServiceModule` import pattern). The tests:

```typescript
describe('buildContextAwarePrompt explore fallback', () => {
  afterEach(() => vi.restoreAllMocks());

  function mockCommon(opts: {
    inventory: unknown[];
    keywordRecipes?: unknown[];
    exploreRecipes?: unknown[];
    bottles: { name: string; liquorType: string | null; detailedClassification: string | null }[];
  }) {
    return Promise.all([import('../database/db'), import('./ShoppingListService'), import('./MemoryService')]).then(
      ([dbModule, shoppingModule, memModule]) => {
        const queryAllSpy = vi.spyOn(dbModule, 'queryAll').mockImplementation(async (sql: string) => {
          if (sql.includes('FROM inventory_items')) return opts.inventory as never;
          if (sql.includes('FROM favorites')) return [] as never;
          if (sql.includes('ORDER BY RANDOM()') && sql.includes('LIMIT $2')) return (opts.exploreRecipes ?? []) as never;
          if (sql.includes('FROM recipes')) return (opts.keywordRecipes ?? []) as never;
          return [] as never;
        });
        vi.spyOn(dbModule, 'queryOne').mockResolvedValue(null as never);
        vi.spyOn(memModule.memoryService, 'getEnhancedContext').mockResolvedValue({ userContext: null, chatContext: null } as never);
        vi.spyOn(shoppingModule.shoppingListService, 'isCraftable').mockReturnValue(true);
        vi.spyOn(shoppingModule.shoppingListService, 'findMissingIngredients').mockReturnValue([]);
        vi.spyOn(shoppingModule.shoppingListService, 'getUserBottles').mockResolvedValue(opts.bottles as never);
        return queryAllSpy;
      }
    );
  }

  const inventory = [{ id: 1, user_id: 1, name: 'Plantation 3 Stars', type: 'Rum', stock_number: 1, spirit_classification: null, profile_nose: null, palate: null, finish: null, abv: '41' }];
  const rumBottles = [{ name: 'Plantation 3 Stars', liquorType: 'rum', detailedClassification: null }];
  const exploreRecipes = Array.from({ length: 5 }, (_, i) => ({
    id: 100 + i, user_id: 1, name: `Explore Recipe ${i + 1}`, category: 'Sour',
    ingredients: JSON.stringify(['rum', 'lime juice', 'sugar']), memmachine_uid: null,
  }));

  it('should surface explore recipes when the query has no keywords (pure explore)', async () => {
    await mockCommon({ inventory, exploreRecipes, bottles: rumBottles });

    const blocks = await aiService.buildContextAwarePrompt(1, "what haven't I tried?", []);
    const text = blocks.map(b => (b as { text: string }).text).join('\n');

    expect(text).toContain('ALLOWED RECIPE LIST');
    expect(text).toContain('Explore Recipe');
  });

  it('should run the explore fallback when keyword search returns fewer than 3 good results', async () => {
    await mockCommon({ inventory, keywordRecipes: [], exploreRecipes, bottles: rumBottles });

    const blocks = await aiService.buildContextAwarePrompt(1, 'any recommendations?', []);
    const text = blocks.map(b => (b as { text: string }).text).join('\n');

    expect(text).toContain('Explore Recipe');
  });

  it('should NOT run the explore query when keyword search already found enough recipes and no explore intent', async () => {
    const keywordRecipes = Array.from({ length: 10 }, (_, i) => ({
      id: i + 1, user_id: 1, name: `Rum Recipe ${i + 1}`, category: 'Sour',
      ingredients: JSON.stringify(['rum', 'lime juice', 'sugar']), memmachine_uid: null,
    }));
    const queryAllSpy = await mockCommon({ inventory, keywordRecipes, bottles: rumBottles });

    await aiService.buildContextAwarePrompt(1, 'rum cocktails', []);

    const randomCalls = queryAllSpy.mock.calls.filter(
      ([sql]) => typeof sql === 'string' && sql.includes('ORDER BY RANDOM()') && sql.includes('LIMIT $2')
    );
    expect(randomCalls).toHaveLength(0);
  });

  it('should add a degraded-mode note instead of an empty context when explore fails and nothing else matched', async () => {
    const dbModule = await import('../database/db');
    await mockCommon({ inventory, bottles: rumBottles });
    // Re-mock: explore query rejects, everything else as before
    vi.spyOn(dbModule, 'queryAll').mockImplementation(async (sql: string) => {
      if (sql.includes('FROM inventory_items')) return inventory as never;
      if (sql.includes('ORDER BY RANDOM()') && sql.includes('LIMIT $2')) throw new Error('DB down');
      return [] as never;
    });

    const blocks = await aiService.buildContextAwarePrompt(1, 'surprise me', []);
    const text = blocks.map(b => (b as { text: string }).text).join('\n');

    expect(text).toContain('RECIPE SEARCH UNAVAILABLE');
    expect(text).not.toContain('ALLOWED RECIPE LIST');
  });
});
```

> Adjust the return-shape handling (`blocks.map(...)`) to match `buildContextAwarePrompt`'s actual `ContentBlock[]` shape — check how existing tests read the prompt text and copy that.

**Step 2: Run tests to confirm they fail**

```bash
cd api && npx vitest run src/services/AIService.test.ts -t "explore fallback" 2>&1 | tail -15
```

Expected: all 4 FAIL (no wiring exists).

**Step 3: Implement**

**Change A** — detect explore intent early. After line 1342 (`const expandedQuery = expandSearchQuery(userMessage);`), add:

```typescript
      const exploreIntent = this.detectExploreIntent(userMessage);
```

**Change B** — insert Step 3d between the broader-search block (ends ~line 1777) and `// Step 3c: Format final context` (~line 1779):

```typescript
      // Step 3d: EXPLORE FALLBACK
      // Fires when the user asked for variety ("surprise me", "what else?") OR when
      // every prior pass together produced fewer than 3 good results. Samples random
      // recipes from the FULL table (not just the keyword matches) and appends only
      // craftable/near-miss ones.
      //
      // Precedence note: queries like "what else can I make?" also fire
      // detectIngredientFlexibility. Flexibility governs the keyword passes above
      // (includeMissingRecipes); explore only appends afterwards, with constraints
      // inherited and already-shown recipes excluded, so both firing is harmless.
      //
      // Constraint inheritance: a constrained follow-up ("show me more rum drinks")
      // fires explore intent too — the sample MUST keep the user's spirit constraint,
      // either from a mentioned bottle (requiredSpiritType) or a base spirit named
      // in the query. Never sample unconstrained when the user named a spirit.
      const EXPLORE_BASE_SPIRITS = ['rum', 'gin', 'vodka', 'whiskey', 'bourbon', 'tequila', 'mezcal', 'brandy', 'cognac'];
      const detectedBaseSpirit = detectedIngredients.find(i => EXPLORE_BASE_SPIRITS.includes(i.toLowerCase())) ?? null;
      const exploreSpiritConstraint = requiredSpiritType ?? (detectedBaseSpirit ? this.normalizeSpiritType(detectedBaseSpirit) : null);
      const isPureExplore = exploreIntent && detectedIngredients.length === 0 && matchedConcepts.length === 0 && !requiredSpiritType;
      const needsMoreRecipes = craftableCount + nearMissCount < 3;
      let exploreFailed = false;

      if (exploreIntent || needsMoreRecipes) {
        logger.info('[AI-EXPLORE] Running explore fallback', {
          reason: exploreIntent ? 'explore intent detected' : 'insufficient results from prior passes',
          existingCount: processedRecipes.length,
          spiritConstraint: exploreSpiritConstraint,
          isPureExplore,
        });

        const exploreExcluded = new Set([...alreadyRecommended, ...processedRecipes]);
        const exploreLimit = Math.max(20 - processedRecipes.length, 5);

        const exploreSample = await this.getRandomCraftableSample(
          userId,
          userBottles,
          exploreExcluded,
          exploreLimit,
          exploreSpiritConstraint
        );

        if (exploreSample.processedRecipes.length > 0) {
          formatted += exploreSample.formatted;
          craftableCount += exploreSample.craftableCount;
          nearMissCount += exploreSample.nearMissCount;
          processedRecipes.push(...exploreSample.processedRecipes);
          spiritMismatchCount += exploreSample.spiritMismatchCount;
          previouslyRecommendedIncluded.push(...exploreSample.previouslyRecommendedIncluded);

          logger.info('[AI-EXPLORE] Explore fallback added recipes', {
            added: exploreSample.processedRecipes.length,
            newTotal: processedRecipes.length,
          });
        }

        exploreFailed = !exploreSample.ok;
      }
```

**Change C** — degraded-mode note. The Step 3c block (`if (formatted.length > 0) { ... }`) gains an `else if`. After its closing brace (~line 1806), add:

```typescript
      else if (exploreFailed) {
        // DB failure during explore with nothing else matched: tell Claude the truth
        // instead of letting an empty context read as "user has no recipes".
        ingredientMatchContext = `\n\n## ⚠️ RECIPE SEARCH UNAVAILABLE\n`;
        ingredientMatchContext += `Recipe lookups failed temporarily. Tell the user you're having trouble accessing their recipe collection right now. `;
        ingredientMatchContext += `Do NOT say they have no recipes, and do NOT invent or recall recipes from training data.\n`;
      }
```

**Step 4: Run the suite + type-check**

```bash
cd api && npm run type-check && npx vitest run src/services/AIService.test.ts 2>&1 | tail -10
```

Expected: all pass, including the 4 new integration tests.

**Step 5: Run the full backend suite for regressions**

```bash
cd api && npm test 2>&1 | tail -10
```

Expected: all pass.

**Step 6: Commit**

```bash
git add api/src/services/AIService.ts api/src/services/AIService.test.ts
git commit -m "feat(ai): wire explore fallback with inherited spirit constraint and degraded-mode note"
```

---

## Task 7: Differentiate the explore section header in the prompt

Completes the superseded plan's Task 4: when results are purely from explore, the `## 🎯 MATCHED RECIPES (PRIORITIZE THESE)` header is misleading.

**Files:**
- Modify: `api/src/services/AIService.ts` — Step 3c block (~line 1780)
- Test: `api/src/services/AIService.test.ts`

**Step 1: Write the failing test**

In the `buildContextAwarePrompt explore fallback` describe block:

```typescript
it('should label pure-explore results as EXPLORE RESULTS, not MATCHED RECIPES', async () => {
  await mockCommon({ inventory, exploreRecipes, bottles: rumBottles });

  const blocks = await aiService.buildContextAwarePrompt(1, 'surprise me', []);
  const text = blocks.map(b => (b as { text: string }).text).join('\n');

  expect(text).toContain('EXPLORE RESULTS');
  expect(text).not.toContain('MATCHED RECIPES (PRIORITIZE THESE)');
});
```

**Step 2: Run test to confirm it fails**

```bash
cd api && npx vitest run src/services/AIService.test.ts -t "EXPLORE RESULTS" 2>&1 | tail -10
```

Expected: FAIL.

**Step 3: Implement**

In Step 3c, replace the header/intro lines:

```typescript
      if (formatted.length > 0) {
        const sectionHeader = isPureExplore
          ? `## 🎲 EXPLORE RESULTS (random craftable selection)`
          : `## 🎯 MATCHED RECIPES (PRIORITIZE THESE)`;
        const sectionIntro = isPureExplore
          ? `The user wants variety or something new. These are randomly sampled craftable recipes from their full collection:\n`
          : `${searchDescription}\nThese recipes match the user's request:\n`;

        ingredientMatchContext = `\n\n${sectionHeader}\n`;
        ingredientMatchContext += sectionIntro;
        ingredientMatchContext += `⚠️ **NOTE: Ingredients below are what RECIPES REQUIRE, not what user HAS. Check BAR STOCK at end of prompt for user's actual bottles.**\n\n`;
        ingredientMatchContext += formatted;
```

(The rest of the block — summary, ALLOWED RECIPE LIST, 🔄 note — is unchanged.)

**Step 4: Run the suite**

```bash
cd api && npm test 2>&1 | tail -10
```

Expected: all pass.

**Step 5: Commit**

```bash
git add api/src/services/AIService.ts api/src/services/AIService.test.ts
git commit -m "feat(ai): label pure-explore results distinctly in the prompt"
```

---

## Task 8: Final verification

**Step 1: Full quality gate (project Critical Rules)**

```bash
cd api && npm run type-check && npm test 2>&1 | tail -5
```
```bash
npm run type-check && npm run lint 2>&1 | tail -5
```

Expected: backend type-check + all tests green; frontend type-check + lint green (frontend untouched, this is the regression gate).

**Step 2: Smoke test in the running app**

1. `npm run dev:all`, open `http://localhost:3001/ai`
2. **"what haven't I tried?"** → 3–5 craftable suggestions under explore framing (not "I can only see what search surfaces")
3. **"what haven’t I tried?"** typed with a curly apostrophe (paste it) → same result (finding #4)
4. **"show me more rum drinks"** → suggestions are rum recipes only (finding #2)
5. **"surprise me"** repeatedly in one conversation → fresh recipes each time; when exhausted, prior ones return with 🔄 framing instead of an empty answer (findings #5, #9)
6. **"give me a daiquiri"** → keyword path unaffected (regression)

**Step 3: Update session docs**

Run `/session-end` to update `Documentation/PROJECT_PROGRESS.md` and `.claude/SESSION_START.md` (new test counts, session summary). Mark `docs/plans/2026-06-05-ai-explore-fallback.md` Tasks 3–4 as superseded by this plan (add a note at the top of that file).

---

## Test Count Impact

- Task 1: +2 (apostrophe, constrained-follow-up documentation)
- Task 2: +1 (queryRandomRecipes)
- Task 3: +1 (no MISSING backfill)
- Task 4: +2 new, 2 updated (ok flag, relaxed re-pass, spirit constraint)
- Task 5: +1 (all fuzzy variants)
- Task 6: +4 (wiring integration)
- Task 7: +1 (explore header)

**Total: ~+12 tests** (961 → ~973 backend tests)

## Out of Scope (noted during review, deliberately not fixed here)

- The pre-existing second pass at AIService.ts:1638 appends `secondPassResult.formatted` wholesale while filtering `processedRecipes` — a latent duplicate-formatting quirk that predates this work. The explore re-pass avoids it by pre-filtering the input rows; fixing the keyword path is a separate change.
- Per-recipe matching cost in `processRecipesWithCraftability` (the double `isCraftable`/`findMissingIngredients` pass per non-craftable recipe). Real but invisible at current library sizes (~hundreds of recipes); revisit if explore latency shows up.
- Trimming `user_id`/`memmachine_uid` from `RECIPE_COLUMNS` — kept so all three queries return a consistent `RecipeRecord`.
