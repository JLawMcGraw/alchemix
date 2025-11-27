# AlcheMix AI Cost Optimization Plan: Haiku + Prompt Caching

## 1. Executive Summary

**Objective:** Reduce the operational cost of the AlcheMix AI Bartender by >95% without sacrificing the "all-knowing" context awareness that defines the user experience.

**Current State:**
- **Model:** Claude 3.5 Sonnet
- **Context Strategy:** Full injection of user Inventory + Recipes + MemMachine context on every turn.
- **Estimated Cost:** ~$0.15 - $0.40 per message (50k+ tokens).
- **Scalability:** Prohibitive for 10,000 users.

**Target State:**
- **Model:** Claude 3.5 Haiku
- **Context Strategy:** "Lazy" Full Context injection utilizing **Anthropic Prompt Caching**.
- **Estimated Cost:** ~$0.0015 - $0.015 per message.
- **Scalability:** Profitable/Sustainable.

---

## 2. Technical Architecture

### 2.1 Model Migration
We will migrate from `claude-3-5-sonnet-20241022` (or similar) to **`claude-3-5-haiku-latest`**.
- **Why:** Haiku is ~12x cheaper than Sonnet while maintaining excellent reasoning capabilities for defined tasks like bartending.
- **Trade-off:** Slightly less nuance in creative writing, but negligible for structured recipe recommendations.

### 2.2 Prompt Caching Strategy
Anthropic's Prompt Caching allows us to "upload" the static parts of the prompt (Inventory, Recipes, Persona) once and reference them cheaply in subsequent requests within a 5-minute TTL (Time-To-Live) window.

**The Prompt Structure:**

The prompt is divided into **Blocks**. Caching works on prefixes; we must cache the largest, most static block first.

| Block | Content | Cache Status | Size | Frequency of Change |
| :--- | :--- | :--- | :--- | :--- |
| **Block 1 (System)** | Base Persona ("You are AlcheMix..."), Output Format Rules, Safety Guidelines. | **Cached** | Small (<1k) | Rare |
| **Block 2 (User Data)** | Full Inventory List, Full Recipe Collection, Favorites. | **Cached** | **Huge (10k-50k+)** | Per Session (mostly) |
| **Block 3 (RAG)** | MemMachine Retrieved Context (Specific memories). | Uncached | Medium | Per Request |
| **Block 4 (Chat)** | Recent Conversation History (Last 10 turns). | Uncached | Small | Per Request |
| **Block 5 (Input)** | Current User Message. | Uncached | Small | Per Request |

**Crucial Implementation Detail:**
To maximize cache hits, the **User Data (Block 2)** must be stable.
- We will mark the end of the User Data block with a `cache_control: {"type": "ephemeral"}` breakpoint.
- Any change to the Inventory/Recipes invalidates the cache for that user. This is acceptable as users don't add bottles *during* a chat often.

---

## 3. Implementation Steps

### 3.1 Modify `api/src/routes/messages.ts`

**Step 1: Update Constants & Headers**
- Add the required beta header: `anthropic-beta: prompt-caching-2024-07-31`.
- Update the model string to `claude-3-5-haiku-latest`.

**Step 2: Restructure `buildContextAwarePrompt`**
Currently, this function returns a single giant string. We need to refactor it to return a structured array of content blocks to properly apply cache breakpoints.

*Current:*
```typescript
return `System Prompt... Inventory... Recipes... Instructions...`;
```

*New:*
```typescript
return [
  {
    type: "text",
    text: `System Prompt... Inventory... Recipes...`,
    cache_control: { type: "ephemeral" } // <--- THE MAGIC SWITCH
  },
  {
    type: "text",
    text: `MemMachine Context... Instructions...`
  }
];
```

**Step 3: Update the API Call Payload**
The `messages` array in the Axios call needs to handle this new structure. Note that strictly speaking, System Prompts with caching are supported in the `system` parameter of the API call.

```typescript
const response = await axios.post('https://api.anthropic.com/v1/messages', {
  model: 'claude-3-5-haiku-latest',
  system: [
    {
      type: 'text',
      text: BIG_STATIC_CONTEXT_STRING, // Inventory + Recipes
      cache_control: { type: 'ephemeral' } // Cache this huge block
    },
    {
      type: 'text',
      text: DYNAMIC_INSTRUCTIONS_STRING // MemMachine + Current Rules
    }
  ],
  messages: [
    ...history,
    { role: 'user', content: userMessage }
  ],
  // ...
});
```

### 3.2 Verify Cache Performance
We will add logging to inspect the `usage` field in the Anthropic response.
- `cache_creation_input_tokens`: Tokens written to cache (Full cost).
- `cache_read_input_tokens`: Tokens read from cache (90% discount).

---

## 4. Cost Analysis (The Math)

**Assumptions:**
- **Context Size:** 50,000 tokens (Heavy user).
- **Session Length:** 5 turns.

**Scenario A: Current (Sonnet, No Cache)**
- Cost per msg: 50k * $3.00/1M = $0.15
- Total Session: 5 * $0.15 = **$0.75**

**Scenario B: Haiku (No Cache)**
- Cost per msg: 50k * $0.25/1M = $0.0125
- Total Session: 5 * $0.0125 = **$0.0625** (92% savings)

**Scenario C: Haiku + Prompt Caching (Target)**
- **Turn 1 (Cache Write):**
  - 50k * $0.30/1M (Write Price) = $0.015
- **Turns 2-5 (Cache Read):**
  - 50k * $0.03/1M (Read Price) = $0.0015
- **Total Session:** $0.015 + (4 * $0.0015) = **$0.021**

**Total Savings (Scenario A vs C):**
- $0.75 -> $0.021
- **~97.2% Cost Reduction**

---

## 5. Risks & Mitigations

| Risk | Impact | Mitigation |
| :--- | :--- | :--- |
| **Model "Stupidity"** | Haiku might not understand complex queries as well as Sonnet. | Refine the system instructions to be more explicit. Use "Few-Shot Prompting" (examples) in the cached block. |
| **Cache Misses** | If users chat >5 mins apart, cache expires. | The "Cache Write" cost of Haiku ($0.30/1M) is still 10x cheaper than Sonnet's base cost ($3.00/1M). It's a win-win. |
| **Context Limit** | Haiku has a 200k limit. Extremely large libraries might hit this. | 50k tokens is massive (approx. 1500 recipes). We are safe for 99% of users. We can implement truncation for the top 1% later. |

---

## 6. Next Steps
1.  [ ] Update `api/src/routes/messages.ts` to import types for the new message structure (if needed).
2.  [ ] Refactor `buildContextAwarePrompt` to separate static data (Inventory/Recipes) from dynamic data.
3.  [ ] Switch model to `claude-3-5-haiku-latest`.
4.  [ ] Enable `anthropic-beta` header.
5.  [ ] Deploy and monitor logs for `cache_read_input_tokens`.
