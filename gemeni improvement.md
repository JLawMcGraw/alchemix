# Gemini Codebase Improvement Plan

**Date:** November 22, 2025
**Status:** Proposed
**Goal:** To address critical performance bottlenecks, refactor architectural technical debt, and enhance type safety across the AlcheMix monorepo.

---

## 🚨 Phase 1: Critical Performance Fixes (High Priority)

These issues directly impact user experience and application scalability. They should be addressed immediately.

### 1. Fix "Fetch All" Anti-Pattern in Inventory
**Severity:** High
**Files:** `src/lib/store.ts`, `src/app/bar/page.tsx`

**The Issue:**
The `fetchItems` action in the Zustand store currently loops through every single page of data from the API (`while (hasMore)`) before updating the UI. For a user with 1,000 bottles, this triggers 10+ sequential HTTP requests, causing the application to "hang" on loading.

**Implementation Plan:**
1.  **Update Store State:**
    -   Add pagination metadata to the store state (e.g., `inventoryPagination: { page: 1, totalPages: 1, total: 0 }`).
2.  **Refactor `fetchItems` Action:**
    -   Remove the `while` loop.
    -   Change signature to accept optional parameters: `fetchItems(page?: number, limit?: number, category?: string)`.
    -   Update state with the specific page of data returned by the API.
3.  **Update Frontend UI (`BarPage`):**
    -   Implement a `<Pagination />` component (Prev/Next/Page Numbers).
    -   Connect pagination controls to the `fetchItems` action.
    -   Remove client-side "loading" blocking behavior in favor of a suspense or skeleton state for the table only.

### 2. Implement Server-Side Filtering
**Severity:** High
**Files:** `src/app/bar/page.tsx`, `src/lib/api.ts`, `src/lib/store.ts`

**The Issue:**
Currently, the frontend requests *all* items and filters them by category (e.g., "Spirits", "Wine") in the browser. Combined with the issue above, this is inefficient.

**Implementation Plan:**
1.  **Update API Client (`inventoryApi.getAll`):**
    -   Ensure it accepts and properly serializes `category`, `search`, and `sort` query parameters.
2.  **Update Store Action:**
    -   Pass these parameters through `fetchItems` to the API client.
3.  **Refactor `BarPage` Logic:**
    -   Instead of `filteredItems = items.filter(...)`, trigger `fetchItems({ category: activeCategory })` when a tab is clicked.
    -   This ensures we only fetch the data the user is actually looking at.

---

## 🏗️ Phase 2: Architectural Simplifications (Medium Priority)

Refactoring these areas will make the codebase easier to maintain and less prone to bugs as it scales.

### 3. Refactor Monolithic Zustand Store
**Severity:** Medium
**Files:** `src/lib/store.ts`

**The Issue:**
`store.ts` is a "God Object" (~400+ lines) managing Auth, Inventory, Recipes, Collections, Chat, and Shopping List. This makes it difficult to read and maintain.

**Implementation Plan:**
1.  **Create Slice Pattern:**
    -   Create a directory `src/lib/store/`.
    -   Define individual slices:
        -   `createAuthSlice.ts`
        -   `createInventorySlice.ts`
        -   `createRecipeSlice.ts`
        -   `createChatSlice.ts`
2.  **Merge Slices:**
    -   Re-implement `useStore` in `src/lib/store/index.ts` to combine these slices using Zustand's slice pattern.
    -   This preserves the "single store" API (`useStore()`) while separating the logic internally.

### 4. Generic API Request Wrapper
**Severity:** Low (DX improvement)
**Files:** `src/lib/api.ts`

**The Issue:**
API methods manually repeat the response unwrapping logic (`const { data } = await ...; return data.data;`).

**Implementation Plan:**
1.  Create a helper function:
    ```typescript
    const request = async <T>(method: 'get'|'post'|'put'|'delete', url: string, data?: any, config?: AxiosRequestConfig): Promise<T> => {
      try {
        const response = await apiClient[method](url, data, config);
        return response.data.data;
      } catch (error) {
        // Centralized error normalization
        throw error;
      }
    };
    ```
2.  Refactor specific API objects (`inventoryApi`, `authApi`) to use this wrapper, reducing boilerplate code by ~40%.

---

## 🔒 Phase 3: Backend & Security Enhancements (Medium Priority)

### 5. Adopt Zod for Validation
**Severity:** Medium
**Files:** `api/src/routes/*.ts`, `api/src/utils/inputValidator.ts`

**The Issue:**
Validation logic (e.g., `validateBottleData`) is manually written, verbose, and prone to edge cases.

**Implementation Plan:**
1.  **Install Zod:** `npm install zod` in the `/api` directory.
2.  **Define Schemas:**
    -   Create `api/src/schemas/inventory.ts`:
        ```typescript
        export const BottleSchema = z.object({
          name: z.string().min(1).max(255),
          abv: z.number().min(0).max(100).optional(),
          // ...
        });
        ```
3.  **Refactor Routes:**
    -   Replace custom validation functions with `BottleSchema.parse(req.body)`.
    -   This automatically handles type coercion, valid string formats, and returns detailed error messages.

### 6. Structured Logging Replacement
**Severity:** Low
**Files:** Global

**The Issue:**
`console.log` and `console.error` are used in production code paths.

**Implementation Plan:**
1.  **Enforce Winston:**
    -   Ensure the `logger` utility (`api/src/utils/logger.ts`) is imported in all route handlers.
    -   Replace `console.error` with `logger.error` to capture stack traces and metadata consistently.
    -   Replace `console.log` with `logger.info` or `logger.debug`.
2.  **Cleanup:**
    -   Remove `console.log` debugging statements from the frontend production build (can be configured in `next.config.js` compiler options).

---

## 🔮 Phase 4: Long-Term Maintenance (Low Priority)

### 7. Database Migration Strategy
**Severity:** Medium (Long term)
**Files:** `api/src/database/db.ts`

**The Issue:**
Schema changes are currently handled by a single `initializeDatabase` function. As the app grows, managing complex schema changes (renaming columns, data backfills) will become risky.

**Implementation Plan:**
1.  **Adopt a Migration Tool:**
    -   Integrate a tool like `db-migrate` or utilize a lightweight custom migration runner.
2.  **Versioned Migrations:**
    -   Create a `migrations` table in SQLite.
    -   Move schema creation queries into timestamped files (e.g., `20251122_create_users.sql`).
    -   Run pending migrations on server startup automatically.

### 8. Type Safety with Query Builder
**Severity:** Low
**Files:** `api/src/database/`

**The Issue:**
Database results are manually cast (e.g., `as Bottle[]`). If the DB schema drifts from the TypeScript interface, the app will crash at runtime.

**Implementation Plan:**
1.  **Evaluate Kysely:**
    -   Kysely is a type-safe SQL query builder that works well with SQLite.
    -   Define DB interfaces once.
2.  **Refactor Queries:**
    -   Replace raw SQL strings (`SELECT * FROM ...`) with builder syntax (`db.selectFrom('bottles').selectAll().execute()`).
    -   This provides compile-time guarantees that your queries match your schema.
