# AI Spirit Style Awareness Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix three layered bugs that cause Claude to hallucinate spirit substitution advice — a field-name mismatch that silently strips all classification and tasting-note data from the AI context, a gap in the tiered search that ignores style tokens from classification, and a substitution rule that lacks style-level guidance.

**Architecture:** All changes are in `AIService.ts` and its test file. Task 1 fixes a silent data bug (wrong field names on `InventoryItemRecord`). Task 2 enriches the bottle-detection flow so classification style tokens (e.g. "jamaican") drive recipe search alongside the broad spirit type. Task 3 updates the static prompt rule so Claude has explicit instructions about what to say when spirit styles don't match.

**Tech Stack:** TypeScript, Express, pg driver, Vitest, Claude Sonnet 4.6

---

## Background (read this before touching code)

`AIService.ts` has an `InventoryItemRecord` interface that maps DB rows for `inventory_items`. The actual DB columns are snake_case (`spirit_classification`, `profile_nose`, `palate`, `finish`). The interface uses legacy display-name strings (`'Detailed Spirit Classification'`, `'Profile (Nose)'`, `Palate`, `Finish`). Because `SELECT *` returns snake_case keys, every field access via the wrong key silently returns `undefined`. Claude never sees bottle classifications or tasting notes even when the data is populated.

Separately, `detectBottleMentionsWithNotes` (the method that identifies which bottles the user is asking about) does not fetch `spirit_classification`, so the tiered recipe search never tokenises style terms like "jamaican" or "agricole" when building tier 1 candidates.

Finally, the existing `SPIRIT SUBSTITUTION RULE` in the static prompt forbids cross-spirit substitutions (rum → bourbon) but says nothing about same-spirit style mismatches (pot-still Jamaican rum ≠ light rum).

---

## Task 1: Fix InventoryItemRecord field names and field access

**Files:**
- Modify: `api/src/services/AIService.ts` lines 91–102 (interface) and 1161–1165 (field access)
- Test: `api/src/services/AIService.test.ts` (add inside the `buildContextAwarePrompt system prompt content` describe block)

---

### Step 1: Write the failing test

Add this test inside the `describe('buildContextAwarePrompt system prompt content')` block in `api/src/services/AIService.test.ts` (after the existing "should not contain FINAL VERIFICATION" test):

```typescript
it('should include spirit_classification and tasting notes in bar stock context', async () => {
  const dbModule = await import('../database/db');
  vi.spyOn(dbModule, 'queryAll').mockImplementation(async (sql: string) => {
    // Return one bottle with classification + tasting data for the inventory query
    if ((sql as string).includes('FROM inventory_items') && (sql as string).includes('ORDER BY name LIMIT')) {
      return [{
        id: 1,
        user_id: 1,
        name: 'Hampden Estate',
        type: 'Rum',
        spirit_classification: 'Jamaican Pot Still High Ester',
        abv: '46',
        profile_nose: 'funky overripe banana',
        palate: 'earthy intense',
        finish: 'long complex',
        stock_number: 1
      }];
    }
    return [];
  });
  vi.spyOn(dbModule, 'queryOne').mockResolvedValue(null);
  vi.spyOn(memoryServiceModule.memoryService, 'getEnhancedContext')
    .mockResolvedValue({ userContext: null, chatContext: null });

  const [staticBlock] = await aiService.buildContextAwarePrompt(1, '', []);

  expect(staticBlock.text).toContain('Jamaican Pot Still High Ester');
  expect(staticBlock.text).toContain('funky overripe banana');
});
```

### Step 2: Run the test to confirm it fails

```
cd api && npx vitest run src/services/AIService.test.ts --reporter=verbose 2>&1 | Select-String -Pattern "FAIL|PASS|spirit_classification|tasting notes|Jamaican"
```

Expected: **FAIL** — "Jamaican Pot Still High Ester" not found in staticBlock.text (because field access is broken).

### Step 3: Fix the InventoryItemRecord interface

In `api/src/services/AIService.ts`, replace lines 91–102:

**Old:**
```typescript
interface InventoryItemRecord {
  id: number;
  user_id: number;
  name: string;
  type?: string;
  'Detailed Spirit Classification'?: string;
  abv?: string;
  'Profile (Nose)'?: string;
  Palate?: string;
  Finish?: string;
  stock_number?: number;
}
```

**New:**
```typescript
interface InventoryItemRecord {
  id: number;
  user_id: number;
  name: string;
  type?: string;
  spirit_classification?: string;
  abv?: string;
  profile_nose?: string;
  palate?: string;
  finish?: string;
  stock_number?: number;
}
```

### Step 4: Fix the field access in buildContextAwarePrompt

