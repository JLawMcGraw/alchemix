# Alchemix MemMachine Integration: A Detailed Implementation Blueprint

## 1. Executive Summary & Core Concepts

### 1.1 The Goal: A Stateful AI Bartender

This document provides a comprehensive, step-by-step implementation plan to integrate **MemMachine**, an open-source AI memory layer, into the Alchemix ecosystem.

The objective is to elevate the Alchemix AI from a stateless "database wrapper" into a stateful, intelligent **AI Bartender**. This new AI will:
-   **Remember** user preferences, allergies, and feedback across sessions.
-   **Learn** a user's taste profile over time.
-   **Proactively** suggest recipes based on learned preferences.
-   **Drastically optimize** LLM token usage and reduce API costs by avoiding redundant data transmission.

### 1.2 The "Why": From Simple Context to True Memory

Currently, the AI's context is rebuilt from scratch with every single message, sending the user's entire inventory and recipe list to the LLM. This is inefficient, expensive, and stateless.

This plan implements a **Retrieval Augmented Generation (RAG)** architecture.
-   **Retrieval:** Instead of sending everything, we first retrieve only the *most relevant* information from a specialized memory store (MemMachine).
-   **Augmentation:** We then "augment" the user's immediate query with this retrieved context.
-   **Generation:** Finally, we send this much smaller, targeted prompt to the LLM for generation.

This approach transforms the AI's capabilities from short-term context to persistent, long-term memory.

### 1.3 The Architecture: A Collaborative Microservice Approach

We will run MemMachine as a dedicated Python microservice alongside the existing Node.js Alchemix backend.

-   **Alchemix API (Node.js):** Remains the primary application backend, handling user authentication, business logic, and UI communication. It will now act as an orchestrator, querying MemMachine for context.
-   **MemMachine API (Python):** Functions as the AI's "hippocampus." It manages the storage and retrieval of memories, handling complex semantic searches and vector embeddings.

This separation of concerns ensures a clean, scalable, and maintainable architecture.

---

## 2. Phase 1: Environment Setup & Repository Structure

**Objective:** Prepare the local development environment by establishing the directory structure and creating placeholder files for the new microservice.

### 2.1 Clone the MemMachine Repository

We will set up MemMachine as a sibling directory to the `alchemix` project. This keeps the projects separate but allows them to be managed within the same workspace and connected via Docker.

**Action:** From the root of your workspace (one level **above** `alchemix/`), run:

```bash
# This clones the repository into a new folder named 'memmachine'
git clone https://github.com/MemMachine/MemMachine.git memmachine
```

Your workspace directory should now look like this:
```
/your-workspace-root
├── alchemix/      <-- Existing Alchemix project
└── memmachine/    <-- Newly cloned MemMachine project
```

### 2.2 Create the Bar Assistant Agent Directory

MemMachine is designed to be extensible. We will create a dedicated Python package within its `examples` directory to house all Alchemix-specific logic.

**Action:** Navigate into the `memmachine` directory and create the required files.

```bash
cd memmachine/examples
mkdir bar_assistant
touch bar_assistant/__init__.py
touch bar_assistant/bar_server.py
touch bar_assistant/query_constructor.py
touch bar_assistant/ingest_recipes.py
```

**Purpose of each file:**
-   `__init__.py`: Makes the `bar_assistant` directory a Python package, allowing for relative imports.
-   `bar_server.py`: The FastAPI entry point for our microservice. This script will configure and launch the web server.
-   `query_constructor.py`: The "brain" of our agent. This module will contain the logic for transforming a user's chat message into a powerful semantic search query.
-   `ingest_recipes.py`: A utility script to perform the one-time action of populating MemMachine's knowledge base with Alchemix recipes.

---

## 3. Phase 2: The Bar Assistant Agent (Python Implementation)

**Objective:** Implement the core logic of the memory microservice in Python.

### 3.1 Implement the Query Constructor

This is the most critical part of the agent's logic. It intercepts the user's message and reformulates it into a highly descriptive query for the vector database, ensuring we retrieve the most relevant memories.

**Action:** Populate `memmachine/examples/bar_assistant/query_constructor.py`.

