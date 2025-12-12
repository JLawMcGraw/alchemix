# Periodic Table Tags for Inventory Items

**Date:** December 12, 2025
**Status:** Approved
**Branch:** `alchemix-redesign`

---

## Overview

Add two new tags to each inventory item that indicate where it belongs in the Periodic Table of Mixology:

- **Group (Column)** - What the ingredient DOES (function)
- **Period (Row)** - Where the ingredient COMES FROM (origin)

Example: A bottle of Gin gets `Base` (group) + `Botanic` (period).

---

## Design Decisions

| Decision | Resolution |
|----------|------------|
| Auto-detect vs manual | Auto-detect with manual override |
| Single or multiple elements | Single element per item |
| What to store | Group name + Period name (human-readable) |
| Display format | Inline pills: `[Spirit] [Base] [Botanic]` |
| Keep existing category | Yes - dashboard still needs it for counts |

---

## Database Schema

**New columns on `inventory_items` table:**

```sql
periodic_group TEXT CHECK(periodic_group IN ('Base', 'Bridge', 'Modifier', 'Sweetener', 'Reagent', 'Catalyst')),
periodic_period TEXT CHECK(periodic_period IN ('Agave', 'Cane', 'Grain', 'Grape', 'Fruit', 'Botanic'))
```

**Migration approach:**
- Add nullable columns (existing items get `NULL`)
- Run backfill to auto-classify existing items
- New items get auto-detected values on creation

---

## API Changes

**Inventory Routes:**

- Accept optional `periodic_group` and `periodic_period` on create/update
- If not provided, auto-detect using `classifyInventoryItem()`
- Store in database

**Response shape:**
```typescript
{
  id: 1,
  name: "Hendrick's",
  category: "spirit",
  type: "Gin",
  periodic_group: "Base",
  periodic_period: "Botanic",
  // ... other fields
}
```

**New endpoint:**
```
POST /api/inventory/backfill-periodic-tags
```

---

## Frontend Types

```typescript
export type PeriodicGroup = 'Base' | 'Bridge' | 'Modifier' | 'Sweetener' | 'Reagent' | 'Catalyst';
export type PeriodicPeriod = 'Agave' | 'Cane' | 'Grain' | 'Grape' | 'Fruit' | 'Botanic';

export interface InventoryItem {
  // ... existing fields
  periodic_group?: PeriodicGroup | null;
  periodic_period?: PeriodicPeriod | null;
}
```

---

## BottleCard Display

Three inline pills:
```
[Spirit] [Base] [Botanic]
```

**Group tag colors:**
| Tag | Color |
|-----|-------|
| Base | `#1E293B` (dark slate) |
| Bridge | `#7C3AED` (violet) |
| Modifier | `#EC4899` (pink) |
| Sweetener | `#6366F1` (indigo) |
| Reagent | `#F59E0B` (yellow) |
| Catalyst | `#EF4444` (red) |

**Period tag colors:**
| Tag | Color |
|-----|-------|
| Agave | `#0D9488` (teal) |
| Cane | `#65A30D` (green) |
| Grain | `#D97706` (amber) |
| Grape | `#8B5CF6` (violet) |
| Fruit | `#F43F5E` (rose) |
| Botanic | `#0EA5E9` (sky) |

---

## Modal Dropdowns

Add/Edit modals get two selects:

**Function (Group):**
- Base (Structure)
- Bridge (Extension)
- Modifier (Liqueur)
- Sweetener (Syrups)
- Reagent (Acids)
- Catalyst (Bitters)

**Origin (Period):**
- Agave (Smoke, Earth)
- Cane (Grass, Funk)
- Grain (Cereal, Bread)
- Grape (Tannin, Wine)
- Fruit (Esters, Tropics)
- Botanic (Herb, Spice)

Auto-detect on name/type change, user can override.

---

## Files to Modify

| File | Changes |
|------|---------|
| `api/src/database/db.ts` | Migration for new columns |
| `api/src/routes/inventoryItems.ts` | Handle new fields, backfill endpoint |
| `src/types/index.ts` | Add types, update interface |
| `src/lib/periodicTableV2.ts` | Add `getPeriodicTags()` helper |
| `src/components/BottleCard/BottleCard.tsx` | Display pills |
| `src/components/BottleCard/BottleCard.module.css` | Tag styling |
| `src/components/modals/AddBottleModal.tsx` | Dropdowns, auto-detect |
| `src/components/modals/ItemDetailModal.tsx` | Dropdowns in edit mode |

---

## Implementation Order

1. Database migration + API changes
2. Frontend types
3. `getPeriodicTags()` helper
4. BottleCard display
5. Modal dropdowns with auto-detect
6. Run backfill for existing items
7. Test end-to-end
