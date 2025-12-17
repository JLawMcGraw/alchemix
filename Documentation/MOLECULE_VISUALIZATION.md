# Recipe Molecule Visualization System

**Package:** `@alchemix/recipe-molecule`
**Location:** `packages/recipe-molecule/`
**Version:** 0.1.0

---

## Overview

The Recipe Molecule Visualization system transforms cocktail recipes into chemical-style molecular structure diagrams. It uses a benzene ring (hexagon) as the backbone with ingredient nodes connected via chemical bonds, creating an aesthetic visualization that maps flavor components to organic chemistry principles.

---

## Architecture

```
AlchemixRecipe (input)
       │
       ▼
   parseIngredients()
       │
       ▼
  ParsedIngredient[] (raw text broken down)
       │
       ▼
  classifyIngredients()
       │
       ▼
  ClassifiedIngredient[] (types assigned)
       │
       ▼
   calculateChaos()  ← Determines layout randomness
       │
       ▼
   computeLayout()   ← Main positioning algorithm
       │
       ▼
   MoleculeNode[]    (positioned ingredients)
       │
       ▼
   generateBonds()   ← Creates connections
       │
       ▼
   MoleculeBond[]    (with determined types)
       │
       ▼
   generateBackbone()
       │
       ▼
   MoleculeRecipe    (complete visualization data)
       │
       ▼
   <Molecule />      (React component renders SVG)
       │
       ▼
   SVG visualization (interactive with tooltips)
```

---

## Core Types (`src/core/types.ts`)

### Ingredient Types

10 categories mapping cocktail ingredients to visual/structural roles:

| Type | Role | Bond Behavior | Color |
|------|------|---------------|-------|
| `spirit` | Base spirits | Center hexagon | `#64748B` |
| `acid` | Sours (citrus) | Inline (bonds pass through) | `#F59E0B` |
| `sweet` | Sweeteners | Inline | `#6366F1` |
| `bitter` | Bitters, amari | Terminal (bond ends here) | `#EC4899` |
| `salt` | Salt, spices | Terminal | `#EF4444` |
| `dilution` | Water, soda | Inline | `#A1A1AA` |
| `garnish` | Herbs, peels | Terminal | `#10B981` |
| `dairy` | Cream, milk | Terminal | `#F5F5F4` |
| `egg` | Egg white/yolk | Terminal | `#FDE68A` |
| `junction` | Invisible branch points | Inline | Transparent |

### Bond Types

5 visual bond styles mimicking organic chemistry notation:

| Type | Visual | Usage |
|------|--------|-------|
| `single` | Solid line | Standard connections |
| `double` | Parallel lines | Acid-sweet balance |
| `dashed` | Dotted line | Optional/accent ingredients |
| `wedge` | Solid triangle | Garnishes (stereochemistry "in front") |
| `dashedWedge` | Dashed tapered triangle | Bitters (stereochemistry "behind") |

### Key Data Structures

```typescript
// Parsed ingredient data
interface ParsedIngredient {
  raw: string;           // "2 oz fresh lime juice"
  name: string;          // "lime juice"
  amount: number | null; // 2
  unit: string | null;   // "oz"
  modifiers: string[];   // ["fresh"]
}

// Classified ingredient with type
interface ClassifiedIngredient extends ParsedIngredient {
  type: IngredientType;  // "acid"
  color: string;         // "#F59E0B"
}

// Positioned node in visualization
interface MoleculeNode extends ClassifiedIngredient {
  id: string;                // "node-5"
  x, y: number;              // Position coordinates
  radius: number;            // Node size (6-18px)
  label: string;             // "Li" or "RUM"
  sublabel?: string;         // "blanco"
  parentId?: string;         // Parent node for chaining
  isInline?: boolean;        // Can bonds pass through?
  outgoingAngle?: number;    // For 120° zig-zag chains
}

// Bond connection
interface MoleculeBond {
  from: string;    // "node-3"
  to: string;      // "node-7"
  type: BondType;  // "single"
}

// Complete visualization
interface MoleculeRecipe {
  name: string;
  method?: string;           // "shake · strain · coupe"
  nodes: MoleculeNode[];
  bonds: MoleculeBond[];
  backbone: MoleculeBackbone;
}
```

---

## Ingredient Parser (`src/core/parser.ts`)