```python
# File: memmachine/examples/bar_assistant/query_constructor.py

import sys
import os
from typing import Dict, Any

# Ensure we can import from the parent 'examples' directory to access MemMachine's base classes
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from base_query_constructor import BaseQueryConstructor

class BarQueryConstructor(BaseQueryConstructor):
    """
    Constructs a specialized search query for the Alchemix memory store.

    This class enhances the user's raw query with semantic keywords and explicit
    instructions for the retrieval system, focusing on flavor profiles, spirit types,
    and crucial user constraints like allergies or dislikes.
    """
    def create_query(self, query: str, **kwargs) -> str:
        """
        Transforms a simple user input string into a rich, semantic search query.

        Args:
            query: The raw chat message from the user (e.g., "I want something fruity").
            **kwargs: Additional context if needed (e.g., user_id).

        Returns:
            A detailed string that will be converted into a vector embedding for searching memories.
        """
        # 1. Define High-Value Keywords for Semantic Enrichment
        # These lists can be expanded over time.
        flavors = ["sweet", "sour", "bitter", "smoky", "dry", "fruity", "spicy", "herbal", "creamy", "tart"]
        spirits = ["gin", "vodka", "rum", "whiskey", "tequila", "mezcal", "brandy", "cognac", "scotch"]
        actions = ["make", "suggest", "recommend", "create", "find"]
        
        lower_query = query.lower()
        found_flavors = [f for f in flavors if f in lower_query]
        found_spirits = [s for s in spirits if s in lower_query]
        is_suggestion_request = any(action in lower_query for action in actions)

        # 2. Construct a Rich Search Context
        # This detailed prompt guides the vector search to find the most relevant memories.
        # It's more effective than just using the raw query.
        search_context = f"User Query: \"{query}\"\n"
        
        if is_suggestion_request:
            search_context += "Intent: The user is asking for a recipe suggestion.\n"

        if found_spirits:
             search_context += f"Primary Subject: The user is asking about {', '.join(found_spirits)}. Search for recipes containing these spirits and any past user feedback related to them.\n"
        
        if found_flavors:
            search_context += f"Flavor Profile: The user mentioned a preference for {', '.join(found_flavors)} flavors. Prioritize memories matching this taste profile.\n"

        # 3. Add Mandatory Checks for Critical User-Specific Constraints
        # This ensures that safety and strong preferences are always checked.
        search_context += "CRITICAL CHECK: Always retrieve memories related to user's stated 'dislikes', 'hates', 'allergies', or 'never wants' to ensure suggestions are safe and enjoyable."

        print(f"Constructed Query for Embedding:\n---\n{search_context}\n---")

        return search_context
```

### 3.2 Implement the Microservice Server

This script uses MemMachine's application factory to create a standard FastAPI app but injects our custom query constructor logic.

**Action:** Populate `memmachine/examples/bar_assistant/bar_server.py`.

```python
# File: memmachine/examples/bar_assistant/bar_server.py

import os
import uvicorn
from dotenv import load_dotenv
from query_constructor import BarQueryConstructor

# It's assumed MemMachine provides a re-usable app factory.
# This allows us to benefit from its pre-configured routes (/retrieve, /v1/memories)
# while only needing to provide our custom business logic.
from example_server import create_app

# Load environment variables from a .env file (e.g., for API keys)
load_dotenv()

# --- Initialization ---
# 1. Instantiate our custom query constructor.
#    This object will be passed into the application.
print("Initializing BarQueryConstructor...")
bar_constructor = BarQueryConstructor()

# 2. Create the FastAPI application instance.
#    The `create_app` factory handles all the boilerplate of setting up routes,
#    database connections, and embedding models. We inject our logic here.
print("Creating FastAPI application with custom query constructor...")
app = create_app(query_constructor=bar_constructor)
print("Application created successfully.")

# --- Server Entry Point ---
if __name__ == "__main__":
    # Get port from environment variables, defaulting to 8001.
    port = int(os.getenv("BAR_ASSISTANT_PORT", 8001))
    
    # Use Uvicorn, a high-performance ASGI server, to run the app.
    print(f"🍹 Alchemix Bar Assistant Memory Layer starting on http://0.0.0.0:{port}")
    uvicorn.run(app, host="0.0.0.0", port=port)
```

---

## 4. Phase 3: Infrastructure as Code (Docker)

**Objective:** Containerize the new Python microservice and enable seamless communication with the Alchemix backend using Docker Compose.

### 4.1 Update Docker Compose Configuration

