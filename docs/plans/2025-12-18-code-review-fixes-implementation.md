# Code Review Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix three code review issues: remove dead legacy db wrapper, add server-side search, add bulk move endpoint.

**Architecture:** Three independent changes executed sequentially. Backend changes first, then frontend integration. TDD approach with tests before implementation.

**Tech Stack:** Express.js, PostgreSQL (pg), Vitest, React/Next.js, Zustand, Axios

---

## Task 1: Remove Legacy db Wrapper

**Files:**
- Modify: `api/src/database/db.ts:226-258`

**Step 1: Remove legacy code**

Delete lines 226-258 from `api/src/database/db.ts`. Remove:
- The `db` export object (lines 236-246)
- The `convertPlaceholders` helper function (lines 254-257)
- The comment block above (lines 226-234)

The file should end after line 224 (the SIGTERM handler).

**Step 2: Verify no usages**

Run: `cd api && npx grep-cli "db\." --include="*.ts" src/`
Expected: No matches for `db.prepare`, `db.exec`, `db.transaction`

**Step 3: Run tests to verify nothing broke**

Run: `cd api && npm test`
Expected: All 866 tests pass

**Step 4: Commit**

```bash
git add api/src/database/db.ts
git commit -m "chore(db): remove unused legacy SQLite compatibility wrapper

The db.prepare/exec/transaction wrappers were kept for backwards
compatibility during PostgreSQL migration but are no longer used.
The transaction wrapper was also unsafe (didn't pass client).

[skip ci]"
```

---

## Task 2: Add Server-Side Search - Service Layer

**Files:**
- Modify: `api/src/services/RecipeService.ts`
- Modify: `api/src/services/RecipeService.test.ts`

**Step 1: Add SearchOptions interface**

In `api/src/services/RecipeService.ts`, after line 35 (after `PaginationOptions`), add:

```typescript
/**
 * Search and filter options
 */
export interface SearchOptions extends PaginationOptions {
  search?: string;
  spirit?: string;
  masteryIds?: number[];  // Recipe IDs that match mastery filter (computed by route)
}
```

**Step 2: Write failing test for search by name**

In `api/src/services/RecipeService.test.ts`, add after the existing `getAll` tests (around line 151):

```typescript
    it('should filter recipes by search term in name', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue({ total: '1' });
      const mockRecipes = [
        createMockRecipe({ id: 1, name: 'Margarita', ingredients: '["Tequila", "Lime"]' as any }),
      ];
      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue(mockRecipes);

      const result = await recipeService.getAll(userId, { page: 1, limit: 10, search: 'margarita' });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].name).toBe('Margarita');
      expect(queryAll).toHaveBeenCalledWith(
        expect.stringContaining('LOWER(name) LIKE'),
        expect.arrayContaining(['%margarita%'])
      );
    });

    it('should filter recipes by search term in ingredients', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue({ total: '1' });
      const mockRecipes = [
        createMockRecipe({ id: 1, name: 'Daiquiri', ingredients: '["White Rum", "Lime Juice"]' as any }),
      ];
      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue(mockRecipes);

      const result = await recipeService.getAll(userId, { page: 1, limit: 10, search: 'rum' });

      expect(result.items).toHaveLength(1);
      expect(queryAll).toHaveBeenCalledWith(
        expect.stringContaining('LOWER(ingredients) LIKE'),
        expect.arrayContaining(['%rum%'])
      );
    });

    it('should filter recipes by masteryIds', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue({ total: '2' });
      const mockRecipes = [
        createMockRecipe({ id: 1, name: 'Margarita' }),
        createMockRecipe({ id: 3, name: 'Daiquiri' }),
      ];
      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue(mockRecipes);

      const result = await recipeService.getAll(userId, { page: 1, limit: 10, masteryIds: [1, 3, 5] });

      expect(result.items).toHaveLength(2);
      expect(queryAll).toHaveBeenCalledWith(
        expect.stringContaining('id = ANY'),
        expect.arrayContaining([[1, 3, 5]])
      );
    });

    it('should combine search and masteryIds with AND logic', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue({ total: '1' });
      const mockRecipes = [
        createMockRecipe({ id: 1, name: 'Margarita' }),
      ];
      (queryAll as ReturnType<typeof vi.fn>).mockResolvedValue(mockRecipes);

      const result = await recipeService.getAll(userId, {
        page: 1,
        limit: 10,
        search: 'margarita',
        masteryIds: [1, 2, 3]
      });

      expect(result.items).toHaveLength(1);
      const query = (queryAll as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(query).toContain('LOWER(name) LIKE');
      expect(query).toContain('id = ANY');
    });

    it('should return empty when masteryIds is empty array', async () => {
      const result = await recipeService.getAll(userId, { page: 1, limit: 10, masteryIds: [] });

      expect(result.items).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
      expect(queryAll).not.toHaveBeenCalled();
    });
```