Converts raw ingredient strings into structured data.

### Supported Formats

**Unicode Fractions:** ½, ⅓, ⅔, ¼, ¾, ⅕, ⅖, ⅗, ⅘, ⅙, ⅚, ⅛, ⅜, ⅝, ⅞

**ASCII Fractions:** "1/2", "3/4"

**Mixed Numbers:** "1 1/2"

**Decimals:** "1.5", "2.75"

### Units (40+ supported)

- **Volume:** oz, ml, cl
- **Specialty:** dash, drop, barspoon, tsp, tbsp
- **Solids:** cube, slice, piece, sprig, leaf, wheel, wedge, twist
- **Containers:** cup, part

### Unit Normalization

Maps variants to canonical forms:
- "ounce", "ounces" → "oz"
- "tablespoon" → "tbsp"
- "teaspoon" → "tsp"

### Conversion to Ounces

| Unit | Conversion Factor |
|------|-------------------|
| oz | 1 |
| ml | 0.033814 |
| dash | 0.03125 (1/32 oz) |
| drop | 0.0016907 (1/600 oz) |
| barspoon | 0.125 |
| tsp | 0.166667 |
| tbsp | 0.5 |
| cup | 8 |
| piece/slice | 0.25 |
| sprig/twist | 0.125 |
| leaf | 0.0625 |

### Modifier Keywords (25+)

Extracts preparation details: fresh, chilled, muddled, crushed, expressed, flamed, aged, float, rinse, topped, etc.

---

## Ingredient Classifier (`src/core/classifier.ts`)

Maps parsed ingredients to types using keyword matching.

### Classification Priority

Checked in order (first match wins):

1. **spirit** - Base ingredients (highest priority)
2. **sweet** - Liqueurs (before garnish to avoid "blackberry liqueur" → garnish)
3. **bitter** - Bitters/amari
4. **acid** - Citrus/acids
5. **salt** - Salt/spicy
6. **dairy** - Dairy products
7. **egg** - Eggs
8. **dilution** - Mixers/sodas
9. **garnish** - Fallback for unknowns

### Keyword Database

**Spirits (25+ keywords):**
- Whiskey family: bourbon, whiskey, rye, scotch
- Clear: vodka, gin, tequila, mezcal, rum
- Brandy: brandy, cognac, armagnac, calvados

**Acids (15+ keywords):**
- Citrus: lime, lemon, grapefruit, orange, yuzu
- Other: vinegar, shrub, passion fruit, pineapple

**Sweets (60+ keywords):**
- Syrups: simple syrup, honey, agave, grenadine, orgeat
- Liqueurs: cointreau, maraschino, amaretto, chartreuse

**Bitters (20+ keywords):**
- Bitters: angostura, peychauds, orange bitters
- Amari: campari, aperol, fernet

### Display Labels

```typescript
// Spirits: Full name (RUM, GIN, WHISKEY)
// Others: 2-letter abbreviations
Ac = Acid     Sw = Sweet    Bt = Bitter
Na = Salt     Mx = Mixer    Ga = Garnish
Da = Dairy    Eg = Egg
```

### Chaos Calculation

Returns 0.2-0.8 randomness factor based on ingredient commonness:
- Common ingredients (vodka, lime, simple syrup) → lower chaos → orderly layout
- Unusual ingredients → higher chaos → organic, scattered layout

---

## Layout Engine (`src/core/layout.ts`)

The heart of the visualization - positions ingredient nodes around hexagonal benzene ring backbones.

### Key Constants

```typescript
HEXAGON_RADIUS = 22px           // Benzene ring radius
TEXT_RADIUS = 8px               // Text label edge shortening
TARGET_VISUAL_BOND_LENGTH = 18px // Visible line length
CHAIN_BOND_LENGTH = 34px        // Center-to-center for text pairs
HEX_GRID_SPACING = 38.1px       // Distance between hex centers (22 × √3)
MAX_CHAIN_LENGTH = 4            // Ingredients per corner before new corner
```

### Hexagon Geometry

Rotated flat-top hexagon (30° rotation) with flat edges facing top/bottom:

```
        5 (upper-left)     0 (upper-right)
              ╱─────╲
             ╱       ╲
    4 (left)|    ●    | 1 (right)
             ╲       ╱
              ╲─────╱
        3 (lower-left)     2 (lower-right)
```

