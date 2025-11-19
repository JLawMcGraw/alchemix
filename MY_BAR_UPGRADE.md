# My Bar Page Upgrade: A Step-by-Step Plan

This document outlines the full plan to upgrade the "My Bar" page. The goal is to refactor the inventory system from a rigid "bottle-only" model to a flexible system that supports various item categories (spirits, mixers, garnishes, etc.) and to overhaul the UI to be more modern, intuitive, and consistent with the "Recipes" page.

---

## Part 1: Backend & Data Model Refactor (The Foundation)

The first and most critical phase is to evolve the backend data model. All frontend changes depend on this.

### Step 1.1: Evolve the Database Schema

We will rename the `bottles` table and add a `category` column to properly classify items.

-   **File to Modify**: `api/src/database/db.ts`
-   **Action 1**: Rename the `bottles` table to `inventory_items`.
-   **Action 2**: Add a new `category` column of type `TEXT` to the `inventory_items` table.

**Example `db.ts` Schema Change:**

```javascript
// Before
const createBottlesTable = `
  CREATE TABLE IF NOT EXISTS bottles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    name TEXT NOT NULL,
    "Liquor Type" TEXT,
    "ABV (%)" REAL,
    // ... other fields
    FOREIGN KEY (user_id) REFERENCES users (id)
  );
`;

// After
const createInventoryItemsTable = `
  CREATE TABLE IF NOT EXISTS inventory_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK(category IN ('spirit', 'liqueur', 'mixer', 'garnish', 'syrup', 'wine', 'beer', 'other')),
    type TEXT, -- Formerly "Liquor Type"
    abv REAL, -- Formerly "ABV (%)"
    // ... other fields can be made more generic or moved to a JSON field
    FOREIGN KEY (user_id) REFERENCES users (id)
  );
`;
```
*Note: We will also rename the columns to be more standard (e.g., `"ABV (%)"` -> `abv`).*

### Step 1.2: Update API Endpoints & Logic

The API needs to be updated to reflect the new database schema and purpose.

-   **File to Modify**: Rename `api/src/routes/inventory.ts` to `api/src/routes/inventoryItems.ts`.
-   **Action 1**: Change the base route from `/api/inventory` to `/api/inventory-items`. This will be updated in the main server file and the frontend client.
-   **Action 2**: Update the CRUD (Create, Read, Update, Delete) logic in the route handler:
    -   `POST /` (Add Item): The request body must now include the `category`. The logic will save this to the new column.
    -   `PUT /:id` (Update Item): The update logic will also handle changes to the `category`.
    -   `GET /` (Fetch Items): The endpoint should be enhanced to support filtering by the new `category` field (e.g., `/api/inventory-items?category=syrup`).

---

## Part 2: Frontend Refactor (The User Experience)

With the backend updated, we will overhaul the frontend to create a better user experience.

### Step 2.1: Update Frontend Data Layer

First, we'll update the frontend's understanding of the data.

1.  **Update Types (`src/types/index.ts`)**:
    -   Rename the `Bottle` interface to `InventoryItem`.
    -   Add the `category: string;` property and rename other fields to match the new schema.

2.  **Update State Management (`src/lib/store.ts`)**:
    -   In the Zustand store, rename the `bottles` array to `inventoryItems`.
    -   Rename associated functions: `fetchBottles` -> `fetchItems`, `addBottle` -> `addItem`, etc.

3.  **Update API Client (`src/lib/api.ts`)**:
    -   Rename `inventoryApi` to `inventoryItemsApi`.
    -   Update its methods to call the new `/api/inventory-items` endpoints.

### Step 2.2: Overhaul "My Bar" Page UI

We will transform the page from a simple table to a dynamic, tabbed interface.

-   **File to Modify**: `src/app/bar/page.tsx`
-   **Action 1: Implement Tabbed Navigation**:
    -   Remove the "Filter by Type" dropdown.
    -   Create a list of tabs for each category (Spirits, Liqueurs, Mixers, etc.). Clicking a tab will filter the displayed items.
-   **Action 2: Implement Card Grid**:
    -   Replace the `<table>` with a grid of `Card` components, similar to the "Recipes" page.
    -   Each card will display a summary of an item (e.g., name, type).
    -   Clicking a card will open a detail modal.

**Conceptual Component Structure:**

```jsx
<div className="bar-page">
  <Tabs onSelect={setActiveCategory}>
    <Tab title="Spirits" />
    <Tab title="Syrups" />
    <Tab title="Garnishes" />
    {/* ...etc... */}
  </Tabs>

  <div className="items-grid">
    {filteredItems.map(item => (
      <ItemCard key={item.id} item={item} onClick={() => openDetailModal(item)} />
    ))}
  </div>
</div>
```

### Step 2.3: Implement New & Updated Modals

We will adopt the "detail modal" pattern for viewing and editing.

1.  **Update the "Add" Modal**:
    -   **File**: Rename `src/components/modals/AddBottleModal.tsx` to `AddItemModal.tsx`.
    -   **Action**: Add a required `<select>` dropdown for "Category". Based on the selected category, we can conditionally show/hide other fields (e.g., hide "ABV" for "Garnish").

2.  **Create a New "Detail" Modal**:
    -   **File**: Create `src/components/modals/ItemDetailModal.tsx`.
    -   **Action**: This modal will be based on `RecipeDetailModal.tsx`. It will open when an item card is clicked and will have two modes:
        -   **View Mode**: Displays all properties of the item in a clean, read-only format.
        -   **Edit Mode**: Allows the user to edit all properties directly within the modal.
    -   This new, unified modal will replace the old `EditBottleModal.tsx`.

---

## Summary of Changes & Renames

| Old Name | New Name | File Path |
| :--- | :--- | :--- |
| `bottles` (DB Table) | `inventory_items` | `api/src/database/db.ts` |
| `/api/inventory` (Route) | `/api/inventory-items` | `api/src/routes/...` |
| `inventory.ts` (Route File) | `inventoryItems.ts` | `api/src/routes/` |
| `Bottle` (Type) | `InventoryItem` | `src/types/index.ts` |
| `bottles` (Zustand state) | `inventoryItems` | `src/lib/store.ts` |
| `AddBottleModal.tsx` | `AddItemModal.tsx` | `src/components/modals/` |
| `EditBottleModal.tsx`| (deprecated) | `src/components/modals/` |
| (new file) | `ItemDetailModal.tsx` | `src/components/modals/` |

By following this plan, we will create a robust, scalable, and highly user-friendly inventory management system that seamlessly integrates with the existing application design.
