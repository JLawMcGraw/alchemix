# Periodic Table of Mixology V2 - Design Document

**Date:** 2025-12-11
**Status:** Approved
**Author:** Claude + User collaboration

---

## Overview

Redesign the Periodic Table of Mixology as a true 6×6 grid where:
- **Groups (Columns)** = Functional role (what it DOES)
- **Periods (Rows)** = Source origin (where it COMES FROM)

Primary use cases:
1. **Inventory Classification** - Auto-classify bottles into Group/Period
2. **Visualization** - Show inventory coverage at a glance
3. **Future:** Substitution engine for balanced cocktail building

---

## Classification System

### Groups (Columns) - Function/Role

| Group | Numeral | Name | Description | Decision Rule |
|-------|---------|------|-------------|---------------|
| 1 | I | Base | Structure / Vol | High-proof (35%+ ABV), backbone (1.5-2oz) |
| 2 | II | Bridge | Extension / Depth | Fortified/aromatized wine (15-22% ABV) |
| 3 | III | Modifier | Liqueur / Flavor | Sweetened liqueur (15-40% ABV), ≤0.75oz |
| 4 | IV | Sweetener | Syrups / Brix | 0% ABV, primarily sugar |
| 5 | V | Reagent | Acids / Juices | Primarily acidic (pH < 4) |
| 6 | VI | Catalyst | Bitters / Extract | Used in dashes/drops for aroma |

**Classification Order (first match wins):**
1. Used in dashes/drops for aroma? → VI. Catalyst
2. Primarily acidic (pH < 4)? → V. Reagent
3. 0% ABV, primarily sugar? → IV. Sweetener
4. Sweetened liqueur (15-40% ABV), ≤0.75oz usage? → III. Modifier
5. Fortified/aromatized wine (15-22% ABV)? → II. Bridge
6. High-proof (35%+ ABV), backbone spirit? → I. Base

### Periods (Rows) - Origin/Source

| Period | Name | Profile | Base Materials |
|--------|------|---------|----------------|
| 1 | Agave | Smoke, Earth | Agave plant |
| 2 | Cane | Grass, Funk | Sugar cane, molasses |
| 3 | Grain | Cereal, Bread | Barley, corn, rye, rice, wheat |
| 4 | Grape | Tannin, Wine | Grape, wine |
| 5 | Fruit | Esters, Tropics | Apple, stone fruit, tropical, berry |
| 6 | Botanic | Herb, Root, Spice | Herbs, roots, bark, spices, flowers |

**Override Rule:** If base is neutral BUT a botanical/herb DEFINES the product's character, use Period 6 (Botanic).
- Vodka → Grain (neutral character)
- Gin → Botanic (juniper defines it)
- Absinthe → Botanic (wormwood defines it)

### Special Rules

**Liqueurs:** Follow the BASE SPIRIT, not the flavoring
- Chambord (cognac + raspberry) → Grape
- Grand Marnier (cognac + orange) → Grape
- Falernum (rum + spices) → Cane
- Kahlúa (grain + coffee) → Grain
- St-Germain (neutral + elderflower) → Botanic

**Syrups:** Follow the SUGAR SOURCE
- Agave nectar → Agave
- Demerara, molasses → Cane
- Simple syrup (refined) → Grain
- Honey → Grape (floral pairing)
- Grenadine, passion fruit → Fruit
- Ginger, cinnamon, vanilla → Botanic

**Acids:** Follow FRUIT SOURCE or traditional spirit pairing
- Lime → Agave (margarita logic)
- Grapefruit → Cane (tiki logic)
- Lemon → Grape (sidecar logic)
- Tropical juices → Fruit
- Ginger/cucumber juice → Botanic

---

## Data Model

### Types

```typescript
// Group = Column (Function/Role)
type MixologyGroup = 1 | 2 | 3 | 4 | 5 | 6;

// Period = Row (Origin/Source)
type MixologyPeriod = 1 | 2 | 3 | 4 | 5 | 6;

// Classification result
interface Classification {
  group: MixologyGroup;
  period: MixologyPeriod;
  confidence: 'high' | 'medium' | 'low' | 'manual';
  reasoning?: string;
}

// Cell position
interface CellPosition {
  group: MixologyGroup;
  period: MixologyPeriod;
}
```

### Constants

```typescript
const GROUPS = {
  1: { numeral: 'I', name: 'Base', desc: 'Structure / Vol', color: '#1E293B' },
  2: { numeral: 'II', name: 'Bridge', desc: 'Extension / Depth', color: '#7C3AED' },
  3: { numeral: 'III', name: 'Modifier', desc: 'Liqueur / Flavor', color: '#EC4899' },
  4: { numeral: 'IV', name: 'Sweetener', desc: 'Syrups / Brix', color: '#6366F1' },
  5: { numeral: 'V', name: 'Reagent', desc: 'Acids / Juices', color: '#F59E0B' },
  6: { numeral: 'VI', name: 'Catalyst', desc: 'Bitters / Extract', color: '#EF4444' },
};

const PERIODS = {
  1: { name: 'Agave', profile: 'Smoke, Earth', color: '#0D9488' },
  2: { name: 'Cane', profile: 'Grass, Funk', color: '#65A30D' },
  3: { name: 'Grain', profile: 'Cereal, Bread', color: '#D97706' },
  4: { name: 'Grape', profile: 'Tannin, Wine', color: '#8B5CF6' },
  5: { name: 'Fruit', profile: 'Esters, Tropics', color: '#F43F5E' },
  6: { name: 'Botanic', profile: 'Herb, Root, Spice', color: '#0EA5E9' },
};
```

