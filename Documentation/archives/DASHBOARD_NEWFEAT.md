# New Dashboard Features: Implementation Plan

This document provides a detailed, step-by-step plan for implementing three new features on the AlcheMix dashboard:
1.  **The Lab Assistant's Notebook** (Proactive AI suggestions)
2.  **The Daily Briefing Greeting** (Dynamic, AI-powered welcome message)
3.  **Encourage Data Enrichment** (Adding tasting notes to inventory)

---

## 1. & 2. Lab Assistant's Notebook & Daily Briefing Greeting

These two features are combined as they can be powered by a single new API endpoint and AI interaction. The goal is to make the AI feel proactive by providing insights on the dashboard without user input.

### Ⅰ. Backend Plan (`/api` directory)

#### **Step 1: Create a New AI Insight API Endpoint**
1.  **File:** `api/src/routes/messages.ts` (to keep AI logic centralized).
2.  **Action:** Add a new `GET` route handler. This route will be responsible for generating and returning the dashboard greeting and insight.
    ```typescript
    // In api/src/routes/messages.ts, add a new route to the router
    router.get('/dashboard-insight', auth, asyncHandler(getDashboardInsight));
    ```

#### **Step 2: Implement the `getDashboardInsight` Handler**
1.  **File:** `api/src/routes/messages.ts`.
2.  **Action:** Create the new `getDashboardInsight` async function.
3.  **Logic:**
    a.  Retrieve the `user_id` from the request (`req.user.id`).
    b.  Fetch the user's current inventory (`bottles`) and recipes (`recipes`) from the database, similar to how the main `/messages` POST handler does.
    c.  Call a new helper function, `buildDashboardInsightPrompt`, passing the inventory and recipes.
    d.  Send the generated prompt to the Anthropic Claude API.
    e.  Parse the AI's response (expecting a JSON object).
    f.  Send the parsed `{ greeting, insight }` object back to the frontend with a `200 OK` status.

#### **Step 3: Engineer the AI System Prompt**
1.  **File:** A new helper function, `buildDashboardInsightPrompt`, likely co-located with other AI prompt logic.
2.  **Action:** This function will construct a system prompt specifically for this task.
3.  **Prompt Content:**
    *   **Persona:** "You are the AlcheMix Lab Assistant, a master mixologist with a friendly, scientific personality."
    *   **Context:** Provide the user's full inventory and recipe list, clearly formatted.
    *   **Task:** Instruct the AI to perform two actions:
        1.  "First, provide a short, welcoming 'Daily Briefing' greeting (1-2 sentences). Examples: 'The bar is stocked and the tools are clean. A perfect day for mixology.' or 'Good evening, Alchemist. Let's create something memorable.'"
        2.  "Second, provide a single, actionable 'Notebook Insight' (2-3 sentences). This insight should help the user explore their bar. It could be a suggestion to buy a specific ingredient to unlock new recipes, a recommendation for a cocktail they can almost make, or an interesting observation about their collection."
    *   **Format:** "You MUST return the response as a single, minified JSON object with two keys: `greeting` and `insight`. Example: `{\"greeting\":\"...\",\"insight\":\"...\"}`"

### Ⅱ. Frontend Plan (`/src` directory)

#### **Step 1: Update the Zustand Store**
1.  **File:** `src/lib/store.ts`.
2.  **Action:** Add new state variables and an action to the `Store` interface and `createStore` implementation.
    ```typescript
    // In the Store interface
    dashboardGreeting: string;
    dashboardInsight: string;
    isDashboardInsightLoading: boolean;
    fetchDashboardInsight: () => Promise<void>;

    // In the createStore implementation
    dashboardGreeting: 'Ready for your next experiment?', // Default text
    dashboardInsight: '',
    isDashboardInsightLoading: false,
    fetchDashboardInsight: async () => {
      set({ isDashboardInsightLoading: true });
      try {
        const response = await aiApi.getDashboardInsight();
        set({
          dashboardGreeting: response.greeting,
          dashboardInsight: response.insight,
          isDashboardInsightLoading: false,
        });
      } catch (error) {
        console.error('Failed to fetch dashboard insight:', error);
        // Keep default greeting on error
        set({ isDashboardInsightLoading: false });
      }
    },
    ```

#### **Step 2: Update the API Client**
1.  **File:** `src/lib/api.ts`.
2.  **Action:** Add the new function to the `aiApi` object.
    ```typescript
    // In the aiApi object
    getDashboardInsight: async (): Promise<{ greeting: string; insight: string; }> => {
      const { data } = await apiClient.get('/ai/dashboard-insight');
      return data;
    },
    ```