**Step 3: Run tests to verify they fail**

Run: `cd api && npm test -- RecipeService.test.ts`
Expected: New tests FAIL (search params not implemented yet)

**Step 4: Implement search in getAll method**

Replace the `getAll` method in `api/src/services/RecipeService.ts` (lines 156-193):

```typescript
  /**
   * Get paginated recipes for a user with optional search/filter
   */
  async getAll(userId: number, options: SearchOptions): Promise<PaginatedResult<Recipe>> {
    const { page, limit, search, masteryIds } = options;
    const offset = (page - 1) * limit;

    // Early return if masteryIds is empty array (no recipes match filter)
    if (masteryIds !== undefined && masteryIds.length === 0) {
      return {
        items: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false
        }
      };
    }

    // Build dynamic WHERE clauses
    const conditions: string[] = ['user_id = $1'];
    const params: unknown[] = [userId];
    let paramIndex = 2;

    // Search filter (name OR ingredients)
    if (search && search.trim()) {
      const searchTerm = `%${search.trim().toLowerCase()}%`;
      conditions.push(`(LOWER(name) LIKE $${paramIndex} OR LOWER(ingredients) LIKE $${paramIndex})`);
      params.push(searchTerm);
      paramIndex++;
    }

    // Mastery filter (recipe IDs)
    if (masteryIds && masteryIds.length > 0) {
      conditions.push(`id = ANY($${paramIndex})`);
      params.push(masteryIds);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    // Get total count
    const countResult = await queryOne<{ total: string }>(
      `SELECT COUNT(*) as total FROM recipes WHERE ${whereClause}`,
      params
    );

    const total = parseInt(countResult?.total ?? '0', 10);

    // Get recipes
    const recipes = await queryAll<Recipe>(`
      SELECT * FROM recipes
      WHERE ${whereClause}
      ORDER BY LOWER(name) ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, [...params, limit, offset]);

    // Parse ingredients JSON
    const parsedRecipes = recipes.map(recipe => this.parseRecipeIngredients(recipe));

    // Calculate pagination metadata
    const totalPages = Math.ceil(total / limit);

    return {
      items: parsedRecipes,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      }
    };
  }
```

**Step 5: Run tests to verify they pass**

Run: `cd api && npm test -- RecipeService.test.ts`
Expected: All tests PASS

**Step 6: Commit**

```bash
git add api/src/services/RecipeService.ts api/src/services/RecipeService.test.ts
git commit -m "feat(recipes): add server-side search and mastery filtering

- Add SearchOptions interface extending PaginationOptions
- Implement search by name OR ingredients (case-insensitive LIKE)
- Implement masteryIds filter for craftable/almost/etc filtering
- Filters combine with AND logic
- Early return for empty masteryIds (no matching recipes)