---

## Classification Engine

### Approach: Hybrid (Hardcoded + User Overrides)

1. **Hardcoded `CLASSIFICATION_MAP`** (~150+ keyword rules)
   - Covers 95% of common items
   - No database overhead
   - Predictable behavior

2. **User overrides in database**
   - Stored only when user manually reclassifies
   - Persists across sessions
   - Takes priority over auto-classification

### Classification Flow

```
classifyItem(item, userOverrides):
  1. Check userOverrides for item.id
     → If found, return { ...override, confidence: 'manual' }

  2. Extract keywords from item.name + item.type

  3. Match against CLASSIFICATION_MAP (priority order)
     - Exact match → confidence: 'high'
     - Partial match → confidence: 'medium'
     - Category fallback → confidence: 'low'

  4. Return { group, period, confidence, reasoning }
```

### Sample Classification Map

```typescript
const CLASSIFICATION_MAP: Record<string, { group: MixologyGroup; period: MixologyPeriod }> = {
  // === BASE SPIRITS (Group 1) ===
  // Agave
  'tequila': { group: 1, period: 1 },
  'mezcal': { group: 1, period: 1 },
  'raicilla': { group: 1, period: 1 },

  // Cane
  'rum': { group: 1, period: 2 },
  'cachaça': { group: 1, period: 2 },
  'rhum agricole': { group: 1, period: 2 },

  // Grain
  'whiskey': { group: 1, period: 3 },
  'bourbon': { group: 1, period: 3 },
  'rye whiskey': { group: 1, period: 3 },
  'scotch': { group: 1, period: 3 },
  'vodka': { group: 1, period: 3 },

  // Grape
  'brandy': { group: 1, period: 4 },
  'cognac': { group: 1, period: 4 },
  'pisco': { group: 1, period: 4 },

  // Fruit
  'applejack': { group: 1, period: 5 },
  'calvados': { group: 1, period: 5 },

  // Botanic (neutral base, botanical character)
  'gin': { group: 1, period: 6 },
  'absinthe': { group: 1, period: 6 },
  'aquavit': { group: 1, period: 6 },

  // === BRIDGE (Group 2) ===
  'sweet vermouth': { group: 2, period: 4 },
  'dry vermouth': { group: 2, period: 4 },
  'sherry': { group: 2, period: 4 },
  'port': { group: 2, period: 4 },
  'amaro': { group: 2, period: 6 },
  'aperol': { group: 2, period: 6 },
  'lillet': { group: 2, period: 6 },

  // === MODIFIER (Group 3) ===
  'triple sec': { group: 3, period: 5 },
  'cointreau': { group: 3, period: 5 },
  'curaçao': { group: 3, period: 5 },
  'grand marnier': { group: 3, period: 4 },
  'chambord': { group: 3, period: 4 },
  'maraschino': { group: 3, period: 4 },
  'st-germain': { group: 3, period: 6 },
  'falernum': { group: 3, period: 2 },
  'kahlúa': { group: 3, period: 3 },

  // === SWEETENER (Group 4) ===
  'simple syrup': { group: 4, period: 3 },
  'demerara syrup': { group: 4, period: 2 },
  'agave nectar': { group: 4, period: 1 },
  'honey': { group: 4, period: 4 },
  'grenadine': { group: 4, period: 5 },
  'orgeat': { group: 4, period: 3 },
  'ginger syrup': { group: 4, period: 6 },
  'cinnamon syrup': { group: 4, period: 6 },

  // === REAGENT (Group 5) ===
  'lime juice': { group: 5, period: 1 },
  'lemon juice': { group: 5, period: 4 },
  'grapefruit juice': { group: 5, period: 2 },
  'orange juice': { group: 5, period: 5 },
  'pineapple juice': { group: 5, period: 5 },
  'passion fruit': { group: 5, period: 5 },
  'ginger juice': { group: 5, period: 6 },

  // === CATALYST (Group 6) ===
  'angostura': { group: 6, period: 3 },
  'angostura bitters': { group: 6, period: 3 },
  'orange bitters': { group: 6, period: 5 },
  "peychaud's": { group: 6, period: 4 },
  'chocolate bitters': { group: 6, period: 3 },
  'celery bitters': { group: 6, period: 6 },
  // ... more mappings
};
```

---

## Database Schema

### New Table: `inventory_classifications`