We will modify the Docker Compose file to define the `memmachine` service and connect it to the same network as the Alchemix services.

**Action:** In the `alchemix` project root, create or update a `docker-compose.dev.yml` file.

```yaml
# File: alchemix/docker-compose.dev.yml

version: '3.8'

services:
  # ... your existing alchemix_api and other services ...
  # Ensure they are also on the 'alchemix-network'

  memmachine:
    # Build the Docker image for this service.
    build:
      # The context is the path to the directory containing the Dockerfile.
      # We point to the sibling 'memmachine' directory.
      context: ../memmachine
      dockerfile: Dockerfile # Assumes a standard Dockerfile exists in the memmachine root.
    container_name: alchemix_memory
    ports:
      # Map port 8001 of the container to port 8001 on the host machine.
      # This is useful for direct testing with tools like curl.
      - "8001:8001"
    environment:
      # Pass environment variables into the container.
      # This is crucial for API keys needed for embeddings.
      - OPENAI_API_KEY=${OPENAI_API_KEY} # Or ANTHROPIC_API_KEY if used for embeddings
      - BAR_ASSISTANT_PORT=8001
      # If MemMachine uses a persistent DB like Postgres/Neo4j, connection strings would go here.
    command: python examples/bar_assistant/bar_server.py
    networks:
      # Connect this service to our shared virtual network.
      - alchemix-network
    restart: unless-stopped

networks:
  alchemix-network:
    # Define the shared bridge network. This allows services to communicate
    # with each other using their service names (e.g., http://memmachine:8001).
    driver: bridge
```

**Key Concepts:**
-   **`context: ../memmachine`**: Tells Docker to look for the `Dockerfile` in the parent directory's `memmachine` folder.
-   **`networks: - alchemix-network`**: This is the magic that allows the Alchemix API container to make an HTTP request to `http://memmachine:8001` and have it resolve correctly.
-   **`environment`**: This securely passes secrets from your host machine (or a `.env` file) into the container, avoiding hardcoding keys in the source code.

---

## 5. Phase 4: Data Ingestion Strategy

**Objective:** Populate the MemMachine vector store with Alchemix's recipe data, turning static recipes into searchable "knowledge memories."

### 5.1 The Ingestion Script (Enhanced)

Instead of using a hardcoded list, this script will fetch recipes directly from the running Alchemix API. This makes it reusable and ensures it ingests the real, complete dataset.

**Action:** Populate `memmachine/examples/bar_assistant/ingest_recipes.py`.