[skip ci]"
```

---

## Task 3: Add Server-Side Search - Route Layer

**Files:**
- Modify: `api/src/routes/recipes.ts`
- Test file already has route tests

**Step 1: Update GET /api/recipes route**

Replace the GET `/` route handler in `api/src/routes/recipes.ts` (lines 64-109):

```typescript
/**
 * GET /api/recipes - List User's Recipes with Pagination and Search
 *
 * Query Parameters:
 * - page: Page number (default: 1, min: 1)
 * - limit: Items per page (default: 50, max: 100, min: 1)
 * - search: Search term for name/ingredients (optional, max 100 chars)
 * - spirit: Spirit category filter (optional) - filtered client-side
 * - mastery: Mastery filter (craftable|almost|need-few|major-gaps) - requires masteryIds
 * - masteryIds: Comma-separated recipe IDs matching mastery filter
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }

  // Validate page parameter
  const pageParam = req.query.page as string | undefined;
  const pageValidation = validateNumber(pageParam || '1', 1, undefined);

  if (!pageValidation.isValid) {
    return res.status(400).json({
      success: false,
      error: 'Invalid page parameter',
      details: pageValidation.errors
    });
  }

  const page = pageValidation.sanitized || 1;

  // Validate limit parameter
  const limitParam = req.query.limit as string | undefined;
  const limitValidation = validateNumber(limitParam || '50', 1, 100);

  if (!limitValidation.isValid) {
    return res.status(400).json({
      success: false,
      error: 'Invalid limit parameter',
      details: limitValidation.errors
    });
  }

  const limit = limitValidation.sanitized || 50;

  // Validate search parameter
  const searchParam = req.query.search as string | undefined;
  let search: string | undefined;
  if (searchParam) {
    if (searchParam.length > 100) {
      return res.status(400).json({
        success: false,
        error: 'Search query too long (max 100 chars)'
      });
    }
    search = searchParam.trim();
  }

  // Parse masteryIds (comma-separated list of recipe IDs)
  const masteryIdsParam = req.query.masteryIds as string | undefined;
  let masteryIds: number[] | undefined;
  if (masteryIdsParam) {
    masteryIds = masteryIdsParam
      .split(',')
      .map(id => parseInt(id.trim(), 10))
      .filter(id => !isNaN(id) && id > 0);
  }

  const result = await recipeService.getAll(userId, { page, limit, search, masteryIds });

  res.json({
    success: true,
    data: result.items,
    pagination: result.pagination
  });
}));
```

**Step 2: Run route tests**

Run: `cd api && npm test -- recipes.test.ts`
Expected: All existing tests PASS

**Step 3: Run full test suite**

Run: `cd api && npm test`
Expected: All 866+ tests PASS

**Step 4: Commit**

```bash
git add api/src/routes/recipes.ts
git commit -m "feat(api): add search and masteryIds query params to GET /recipes

- search: filters by name OR ingredients (max 100 chars)
- masteryIds: comma-separated recipe IDs for mastery filtering
- spirit filter handled client-side (requires ingredient parsing)

[skip ci]"
```

---

## Task 4: Add Bulk Move - Service Layer

**Files:**
- Modify: `api/src/services/RecipeService.ts`
- Modify: `api/src/services/RecipeService.test.ts`

**Step 1: Write failing tests for bulkMove**

Add to `api/src/services/RecipeService.test.ts` after the `bulkDelete` tests:

```typescript
  describe('bulkMove', () => {
    it('should move multiple recipes to a collection', async () => {
      // Mock collection validation
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: collectionId });
      // Mock update
      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({ rowCount: 3 });

      const result = await recipeService.bulkMove([1, 2, 3], userId, collectionId);

      expect(result.moved).toBe(3);
      expect(execute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE recipes SET collection_id'),
        expect.arrayContaining([collectionId, userId, [1, 2, 3]])
      );
    });

    it('should move recipes to uncategorized (null collection)', async () => {
      (execute as ReturnType<typeof vi.fn>).mockResolvedValue({ rowCount: 2 });

      const result = await recipeService.bulkMove([1, 2], userId, null);

      expect(result.moved).toBe(2);
      expect(execute).toHaveBeenCalledWith(
        expect.stringContaining('collection_id = $1'),
        expect.arrayContaining([null, userId, [1, 2]])
      );
    });

    it('should return error for invalid collection', async () => {
      (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await recipeService.bulkMove([1, 2], userId, 999);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Collection not found or access denied');
    });

    it('should return error for empty recipe array', async () => {
      const result = await recipeService.bulkMove([], userId, collectionId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('No recipe IDs provided');
    });

    it('should return error when exceeding max recipes', async () => {
      const tooManyIds = Array.from({ length: 101 }, (_, i) => i + 1);

      const result = await recipeService.bulkMove(tooManyIds, userId, collectionId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Maximum 100 recipes per bulk operation');
    });
  });
```

**Step 2: Run tests to verify they fail**

Run: `cd api && npm test -- RecipeService.test.ts`
Expected: bulkMove tests FAIL (method not implemented)

**Step 3: Add BulkMoveResult interface**

In `api/src/services/RecipeService.ts`, add after line 134 (after `SyncStats`):

```typescript
/**
 * Bulk move result
 */
