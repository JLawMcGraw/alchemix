# Periodic Table of Mixology

**Location:** `src/lib/periodicTable/` and `src/components/PeriodicTableV2/`

---

## Overview

The Periodic Table of Mixology is a 6×6 classification system that organizes mixology ingredients by:
- **Groups (Columns 1-6):** Functional role in cocktails (what does it DO?)
- **Periods (Rows 1-6):** Origin/source of the ingredient (where does it COME FROM?)

This creates a matrix similar to chemistry's periodic table, where each cell represents an ingredient TYPE, and user inventory items are matched against predefined element types.

---

## Grid Structure

```
         │  Group I   │  Group II  │ Group III  │  Group IV  │  Group V   │  Group VI  │
         │   BASE     │   BRIDGE   │  MODIFIER  │ SWEETENER  │  REAGENT   │  CATALYST  │
─────────┼────────────┼────────────┼────────────┼────────────┼────────────┼────────────┤
Period 1 │  Tequila   │   (Rare)   │  Agavero   │Agave Nectar│ Lime Juice │Mole Bitters│
AGAVE    │    Tq      │     --     │    Av      │     Ag     │     Lm     │     Mo     │
─────────┼────────────┼────────────┼────────────┼────────────┼────────────┼────────────┤
Period 2 │    Rum     │  Falernum  │   Kahlúa   │Demerara Syr│Grapefr Jce │Tiki Bitters│
CANE     │    Rm      │     Fn     │    Ka      │     Dm     │     Gf     │     Tk     │
─────────┼────────────┼────────────┼────────────┼────────────┼────────────┼────────────┤
Period 3 │  Whiskey   │ Drambuie   │  Amaretto  │Simple Syrup│Lemon Juice │ Angostura  │
GRAIN    │    Wh      │     Dr     │    Am      │     Ss     │     Le     │     An     │
─────────┼────────────┼────────────┼────────────┼────────────┼────────────┼────────────┤
Period 4 │   Brandy   │  Vermouth  │Grand Marnr │ Honey Syrup│Orange Juice│  Peychauds │
GRAPE    │    Br      │     Vm     │    Gm      │     Hn     │     Or     │     Py     │
─────────┼────────────┼────────────┼────────────┼────────────┼────────────┼────────────┤
Period 5 │ Applejack  │   Lillet   │  Curaçao   │Passion Syr │Pineapple Jc│Orng Bitters│
FRUIT    │    Aj      │     Lt     │    Cu      │     Pf     │     Pi     │     Ob     │
─────────┼────────────┼────────────┼────────────┼────────────┼────────────┼────────────┤
Period 6 │    Gin     │   Aperol   │St-Germain  │Ginger Syrup│Ginger Beer │Celery Bittr│
BOTANIC  │    Gn      │     Ap     │    Sg      │     Gi     │     Gb     │     Cb     │
─────────┴────────────┴────────────┴────────────┴────────────┴────────────┴────────────┘
```

---

## Classification Logic

### GROUP (Column) — What does it DO?

| Group | Name | Function | Color |
|-------|------|----------|-------|
| **I** | BASE | Structure / Volume | `#1E293B` (Slate) |
| **II** | BRIDGE | Extension / Depth | `#7C3AED` (Purple) |
| **III** | MODIFIER | Liqueur / Flavor | `#EC4899` (Pink) |
| **IV** | SWEETENER | Syrups / Brix | `#6366F1` (Indigo) |
| **V** | REAGENT | Acids / Juices | `#F59E0B` (Amber) |
| **VI** | CATALYST | Bitters / Extract | `#EF4444` (Red) |

### Group Classification Questions

Ask these questions **in order** (first "yes" wins):

```
1. Is it used in dashes/drops for aroma?
   → VI. CATALYST

2. Is it primarily acidic (pH < 4)?
   → V. REAGENT

3. Is it 0% ABV, primarily sugar?
   → IV. SWEETENER

4. Is it a sweetened liqueur (15-40% ABV) used at ≤0.75oz to push flavor?
   → III. MODIFIER

5. Is it fortified/aromatized wine (15-22% ABV) used to extend/deepen?
   → II. BRIDGE

6. Is it high-proof (35%+ ABV) used as the drink's backbone (1.5-2oz)?
   → I. BASE
```

### Group Edge Case Rule