```python
# File: memmachine/examples/bar_assistant/ingest_recipes.py

import requests
import json
import os

# --- Configuration ---
# The URL for MemMachine's memory creation endpoint.
MEMMACHINE_API_URL = os.getenv("MEMMACHINE_API_URL", "http://localhost:8001/v1/memories")

# The URL for the Alchemix API's recipe endpoint.
# Assumes the backend is running and accessible during ingestion.
ALCHEMIX_API_URL = os.getenv("ALCHEMIX_API_URL", "http://localhost:3000/api/recipes")

# A special, system-level user ID to hold global, non-user-specific knowledge.
# This ensures recipes are retrieved for ALL users.
KNOWLEDGE_BASE_USER_ID = "system_knowledge_base" 

# A valid JWT token from Alchemix is required to access the /api/recipes endpoint.
# This should be acquired by logging in with a test user.
ALCHEMIX_JWT_TOKEN = os.getenv("ALCHEMIX_JWT_TOKEN", "your_jwt_token_here")


def fetch_recipes_from_alchemix():
    """Fetches all recipes from the Alchemix API."""
    print(f"Fetching recipes from {ALCHEMIX_API_URL}...")
    headers = {
        "Authorization": f"Bearer {ALCHEMIX_JWT_TOKEN}"
    }
    try:
        response = requests.get(ALCHEMIX_API_URL, headers=headers)
        response.raise_for_status()
        print(f"Successfully fetched {len(response.json())} recipes.")
        return response.json()
    except Exception as e:
        print(f"❌ CRITICAL: Failed to fetch recipes from Alchemix API. Error: {e}")
        print("Please ensure the Alchemix backend is running and the JWT token is valid.")
        return []

def ingest_recipe(recipe: dict):
    """Ingests a single recipe into MemMachine."""
    
    # Create a text representation of the recipe for semantic search.
    # The more descriptive this is, the better the search results.
    recipe_text = (
        f"Recipe for {recipe.get('name', 'N/A')}. "
        f"Type: {recipe.get('category', 'N/A')}. "
        f"Primary Ingredients: {recipe.get('ingredients', 'N/A')}. "
        f"Instructions: {recipe.get('instructions', 'N/A')}"
    )

    # Metadata allows for structured filtering in the future.
    metadata = {
        "source": "alchemix_db",
        "type": "recipe",
        "recipe_id": recipe.get('id'),
        "recipe_name": recipe.get('name'),
        "category": recipe.get('category'),
        # Storing ingredients allows for future exact-match filtering if needed.
        "ingredients_list": recipe.get('ingredients', '').split(',') if isinstance(recipe.get('ingredients'), str) else recipe.get('ingredients', [])
    }
    
    payload = {
        "user_id": KNOWLEDGE_BASE_USER_ID,
        "text": recipe_text, # The text that will be converted to a vector embedding.
        "metadata": metadata
    }
    
    try:
        response = requests.post(MEMMACHINE_API_URL, json=payload)
        response.raise_for_status()
        print(f"✅ Ingested Recipe: {recipe.get('name')}")
    except Exception as e:
        print(f"❌ Failed to ingest {recipe.get('name')}. Error: {e}")

if __name__ == "__main__":
    if not ALCHEMIX_JWT_TOKEN or ALCHEMIX_JWT_TOKEN == "your_jwt_token_here":
        print("⚠️ WARNING: ALCHEMIX_JWT_TOKEN is not set. Please set it as an environment variable.")
    else:
        print("🚀 Starting Alchemix Recipe Ingestion for MemMachine...")
        recipes = fetch_recipes_from_alchemix()
        if recipes:
            print(f"\nIngesting {len(recipes)} recipes into knowledge base...")
            for r in recipes:
                ingest_recipe(r)
            print("\n✅ Ingestion process complete.")
```
**To run this script:**
1.  Launch the Alchemix stack (`npm run dev:all` or `docker-compose up`).
2.  Log in to the Alchemix UI and get a valid JWT token from your browser's developer tools (Local Storage).
3.  Set the token as an environment variable: `export ALCHEMIX_JWT_TOKEN="eyJ..."`
4.  Run the script: `python memmachine/examples/bar_assistant/ingest_recipes.py`

---

## 6. Phase 5: Alchemix Backend Integration (TypeScript)

**Objective:** Modify the Alchemix API to communicate with the MemMachine service, transforming the chat endpoint into a memory-aware RAG pipeline.

### 6.1 Create a `MemoryService` Client

This service will encapsulate all communication logic with the `memmachine` microservice.

**Action:** Create a new file at `api/src/services/MemoryService.ts`.