export interface BulkMoveResult {
  success: boolean;
  moved?: number;
  error?: string;
}
```

**Step 4: Implement bulkMove method**

Add after the `bulkDelete` method (around line 469):

```typescript
  /**
   * Bulk move recipes to a collection
   *
   * @param recipeIds - Array of recipe IDs to move
   * @param userId - User ID (for ownership validation)
   * @param collectionId - Target collection ID (null for uncategorized)
   */
  async bulkMove(
    recipeIds: number[],
    userId: number,
    collectionId: number | null
  ): Promise<BulkMoveResult> {
    // Validate input
    if (!recipeIds || recipeIds.length === 0) {
      return { success: false, error: 'No recipe IDs provided' };
    }

    if (recipeIds.length > 100) {
      return { success: false, error: 'Maximum 100 recipes per bulk operation' };
    }

    // Validate collection belongs to user (if not null)
    if (collectionId !== null) {
      const collectionExists = await this.validateCollection(collectionId, userId);
      if (!collectionExists) {
        return { success: false, error: 'Collection not found or access denied' };
      }
    }

    // Execute bulk update
    const result = await execute(
      `UPDATE recipes SET collection_id = $1 WHERE user_id = $2 AND id = ANY($3)`,
      [collectionId, userId, recipeIds]
    );

    return {
      success: true,
      moved: result.rowCount ?? 0
    };
  }
```

**Step 5: Run tests to verify they pass**

Run: `cd api && npm test -- RecipeService.test.ts`
Expected: All tests PASS

**Step 6: Commit**

```bash
git add api/src/services/RecipeService.ts api/src/services/RecipeService.test.ts
git commit -m "feat(recipes): add bulkMove service method

- Move multiple recipes to collection in single UPDATE query
- Validates collection ownership
- Max 100 recipes per operation
- Returns count of moved recipes

[skip ci]"
```

---

## Task 5: Add Bulk Move - Route Layer

**Files:**
- Modify: `api/src/routes/recipes.ts`

**Step 1: Add POST /api/recipes/bulk-move route**

Add after the `/bulk` delete route (around line 408), BEFORE the `/:id` delete route:

```typescript
/**
 * POST /api/recipes/bulk-move - Bulk Move Recipes to Collection
 *
 * Body:
 * - recipeIds: number[] - Recipe IDs to move (required, max 100)
 * - collectionId: number | null - Target collection (null = uncategorized)
 */
router.post('/bulk-move', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }

  const { recipeIds, collectionId } = req.body;

  // Validate recipeIds
  if (!Array.isArray(recipeIds)) {
    return res.status(400).json({
      success: false,
      error: 'recipeIds must be an array'
    });
  }

  // Sanitize and validate IDs
  const sanitizedIds = recipeIds
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0);

  if (sanitizedIds.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'No valid recipe IDs provided'
    });
  }

  if (sanitizedIds.length > 100) {
    return res.status(400).json({
      success: false,
      error: 'Maximum 100 recipes per bulk operation'
    });
  }

  // Validate collectionId (must be null, undefined, or positive integer)
  let targetCollectionId: number | null = null;
  if (collectionId !== null && collectionId !== undefined) {
    const parsedCollectionId = Number(collectionId);
    if (!Number.isInteger(parsedCollectionId) || parsedCollectionId <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid collection ID'
      });
    }
    targetCollectionId = parsedCollectionId;
  }

  const result = await recipeService.bulkMove(sanitizedIds, userId, targetCollectionId);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      error: result.error
    });
  }

  // Get collection name for response message
  let collectionName = 'Uncategorized';
  if (targetCollectionId) {
    const collection = await queryOne<{ name: string }>(
      'SELECT name FROM collections WHERE id = $1 AND user_id = $2',
      [targetCollectionId, userId]
    );
    if (collection) {
      collectionName = collection.name;
    }
  }

  res.json({
    success: true,
    moved: result.moved,
    message: `Moved ${result.moved} recipe(s) to ${collectionName}`
  });
}));
```

**Step 2: Add queryOne import**

At the top of `api/src/routes/recipes.ts`, update the import from database:

```typescript
import { queryOne } from '../database/db';
```

**Step 3: Run tests**

Run: `cd api && npm test`
Expected: All tests PASS

**Step 4: Commit**

```bash
git add api/src/routes/recipes.ts
git commit -m "feat(api): add POST /recipes/bulk-move endpoint

- Accepts recipeIds array and collectionId
- Validates input, sanitizes IDs
- Returns moved count and collection name in message
- Max 100 recipes per request

