# PostgreSQL Migration Design

**Date:** 2025-12-17
**Status:** Approved
**Timeline:** 3 days

---

## Overview

Migrate AlcheMix database from SQLite (better-sqlite3) to PostgreSQL (pg driver) for Railway deployment with multi-user support.

### Decisions Made

| Decision | Choice | Reasoning |
|----------|--------|-----------|
| Driver | `pg` (direct) | Lightest weight, similar to current pattern |
| Instance | Separate from MemMachine | Better isolation, independent scaling |
| Transition | Big Bang | No production users, cleanest approach |

---

## Architecture

### Current vs. New

```
CURRENT (SQLite)                    NEW (PostgreSQL)
─────────────────                   ─────────────────
api/data/alchemix.db               Railway PostgreSQL Plugin
        │                                   │
   better-sqlite3                          pg
   (sync API)                        (async/await)
        │                                   │
   db.prepare().get()              pool.query() → rows[0]
```

### Connection Setup

```typescript
// api/src/database/db.ts

import { Pool } from 'pg';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Helper for single row queries
export async function queryOne<T>(sql: string, params?: any[]): Promise<T | null> {
  const { rows } = await pool.query(sql, params);
  return rows[0] || null;
}

// Helper for multiple rows
export async function queryAll<T>(sql: string, params?: any[]): Promise<T[]> {
  const { rows } = await pool.query(sql, params);
  return rows;
}
```

### Key Differences

- **Placeholders**: `?` → `$1, $2, $3`
- **API**: Sync → Async (every query needs `await`)
- **Connection**: Single file → Connection pool

---

## Schema Migration

### SQL Syntax Changes

| SQLite | PostgreSQL | Notes |
|--------|------------|-------|
| `INTEGER PRIMARY KEY AUTOINCREMENT` | `SERIAL PRIMARY KEY` | Auto-increment |
| `TEXT` | `TEXT` or `VARCHAR(255)` | Same |
| `DATETIME DEFAULT CURRENT_TIMESTAMP` | `TIMESTAMP DEFAULT NOW()` | Timestamps |
| `BOOLEAN` (stored as 0/1) | `BOOLEAN` (native) | True booleans |

### Example Table Conversion

```sql
-- SQLite (current)
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_verified INTEGER DEFAULT 0
);

-- PostgreSQL (new)
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  is_verified BOOLEAN DEFAULT FALSE
);
```

### File Structure

```
api/src/database/
├── db.ts              # Connection pool + helpers
├── schema.sql         # PostgreSQL schema
└── migrations/        # Future migrations (optional)
```

---

## Query Migration Pattern

### Single Row Query

```typescript
// SQLite (sync)
const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

// PostgreSQL (async)
const user = await queryOne<User>('SELECT * FROM users WHERE id = $1', [userId]);
```

### Multiple Rows

```typescript
// SQLite (sync)
const recipes = db.prepare('SELECT * FROM recipes WHERE user_id = ?').all(userId);

// PostgreSQL (async)
const recipes = await queryAll<Recipe>('SELECT * FROM recipes WHERE user_id = $1', [userId]);
```

### Insert with Returning ID

```typescript
// SQLite (sync)
const result = db.prepare('INSERT INTO recipes (name, user_id) VALUES (?, ?)').run(name, userId);
const newId = result.lastInsertRowid;

// PostgreSQL (async)
const { rows } = await pool.query(
  'INSERT INTO recipes (name, user_id) VALUES ($1, $2) RETURNING id',
  [name, userId]
);
const newId = rows[0].id;
```

### Update/Delete

```typescript
// SQLite (sync)
db.prepare('DELETE FROM recipes WHERE id = ? AND user_id = ?').run(id, userId);

// PostgreSQL (async)
await pool.query('DELETE FROM recipes WHERE id = $1 AND user_id = $2', [id, userId]);
```

### Function Signature Changes

```typescript
// Before
function getUserById(id: number): User | null {
  return db.prepare('...').get(id);
}

// After
async function getUserById(id: number): Promise<User | null> {
  return queryOne<User>('...', [id]);
}
```

---

## Migration Scope

### Files to Update

```
api/src/
├── database/
│   └── db.ts                    # REWRITE
├── routes/
│   ├── auth/* (5 files)         # UPDATE
│   ├── inventory.ts             # UPDATE
│   ├── inventoryItems.ts        # UPDATE
│   ├── recipes.ts               # UPDATE
│   ├── collections.ts           # UPDATE
│   ├── favorites.ts             # UPDATE
│   ├── shoppingList.ts          # UPDATE
│   ├── messages.ts              # UPDATE
│   └── classifications.ts       # UPDATE
├── services/
│   ├── InventoryService.ts      # UPDATE
│   ├── RecipeService.ts         # UPDATE
│   ├── FavoriteService.ts       # UPDATE
│   ├── ShoppingListService.ts   # UPDATE
│   └── ClassificationService.ts # UPDATE
├── middleware/
│   └── auth.ts                  # UPDATE
└── utils/
    └── tokenBlacklist.ts        # UPDATE
```

### Estimated Changes

| Category | Files | Queries | Effort |
|----------|-------|---------|--------|
| Database setup | 1 | - | Rewrite |
| Routes | ~15 | ~400 | Mechanical |
| Services | ~8 | ~600 | Mechanical |
| Middleware | ~3 | ~50 | Mechanical |
| Utils | ~2 | ~20 | Mechanical |
| Tests | ~35 | ~200 | Update mocks |

---

## Implementation Plan

### Phase 1: Database Layer (Day 1)

- [ ] Rewrite db.ts with pg pool + helpers
- [ ] Create schema.sql for PostgreSQL
- [ ] Add DATABASE_URL to env validation
- [ ] Test connection locally (Docker PostgreSQL)

### Phase 2: Core Services (Day 1-2)

- [ ] InventoryService.ts
- [ ] RecipeService.ts
- [ ] FavoriteService.ts
- [ ] ShoppingListService.ts
- [ ] ClassificationService.ts

### Phase 3: Routes (Day 2)

- [ ] auth/* routes
- [ ] inventory routes
- [ ] recipes routes
- [ ] All remaining routes

### Phase 4: Middleware & Utils (Day 2)

- [ ] auth.ts middleware
- [ ] tokenBlacklist.ts

### Phase 5: Tests (Day 3)

- [ ] Update test database setup
- [ ] Fix service tests
- [ ] Fix route tests

### Phase 6: Deploy (Day 3)

- [ ] Add PostgreSQL plugin on Railway
- [ ] Set DATABASE_URL env var
- [ ] Deploy and verify
- [ ] Test with beta users

---

## Local Development Setup

```bash
# Docker PostgreSQL
docker run -d --name alchemix-postgres \
  -e POSTGRES_DB=alchemix \
  -e POSTGRES_USER=alchemix \
  -e POSTGRES_PASSWORD=dev123 \
  -p 5432:5432 postgres:16

# .env.local
DATABASE_URL=postgresql://alchemix:dev123@localhost:5432/alchemix
```

---

## Rollback Plan

If issues arise on Railway:
1. Revert git commit
2. Redeploy previous SQLite version
3. Debug locally with Docker PostgreSQL