If something could be multiple groups (like Pernod at 40% that's sometimes used as a rinse), **slot by primary use case**.

**Example:** Pernod is mostly used in small amounts → **Modifier or Catalyst**, not Base.

---

### PERIOD (Row) — Where does it COME FROM?

| Period | Name | Flavor Profile | Color |
|--------|------|----------------|-------|
| **1** | AGAVE | Smoke, Earth | `#0D9488` (Teal) |
| **2** | CANE | Grass, Funk | `#65A30D` (Lime) |
| **3** | GRAIN | Cereal, Bread | `#D97706` (Orange) |
| **4** | GRAPE | Tannin, Wine | `#8B5CF6` (Purple) |
| **5** | FRUIT | Esters, Tropics | `#F43F5E` (Rose) |
| **6** | BOTANIC | Herb, Root, Spice | `#0EA5E9` (Sky) |

### Period Classification: Two-Step Logic

#### Step 1: Identify the Base Material

| Material | Period |
|----------|--------|
| Agave plant | 1. Agave |
| Sugar cane / molasses | 2. Cane |
| Grain (barley, corn, rye, rice, wheat) | 3. Grain |
| Grape / wine | 4. Grape |
| Other fruit (apple, stone, tropical, berry) | 5. Fruit |
| Herbs, roots, bark, spices, flowers | 6. Botanic |

#### Step 2: Override Rule

**If the base is neutral BUT a botanical/herb DEFINES the product's character, use Period 6 (Botanic).**

| Product | Base | Character | Result |
|---------|------|-----------|--------|
| Vodka | Grain | Neutral | **3. Grain** |
| Gin | Grain | Juniper DEFINES it | **6. Botanic** |
| Absinthe | Grain | Wormwood/anise DEFINES it | **6. Botanic** |
| Pernod | Grain | Anise DEFINES it | **6. Botanic** |

---

### Period Rules for Liqueurs

**Follow the base spirit, not the flavoring:**

| Liqueur | Base Spirit | Flavoring | Period |
|---------|-------------|-----------|--------|
| Chambord | Cognac | Raspberry | **4. Grape** |
| Grand Marnier | Cognac | Orange | **4. Grape** |
| Falernum | Rum | Spices | **2. Cane** |
| Kahlúa | Grain | Coffee | **3. Grain** |
| St-Germain | Neutral | Elderflower | **6. Botanic** |

---

### Period Rules for Syrups

**Follow the sugar source:**

| Syrup | Sugar Source | Period |
|-------|--------------|--------|
| Agave nectar | Agave | **1. Agave** |
| Demerara, molasses | Cane | **2. Cane** |
| Simple syrup | Refined sugar (neutral) | **3. Grain** |
| Honey | Floral pairing | **4. Grape** |
| Grenadine, passion fruit | Fruit | **5. Fruit** |
| Ginger, cinnamon, vanilla | Botanical | **6. Botanic** |

---

### Period Rules for Acids

**Follow the fruit source, OR pair with traditional spirit family:**

| Acid | Traditional Pairing | Period |
|------|---------------------|--------|
| Lime | Agave (margarita logic) | **1. Agave** |
| Grapefruit | Cane (tiki logic) | **2. Cane** |
| Lemon | Grape (sidecar/sour logic) | **3. Grain** |
| Orange juice | Wine cocktails | **4. Grape** |
| Tropical juices | Fruit | **5. Fruit** |
| Ginger/cucumber juice | Botanical | **6. Botanic** |

---

### Classification Example: Pernod

| Question | Answer |
|----------|--------|
| **Function?** | 40% ABV, but typically used in rinses/small amounts |
| **Origin?** | Neutral grain base, but anise DEFINES it |

**Result:** [Botanic, Modifier] — alongside St-Germain, Suze, Galliano.

*Alternative:* If considered a base spirit like Absinthe → [Botanic, Base]

---

## Element Types

Each cell contains predefined element types. The system has **217 predefined elements**.

### Element Structure

```typescript
interface ElementType {
  symbol: string;           // 2-letter code (e.g., "Gn")
  name: string;             // Full name (e.g., "Gin")
  group: MixologyGroup;     // Column (1-6)
  period: MixologyPeriod;   // Row (1-6)
  abv?: string;             // Alcohol by volume
  brix?: string;            // Sugar content
  ph?: string;              // pH level
  usage?: string;           // Usage notes (e.g., "Dashes")
  primary?: boolean;        // Primary element for cell
  empty?: boolean;          // Placeholder for rare cells
  keywords: string[];       // Search keywords for matching
}
```

### Example Elements

```typescript
// Base spirit (Group I, Period 1)
{ symbol: 'Tq', name: 'Tequila Blanco', group: 1, period: 1,
  abv: '40%', primary: true,
  keywords: ['tequila', 'tequila blanco', 'blanco', 'silver tequila'] }

// Sweetener (Group IV, Period 1)
{ symbol: 'Ag', name: 'Agave Nectar', group: 4, period: 1,
  brix: '75', primary: true,
  keywords: ['agave nectar', 'agave syrup'] }

// Reagent (Group V, Period 1)
{ symbol: 'Lm', name: 'Lime Juice', group: 5, period: 1,
  ph: '2.2', primary: true,
  keywords: ['lime', 'lime juice', 'fresh lime'] }

// Catalyst (Group VI, Period 1)
{ symbol: 'Mo', name: 'Mole Bitters', group: 6, period: 1,
  usage: 'Dashes', primary: true,
  keywords: ['mole bitters', 'xocolatl mole'] }
```

---

## Classification Engine (`src/lib/periodicTable/engine.ts`)

### Keyword Extraction & Normalization

```typescript
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .normalize('NFD')                    // Decompose accents
    .replace(/[\u0300-\u036f]/g, '')    // Remove accents
    .replace(/['']/g, "'");             // Normalize quotes
}
```

### Classification Strategy (3-tier fallback)

**Tier 1: Exact Keyword Match**
- Check extracted keywords against CLASSIFICATION_MAP
- Returns: `{ group, period, confidence: 'high' }`

**Tier 2: Partial Keyword Match**
- Check if keyword includes or is included by map key
- Returns: `{ group, period, confidence: 'medium' }`

**Tier 3: Category Fallback**

| Category | Group | Period |
|----------|-------|--------|
| spirit | I. Base | 3. Grain |
| liqueur | III. Modifier | 6. Botanic |
| mixer | V. Reagent | 5. Fruit |
| syrup | IV. Sweetener | 3. Grain |
| garnish | VI. Catalyst | 6. Botanic |
| wine | II. Bridge | 4. Grape |
| beer | I. Base | 3. Grain |
| other | III. Modifier | 6. Botanic |

**Ultimate Fallback:** Group III, Period 6, confidence: 'low'

---

## Classification Map Keywords

The CLASSIFICATION_MAP contains **457 keyword entries**:

### Group I (Base) Keywords

| Period | Keywords |
|--------|----------|
| Agave | tequila, tequila blanco, reposado, añejo, mezcal, raicilla |
| Cane | rum, white rum, gold rum, dark rum, aged rum, agricole, cachaça |
| Grain | whiskey, bourbon, rye, scotch, vodka, sake, soju, irish whiskey |
| Grape | brandy, cognac, armagnac, pisco, grappa, marc |
| Fruit | applejack, calvados, eau de vie, kirsch, slivovitz, poire williams |
| Botanic | gin, london dry, plymouth, old tom, absinthe, aquavit |

### Group V (Reagent) Keywords

| Period | Keywords |
|--------|----------|
| Agave | lime, lime juice, fresh lime |
| Cane | grapefruit juice, grapefruit |
| Grain | lemon, lemon juice, fresh lemon |
| Grape | orange juice, blood orange |
| Fruit | pineapple juice, passion fruit juice, mango juice |
| Botanic | ginger juice, cucumber juice, tonic water, soda water |

### Group VI (Catalyst) Keywords

| Period | Keywords |
|--------|----------|
| Agave | mole bitters, chocolate bitters, xocolatl |
| Cane | tiki bitters, falernum bitters |
| Grain | angostura, aromatic bitters |
| Grape | peychauds, creole bitters |
| Fruit | orange bitters, grapefruit bitters |
| Botanic | celery bitters, lavender bitters, rhubarb bitters |

---

## Element Matching Algorithm

### Scoring System

```typescript
function matchItemToElements(item: InventoryItem): ElementType[] {
  const scores = new Map<ElementType, number>();

  for (const element of ELEMENTS) {
    let score = 0;

    for (const keyword of element.keywords) {
      if (keyword.includes(' ')) {
        // Multi-word keyword: +20 points for exact substring match
        if (itemName.includes(keyword)) score += 20;
      } else {
        // Single-word keyword: +10 points for word boundary match
        if (new RegExp(`\\b${keyword}\\b`).test(itemName)) score += 10;
      }
    }

    if (score > 0) scores.set(element, score);
  }

  // Sort by score descending, then by primary flag
  return sorted(scores)
    .map(([element]) => element);
}
```

### Matching Example

**Item:** "Tequila Blanco 1942"

| Step | Action | Result |
|------|--------|--------|
| 1 | Extract keywords | ["tequila blanco 1942", "tequila", "blanco"] |
| 2 | Match "tequila blanco" | +20 to Tequila Blanco element |
| 3 | Match "tequila" | +10 to Tequila Reposado, Añejo, etc. |
| 4 | Sort by score | Tequila Blanco (20) > Reposado (10) |
| 5 | Return best match | `{ symbol: 'Tq', group: 1, period: 1 }` |

---

## Cell Display Data

### getCellDisplayData Algorithm

```typescript
function getCellDisplayData(group, period, inventoryItems): CellDisplayData {
  // 1. Get all elements for this cell
  const cellElements = getElementsForCell(group, period);
  const primaryElement = getPrimaryElement(group, period);

  // 2. Match inventory items to elements
  const matchedItems: InventoryItem[] = [];
  const ownedElementSymbols = new Set<string>();

  for (const item of inventoryItems) {
    const matches = matchItemToElements(item);
    for (const match of matches) {
      if (match.group === group && match.period === period) {
        matchedItems.push(item);
        ownedElementSymbols.add(match.symbol);
        break;
      }
    }
  }

  // 3. Determine display element (prioritize owned primary)
  let displayElement = primaryElement;
  if (!ownedElementSymbols.has(primaryElement?.symbol)) {
    const ownedElement = cellElements.find(e => ownedElementSymbols.has(e.symbol));
    if (ownedElement) displayElement = ownedElement;
  }

  return { element: primaryElement, displayElement, matchedItems,
           count: matchedItems.length, isEmpty: matchedItems.length === 0,
           ownedElementSymbols };
}
```

---

## Component Architecture

### PeriodicTable Component

**File:** `src/components/PeriodicTableV2/PeriodicTable.tsx`

```typescript
interface PeriodicTableProps {
  inventoryItems: InventoryItem[];
  userOverrides?: Map<number, CellPosition>;
  onElementSelect?: (element: ElementType) => void;
  className?: string;
}
```

**Structure:**
```
PeriodicTable
├── Header (Title + Count)
├── Group Labels Row
│   ├── Corner Cell (56px)
│   └── GroupHeader × 6
├── Period Rows × 6
│   ├── PeriodLabel
│   └── ElementCell × 6
└── Legend Footer
```

### ElementCell Component

**Visual Structure:**
```
.cell (64px min-height)
├── .periodDot (colored indicator, top-right)
├── .countBadge (bottom-right, if has items)
├── .symbol (2-letter code, monospace)
├── .name (element type, ellipsis truncated)
├── .spec (ABV/Brix/pH value)
└── .dropdown (when expanded)
    ├── .dropdownHeader
    └── .itemList (clickable elements)
```

### Cell States

| State | Condition | Styling |
|-------|-----------|---------|
| Empty | `element.empty === true` | opacity: 0.4, no hover |
| Has Items | `matchedItems.length > 0` | Standard |
| Not Owned | element not in ownedElementSymbols | opacity: 0.5 |
| Expanded | `isExpanded === true` | Border highlight, z-index: 10 |

---

## Responsive Design

| Breakpoint | Corner | Gap | Symbol Size |
|------------|--------|-----|-------------|
| Desktop (1024px+) | 56px | 4px | 1.25rem |
| Tablet (768-1024px) | 48px | 3px | 1rem |
| Mobile (<768px) | 44px | 2px | 0.875rem |

Mobile: Horizontal scrollable grid, min-width 360px

---

## File Structure

```
src/
├── lib/periodicTable/
│   ├── types.ts              # Type definitions
│   ├── constants.ts          # Groups, Periods, Colors
│   ├── elements.ts           # 217 predefined elements
│   ├── classificationMap.ts  # 457 keyword mappings
│   ├── engine.ts             # Classification & matching
│   └── index.ts              # Public exports
│
└── components/PeriodicTableV2/
    ├── PeriodicTable.tsx     # Main component
    ├── PeriodicTable.module.css
    ├── ElementCell.tsx       # Individual cell
    ├── ElementCell.module.css
    └── index.ts              # Component export
```

---

## Usage Example

```tsx
import { PeriodicTable } from '@/components/PeriodicTableV2';
import { classifyInventoryItem, getPeriodicTags } from '@/lib/periodicTable';

// Classify a single item
const classification = classifyInventoryItem(inventoryItem);
// { group: 1, period: 3, confidence: 'high' }

// Get periodic tags for display
const tags = getPeriodicTags(inventoryItem);
// { group: 'Base', period: 'Grain' }

// Render the table
<PeriodicTable
  inventoryItems={userInventory}
  onElementSelect={(element) => console.log('Selected:', element)}
/>
```