[skip ci]"
```

---

## Task 6: Frontend - Update API Client

**Files:**
- Modify: `src/lib/api.ts`

**Step 1: Update recipeApi.getAll signature**

Replace the `getAll` method in `src/lib/api.ts` (around line 301):

```typescript
  async getAll(
    page: number = 1,
    limit: number = 50,
    options?: { search?: string; masteryIds?: number[] }
  ): Promise<{
    recipes: Recipe[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNextPage: boolean;
      hasPreviousPage: boolean;
    }
  }> {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(limit));

    if (options?.search) {
      params.set('search', options.search);
    }
    if (options?.masteryIds && options.masteryIds.length > 0) {
      params.set('masteryIds', options.masteryIds.join(','));
    }

    const { data } = await apiClient.get<{
      success: boolean;
      data: Recipe[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        hasNextPage: boolean;
        hasPreviousPage: boolean;
      };
    }>(`/api/recipes?${params.toString()}`);
    return { recipes: data.data, pagination: data.pagination };
  },
```

**Step 2: Add bulkMove method**

Add after the `deleteAll` method (around line 350):

```typescript
  async bulkMove(recipeIds: number[], collectionId: number | null): Promise<{ moved: number; message: string }> {
    const { data } = await apiClient.post<{ success: boolean; moved: number; message: string }>(
      '/api/recipes/bulk-move',
      { recipeIds, collectionId }
    );
    return { moved: data.moved, message: data.message };
  },
```

**Step 3: Commit**

```bash
git add src/lib/api.ts
git commit -m "feat(frontend): add search params and bulkMove to recipe API client

- getAll now accepts optional search and masteryIds params
- Add bulkMove method for single-request collection moves

[skip ci]"
```

---

## Task 7: Frontend - Update useRecipesPage Hook

**Files:**
- Modify: `src/app/recipes/useRecipesPage.ts`

**Step 1: Update loadRecipes to pass search params**

Replace the `loadRecipes` callback (around line 97):

```typescript
  // Load recipes with server-side search
  const loadRecipes = useCallback(async (
    page: number = 1,
    loadAll: boolean = false,
    options?: { search?: string; masteryIds?: number[] }
  ) => {
    try {
      if (loadAll) {
        // Load all with search params
        const firstResult = await recipeApi.getAll(1, 100, options);
        let allRecipes = [...firstResult.recipes];
        const totalPages = firstResult.pagination.totalPages;
        for (let p = 2; p <= totalPages; p++) {
          const pageResult = await recipeApi.getAll(p, 100, options);
          allRecipes = [...allRecipes, ...pageResult.recipes];
        }
        // Deduplicate to prevent React key warnings
        const uniqueRecipes = deduplicateRecipes(allRecipes);
        useStore.setState({ recipes: uniqueRecipes });
        setPagination({
          page: 1,
          limit: uniqueRecipes.length,
          total: uniqueRecipes.length,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false
        });
        setCurrentPage(1);
      } else {
        const result = await recipeApi.getAll(page, 50, options);
        // Deduplicate to prevent React key warnings
        const uniqueRecipes = deduplicateRecipes(result.recipes);
        useStore.setState({ recipes: uniqueRecipes });
        setPagination(result.pagination);
        setCurrentPage(page);
      }
    } catch (error) {
      console.error('Failed to load recipes:', error);
    } finally {
      setHasInitiallyLoaded(true);
    }
  }, []);
```

**Step 2: Update handleBulkMove to use new endpoint**

Replace the `handleBulkMove` callback (around line 402):

```typescript
  const handleBulkMove = useCallback(async () => {
    if (selectedRecipes.size === 0) return;
    try {
      const ids = Array.from(selectedRecipes);
      const result = await recipeApi.bulkMove(ids, bulkMoveCollectionId);

      await loadRecipes(1);
      await fetchCollections();
      setSelectedRecipes(new Set());
      setShowBulkMoveModal(false);
      setBulkMoveCollectionId(null);
      showToast('success', result.message);
    } catch (error) {
      showToast('error', 'Failed to move recipes');
    }
  }, [selectedRecipes, bulkMoveCollectionId, loadRecipes, fetchCollections, showToast]);
```

**Step 3: Add debounced search with server-side filtering**

Add a useEffect for debounced server-side search. After the `searchQuery` state (around line 59), add:

```typescript
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reload when search changes (server-side filtering)
  useEffect(() => {
    if (!isAuthenticated || isValidating || !hasInitiallyLoaded) return;

    // Only trigger server-side search when there's a search term and we're in 'all' tab
    if (activeTab === 'all' && debouncedSearch) {
      loadRecipes(1, true, { search: debouncedSearch });
    } else if (activeTab === 'all' && !debouncedSearch && !masteryFilter) {
      // Clear search - reload without filter
      loadRecipes(1, false);
    }
  }, [debouncedSearch, activeTab, isAuthenticated, isValidating, hasInitiallyLoaded, masteryFilter, loadRecipes]);