**Corner Angles:** 0=-60°, 1=0°, 2=60°, 3=120°, 4=180°, 5=-120°

### Spirit Positioning Algorithm

**Single Spirit:**
- Placed at canvas center (200, 150 for 400×300)

**Two Spirits:**
- Vertical stack, spaced by HEX_GRID_SPACING
- Creates "flavor backbone" visual

**Three Spirits - Same Type (all rums):**
- Compact triangle formation
- Lower-right at +30°, upper-right at -120° from anchor

**Three Spirits - Different Types:**
- V-shape (wider spread to show contrast)
- Lower-left at -150°, lower-right at -30° from top

**Four+ Spirits:**
- Vertical stack, evenly distributed

**Centroid Calculation:**
1. Calculate spirit positions relative to origin
2. Find centroid (average of all positions)
3. Offset to place centroid at canvas center

### Corner Availability

Depends on spirit count to avoid overlaps:

| Spirits | Spirit Index | Available Corners |
|---------|--------------|-------------------|
| 1 | 0 | All [0,1,2,3,4,5] |
| 2 (vertical) | 0 (top) | [0,1,5,4] |
| 2 (vertical) | 1 (bottom) | [1,2,3,4] |
| 3 (same type) | 0 (left) | [3,4,5] |
| 3 (same type) | 1 (lower-right) | [1,2,3] |
| 3 (same type) | 2 (upper-right) | [0,5] |

### Ingredient Placement Strategy

| Type | Preferred Corners |
|------|-------------------|
| Acids | Right/east [1, 0, 2] |
| Sweets | Flexible, branch from acids |
| Bitters | Left/west [4, 5, 3] |
| Garnishes | Any available |
| Remaining | Bottom [2, 3] |

### Junction Nodes

Invisible phantom nodes created for branching when multiple ingredients share a corner:

```
Spirit node
    │
   HEX CORNER (angle θ)
    │
JUNCTION (at θ, distance = 40px)
   ╱ ╲
  ╱   ╲
BRANCH1  BRANCH2
(+60°)   (-60°)
```

### Zig-Zag Chaining

Chains follow 120° angles for organic hexagonal wave pattern:

```
Spirit node
    │
Corner 1 (0°) → Acid 1
           │ (+60°)
           Acid 2
           │ (-60°)
           Acid 3
           │ (+60°)
           Acid 4
```

### Collision Detection

- **Minimum distance:** 27.2px (80% of chain bond length)
- Algorithm checks all used positions
- On collision: try alternative corner

### Canvas Bounds

All nodes clamped to 30-40px padding from edges.

---

## Bond Generation (`src/core/bonds.ts`)

Creates connections between positioned nodes.

### Bond Type Determination

| From Type | To Type | Bond Type |
|-----------|---------|-----------|
| junction | garnish | wedge |
| junction | bitter | dashedWedge |
| any | garnish | wedge |
| any | bitter | dashedWedge |
| any | carbonated mixer | dashed |
| acid | sweet | double |
| sweet | acid | double |
| any | any | single |

**Special Cases:**
- "dash" or "drop" in ingredient text → dashedWedge
- Ginger beer, tonic, soda, cola → dashed

### Geometric Helpers

**`getDoubleBondLines()`** - Creates parallel lines offset by 3px perpendicular to bond

**`shortenBondToEdge()`** - Stops bond at node radius edge:
- Spirit bonds stop at hexagon ring (22px radius)
- Text bonds stop at label edge (8px radius)
- Junction bonds don't shorten (0px radius)

---

## Molecule Component (`src/components/Molecule.tsx`)

React component that renders the SVG visualization.

### Rendering Layers

```
<svg viewBox="0 0 400 300">
  <!-- Layer 1: Benzene rings around spirits -->
  <g>BenzeneRing components</g>

  <!-- Layer 2: Chemical bonds -->
  <g>Bond components</g>

  <!-- Layer 3: Node labels -->
  <g>Node components</g>
</svg>

<!-- Tooltip overlay -->
<Tooltip />

<!-- Legend footer -->
<Legend />
```

### BenzeneRing Component

Renders alternating single/double bonds in hexagon:
- Outer edges: solid black, 1.5px stroke
- Double bonds on alternating edges (0, 2, 4)
- Classic organic chemistry appearance

