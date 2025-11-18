# Smart Shopping List Feature: Detailed Plan

This document outlines the detailed plan for implementing the "Smart Shopping List" feature in AlcheMix.

## Feature Overview

The "Smart Shopping List" will analyze a user's current bar inventory against their entire recipe collection to identify which single ingredient purchase will unlock the most new cocktails. This provides users with intelligent recommendations on how to expand their cocktail-making capabilities most efficiently.

## Phase 1: Backend API Development

This phase focuses on creating a new, secure API endpoint that performs the core calculations.

### Step 1: Create the New Route File

*   **File:** `api/src/routes/shoppingList.ts`
*   **Action:** Create a new file to house the logic for the shopping list feature. It will define a new Express router.

### Step 2: Define the `GET /smart` Endpoint

*   **File:** `api/src/routes/shoppingList.ts`
*   **Action:**
    1.  The route will be `GET /smart`.
    2.  It will be protected by the existing `auth` middleware to ensure only logged-in users can access it.
    3.  It will use the `asyncHandler` utility to manage asynchronous operations and errors gracefully.

### Step 3: Implement the Core "Near Miss" Logic

*   **File:** `api/src/routes/shoppingList.ts`
*   **Action:** This is the heart of the feature. The endpoint will perform the following sequence:
    1.  **Fetch Data:** Get the user's ID from the request and fetch two sets of data from the database:
        *   The user's current inventory (a list of their bottle names).
        *   All of the user's recipes (specifically their ingredient lists).
    2.  **Identify Craftable Recipes:** Determine which recipes are already makeable with the current inventory. A helper function will be created to check if all of a recipe's ingredients are present in the user's inventory.
    3.  **Find "Near Misses":** For all the *uncraftable* recipes, identify which ones are missing exactly **one** ingredient.
    4.  **Parse and Count Missing Ingredients:**
        *   For each "near miss" recipe, parse the name of the single missing ingredient (e.g., extracting "Angostura Bitters" from "2 dashes Angostura Bitters").
        *   Create a tally, counting how many new recipes each unique missing ingredient would unlock.
    5.  **Format and Sort:** The final result will be an array of objects, like `[{ ingredient: 'Angostura Bitters', unlocks: 20 }]`, sorted in descending order by the number of unlocked recipes.
    6.  **Return JSON:** The sorted array will be sent back to the frontend as a JSON response.

### Step 4: Integrate the New Route into the Server

*   **File:** `api/src/server.ts`
*   **Action:** Import the new `shoppingList` router and mount it at the `/api/shopping-list` path, making the endpoint accessible.

### Step 5: Write Comprehensive Backend Tests

*   **File:** `api/src/routes/shoppingList.test.ts`
*   **Action:** Create a new test file to ensure the API endpoint is reliable. Tests will cover:
    *   An unauthenticated user being denied access.
    *   The endpoint returning correct results for various scenarios (e.g., no recipes, no inventory, a simple near miss, multiple complex near misses).
    *   Verification that the results are correctly sorted.

## Phase 2: Frontend UI Development

This phase focuses on creating a new page to display the smart shopping list to the user.

### Step 1: Add a New API Function

*   **File:** `src/lib/api.ts`
*   **Action:** Add a new function, `getSmartShoppingList()`, which will be responsible for calling the `GET /api/shopping-list/smart` endpoint created in Phase 1.

### Step 2: Update the Global State

*   **File:** `src/lib/store.ts`
*   **Action:** Extend the Zustand store to manage the state for the new feature, including:
    *   `shoppingListSuggestions`: An array to hold the data from the API.
    *   `isLoadingShoppingList`: A boolean to show a loading spinner while data is being fetched.
    *   An action to trigger the API call and update the store with the results.

### Step 3: Add a Navigation Link

*   **File:** `src/components/layout/TopNav.tsx`
*   **Action:** Add a new link to the main navigation bar, labeled "Shopping List," so users can easily find the new page. Include a relevant icon from the Lucide icon library.

### Step 4: Create the Shopping List Page Component

*   **File:** `src/app/shopping-list/page.tsx`
*   **Action:** Create the main React component for the page. Its responsibilities will be:
    *   Using the `useAuthGuard` hook to protect the page.
    *   Calling the new action from the Zustand store to fetch the data when the page loads.
    *   Displaying a loading spinner while the API request is in progress.
    *   Rendering the list of suggestions from the store, or showing an informative message if the list is empty.

### Step 5: Style the New Page

*   **File:** `src/app/shopping-list/shopping-list.module.css`
*   **Action:** Create a corresponding CSS module to style the page, ensuring it matches the project's existing design system. A clean, card-based layout will be used to present the suggestions.
