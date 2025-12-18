# Code Review Fixes Design

**Date:** 2025-12-18
**Status:** Approved
**Branch:** `postgresql-deployment`

## Overview

Address three issues identified in code review:
1. Dead code cleanup - Remove unused legacy `db` wrapper
2. Server-side search - Add search/filter params to RecipeService
3. Bulk move endpoint - Eliminate N+1 API calls

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      CHANGES OVERVIEW                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. db.ts                                                    │
│     └── Remove legacy `db` export (lines 236-246)           │
│                                                              │
│  2. Server-Side Search (3 files)                            │
│     ├── RecipeService.ts  → Add search/filter params        │
│     ├── recipes.ts route  → Accept query params             │
│     └── useRecipesPage.ts → Pass params to API              │
│                                                              │
│  3. Bulk Move (4 files)                                     │
│     ├── RecipeService.ts  → Add bulkMove() method           │
│     ├── recipes.ts route  → POST /recipes/bulk-move         │
│     ├── api.ts            → Add recipeApi.bulkMove()        │
│     └── useRecipesPage.ts → Use new endpoint                │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Execution order:** Dead code → Server-side search → Bulk move

---

## 1. Dead Code Removal

Remove legacy `db` export from `api/src/database/db.ts` (lines 236-257):
- `db.prepare()` wrapper
- `db.exec()` wrapper
- `db.pragma()` no-op
- `db.close()` wrapper
- `db.transaction()` wrapper (unsafe - doesn't pass client)
- `convertPlaceholders()` helper

**Verification:** Grep confirms zero usages of `db.transaction` in codebase.

---

## 2. Server-Side Search

### API Contract

```
GET /api/recipes?page=1&limit=50&search=margarita&spirit=tequila&mastery=craftable
```

| Param | Type | Description |
|-------|------|-------------|
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 50) |
| `search` | string | Search term (name OR ingredients contain) |
| `spirit` | string | Spirit category filter |
| `mastery` | string | Mastery level filter |

### Service Interface

```typescript
interface SearchOptions extends PaginationOptions {
  search?: string;
  spirit?: string;
  mastery?: string;
  craftableIds?: number[];
}
```

### Filter Logic

- **search** → SQL: `WHERE (LOWER(name) LIKE $x OR LOWER(ingredients) LIKE $x)`
- **spirit** → Application layer (reuse `getIngredientSpirits` logic)
- **mastery** → SQL: `WHERE id IN ($craftableIds)` (IDs from shopping list service)
- **Combined** → AND logic (all filters must match)

### Why App-Layer Filtering for Spirit/Mastery?

- Spirit detection requires parsing ingredients JSON + keyword matching
- Mastery requires craftability calculation from shopping list service
- Both already computed; moving to SQL is error-prone

---

## 3. Bulk Move Endpoint

### API Contract

```
POST /api/recipes/bulk-move
Content-Type: application/json

{
  "recipeIds": [1, 2, 3, 45, 67],
  "collectionId": 5
}
```

### Response

```json
{
  "moved": 5,
  "message": "Moved 5 recipes to Classic Cocktails"
}
```

### Service Method

```typescript
async bulkMove(
  userId: number,
  recipeIds: number[],
  collectionId: number | null
): Promise<{ moved: number }>
```

### Implementation

- Single UPDATE: `UPDATE recipes SET collection_id = $1 WHERE user_id = $2 AND id = ANY($3)`
- Validate collection ownership before update
- Return affected row count

### Security

- Recipe ownership enforced by `WHERE user_id = $2`
- Collection ownership validated explicitly
- Max 100 recipes per request

---

## Testing Requirements

| File | New Tests |
|------|-----------|
| `RecipeService.test.ts` | `getAll` with search, spirit, mastery, combined |
| `RecipeService.test.ts` | `bulkMove` success, invalid collection, empty array, max limit |
| `recipes.test.ts` | Route query params, input validation, filtered results |
| `recipes.test.ts` | `POST /bulk-move` valid/invalid payloads |

---

## Error Handling

| Scenario | Response |
|----------|----------|
| Search too long | 400 - "Search query too long (max 100 chars)" |
| Invalid spirit filter | Ignore (treat as 'all') |
| Invalid mastery filter | Ignore (treat as no filter) |
| Bulk move empty array | 400 - "No recipe IDs provided" |
| Bulk move >100 recipes | 400 - "Maximum 100 recipes per bulk operation" |
| Invalid collection | 400 - "Collection not found or access denied" |

---

## Files Changed

1. `api/src/database/db.ts` - Remove legacy wrapper
2. `api/src/services/RecipeService.ts` - Add search params + bulkMove
3. `api/src/routes/recipes.ts` - Add query params + bulk-move route
4. `src/lib/api.ts` - Add recipeApi.bulkMove()
5. `src/app/recipes/useRecipesPage.ts` - Use server-side search + bulk endpoint
6. Test files for above