### ViewBox Modes

**Standard:** `0 0 400 300` - Fixed canvas with potential whitespace

**Tight:** Dynamic based on node bounds
- Crops to actual content
- Adds padding (40px top for labels, 20px sides/bottom)
- Optimal for exports

### Props

```typescript
interface MoleculeProps {
  recipe: MoleculeRecipe;
  width?: number;              // ViewBox width (400)
  height?: number;             // ViewBox height (300)
  displayWidth?: number;       // Rendered width
  displayHeight?: number;      // Rendered height
  showLegend?: boolean;        // Show color legend
  tightViewBox?: boolean;      // Crop to content
  svgRef?: RefObject;          // For export
}
```

---

## Node Rendering (`src/components/Node.tsx`)

### Spirit Nodes
- Positioned at benzene ring center
- Text: Full spirit name (RUM, GIN, WHISKEY)
- Hover area: 30px radius (covers entire ring)

### Regular Ingredient Nodes
- Text-only labels (no colored circles)
- Label: 2-letter type abbreviation
- Sublabel: Optional modifier (e.g., "blanco")
- Hover area: 14px radius
- Monochrome black (#333) for academic style

### Junction Nodes
- Completely invisible
- No text, circle, or hit area
- Exist only for bond routing

---

## Adapter (`src/adapter.ts`)

Transforms AlchemixRecipe format to MoleculeRecipe.

### Pipeline Steps

1. **Normalize ingredients** - Handle array/JSON/delimiter formats
2. **Parse** - Extract amount, unit, name, modifiers
3. **Classify** - Assign types and colors
4. **Calculate chaos** - Determine layout randomness
5. **Compute layout** - Position all nodes
6. **Generate bonds** - Create connections
7. **Generate backbone** - Create hexagon
8. **Derive method** - Extract technique from instructions

### Method Derivation

Extracts from instructions:
- Technique: shake, stir, build, muddle, blend
- Strain: strain, double strain

Adds glass type:
- "coupe glass" → "coupe"
- "rocks glass" → "rocks"

Format: `"shake · strain · coupe"`

---

## Configuration Summary

| Constant | Value | Purpose |
|----------|-------|---------|
| BENZENE_RADIUS | 22px | Spirit hexagon radius |
| TEXT_RADIUS | 8px | Text label shortening |
| TARGET_VISUAL_BOND_LENGTH | 18px | Visible line length |
| CHAIN_BOND_LENGTH | 34px | Text-to-text distance |
| HEX_GRID_SPACING | 38.1px | Spirit-to-spirit distance |
| MIN_DISTANCE | 27.2px | Collision threshold |
| MAX_CHAIN_LENGTH | 4 | Ingredients per corner |
| DEFAULT_WIDTH | 400px | Canvas width |
| DEFAULT_HEIGHT | 300px | Canvas height |

---

## Usage Example

```tsx
import { Molecule, transformRecipe } from '@alchemix/recipe-molecule';

const recipe = {
  name: 'Margarita',
  ingredients: ['2 oz Tequila', '1 oz Lime juice', '0.75 oz Cointreau'],
  instructions: 'Shake with ice, strain into coupe',
  glass: 'Coupe'
};

const moleculeRecipe = transformRecipe(recipe);

<Molecule
  recipe={moleculeRecipe}
  showLegend={true}
  tightViewBox={false}
/>
```

---

## File Structure

```
packages/recipe-molecule/
├── src/
│   ├── core/
│   │   ├── types.ts        # Type definitions
│   │   ├── parser.ts       # Ingredient parsing
│   │   ├── classifier.ts   # Type classification
│   │   ├── layout.ts       # Node positioning
│   │   ├── bonds.ts        # Bond generation
│   │   └── formula.ts      # Chemical formula notation
│   ├── components/
│   │   ├── Molecule.tsx    # Main SVG container
│   │   ├── Bond.tsx        # Bond rendering
│   │   ├── Node.tsx        # Node rendering
│   │   ├── Tooltip.tsx     # Hover tooltips
│   │   └── Legend.tsx      # Color legend
│   ├── adapter.ts          # Recipe transformation
│   ├── export.ts           # PNG/SVG export
│   └── index.ts            # Public exports
└── FORMULA_NOTATION.md     # Formula notation spec
```
