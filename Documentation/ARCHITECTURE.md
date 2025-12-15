# AlcheMix Architecture

**Version**: v1.30.0
**Last Updated**: December 14, 2025

This document provides a comprehensive map of the AlcheMix system architecture, including high-level diagrams, component relationships, and data flows.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Tech Stack](#tech-stack)
3. [High-Level Architecture](#high-level-architecture)
4. [Project Structure](#project-structure)
5. [Frontend Architecture](#frontend-architecture)
6. [Backend Architecture](#backend-architecture)
7. [Database Schema](#database-schema)
8. [Authentication Flow](#authentication-flow)
9. [Data Flow](#data-flow)
10. [External Integrations](#external-integrations)
11. [Dependency Map](#dependency-map)
12. [Security Architecture](#security-architecture)

---

## System Overview

AlcheMix is a full-stack cocktail inventory and recipe management application with AI-powered bartender recommendations. The system follows a client-server architecture with a React/Next.js frontend and Express.js backend.

```mermaid
graph TB
    subgraph Client
        Browser[Web Browser]
    end

    subgraph Frontend["Frontend (Next.js)"]
        Pages[Pages/Routes]
        Components[React Components]
        Store[Zustand Store]
        API_Client[API Client]
    end

    subgraph Backend["Backend (Express.js)"]
        Routes[API Routes]
        Services[Business Services]
        Middleware[Auth/Rate Limiting]
        DB[(SQLite Database)]
    end

    subgraph External["External Services"]
        Claude[Claude AI API]
        MemMachine[MemMachine<br/>Semantic Memory]
        Neo4j[(Neo4j<br/>Vector Store)]
    end

    Browser --> Pages
    Pages --> Components
    Components --> Store
    Store --> API_Client
    API_Client -->|HTTP/REST| Routes
    Routes --> Middleware
    Middleware --> Services
    Services --> DB
    Services -->|AI Requests| Claude
    Services -->|Memory Ops| MemMachine
    MemMachine --> Neo4j
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | Next.js 14 | React framework with App Router |
| | TypeScript 5.3 | Type safety |
| | Zustand 4.5 | State management |
| | CSS Modules | Scoped styling |
| **Backend** | Express.js 4.18 | REST API server |
| | TypeScript | Type safety |
| | better-sqlite3 | SQLite database driver |
| **Database** | SQLite | Embedded relational database |
| **AI** | Claude Haiku 4.5 | AI bartender recommendations |
| **Memory** | MemMachine v2 | Semantic search & memory |
| | Neo4j 5.23 | Vector embeddings storage |
| **Auth** | JWT | Token-based authentication |
| | bcrypt | Password hashing |
| **Infrastructure** | Docker | Containerization |

---

## High-Level Architecture

```mermaid
flowchart LR
    subgraph Presentation["Presentation Layer"]
        UI[React Components]
        Pages[Next.js Pages]
        Styles[CSS Modules]
    end

    subgraph State["State Layer"]
        Auth[Auth Slice]
        Inv[Inventory Slice]
        Rec[Recipes Slice]
        Chat[Chat Slice]
    end

    subgraph Transport["Transport Layer"]
        Axios[Axios Client]
        HTTP[HTTP/REST]
    end

    subgraph API["API Layer"]
        AuthR["/auth/*"]
        InvR["/api/inventory"]
        RecR["/api/recipes"]
        MsgR["/api/messages"]
        ShopR["/api/shopping-list"]
    end

    subgraph Business["Business Layer"]
        InvS[InventoryService]
        RecS[RecipeService]
        MemS[MemoryService]
        ColS[CollectionService]
        FavS[FavoriteService]
    end

    subgraph Data["Data Layer"]
        SQLite[(SQLite)]
    end

    UI --> State
    State --> Axios
    Axios --> HTTP
    HTTP --> API
    API --> Business
    Business --> Data
```

---

## Project Structure

```
alchemix/
├── src/                          # Frontend (Next.js)
│   ├── app/                      # Pages (App Router)
│   │   ├── login/               # Authentication
│   │   ├── dashboard/           # Home dashboard
│   │   ├── bar/                 # My Bar inventory
│   │   ├── recipes/             # Recipe management
│   │   ├── ai/                  # AI Bartender chat
│   │   ├── favorites/           # Saved favorites
│   │   ├── shopping-list/       # Shopping recommendations
│   │   ├── account/             # User account
│   │   ├── settings/            # App settings
│   │   ├── verify-email/        # Email verification
│   │   ├── forgot-password/     # Password reset request
│   │   └── reset-password/      # Password reset
│   │
│   ├── components/               # React Components
│   │   ├── ui/                  # Base UI components
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Toast.tsx
│   │   │   ├── Spinner.tsx
│   │   │   ├── ElementCard.tsx
│   │   │   └── AlcheMixLogo.tsx
│   │   ├── modals/              # Modal dialogs
│   │   │   ├── AddBottleModal.tsx
│   │   │   ├── AddRecipeModal.tsx
│   │   │   ├── ItemDetailModal.tsx
│   │   │   ├── RecipeDetailModal.tsx
│   │   │   ├── CSVUploadModal.tsx
│   │   │   └── DeleteConfirmModal.tsx
│   │   ├── layout/              # Layout components
│   │   │   └── TopNav.tsx
│   │   ├── BottleCard/          # Inventory item card
│   │   ├── RecipeCard/          # Recipe card
│   │   ├── PeriodicTableV2/     # Ingredient periodic table
│   │   ├── GlassSelector/       # Glassware picker
│   │   └── RecipeMolecule.tsx   # Molecule visualization
│   │
│   ├── lib/                      # Utilities & State
│   │   ├── api.ts               # Axios API client
│   │   ├── store/               # Zustand store slices
│   │   │   ├── index.ts
│   │   │   ├── createAuthSlice.ts
│   │   │   ├── createInventorySlice.ts
│   │   │   ├── createRecipesSlice.ts
│   │   │   └── createChatSlice.ts
│   │   ├── periodicTableV2.ts   # Element classification
│   │   ├── formatters.ts        # Data formatters
│   │   └── passwordPolicy.ts    # Password validation
│   │
│   ├── hooks/                    # Custom React Hooks
│   │   ├── useAuthGuard.ts
│   │   └── useVerificationGuard.ts
│   │
│   ├── styles/                   # Global Styles
│   │   └── globals.css          # Design system tokens
│   │
│   └── types/                    # TypeScript Definitions
│       └── index.ts
│
├── api/                          # Backend (Express.js)
│   └── src/
│       ├── server.ts            # Express app entry
│       ├── routes/              # API Endpoints
│       │   ├── auth.ts          # Authentication
│       │   ├── inventoryItems.ts
│       │   ├── recipes.ts
│       │   ├── collections.ts
│       │   ├── favorites.ts
│       │   ├── messages.ts      # AI chat
│       │   ├── shoppingList.ts
│       │   ├── glasses.ts
│       │   └── classifications.ts
│       ├── services/            # Business Logic
│       │   ├── InventoryService.ts
│       │   ├── RecipeService.ts
│       │   ├── CollectionService.ts
│       │   ├── FavoriteService.ts
│       │   ├── MemoryService.ts
│       │   ├── EmailService.ts
│       │   ├── GlassService.ts
│       │   └── ClassificationService.ts
│       ├── middleware/          # Express Middleware
│       │   ├── auth.ts
│       │   ├── csrf.ts
│       │   ├── errorHandler.ts
│       │   ├── requestId.ts
│       │   ├── requestLogger.ts
│       │   └── userRateLimit.ts
│       ├── config/              # Configuration
│       │   ├── env.ts
│       │   ├── rateLimiter.ts
│       │   └── validateEnv.ts
│       ├── database/            # Database Setup
│       │   └── db.ts
│       ├── utils/               # Utilities
│       │   ├── asyncHandler.ts
│       │   ├── corsConfig.ts
│       │   ├── inputValidator.ts
│       │   ├── logger.ts
│       │   ├── passwordValidator.ts
│       │   └── tokenBlacklist.ts
│       └── types/               # TypeScript types
│
├── packages/                     # Shared Packages
│   └── recipe-molecule/         # Molecule visualization
│       └── src/
│           ├── core/            # Parsing & layout
│           │   ├── parser.ts
│           │   ├── classifier.ts
│           │   ├── layout.ts
│           │   └── bonds.ts
│           └── components/      # React components
│               ├── Molecule.tsx
│               ├── Node.tsx
│               └── Bond.tsx
│
├── docker/                       # Docker Configuration
│   ├── docker-compose.yml
│   ├── docker-compose.dev.yml
│   ├── docker-compose.prod.yml
│   └── memmachine/              # MemMachine config
│
└── Documentation/                # Project Docs
    ├── ARCHITECTURE.md          # This file
    ├── PROJECT_PROGRESS.md
    ├── REDESIGN_PLAN.md
    └── DEV_NOTES.md
```

---

## Frontend Architecture

### Component Hierarchy

```mermaid
graph TD
    subgraph Layout
        RootLayout[Root Layout]
        TopNav[TopNav]
        ToastProvider[Toast Provider]
    end

    subgraph Pages
        Login[Login Page]
        Dashboard[Dashboard]
        Bar[My Bar]
        Recipes[Recipes]
        AI[AI Bartender]
        Favorites[Favorites]
        Shopping[Shopping List]
        Account[Account]
    end

    subgraph SharedComponents["Shared Components"]
        Button[Button]
        Card[Card]
        Input[Input]
        Modal[Modal]
        Spinner[Spinner]
    end

    subgraph FeatureComponents["Feature Components"]
        BottleCard[BottleCard]
        RecipeCard[RecipeCard]
        PeriodicTable[PeriodicTableV2]
        RecipeMolecule[RecipeMolecule]
        GlassSelector[GlassSelector]
    end

    subgraph Modals
        AddBottle[AddBottleModal]
        AddRecipe[AddRecipeModal]
        ItemDetail[ItemDetailModal]
        RecipeDetail[RecipeDetailModal]
        CSVUpload[CSVUploadModal]
    end

    RootLayout --> TopNav
    RootLayout --> ToastProvider
    RootLayout --> Pages

    Bar --> PeriodicTable
    Bar --> BottleCard
    Bar --> AddBottle
    Bar --> ItemDetail

    Recipes --> RecipeCard
    Recipes --> AddRecipe
    Recipes --> RecipeDetail

    RecipeCard --> RecipeMolecule
```

### State Management (Zustand)

```mermaid
graph LR
    subgraph Store["Zustand Store"]
        subgraph AuthSlice["Auth Slice"]
            User[user]
            IsAuth[isAuthenticated]
            Login["login()"]
            Logout["logout()"]
        end

        subgraph InventorySlice["Inventory Slice"]
            Items[inventoryItems]
            FetchItems["fetchItems()"]
            AddItem["addItem()"]
            UpdateItem["updateItem()"]
            DeleteItem["deleteItem()"]
        end

        subgraph RecipesSlice["Recipes Slice"]
            RecList[recipes]
            Collections[collections]
            FetchRec["fetchRecipes()"]
            AddRec["addRecipe()"]
        end

        subgraph ChatSlice["Chat Slice"]
            Messages[chatHistory]
            ShopItems[shoppingListItems]
            SendMsg["sendMessage()"]
        end
    end

    subgraph Persistence["LocalStorage"]
        LS[(alchemix-storage)]
    end

    Store -->|persist user| LS
```

---

## Backend Architecture

### API Routes

```mermaid
graph TD
    subgraph Express["Express Server :3000"]
        subgraph Middleware
            CORS[CORS]
            JSON[JSON Parser]
            Cookie[Cookie Parser]
            RateLimit[Rate Limiter]
            Auth[Auth Middleware]
        end

        subgraph PublicRoutes["Public Routes"]
            POST_signup[POST /auth/signup]
            POST_login[POST /auth/login]
            POST_verify[POST /auth/verify-email]
            POST_forgot[POST /auth/forgot-password]
            POST_reset[POST /auth/reset-password]
            GET_health[GET /health]
        end

        subgraph ProtectedRoutes["Protected Routes (JWT)"]
            AUTH["/auth/*"]
            INV["/api/inventory/*"]
            REC["/api/recipes/*"]
            COL["/api/collections/*"]
            FAV["/api/favorites/*"]
            MSG["/api/messages"]
            SHOP["/api/shopping-list/*"]
            GLASS["/api/glasses/*"]
        end
    end

    CORS --> JSON --> Cookie --> RateLimit
    RateLimit --> PublicRoutes
    RateLimit --> Auth --> ProtectedRoutes
```

### Service Layer

```mermaid
graph TB
    subgraph Routes
        R1[inventoryItems.ts]
        R2[recipes.ts]
        R3[messages.ts]
        R4[shoppingList.ts]
        R5[collections.ts]
        R6[favorites.ts]
    end

    subgraph Services
        S1[InventoryService]
        S2[RecipeService]
        S3[MemoryService]
        S4[CollectionService]
        S5[FavoriteService]
        S6[EmailService]
    end

    subgraph Database
        DB[(SQLite)]
    end

    subgraph External
        Claude[Claude API]
        MM[MemMachine]
    end

    R1 --> S1
    R2 --> S2
    R3 --> S3
    R4 --> S1
    R4 --> S2
    R5 --> S4
    R6 --> S5

    S1 --> DB
    S2 --> DB
    S4 --> DB
    S5 --> DB

    S3 --> Claude
    S3 --> MM
    S2 --> S3
```

---

## Database Schema

### Entity Relationship Diagram

```mermaid
erDiagram
    users ||--o{ inventory_items : owns
    users ||--o{ recipes : owns
    users ||--o{ collections : owns
    users ||--o{ favorites : has
    users ||--o{ shopping_list_items : has
    users ||--o{ custom_glasses : has
    users ||--o{ inventory_classifications : has
    collections ||--o{ recipes : contains
    recipes ||--o{ favorites : referenced_by
    inventory_items ||--o{ inventory_classifications : classified_by

    users {
        int id PK
        string email UK
        string password_hash
        int token_version
        bool is_verified
        string verification_token
        datetime verification_token_expires
        string reset_token
        datetime reset_token_expires
        datetime created_at
    }

    inventory_items {
        int id PK
        int user_id FK
        string name
        string category
        string type
        string abv
        int stock_number
        string spirit_classification
        string distillation_method
        string distillery_location
        string age_statement
        string additional_notes
        string profile_nose
        string palate
        string finish
        string tasting_notes
        string periodic_group
        string periodic_period
        datetime created_at
    }

    recipes {
        int id PK
        int user_id FK
        int collection_id FK
        string name
        json ingredients
        string instructions
        string glass
        string category
        string memmachine_uid
        datetime created_at
    }

    collections {
        int id PK
        int user_id FK
        string name
        string description
        datetime created_at
    }

    favorites {
        int id PK
        int user_id FK
        int recipe_id FK
        string recipe_name
        datetime created_at
    }

    shopping_list_items {
        int id PK
        int user_id FK
        string name
        bool checked
        datetime created_at
    }

    custom_glasses {
        int id PK
        int user_id FK
        string name UK
        datetime created_at
    }

    inventory_classifications {
        int id PK
        int user_id FK
        int inventory_item_id FK
        int group_num
        int period_num
        datetime created_at
        datetime updated_at
    }

    token_blacklist {
        string token PK
        int expires_at
    }
```

### Table Summary

| Table | Purpose | Key Relations |
|-------|---------|---------------|
| `users` | User accounts & auth | Parent of all user data |
| `inventory_items` | Bar inventory | user_id → users |
| `recipes` | Cocktail recipes | user_id → users, collection_id → collections |
| `collections` | Recipe folders | user_id → users |
| `favorites` | Saved recipes | user_id → users, recipe_id → recipes |
| `shopping_list_items` | Shopping list | user_id → users |
| `custom_glasses` | User-defined glasses | user_id → users |
| `inventory_classifications` | Periodic table overrides | user_id, inventory_item_id |
| `token_blacklist` | Revoked JWTs | Standalone |

---

## Authentication Flow

```mermaid
sequenceDiagram
    participant Browser
    participant Frontend
    participant Backend
    participant Database

    Note over Browser,Database: Login Flow
    Browser->>Frontend: Enter credentials
    Frontend->>Backend: POST /auth/login
    Backend->>Database: Verify credentials
    Database-->>Backend: User record
    Backend->>Backend: Generate JWT
    Backend-->>Frontend: Set httpOnly cookie
    Frontend->>Frontend: Update Zustand store
    Frontend-->>Browser: Redirect to dashboard

    Note over Browser,Database: Authenticated Request
    Browser->>Frontend: Navigate to /bar
    Frontend->>Backend: GET /api/inventory (cookie)
    Backend->>Backend: Verify JWT from cookie
    Backend->>Backend: Check token_version
    Backend->>Database: Fetch user's items
    Database-->>Backend: Inventory items
    Backend-->>Frontend: JSON response
    Frontend-->>Browser: Render inventory

    Note over Browser,Database: Logout Flow
    Browser->>Frontend: Click logout
    Frontend->>Backend: POST /auth/logout
    Backend->>Backend: Add token to blacklist
    Backend-->>Frontend: Clear cookie
    Frontend->>Frontend: Clear store
    Frontend-->>Browser: Redirect to login
```

### Security Features

- **HttpOnly Cookies**: JWT stored in httpOnly cookie (XSS protection)
- **Token Versioning**: Database-backed version for instant invalidation
- **Token Blacklist**: Persisted blacklist for logout/password change
- **Rate Limiting**: Per-user request limits
- **CSRF Protection**: SameSite cookie attribute
- **Password Hashing**: bcrypt with 10 rounds

---

## Data Flow

### Adding an Inventory Item

```mermaid
sequenceDiagram
    participant UI as AddBottleModal
    participant Store as Zustand Store
    participant API as API Client
    participant Route as inventoryItems.ts
    participant Service as InventoryService
    participant DB as SQLite

    UI->>Store: addItem(itemData)
    Store->>API: inventoryApi.add(item)
    API->>Route: POST /api/inventory
    Route->>Route: Validate input
    Route->>Service: create(userId, item)
    Service->>Service: Auto-classify periodic tags
    Service->>DB: INSERT INTO inventory_items
    DB-->>Service: New item with ID
    Service-->>Route: Item object
    Route-->>API: 201 Created
    API-->>Store: New item
    Store->>Store: Prepend to inventoryItems[]
    Store-->>UI: Re-render
```

### AI Bartender Chat

```mermaid
sequenceDiagram
    participant UI as AI Page
    participant Store as Chat Slice
    participant API as API Client
    participant Route as messages.ts
    participant Memory as MemoryService
    participant Claude as Claude API
    participant MM as MemMachine

    UI->>Store: sendMessage(text)
    Store->>API: aiApi.sendMessage(message, history)
    API->>Route: POST /api/messages
    Route->>Memory: processMessage()

    Memory->>MM: Search similar recipes
    MM-->>Memory: Relevant recipes

    Memory->>Memory: Build context prompt
    Memory->>Claude: Send to Claude Haiku
    Claude-->>Memory: AI response

    Memory->>MM: Store interaction
    Memory-->>Route: Response + recommendations
    Route-->>API: JSON response
    API-->>Store: Update chatHistory
    Store-->>UI: Display response
```

---

## External Integrations

### Claude AI Integration

```mermaid
graph LR
    subgraph Backend
        MS[MemoryService]
        Persona[AI Persona Config]
    end

    subgraph Claude["Claude API"]
        Haiku[Claude Haiku 4.5]
    end

    subgraph Context["Context Building"]
        Inventory[User's Inventory]
        Recipes[User's Recipes]
        History[Chat History]
    end

    Context --> MS
    Persona --> MS
    MS -->|Messages API| Haiku
    Haiku -->|Response| MS
```

### MemMachine Integration

```mermaid
graph TB
    subgraph App["AlcheMix Backend"]
        MS[MemoryService]
    end

    subgraph MemMachine["MemMachine v2"]
        API[REST API :8080]
        Engine[Memory Engine]
    end

    subgraph Neo4j["Neo4j"]
        VectorDB[(Vector Embeddings)]
    end

    MS -->|Store recipe| API
    MS -->|Search similar| API
    MS -->|Delete by UID| API
    API --> Engine
    Engine --> VectorDB
```

**MemMachine Features Used:**
- Recipe storage with UIDs for tracking
- Semantic similarity search
- Per-user project isolation (`org: alchemix`, `project: user_{id}_recipes`)
- Vector embeddings via Neo4j GDS plugin

---

## Port Reference

| Service | Port | Description |
|---------|------|-------------|
| Frontend (Next.js) | 3001 | Development server |
| Backend (Express) | 3000 | API server |
| MemMachine | 8080 | Semantic memory API |
| Neo4j HTTP | 7474 | Graph database UI |
| Neo4j Bolt | 7687 | Graph database protocol |
| PostgreSQL | 5432 | MemMachine profile storage |

---

## Design System Reference

The frontend uses the **"Molecular Mixology"** design system. Key design tokens are defined in `src/styles/globals.css`.

### Color Palette

| Variable | Value | Usage |
|----------|-------|-------|
| `--bond-agave` | `#0D9488` | Tequila, Mezcal |
| `--bond-grain` | `#D97706` | Whiskey, Bourbon |
| `--bond-cane` | `#65A30D` | Rum, Cachaça |
| `--bond-juniper` | `#0EA5E9` | Gin |
| `--bond-grape` | `#7C3AED` | Brandy, Cognac |
| `--bond-botanical` | `#EC4899` | Amaro, Vermouth |
| `--bond-acid` | `#F59E0B` | Citrus |
| `--bond-sugar` | `#6366F1` | Syrups, Liqueurs |

### Typography

| Font | Usage |
|------|-------|
| Inter | UI text, headings |
| JetBrains Mono | Data, measurements, code |

---

## Quick Commands Reference

```bash
# Development
npm run dev:all          # Start frontend + backend
npm run type-check       # TypeScript checks (all packages)

# Testing
cd api && npm test       # Backend tests (732)
npm test                 # Frontend tests (206)
cd packages/recipe-molecule && npm test  # Molecule tests (124)

# Docker (for MemMachine)
docker compose -f docker/docker-compose.yml up -d
```

---

## Dependency Map

### Backend Module Dependencies

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              server.ts (Entry Point)                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
          ┌───────────────────────────┼───────────────────────────┐
          ▼                           ▼                           ▼
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│    config/      │         │   middleware/   │         │    routes/      │
├─────────────────┤         ├─────────────────┤         ├─────────────────┤
│ env.ts          │◄────────│ auth.ts         │         │ auth/           │
│ validateEnv.ts  │         │ csrf.ts         │         │ inventoryItems  │
│ rateLimiter.ts  │────────►│ errorHandler.ts │         │ recipes         │
└─────────────────┘         │ requestId.ts    │         │ collections     │
        │                   │ requestLogger.ts│         │ favorites       │
        │                   │ userRateLimit.ts│         │ messages        │
        ▼                   └─────────────────┘         │ shoppingList    │
┌─────────────────┐                 │                   │ glasses         │
│ express-rate-   │                 ▼                   │ classifications │
│ limit           │         ┌─────────────────┐         │ health          │
└─────────────────┘         │   utils/        │         └─────────────────┘
                            ├─────────────────┤                 │
                            │ logger.ts ──────│──► winston      │
                            │ inputValidator  │                 │
                            │ passwordValid.  │                 │
                            │ tokenBlacklist  │                 │
                            │ asyncHandler    │                 │
                            │ corsConfig      │                 ▼
                            └─────────────────┘         ┌─────────────────┐
                                    │                   │   services/     │
                                    │                   ├─────────────────┤
                                    ▼                   │ InventoryService│
                            ┌─────────────────┐         │ RecipeService   │
                            │   errors/       │         │ CollectionSvc   │
                            ├─────────────────┤         │ FavoriteService │
                            │ AppError.ts     │         │ GlassService    │
                            │ index.ts        │         │ ClassificationS │
                            └─────────────────┘         │ ShoppingListSvc │
                                                        │ AIService ──────│──► @anthropic-ai/sdk
                                                        │ MemoryService ──│──► MemMachine API
                                                        │ EmailService ───│──► nodemailer
                                                        └─────────────────┘
                                                                │
                                                                ▼
                                                        ┌─────────────────┐
                                                        │   database/     │
                                                        ├─────────────────┤
                                                        │ db.ts ──────────│──► better-sqlite3
                                                        └─────────────────┘
```

### Backend Dependency Matrix

| Module | Depends On | External Packages |
|--------|-----------|-------------------|
| `server.ts` | config/*, middleware/*, routes/* | express, cors, helmet, cookie-parser |
| `config/env.ts` | - | dotenv |
| `config/validateEnv.ts` | - | (pure) |
| `config/rateLimiter.ts` | - | express-rate-limit |
| `middleware/auth.ts` | database/db, utils/tokenBlacklist | jsonwebtoken |
| `middleware/csrf.ts` | - | (pure) |
| `middleware/errorHandler.ts` | errors/AppError, utils/logger | (pure) |
| `middleware/requestId.ts` | - | crypto (built-in) |
| `middleware/requestLogger.ts` | utils/logger | (pure) |
| `middleware/userRateLimit.ts` | - | (pure, in-memory) |
| `routes/auth/*` | services/EmailService, database/db | bcryptjs, jsonwebtoken |
| `routes/inventoryItems.ts` | services/InventoryService | (pure) |
| `routes/recipes.ts` | services/RecipeService | (pure) |
| `routes/messages.ts` | services/AIService, MemoryService | (pure) |
| `services/InventoryService.ts` | database/db | (pure) |
| `services/RecipeService.ts` | database/db, MemoryService | (pure) |
| `services/AIService.ts` | - | @anthropic-ai/sdk |
| `services/MemoryService.ts` | utils/logger | fetch (built-in) |
| `services/EmailService.ts` | config/validateEnv | nodemailer |
| `utils/logger.ts` | - | winston |
| `database/db.ts` | - | better-sqlite3 |

### Frontend Module Dependencies

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          app/layout.tsx (Root)                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
          ┌───────────────────────────┼───────────────────────────┐
          ▼                           ▼                           ▼
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│  components/    │         │     lib/        │         │    hooks/       │
│  layout/        │         │                 │         │                 │
├─────────────────┤         ├─────────────────┤         ├─────────────────┤
│ TopNav.tsx      │◄────────│ store.ts ───────│──► zustand│ useAuthGuard   │
│ TopNavWrapper   │         │ api.ts ─────────│──► fetch │ useVerifGuard  │
└─────────────────┘         │ periodicTable/  │         └─────────────────┘
        │                   └─────────────────┘                 │
        ▼                           │                           │
┌─────────────────┐                 │                           │
│  components/    │                 ▼                           │
│  modals/        │         ┌─────────────────┐                 │
├─────────────────┤         │  app/pages/     │◄────────────────┘
│ AddBottleModal  │◄────────├─────────────────┤
│ AddRecipeModal  │         │ dashboard/      │
│ EditBottleModal │         │ bar/            │──► PeriodicTableV2, BottleCard
│ RecipeDetail    │         │ recipes/        │──► RecipeCard, RecipeMolecule
│ CSVUploadModal  │         │ ai/             │
│ CollectionModal │         │ favorites/      │
│ DeleteConfirm   │         │ shopping-list/  │
└─────────────────┘         │ settings/       │
        │                   │ account/        │
        ▼                   └─────────────────┘
┌─────────────────┐                 │
│  components/    │                 ▼
│  ui/            │         ┌─────────────────┐
├─────────────────┤         │  packages/      │
│ Button.tsx      │         │  recipe-molecule│
│ Card.tsx        │         ├─────────────────┤
│ Input.tsx       │◄────────│ core/parser     │
│ Modal.tsx       │         │ core/classifier │
│ Toast.tsx       │         │ core/layout     │
│ Spinner.tsx     │         │ core/bonds      │
│ ElementCard     │         │ components/     │
└─────────────────┘         └─────────────────┘
```

### Frontend Dependency Matrix

| Module | Depends On | External Packages |
|--------|-----------|-------------------|
| `lib/store.ts` | lib/api.ts | zustand, zustand/middleware |
| `lib/api.ts` | - | fetch (built-in) |
| `lib/periodicTable/*` | - | (pure) |
| `app/bar/page.tsx` | lib/store, PeriodicTableV2, modals | react |
| `app/recipes/page.tsx` | lib/store, RecipeCard, modals | react |
| `components/RecipeMolecule.tsx` | @alchemix/recipe-molecule | react |
| `hooks/useAuthGuard.ts` | lib/store | react, next/navigation |

### Package Dependencies

```
packages/recipe-molecule/
├── src/core/
│   ├── parser.ts ────────────► (pure TypeScript)
│   ├── classifier.ts ────────► (pure TypeScript)
│   ├── layout.ts ────────────► (pure, force-directed)
│   ├── bonds.ts ─────────────► (pure, geometry)
│   ├── formula.ts ───────────► (pure)
│   └── types.ts ─────────────► (type definitions)
└── src/components/
    └── *.tsx ────────────────► react, react-dom

packages/types/
└── src/*.ts ─────────────────► (pure TypeScript types)
```

### External Service Dependencies

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              AlcheMix Backend                                │
└─────────────────────────────────────────────────────────────────────────────┘
                │                    │                    │
                ▼                    ▼                    ▼
        ┌───────────────┐   ┌───────────────┐   ┌───────────────┐
        │   SQLite      │   │  MemMachine   │   │  Claude API   │
        │   (local)     │   │  (Docker)     │   │  (Anthropic)  │
        ├───────────────┤   ├───────────────┤   ├───────────────┤
        │ Users         │   │ POST /store   │   │ Messages API  │
        │ Inventory     │   │ POST /query   │   │ claude-3-haiku│
        │ Recipes       │   │ DELETE /mem   │   │ max_tokens:   │
        │ Collections   │   │               │   │ 1024          │
        │ Favorites     │   └───────┬───────┘   └───────────────┘
        │ Classifications│          │
        └───────────────┘          ▼
                           ┌───────────────┐
                           │    Neo4j      │
                           │   (Docker)    │
                           ├───────────────┤
                           │ Vector Store  │
                           │ GDS Plugin    │
                           └───────────────┘
                                   │
                                   ▼
                           ┌───────────────┐
                           │  PostgreSQL   │
                           │   (Docker)    │
                           ├───────────────┤
                           │ Profile Store │
                           └───────────────┘
```

---

## Security Architecture

### Middleware Security Stack

```
Request Flow:
───────────────────────────────────────────────────────────────────────────────►

┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│requestId │►│requestLog│►│ helmet   │►│  cors    │►│  csrf    │►│  auth    │
│(correlate)│ │(audit)   │ │(headers) │ │(origin)  │ │(tokens)  │ │(jwt)     │
└──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘
     │            │            │            │            │            │
     ▼            ▼            ▼            ▼            ▼            ▼
  X-Request-ID  Winston    CSP, HSTS    Whitelist   Double-Submit  HttpOnly
  UUID v4       JSON logs  X-Frame     Origins      Cookie         JWT Cookie
```

### Rate Limiter Configuration

| Limiter | Window | Max Requests | Purpose |
|---------|--------|--------------|---------|
| `apiLimiter` | 15 min | 100 | General API protection |
| `authLimiter` | 15 min | 5 (failed) | Login brute-force prevention |
| `aiLimiter` | 1 hour | 30 | API cost control |
| `importLimiter` | 1 hour | 10 | Large file upload DoS |
| `passwordResetLimiter` | 1 hour | 3 | Reset email spam |
| `logoutLimiter` | 15 min | 10 | Token blacklist exhaustion |
| `changePasswordLimiter` | 1 hour | 3 | Password brute-force |
| `verificationLimiter` | 1 hour | 3 | Verification email spam |
| `bulkOperationsLimiter` | 15 min | 10 | Mass deletion DoS |

### Logging Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             Winston Logger                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  Transports:                                                                │
│  ├── Console (development) - colorized, human-readable                      │
│  └── File (production) - JSON, rotated                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  Log Levels: error > warn > info > debug                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  Automatic Metadata:                                                        │
│  ├── service: "alchemix-api"                                                │
│  ├── environment: NODE_ENV                                                  │
│  ├── requestId: X-Request-ID                                                │
│  └── timestamp: ISO 8601                                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  Sensitive Data Redaction:                                                  │
│  password, token, apikey, secret, authorization, ssn, creditcard, cvv      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

*Last updated: December 14, 2025*