```

**Step 4: Update filteredRecipes to skip client-side search when server handled it**

Update the `filteredRecipes` useMemo (around line 195):

```typescript
  // Filter recipes (client-side for spirit filter, server handled search)
  const filteredRecipes = useMemo(() => {
    return recipesArray.filter((recipe) => {
      const ingredientsArray = parseIngredients(recipe.ingredients);
      const ingredientsText = ingredientsArray.join(' ').toLowerCase();

      // Only apply client-side search if NOT in 'all' tab (server handles 'all' tab search)
      const matchesSearch = (activeTab === 'all')
        ? true  // Server already filtered
        : searchQuery
          ? recipe.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            ingredientsText.includes(searchQuery.toLowerCase())
          : true;

      const recipeSpirits = getIngredientSpirits(ingredientsArray);
      const matchesSpirit =
        filterSpirit === 'all' ||
        recipeSpirits.includes(filterSpirit);

      if (masteryFilter) {
        const matchesList = (list: Array<{ id?: number; name: string }> = []) => {
          return list.some(entry => {
            if (recipe.id && entry.id) return entry.id === recipe.id;
            return entry.name.toLowerCase() === recipe.name.toLowerCase();
          });
        };

        switch (masteryFilter) {
          case 'craftable':
            return matchesSearch && matchesSpirit && matchesList(craftableRecipes);
          case 'almost':
            return matchesSearch && matchesSpirit && matchesList(nearMissRecipes);
          case 'need-few':
            return matchesSearch && matchesSpirit && matchesList(needFewRecipes);
          case 'major-gaps':
            return matchesSearch && matchesSpirit && matchesList(majorGapsRecipes);
          default:
            return false;
        }
      }

      const matchesCollection = activeCollection
        ? recipe.collection_id === activeCollection.id
        : activeTab === 'all' ? true : !recipe.collection_id;

      return matchesSearch && matchesSpirit && matchesCollection;
    });
  }, [recipesArray, searchQuery, filterSpirit, masteryFilter, activeCollection, activeTab, craftableRecipes, nearMissRecipes, needFewRecipes, majorGapsRecipes]);
```

**Step 5: Commit**

```bash
git add src/app/recipes/useRecipesPage.ts
git commit -m "feat(frontend): implement server-side search and bulk move

- loadRecipes now accepts search/masteryIds params
- handleBulkMove uses single API call instead of N+1 loop
- Add debounced search triggering server-side filtering
- Client-side filtering only for spirit (needs ingredient parsing)

[skip ci]"
```

---

## Task 8: Final Verification

**Step 1: Run all backend tests**

Run: `cd api && npm test`
Expected: All tests PASS (866+)

**Step 2: Run frontend type check**

Run: `npm run type-check`
Expected: No type errors

**Step 3: Run frontend tests**

Run: `npm test`
Expected: All tests PASS

**Step 4: Manual testing checklist**

- [ ] Search "margarita" in All Recipes tab - finds recipes on any page
- [ ] Search in collection view - still works (client-side)
- [ ] Spirit filter + search - combines correctly
- [ ] Mastery filter - still works
- [ ] Bulk move 5+ recipes - single network request in DevTools
- [ ] Bulk move to Uncategorized - works

**Step 5: Final commit (squash if needed)**

```bash
git add -A
git commit -m "feat: server-side recipe search and bulk move endpoint

Fixes code review findings:
- Remove unused legacy db wrapper (dead code cleanup)
- Add server-side search for recipes (fixes broken search UX)
- Add bulk move endpoint (eliminates N+1 API calls)

Breaking changes: None
Test coverage: All existing tests pass + new tests added"
```

---

## Summary

| Task | Files | Description |
|------|-------|-------------|
| 1 | db.ts | Remove legacy wrapper |
| 2 | RecipeService.ts, .test.ts | Add search to service |
| 3 | recipes.ts route | Add query params |
| 4 | RecipeService.ts, .test.ts | Add bulkMove service |
| 5 | recipes.ts route | Add bulk-move route |
| 6 | api.ts | Update frontend API |
| 7 | useRecipesPage.ts | Wire up frontend |
| 8 | - | Final verification |

**Total: 8 tasks, ~7 files modified**