In `api/src/services/AIService.ts`, replace lines 1161–1165:

**Old:**
```typescript
        const classification = this.sanitizeContextField(bottle['Detailed Spirit Classification'], 'bottle.classification', userId);
        const abv = this.sanitizeContextField(bottle.abv, 'bottle.abv', userId);
        const profile = this.sanitizeContextField(bottle['Profile (Nose)'], 'bottle.profile', userId);
        const palate = this.sanitizeContextField(bottle.Palate, 'bottle.palate', userId);
        const finish = this.sanitizeContextField(bottle.Finish, 'bottle.finish', userId);
```

**New:**
```typescript
        const classification = this.sanitizeContextField(bottle.spirit_classification, 'bottle.classification', userId);
        const abv = this.sanitizeContextField(bottle.abv, 'bottle.abv', userId);
        const profile = this.sanitizeContextField(bottle.profile_nose, 'bottle.profile', userId);
        const palate = this.sanitizeContextField(bottle.palate, 'bottle.palate', userId);
        const finish = this.sanitizeContextField(bottle.finish, 'bottle.finish', userId);
```

### Step 5: Run the test to confirm it passes

```
cd api && npx vitest run src/services/AIService.test.ts --reporter=verbose 2>&1 | Select-String -Pattern "FAIL|PASS|spirit_classification|tasting notes"
```

Expected: **PASS** for the new test and all existing tests.

### Step 6: Run all backend tests

```
cd api && npm test 2>&1 | tail -20
```

Expected: all tests pass, no new failures.

### Step 7: Commit

```
git add api/src/services/AIService.ts api/src/services/AIService.test.ts
git commit -m "fix(ai): correct InventoryItemRecord field names so classification and tasting notes reach Claude"
```

---

## Task 2: Add spirit_classification to bottle detection and tier 1 search

**Files:**
- Modify: `api/src/services/AIService.ts` — `detectBottleMentionsWithNotes` (lines 459–523) and tier 1 search block (lines 1395–1418)
- Test: `api/src/services/AIService.test.ts` (add a new describe block)

---

### Step 1: Write the failing test

Add this new describe block at the end of the outer `describe('AIService')` block (before the closing `}`):

```typescript
describe('buildContextAwarePrompt tiered search classification', () => {
  it('should search for spirit_classification style tokens in tier 1 when bottle is mentioned', async () => {
    const dbModule = await import('../database/db');
    const ingredientSearchParams: string[] = [];

    vi.spyOn(dbModule, 'queryAll').mockImplementation(async (sql: string, params?: unknown[]) => {
      // Capture params from ingredient LIKE searches (tier 1/2/3 recipe searches)
      if ((sql as string).includes('LOWER(') && (sql as string).includes('LIKE') && params) {
        for (const p of params) {
          if (typeof p === 'string' && p.startsWith('%')) {
            ingredientSearchParams.push(p);
          }
        }
      }
      // Return the Hampden bottle for both the bottle-detection query and inventory query
      if ((sql as string).includes('FROM inventory_items')) {
        return [{
          id: 1,
          user_id: 1,
          name: 'Hampden Estate',
          tasting_notes: null,
          type: 'Rum',
          distillery_location: 'Jamaica',
          category: 'spirit',
          spirit_classification: 'Jamaican Pot Still High Ester Rum',
          profile_nose: null,
          palate: null,
          finish: null,
          stock_number: 1,
          abv: '46'
        }];
      }
      return [];
    });
    vi.spyOn(dbModule, 'queryOne').mockResolvedValue(null);
    vi.spyOn(memoryServiceModule.memoryService, 'getEnhancedContext')
      .mockResolvedValue({ userContext: null, chatContext: null });

    await aiService.buildContextAwarePrompt(1, 'what can I make with Hampden', []);

    // Tier 1 should have searched for 'jamaican' from the classification string
    expect(ingredientSearchParams.some(p => p.includes('jamaican'))).toBe(true);
  });
});
```

### Step 2: Run the test to confirm it fails

```
cd api && npx vitest run src/services/AIService.test.ts --reporter=verbose 2>&1 | Select-String -Pattern "FAIL|PASS|tiered search"
```

Expected: **FAIL** — `ingredientSearchParams` will not contain `%jamaican%` because `detectBottleMentionsWithNotes` doesn't fetch `spirit_classification` and tier 1 doesn't tokenise it.

### Step 3: Add spirit_classification to detectBottleMentionsWithNotes

In `api/src/services/AIService.ts`, update the method signature return type (line 462):

**Old:**
```typescript
  ): Promise<Array<{
    name: string;
    tastingNotes: string;
    spiritType: string | null;
    distilleryLocation: string | null;
    category: string | null;
  }>> {
```