```sql
CREATE TABLE IF NOT EXISTS inventory_classifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  inventory_item_id INTEGER NOT NULL,
  group_num INTEGER NOT NULL CHECK (group_num BETWEEN 1 AND 6),
  period_num INTEGER NOT NULL CHECK (period_num BETWEEN 1 AND 6),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE CASCADE,
  UNIQUE (user_id, inventory_item_id)
);

CREATE INDEX idx_classifications_user ON inventory_classifications(user_id);
```

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/inventory-items/classifications` | Get user's manual overrides |
| PUT | `/api/inventory-items/:id/classification` | Set/update override |
| DELETE | `/api/inventory-items/:id/classification` | Remove override (revert to auto) |

---

## Component Architecture

### File Structure

```
src/
├── lib/
│   └── periodicTableV2.ts           # Types, constants, classification engine
│
├── components/
│   └── PeriodicTableV2/
│       ├── index.ts                  # Public exports
│       ├── PeriodicTable.tsx         # Main 6×6 grid container
│       ├── PeriodicTable.module.css
│       ├── ElementCell.tsx           # Single cell with expand/collapse
│       ├── ElementCell.module.css
│       ├── ElementDetailPanel.tsx    # Slide-out detail view
│       └── ElementDetailPanel.module.css
```

### Component Props

```typescript
// Main component
interface PeriodicTableProps {
  inventoryItems: InventoryItem[];
  userOverrides?: Map<number, CellPosition>;
  onItemClick?: (item: InventoryItem) => void;
  onReclassify?: (itemId: number, group: MixologyGroup, period: MixologyPeriod) => void;
  className?: string;
}

// Element cell
interface ElementCellProps {
  group: MixologyGroup;
  period: MixologyPeriod;
  items: InventoryItem[];           // Items classified into this cell
  isExpanded: boolean;
  onExpand: () => void;
  onItemSelect: (item: InventoryItem) => void;
}

// Detail panel
interface ElementDetailPanelProps {
  item: InventoryItem;
  classification: Classification;
  onClose: () => void;
  onReclassify: (group: MixologyGroup, period: MixologyPeriod) => void;
}
```

---

## Visual Design

### Colors

```typescript
// Groups (columns) - Function colors
const GROUP_COLORS = {
  1: '#1E293B',  // Base - Slate
  2: '#7C3AED',  // Bridge - Violet
  3: '#EC4899',  // Modifier - Pink
  4: '#6366F1',  // Sweetener - Indigo
  5: '#F59E0B',  // Reagent - Amber
  6: '#EF4444',  // Catalyst - Red
};

// Periods (rows) - Origin colors
const PERIOD_COLORS = {
  1: '#0D9488',  // Agave - Teal
  2: '#65A30D',  // Cane - Lime
  3: '#D97706',  // Grain - Amber
  4: '#8B5CF6',  // Grape - Purple
  5: '#F43F5E',  // Fruit - Rose
  6: '#0EA5E9',  // Botanic - Sky
};
```

### Cell States

| State | Visual Treatment |
|-------|------------------|
| **Has inventory** | Full opacity, solid border, count badge |
| **Empty** | 20% opacity, dashed border, faded background |
| **Hovered** | Scale 1.02, subtle shadow |
| **Selected** | 2px border in Group color |
| **Expanded** | Dropdown below showing all items |

### Cell Anatomy

```
┌─────────────────────────┐
│ ●                    3  │  ← Period dot (top-left), Count badge (top-right)
│                         │
│   Wh                    │  ← Symbol (large, Group color)
│   Whiskey               │  ← Name (truncated)
│   40-50%                │  ← Spec (ABV/Brix/pH)
│                         │
└─────────────────────────┘
```

### Responsive Behavior

- **Desktop (>1024px)** - Full 6×6 grid, detail panel on right
- **Tablet (768-1024px)** - Smaller cells, detail panel as modal
- **Mobile (<768px)** - Horizontal scroll or list view by Period

---

## Implementation Phases

### Phase 1: Classification Engine
- [ ] Create `lib/periodicTableV2.ts`
- [ ] Define types, constants, GROUPS, PERIODS
- [ ] Build `CLASSIFICATION_MAP` (~150 keywords)
- [ ] Implement `classifyInventoryItem()` function
- [ ] Add unit tests

### Phase 2: Database & API
- [ ] Add migration for `inventory_classifications` table
- [ ] Create `ClassificationService.ts`
- [ ] Add API routes (GET/PUT/DELETE)
- [ ] Add route tests

### Phase 3: Components
- [ ] Create `PeriodicTableV2/PeriodicTable.tsx`
- [ ] Create `PeriodicTableV2/ElementCell.tsx`
- [ ] Create `PeriodicTableV2/ElementDetailPanel.tsx`
- [ ] Style with CSS modules
- [ ] Add component tests

### Phase 4: Integration
- [ ] Add to Dashboard or `/inventory` page
- [ ] Wire to Zustand store
- [ ] Connect reclassify action to API
- [ ] End-to-end testing

---

## Future Enhancements

1. **Substitution Engine** - Suggest replacements within same Group/Period
2. **Recipe Balance View** - Show recipe as Group distribution chart
3. **Collection Goals** - Gamify filling the periodic table
4. **AI Integration** - Use MemMachine to suggest classifications for unknown items