```typescript
// File: api/src/services/MemoryService.ts

import fetch from 'node-fetch';

// The URL for the memory service. When running in Docker, 'memmachine' is the hostname.
const MEMORY_API_URL = process.env.MEMORY_API_URL || 'http://memmachine:8001';

/**
 * A client service for interacting with the MemMachine microservice.
 */
export class MemoryService {
  
  /**
   * Retrieves relevant context (user preferences, recipes, etc.) from MemMachine.
   * This is the "Retrieval" step in RAG.
   * @param userId - The ID of the current user.
   * @param query - The user's latest chat message.
   * @returns A string containing the retrieved context, or an empty string if retrieval fails.
   */
  static async getContext(userId: string, query: string): Promise<string> {
    // Feature flag to disable this service if needed.
    if (process.env.MEMMACHINE_ENABLED !== 'true') {
      return "";
    }

    try {
      const response = await fetch(`${MEMORY_API_URL}/retrieve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          query: query
        })
      });

      if (!response.ok) {
        throw new Error(`Memory retrieval failed with status: ${response.status}`);
      }

      const data = await response.json();
      // The context is constructed by MemMachine and returned.
      return data.context || ""; 
    } catch (error) {
      console.warn("⚠️ MemMachine service is unavailable or failed. Proceeding without memory context.", error);
      // Fallback: return an empty string to ensure the application doesn't crash.
      return "";
    }
  }

  /**
   * Stores a new piece of information in the user's memory.
   * This is a "fire-and-forget" operation to avoid delaying the response to the user.
   * @param userId - The ID of the current user.
   * @param text - The text content of the memory to store.
   * @param metadata - An object for structured data associated with the memory.
   */
  static async addMemory(userId: string, text: string, metadata: object = {}): Promise<void> {
    if (process.env.MEMMACHINE_ENABLED !== 'true') {
      return;
    }
    
    // We don't 'await' this fetch call on purpose.
    fetch(`${MEMORY_API_URL}/v1/memories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        text: text,
        metadata: metadata
      })
    }).catch(err => {
      // Log the error, but don't let it crash the main application flow.
      console.error("🔥 Failed to save memory to MemMachine (fire-and-forget).", err)
    });
  }
}
```

### 6.2 Integrate `MemoryService` into the Chat Route

Modify the primary chat route (`messages.ts`) to implement the full RAG pipeline.

**Action:** Update `api/src/routes/messages.ts`.

```typescript
// File: api/src/routes/messages.ts (Simplified for clarity)

import { MemoryService } from '../services/MemoryService'; // <-- Import the new service
import { Router } from 'express';
// ... other imports

const router = Router();

// This is the main AI chat endpoint
router.post('/', async (req, res, next) => {
  try {
    const { message, history } = req.body;
    const userId = req.user.id;

    // --- RAG Pipeline ---

    // 1. RETRIEVE: Get relevant context from MemMachine before calling the LLM.
    // This context will include learned preferences, dislikes, and relevant recipes.
    const memoryContext = await MemoryService.getContext(userId, message);

    // 2. AUGMENT: Construct the final system prompt.
    // This prompt is now much smarter and more concise.
    // Note: We no longer stuff the entire inventory/recipe list here.
    const systemPrompt = `
      You are Alchemix, an expert AI mixologist with a perfect memory of our past conversations.

      === Relevant Memory & Context ===
      This information is retrieved from your long-term memory. Use it to personalize your response.
      ${memoryContext || "No specific memories were recalled for this query."}
      =================================

      Your task is to answer the user's request based on this context and the provided chat history.
      If the context contains a recipe, use it. If it contains a preference (e.g., "user dislikes gin"),
      strictly adhere to it.
    `.trim();

    // 3. GENERATE: Call the LLM with the augmented prompt (existing logic).
    const llmResponse = await callAnthropicAPI({
        system: systemPrompt,
        messages: [...history, { role: 'user', content: message }],
    });

    // 4. STORE: After getting a response, save the interaction to memory for future use.
    // This is how the AI learns from each conversation.
    await MemoryService.addMemory(
        userId,
        `The user asked: "${message}". You responded: "${llmResponse}".`,
        { type: 'chat_turn', timestamp: new Date().toISOString() }
    );

    // Also, if the user gives direct feedback like "I hate strawberries", we should store that too.
    // Example of explicit memory storage:
    if (message.toLowerCase().includes("i am allergic to") || message.toLowerCase().includes("i hate")) {
        await MemoryService.addMemory(
            userId,
            `User stated a strong preference or allergy: "${message}"`,
            { type: 'user_preference', preference_type: 'dislike_or_allergy' }
        );
    }

    res.json({ reply: llmResponse });

  } catch (error) {
    next(error);
  }
});
```

---

## 7. Phase 6: A Comprehensive Testing & Verification Plan

**Objective:** Rigorously test the integration at every level to ensure it is robust, functional, and bug-free.

### 7.1 Unit Testing (Python)

**Tool:** `pytest`

**Action:** Create `memmachine/examples/bar_assistant/test_query_constructor.py`.

```python
# File: test_query_constructor.py
from .query_constructor import BarQueryConstructor

def test_create_query_with_flavor_and_spirit():
    constructor = BarQueryConstructor()
    query = "Can you recommend a sweet whiskey drink?"
    result = constructor.create_query(query)
    
    assert 'User Query: "Can you recommend a sweet whiskey drink?"' in result
    assert "Intent: The user is asking for a recipe suggestion." in result
    assert "Primary Subject: The user is asking about whiskey." in result
    assert "Flavor Profile: The user mentioned a preference for sweet flavors." in result
    assert "CRITICAL CHECK: Always retrieve memories related to user's stated 'dislikes'" in result

def test_create_query_for_allergy_statement():
    constructor = BarQueryConstructor()
    query = "I'm allergic to peanuts."
    result = constructor.create_query(query)

    assert 'User Query: "I\'m allergic to peanuts."' in result
    assert "Intent:" not in result # Not a suggestion request
    assert "CRITICAL CHECK" in result # Always present
```

### 7.2 Integration Testing (API Level)

**Tool:** `curl` or any API client (Postman, Insomnia).

**Action:** Run these commands after starting the services with `docker-compose up`.

**Test 1: Ingest a Memory**
```bash
curl -X POST http://localhost:8001/v1/memories \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "e2e_test_user",
    "text": "User has a strong dislike for gin.",
    "metadata": {"type": "preference", "strength": "high"}
  }'
```
*Expected Result:* `{"status": "success"}`

**Test 2: Retrieve the Memory with a Relevant Query**
```bash
curl -X POST http://localhost:8001/retrieve \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "e2e_test_user",
    "query": "Suggest a classic cocktail for me"
  }'
```
*Expected Result:* A JSON response where the `context` string contains "User has a strong dislike for gin."

### 7.3 End-to-End (E2E) Testing Scenario

This simulates a real user journey in the Alchemix UI.

**Scenario:** The AI remembers an allergy across sessions.

1.  **Session 1, Turn 1:**
    -   **User:** Logs in and navigates to the AI chat.
    -   **User says:** "By the way, I am allergic to strawberries."
    -   **Verification (Backend):** Check the `memmachine` logs or database. A new memory for this user should be created with the text "User stated a strong preference or allergy: 'By the way, I am allergic to strawberries.'" and metadata `{"type": "user_preference"}`.

2.  **Session 2 (after logout/login or page refresh):**
    -   **User:** Navigates to the AI chat again.
    -   **User says:** "Can you suggest a fruity vodka drink?"
    -   **Verification (Backend):**
        -   The Alchemix API calls `MemoryService.getContext` with the query.
        -   The `BarQueryConstructor` creates a search query including "fruity" and "vodka".
        -   The `memmachine` vector search should find the strawberry allergy memory as highly relevant due to the "fruity" keyword and the "CRITICAL CHECK" instruction.
        -   The returned `memoryContext` string should contain the allergy information.
        -   The final prompt sent to the LLM includes this context.

3.  **Final Success Criteria:**
    -   **AI Response:** The AI should recommend a fruity vodka drink **but explicitly avoid any with strawberries**. For example: "A great fruity vodka drink is a Cape Codder, made with vodka and cranberry juice. Since you're allergic to strawberries, we'll definitely stay away from anything like a Strawberry Vodka Lemonade."

---

## 8. Phase 7: Deployment & Rollout Strategy

**Objective:** Safely deploy the new microservice to production and activate it without interrupting service.

### 8.1 Production Deployment

-   **MemMachine Service:** This Python application will need to be deployed to a service capable of running Docker containers, such as **Railway**, AWS App Runner, or Google Cloud Run. It will need its own persistent storage for the vector database if it's not purely in-memory.
-   **Alchemix Backend:** The existing Railway deployment for the Node.js app will need to be updated with the new environment variables.

### 8.2 Environment Variables for Production

-   **In Alchemix Backend (on Railway):**
    -   `MEMORY_API_URL`: Set this to the public URL of your deployed MemMachine service (e.g., `https://alchemix-memory-prod.up.railway.app`).
    -   `MEMMACHINE_ENABLED`: Set to `true`.
-   **In MemMachine Service (on Railway):**
    -   `OPENAI_API_KEY`: A production API key for embeddings.
    -   `DATABASE_URL`: If using a persistent database like Postgres for memories.

### 8.3 Rollout Strategy: Feature Flag

The `MEMMACHINE_ENABLED` environment variable acts as a crucial **feature flag**.

-   **To Deploy Safely:** Deploy all new code to production with `MEMMACHINE_ENABLED` set to `false` (or not set at all). The application will run exactly as it did before, completely ignoring the new memory features.
-   **To Activate:** Once you are confident the deployment is stable, simply change the `MEMMACHINE_ENABLED` environment variable to `true` and restart the Alchemix backend service. The memory features will activate instantly without a code redeployment.
-   **To Rollback:** If any issues arise, setting `MEMMACHINE_ENABLED` back to `false` immediately disables the integration and reverts to the old, stateless behavior.