**New:**
```typescript
  ): Promise<Array<{
    name: string;
    tastingNotes: string;
    spiritType: string | null;
    spiritClassification: string | null;
    distilleryLocation: string | null;
    category: string | null;
  }>> {
```

Update the SQL query at line 480:

**Old:**
```typescript
        SELECT name, tasting_notes, type, distillery_location, category
        FROM inventory_items
        WHERE user_id = $1 AND stock_number > 0
```

**New:**
```typescript
        SELECT name, tasting_notes, type, spirit_classification, distillery_location, category
        FROM inventory_items
        WHERE user_id = $1 AND stock_number > 0
```

Update the `queryAll` generic type and the `matchedBottles` array type (line 473 and 485):

**Old `queryAll` generic:**
```typescript
      const bottles = await queryAll<{
        name: string;
        tasting_notes: string | null;
        type: string | null;
        distillery_location: string | null;
        category: string | null;
      }>(`
```

**New:**
```typescript
      const bottles = await queryAll<{
        name: string;
        tasting_notes: string | null;
        type: string | null;
        spirit_classification: string | null;
        distillery_location: string | null;
        category: string | null;
      }>(`
```

**Old `matchedBottles` array type:**
```typescript
      const matchedBottles: Array<{
        name: string;
        tastingNotes: string;
        spiritType: string | null;
        distilleryLocation: string | null;
        category: string | null;
      }> = [];
```

**New:**
```typescript
      const matchedBottles: Array<{
        name: string;
        tastingNotes: string;
        spiritType: string | null;
        spiritClassification: string | null;
        distilleryLocation: string | null;
        category: string | null;
      }> = [];
```

Update the `matchedBottles.push(...)` at line 502:

**Old:**
```typescript
          matchedBottles.push({
            name: bottle.name,
            tastingNotes: bottle.tasting_notes || '',
            spiritType: bottle.type,
            distilleryLocation: bottle.distillery_location,
            category: bottle.category
          });
```

**New:**
```typescript
          matchedBottles.push({
            name: bottle.name,
            tastingNotes: bottle.tasting_notes || '',
            spiritType: bottle.type,
            spiritClassification: bottle.spirit_classification,
            distilleryLocation: bottle.distillery_location,
            category: bottle.category
          });
```

### Step 4: Add classification token search to tier 1

In `api/src/services/AIService.ts`, locate the tier 1 block (starting around line 1399). Add classification tokenisation **after** the existing `spiritType` tokenisation block (after the `logger.info('[AI-SEARCH] Tier 1 (exact type) results'` call):

**Add this block immediately after the existing tier 1 block (after line ~1418):**

```typescript
        // TIER 1b: Search for style tokens from spirit_classification
        // e.g. "Jamaican Pot Still High Ester Rum" → searches "jamaican", "agricole", "overproof"
        if (firstBottle.spiritClassification) {
          const classificationSkipWords = new Set([
            'white', 'dark', 'light', 'aged', 'gold', 'year', 'old', 'extra', 'reserve',
            'rum', 'gin', 'vodka', 'whiskey', 'whisky', 'tequila', 'mezcal', 'brandy',
            'cognac', 'bourbon', 'scotch', 'single', 'blended', 'malt', 'grain',
            'pot', 'still', 'column', 'continuous', 'high', 'ester', 'proof'
          ]);
          const classificationTerms = firstBottle.spiritClassification.toLowerCase().split(/[\s,\-\/]+/);

          for (const term of classificationTerms) {
            if (term.length < 5 || classificationSkipWords.has(term)) continue;
            // Avoid re-searching terms already covered by spiritType tokenisation
            if (firstBottle.spiritType && firstBottle.spiritType.toLowerCase().includes(term)) continue;

            const matches = await this.queryRecipesWithIngredient(userId, term);
            for (const recipe of matches) {
              if (!tier1Recipes.some(r => r.id === recipe.id)) {
                tier1Recipes.push(recipe);
              }
            }
          }
          logger.info('[AI-SEARCH] Tier 1b (classification style) results', {
            spiritClassification: firstBottle.spiritClassification,
            tier1TotalAfter: tier1Recipes.length
          });
        }
```

### Step 5: Run the test to confirm it passes

```
cd api && npx vitest run src/services/AIService.test.ts --reporter=verbose 2>&1 | Select-String -Pattern "FAIL|PASS|tiered search"
```

Expected: **PASS**.

### Step 6: Run all backend tests

```
cd api && npm test 2>&1 | tail -20
```

Expected: all tests pass.

### Step 7: Type-check

```
cd api && npm run type-check 2>&1 | tail -20
```

Expected: no type errors.

### Step 8: Commit

```
git add api/src/services/AIService.ts api/src/services/AIService.test.ts
git commit -m "feat(ai): add spirit_classification to bottle detection and tier 1 style search"
```

---

## Task 3: Strengthen the spirit substitution rule for style-level mismatches

**Files:**
- Modify: `api/src/services/AIService.ts` — static prompt `SPIRIT SUBSTITUTION RULE` section (lines 1941–1946)
- Test: `api/src/services/AIService.test.ts` (add inside `buildContextAwarePrompt system prompt content`)

---

### Step 1: Write the failing test

Add inside `describe('buildContextAwarePrompt system prompt content')`:

```typescript
it('should contain style-mismatch guidance in the spirit substitution rule', async () => {
  const dbModule = await import('../database/db');
  vi.spyOn(dbModule, 'queryAll').mockResolvedValue([]);
  vi.spyOn(dbModule, 'queryOne').mockResolvedValue(null);
  vi.spyOn(memoryServiceModule.memoryService, 'getEnhancedContext')
    .mockResolvedValue({ userContext: null, chatContext: null });

  const [staticBlock] = await aiService.buildContextAwarePrompt(1, '', []);

  expect(staticBlock.text).toContain('STYLE MATTERS');
  expect(staticBlock.text).toContain('stay silent');
});
```

### Step 2: Run the test to confirm it fails

```
cd api && npx vitest run src/services/AIService.test.ts --reporter=verbose 2>&1 | Select-String -Pattern "FAIL|PASS|style-mismatch"
```

Expected: **FAIL** — "STYLE MATTERS" and "stay silent" not in the current rule.

### Step 3: Update the SPIRIT SUBSTITUTION RULE in the static prompt

In `api/src/services/AIService.ts`, replace the existing `SPIRIT SUBSTITUTION RULE` block (lines 1941–1946):

**Old:**
```typescript
**🚫 SPIRIT SUBSTITUTION RULE:**
When a user mentions a specific spirit (rum, gin, whiskey, etc.), ONLY recommend cocktails that USE that spirit.
- If user asks about RUM: Do NOT recommend bourbon/whiskey/gin cocktails and suggest "just sub rum"
- If user asks about GIN: Do NOT recommend vodka cocktails and suggest "works with gin too"
- This applies to both craftable AND near-miss recipes
- If no recipes match the spirit type, say "I didn't find [spirit] cocktails in your database" - don't suggest substitutions
```

**New:**
```typescript
**🚫 SPIRIT SUBSTITUTION RULE:**
When a user mentions a specific spirit (rum, gin, whiskey, etc.), ONLY recommend cocktails that USE that spirit.
- If user asks about RUM: Do NOT recommend bourbon/whiskey/gin cocktails and suggest "just sub rum"
- If user asks about GIN: Do NOT recommend vodka cocktails and suggest "works with gin too"
- **STYLE MATTERS within a spirit category**: If a recipe calls for "light rum" or "white rum" and the user has a heavy, aged, or Jamaican pot-still rum — do NOT say it "could substitute" or "would work". These are different products with incompatible flavor profiles.
  - Wrong: "The Hampden could absolutely sub in for the light rum here"
  - Right: "This recipe is designed for light rum, which has a different profile than Hampden Estate"
- This applies to both craftable AND near-miss recipes
- If no recipes match the spirit AND style, say "I didn't find [spirit type] cocktails matching your bottle's style in your database" — don't suggest substitutions
- When uncertain about style compatibility, stay silent rather than invent a substitution rationale
```

### Step 4: Run the test to confirm it passes

```
cd api && npx vitest run src/services/AIService.test.ts --reporter=verbose 2>&1 | Select-String -Pattern "FAIL|PASS|style-mismatch"
```

Expected: **PASS**.

### Step 5: Run all backend tests

```
cd api && npm test 2>&1 | tail -20
```

Expected: all tests pass.

### Step 6: Type-check and lint

```
cd api && npm run type-check 2>&1 | tail -10
```

Expected: no errors.

### Step 7: Commit

```
git add api/src/services/AIService.ts api/src/services/AIService.test.ts
git commit -m "feat(ai): strengthen spirit substitution rule with style-level mismatch guidance"
```

---

## Verification

After all three tasks, do a quick manual smoke test in the AI bartender:
1. Ask: "What can I make with Hampden Estate to showcase it?"
2. Verify Claude's response:
   - ✅ Does NOT say "Hampden could sub in for light rum"
   - ✅ If it mentions a multi-rum recipe, it explicitly notes the style difference rather than inventing a bridge
   - ✅ Bar stock section shows `Hampden Estate [Rum] (Jamaican Pot Still High Ester)` in the prompt (visible via server logs)