#### **Step 3: Integrate into the Dashboard Page**
1.  **File:** `src/app/dashboard/page.tsx`.
2.  **Action:**
    a.  Destructure the new state and action from `useStore`: `dashboardGreeting`, `dashboardInsight`, `isDashboardInsightLoading`, `fetchDashboardInsight`.
    b.  Call `fetchDashboardInsight()` inside the main `useEffect` hook, alongside the other data-fetching functions.
    c.  **Greeting:** Replace the static `h1` content with the `dashboardGreeting`.
        ```tsx
        <h1 className={styles.greeting}>
          {isDashboardInsightLoading ? 'Brewing up a greeting...' : dashboardGreeting}
        </h1>
        ```
    d.  **Notebook:** Add a new `Card` component to the `overview` section, specifically for the insight. This could be a new, dedicated `DashboardInsightCard.tsx` component.
        ```tsx
        // In the 'overview' section, likely as the first card
        <Card padding="md" className={styles.overviewCard}>
          <div className={styles.cardHeader}>
            <h3 className={styles.cardTitle}>
              <Sparkles size={20} style={{ marginRight: '8px' }} />
              Lab Assistant's Notebook
            </h3>
          </div>
          <div className={styles.cardContent}>
            {isDashboardInsightLoading ? (
              <p>Analyzing your lab notes...</p> // Or a spinner component
            ) : (
              <p className={styles.insightText}>{dashboardInsight}</p>
            )}
          </div>
        </Card>
        ```

---

## 3. Encourage Data Enrichment

This feature focuses on capturing more detailed data about inventory items to improve the quality of AI recommendations.

### Ⅰ. Backend Plan (`/api` directory)

#### **Step 1: Update Database Schema**
1.  **File:** `api/src/database/db.ts`.
2.  **Action:** Modify the `CREATE TABLE bottles` statement to include a new field. We'll use a single `TEXT` field to store unstructured notes, which offers flexibility.
    ```sql
    -- Original
    -- type TEXT,
    -- category TEXT,
    
    -- New
    type TEXT,
    category TEXT,
    tasting_notes TEXT,
    -- ...
    ```

#### **Step 2: Update API Routes**
1.  **File:** `api/src/routes/inventory.ts`.
2.  **Action:**
    a.  **Add Bottle (`POST /`):** Modify the handler to accept an optional `tasting_notes` string from the request body and include it in the `db.prepare('INSERT ...')` statement.
    b.  **Update Bottle (`PUT /:id`):** Modify the handler to accept `tasting_notes` and add it to the `SET` clause of the `UPDATE` statement.
    c.  **Get Inventory (`GET /`):** Ensure the `tasting_notes` field is included in the `SELECT` statement that fetches all bottles.

#### **Step 3: Update Backend Types**
1.  **File:** `api/src/types/index.ts`.
2.  **Action:** Add the optional `tasting_notes` property to the `InventoryItem` type definition.
    ```typescript
    export interface InventoryItem {
      // ... existing fields
      tasting_notes?: string;
    }
    ```

### Ⅱ. Frontend Plan (`/src` directory)

#### **Step 1: Update Frontend Types**
1.  **File:** `src/types/index.ts`.
2.  **Action:** Mirror the backend change by adding `tasting_notes?: string;` to the `Bottle` interface.

#### **Step 2: Update Bottle Modals**
1.  **Files:** `src/components/modals/AddBottleModal.tsx` and `src/components/modals/EditBottleModal.tsx`.
2.  **Action:** In both files, make the following changes:
    a.  Add state to manage the `tasting_notes` input (e.g., `const [tastingNotes, setTastingNotes] = useState('');`). For the `EditBottleModal`, initialize this state with the existing bottle's data.
    b.  Add a `textarea` element to the form for the tasting notes. An `Input` component could be adapted or a new `TextArea` UI component created.
    ```tsx
    <Input
      label="Tasting Notes (Optional)"
      value={tastingNotes}
      onChange={(e) => setTastingNotes(e.target.value)}
      placeholder="e.g., vanilla, oak, hint of citrus..."
      fullWidth
      as="textarea" // Assuming the Input component can be a textarea
    />
    ```
    c.  Add the "encouragement" text below the textarea.
    ```tsx
    <p className={styles.enrichmentHint}>
      Adding notes will improve your Lab Assistant's recommendations.
    </p>
    ```
    d.  Modify the form's `onSubmit` handler to include `tasting_notes: tastingNotes` in the data payload sent to the API (`inventoryApi.add` or `inventoryApi.update`).

#### **Step 3: Update API Client**
1.  **File:** `src/lib/api.ts`.
2.  **Action:** Update the `add` and `update` functions in `inventoryApi` to accept the new data structure containing `tasting_notes`.

### Ⅲ. Final AI Integration

#### **Step 1: Update the AI Context**
1.  **File:** `api/src/routes/messages.ts` (or wherever the main chat prompt is built).
2.  **Action:** When fetching the user's inventory to create the AI context, ensure `tasting_notes` is retrieved.
3.  **Logic:** Format the inventory list for the AI to include these notes.
    *   **Before:** `- Gin (1 bottle)`
    *   **After:** `- Gin (1 bottle). Notes: juniper-forward, with hints of citrus and spice.`

#### **Step 2: Enhance the System Prompt**
1.  **File:** `api/src/routes/messages.ts` (or prompt-building utility).
2.  **Action:** Add an instruction to the main chat system prompt telling the AI how to use the new information.
3.  **Instruction:** "When making recommendations, consider the specific `Tasting Notes` provided for each ingredient to create more nuanced and tailored cocktail suggestions."

