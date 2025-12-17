# Molecular Mixology (AlcheMix) — Design System

**Version**: v1.30.0
**Last Updated**: December 17, 2025

---

## Overview

AlcheMix is a cocktail inventory and recipe management application with a "Molecular Mixology" design system. The interface treats cocktails as chemical formulas rendered on high-quality laboratory paper.

### Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14, TypeScript, CSS Modules |
| State | Zustand 4.5 |
| Animations | d3-force (molecule physics) |
| Icons | Lucide React |
| Molecule Viz | @alchemix/recipe-molecule (custom SVG) |

### Core Metaphor

The UI mimics a high-end laboratory interface:
- **Ingredients** → Elements (Periodic Table)
- **Recipes** → Molecules (node-link diagrams)
- **Inventory** → Mass/Volume
- **User** → The chemist

---

## 1. Design Philosophy

**Core Principles**: Clarity, Purity, Structure, Precision.

The aesthetic is derived from high-end chemistry textbooks, Swiss graphic design (Müller-Brockmann, Helvetica documentary), molecular modeling software, and laboratory equipment interfaces. It rejects the chaos of the real world in favor of the perfect order of the atomic world. This is the UI equivalent of a pristine research lab at 6am—everything in its place, every measurement exact, every surface clean.

**The Vibe**: Clinical, intellectual, quietly confident. It's the design equivalent of a well-made Old Fashioned—no unnecessary ingredients, perfect proportions, served with precision. The interface should feel like it was designed by scientists who happen to have impeccable taste. Not cold, but *controlled*. Not boring, but *intentional*.

**The Tactile Experience**:

| Concept | Description |
|---------|-------------|
| **The Laboratory** | The background is not a void but a clean slate—Paper White (#F8F9FA) or Matte Slate (#0F172A). Every element exists on this "lab bench." |
| **The Periodic Table** | Navigation and selection are grid-based. Every ingredient has an "Atomic Number" (inventory ID), a "Symbol" (2-letter abbreviation), and a "Group" (spirit family). |
| **The Molecule** | Recipes are not lists; they are node-link diagrams. The base spirit is the nucleus; modifiers orbit it. Bond thickness represents volume. |
| **The Instrument** | Inputs feel like precision instruments—pipettes, graduated cylinders, analytical balances. Not sliders, but steppers. Not toggles, but switches. |

**Visual Signatures That Make This Unforgettable**:

1. **Hairline Borders**: 1px lines everywhere. They're structural, not decorative—like the lines on graph paper or the markings on a beaker.

2. **Color-Coded Top Borders**: Elements have a 3px colored top border indicating their "chemical group" (Agave=Teal, Grain=Amber, etc.). The rest of the border is neutral.

3. **Monospace Data**: All measurements, quantities, and formulas use monospace with leading zeros (01.50 oz, not 1.5 oz). Decimal points align.

4. **Chemical Notation**: Recipes displayed as formulas: `Ry₂ · Sv₁ · Cp₁` using proper subscript. Not "2 oz Rye" but "Ry₂".

5. **Node-Link Diagrams**: Recipes rendered as 2D molecular structures. Base spirit = large central node. Modifiers = smaller orbiting nodes. Lines = bonds (thickness = volume).

6. **Brownian Motion**: Idle animations should feel like molecules drifting in solution—slow, random, physics-based. Not bouncy or playful.

7. **The Grid**: Everything aligns. The periodic table is a perfect grid. Cards are squares. Spacing follows an 8px base unit.

---

## 2. Design Token System (The DNA)

### Colors (The "Reagent" Palette)

Colors are desaturated and matte—like diagrams printed on high-quality paper or labels on laboratory bottles. No neon. No gradients unless representing liquid density.

```css
:root {
  /* === BASE THEMES === */
  
  /* Light Mode (Paper) - DEFAULT */
  --bg-paper:          #F8F9FA;  /* Clinical off-white, like quality paper stock */
  --bg-elevated:       #FFFFFF;  /* Pure white for cards/elevated surfaces */
  --fg-primary:        #1E293B;  /* Ink black, high contrast */
  --fg-secondary:      #64748B;  /* Graphite, for secondary text */
  --fg-tertiary:       #94A3B8;  /* Light graphite, for hints/placeholders */
  --border-hairline:   #E2E8F0;  /* Structural lines, like graph paper */
  --border-emphasis:   #CBD5E1;  /* Slightly darker for emphasis */
  
  /* Dark Mode (Slate Lab Countertop) */
  --bg-slate:          #0F172A;  /* Deep blue-black, like a lab bench */
  --bg-elevated-dark:  #1E293B;  /* Elevated surfaces in dark mode */
  --fg-primary-dark:   #F1F5F9;  /* Off-white text */
  --fg-secondary-dark: #94A3B8;  /* Muted text */
  --border-dark:       #334155;  /* Dark mode borders */
  
  /* === ELEMENT GROUPS (Chemical Categories) === */
  /* These are the "periodic table" color coding */
  
  --bond-agave:        #0D9488;  /* Teal — Tequila, Mezcal */
  --bond-grain:        #D97706;  /* Amber — Whiskey, Bourbon, Rye */
  --bond-cane:         #65A30D;  /* Leaf Green — Rum, Cachaça */
  --bond-juniper:      #0EA5E9;  /* Sky Blue — Gin */
  --bond-grape:        #7C3AED;  /* Violet — Brandy, Cognac, Pisco */
  --bond-neutral:      #64748B;  /* Slate — Vodka */
  --bond-botanical:    #EC4899;  /* Pink — Amaro, Vermouth, Bitters */
  --bond-acid:         #F59E0B;  /* Yellow — Citrus (Lemon, Lime, Orange) */
  --bond-sugar:        #6366F1;  /* Indigo — Syrups, Liqueurs */
  --bond-dairy:        #F5F5F4;  /* Cream — Cream, Eggs */
  --bond-carbonation:  #A1A1AA;  /* Silver — Soda, Tonic, Sparkling */
  
  /* === FUNCTIONAL COLORS === */
  --status-optimal:    #10B981;  /* Emerald — In stock, balanced */
  --status-warning:    #F59E0B;  /* Amber — Low stock, attention */
  --status-critical:   #EF4444;  /* Red — Out of stock, error */
  --status-info:       #0EA5E9;  /* Blue — Informational */
  
  /* === INTERACTION STATES === */
  --focus-ring:        #0D9488;  /* Teal focus ring (matches agave, feels "primary") */
  --hover-overlay:     rgba(0, 0, 0, 0.04);  /* Light mode hover */
  --hover-overlay-dark: rgba(255, 255, 255, 0.06);  /* Dark mode hover */
  --selected-bg:       rgba(13, 148, 136, 0.08);  /* Teal tint for selected */
}
```

### Typography

**Font Stack**:

| Usage | Font | Rationale |
|-------|------|-----------|
| Headings & UI | `"Inter", "Helvetica Neue", -apple-system, sans-serif` | Objective, neutral, Swiss-inspired, highly legible |
| Data & Formulas | `"JetBrains Mono", "SF Mono", "Consolas", monospace` | For measurements, inventory counts, chemical symbols—aligns decimals |
| Element Symbols | `"JetBrains Mono", monospace` at `font-weight: 600` | Bold monospace for the 2-letter element abbreviations |

**Type Scale & Styling**:

```css
/* === HEADINGS === */
.h1-display {
  font-family: var(--font-sans);
  font-size: 2.25rem;        /* 36px */
  font-weight: 600;
  letter-spacing: -0.025em;  /* Tight tracking */
  line-height: 1.2;
}

.h2-section {
  font-family: var(--font-sans);
  font-size: 1.5rem;         /* 24px */
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: 1.3;
}

.h3-card {
  font-family: var(--font-sans);
  font-size: 1.125rem;       /* 18px */
  font-weight: 500;
  letter-spacing: -0.01em;
  line-height: 1.4;
}

/* === BODY === */
.body-default {
  font-family: var(--font-sans);
  font-size: 0.9375rem;      /* 15px */
  font-weight: 400;
  line-height: 1.6;
  color: var(--fg-secondary);
}

/* === LABELS (Scientific/Technical) === */
.label-section {
  font-family: var(--font-sans);
  font-size: 0.625rem;       /* 10px */
  font-weight: 500;
  letter-spacing: 0.2em;     /* VERY wide */
  text-transform: uppercase;
  color: var(--fg-secondary);
}

.label-element-number {
  font-family: var(--font-mono);
  font-size: 0.5625rem;      /* 9px */
  color: var(--fg-secondary);
}

/* === DATA/MEASUREMENTS === */
.data-symbol {
  font-family: var(--font-mono);
  font-size: 1.5rem;         /* 24px */
  font-weight: 600;
  letter-spacing: -0.05em;
}

.data-measurement {
  font-family: var(--font-mono);
  font-size: 0.75rem;        /* 12px */
  font-weight: 400;
  font-variant-numeric: tabular-nums;  /* Aligns numbers in columns */
}

.data-formula {
  font-family: var(--font-mono);
  font-size: 0.75rem;
}
.data-formula sub {
  font-size: 0.625rem;       /* Subscripts for chemical notation */
}

/* === ELEMENT NAME (in periodic table cards) === */
.element-name {
  font-family: var(--font-sans);
  font-size: 0.5rem;         /* 8px */
  font-weight: 500;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--fg-secondary);
}
```

### Radius & Structure

```css
:root {
  --radius-none:    0px;      /* Sharp corners - DEFAULT for most elements */
  --radius-atom:    9999px;   /* Perfect circles for molecular nodes */
  --radius-card:    2px;      /* Almost sharp, like lab slides/glass edges */
  --radius-input:   2px;      /* Minimal softening on inputs */
  --radius-button:  2px;      /* Buttons match inputs */
  --radius-pill:    9999px;   /* Full round for tags/badges */
}
```

**Border Philosophy**: 1px hairline borders are the primary structural element. They define space like the lines on graph paper. Use `--border-hairline` by default, `--border-emphasis` for focus/hover states.

### Shadows & Depth

This is a FLAT design system. Depth is communicated through borders and subtle background color shifts, NOT shadows. Use shadows extremely sparingly.

```css
:root {
  /* Almost no shadows - very subtle elevation */
  --shadow-sm:  0 1px 2px rgba(0, 0, 0, 0.04);
  --shadow-md:  0 2px 4px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02);
  
  /* Hover lift - barely perceptible */
  --shadow-hover: 0 4px 12px rgba(0, 0, 0, 0.06);
  
  /* Focus ring - NOT a shadow, a proper outline/ring */
  --ring-focus: 0 0 0 2px var(--bg-paper), 0 0 0 4px var(--focus-ring);
}
```

### Spacing System (8px Base Grid)

```css
:root {
  --space-1:   4px;
  --space-2:   8px;    /* Base unit */
  --space-3:   12px;
  --space-4:   16px;
  --space-5:   20px;
  --space-6:   24px;
  --space-8:   32px;
  --space-10:  40px;
  --space-12:  48px;
  --space-16:  64px;
  --space-20:  80px;
  --space-24:  96px;
}
```

---

## 3. Component Specifications

### The "Element" (Ingredient Card)

The atomic building block of the Periodic Table view. MUST be a perfect square.

```
┌─────────────────────┐  ← 3px top border in group color
│ 01                  │  ← Atomic Number (top-left, mono, 9px)
│                     │
│        Ry           │  ← Symbol (center, mono bold, 24px)
│                     │
│    RYE WHISKEY      │  ← Full Name (bottom, truncated, 8px uppercase)
└─────────────────────┘
```

**Specifications**:

| Property | Value |
|----------|-------|
| Shape | Perfect square (`aspect-ratio: 1`) |
| Background | `--bg-elevated` (white in light mode) |
| Border | `1px solid --border-hairline` |
| Top Border | `3px solid [group-color]` (overrides top border) |
| Border Radius | `--radius-card` (2px) |
| Padding | `--space-2` (8px) |

**States**:

| State | Behavior |
|-------|----------|
| Default | As specified above |
| Hover | `transform: scale(1.05)`, `box-shadow: --shadow-hover`, `z-index: 10` |
| Selected | `border-color: [group-color]`, `box-shadow: 0 0 0 2px [group-color]` |
| Disabled/Out-of-Stock | `opacity: 0.4`, top border becomes `--fg-tertiary` |

**Logistics Mode Variant**: Same card but adds a small "stock level" bar at the bottom (like liquid in a beaker).

### The "Molecule" (Recipe Visualization)

Recipes rendered as 2D node-link diagrams. This is the HERO component.

**Structure**:

```
           [Sv]  ←  Modifier node (smaller, 28px radius)
            │
            │   ← Bond line (stroke-width = volume)
            │
  [Cp]────[Ry]────[Or]
            │
            │
          [Ab]  ← Garnish node (smallest, 16px radius)
```

**Node Specifications**:

| Node Type | Circle Radius | Fill | Symbol Size |
|-----------|---------------|------|-------------|
| Base Spirit | 40px | `[group-color]` | 18px |
| Modifier | 28px | `[group-color]` | 14px |
| Garnish | 16px | `[group-color]` | 10px |

**Bond (Line) Specifications**:

| Property | Value |
|----------|-------|
| Stroke Color | `--border-hairline` (or `--border-emphasis`) |
| Stroke Width | Proportional to volume: 0.5oz = 2px, 1oz = 3px, 2oz = 4px |
| Stroke Linecap | `round` |

**Labels**: Below each node, display volume in monospace (`01.00 oz`). For garnishes, display "Twist" or "Wheel" etc.

**Layout**: Uses d3-force simulation for physics-based positioning. Nodes repel each other while bonds maintain distances.

**Interaction**: Clicking a node highlights it and shows ingredient detail. Hovering shows tooltip with full name.

### The Balance Meter (Stoichiometry)

Shows recipe balance across key dimensions. Horizontal bar chart.

```
SPIRIT   ████████████░░░░░░░░░  65%
BITTER   ██████████░░░░░░░░░░░  45%
SWEET    ███████░░░░░░░░░░░░░░  38%
ACID     ░░░░░░░░░░░░░░░░░░░░░   0%
```

**Specifications**:

| Property | Value |
|----------|-------|
| Track Height | 6px |
| Track Background | `--border-hairline` |
| Fill Border Radius | 3px (slightly rounded) |
| Fill Colors | Use relevant `--bond-*` color for each category |
| Label | `--font-mono`, 10px, uppercase |
| Value | `--font-mono`, 11px, right-aligned |

### Buttons

All buttons are utilitarian and technical. No rounded corners. No gradients.

**Base Styles (All Variants)**:

```css
.btn-base {
  font-family: var(--font-mono);
  font-size: 0.6875rem;        /* 11px */
  font-weight: 500;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 10px 16px;
  border-radius: var(--radius-button);
  transition: all 150ms ease;
  cursor: pointer;
}
```

**Variants**:

| Variant | Background | Border | Text | Hover |
|---------|------------|--------|------|-------|
| Primary | `--bond-agave` | none | white | `brightness(1.1)` |
| Secondary | transparent | `1px solid --border-hairline` | `--fg-primary` | `border-color: --fg-primary` |
| Ghost | transparent | none | `--fg-secondary` | `background: --hover-overlay` |
| Danger | transparent | `1px solid --status-critical` | `--status-critical` | `background: --status-critical`, text white |

**Focus State**: `box-shadow: var(--ring-focus)` using the focus ring variable.

### Inputs

Inputs should feel like laboratory instruments—precise, clinical, with clear affordances.

**Text Input**:

```
┌──────────────────────────────┐
│ > Enter ingredient name...   │  ← ">" prefix in accent color
└──────────────────────────────┘
```

| Property | Value |
|----------|-------|
| Background | `--bg-elevated` |
| Border | `1px solid --border-hairline` |
| Border Radius | `--radius-input` |
| Padding | `10px 12px 10px 28px` (left padding for prefix) |
| Font | `--font-mono`, 13px |
| Prefix | `>` character, absolute positioned, `--bond-agave` color |
| Placeholder | `--fg-tertiary`, italic |
| Focus | `border-color: --focus-ring`, `box-shadow: var(--ring-focus)` |

**Stepper Input** (for quantities):

```
┌───┬─────────┬───┐
│ - │  01.50  │ + │
└───┴─────────┴───┘
```

Mechanical, clicky feel. Use `font-variant-numeric: tabular-nums` for the number. Buttons are `--border-hairline` bordered squares.

### Cards

**Default Card**:

```css
.card {
  background: var(--bg-elevated);
  border: 1px solid var(--border-hairline);
  border-radius: var(--radius-card);
  padding: var(--space-6);
}
```

**Card with Hover Effect**:

```css
.card-interactive {
  transition: transform 150ms ease, box-shadow 150ms ease, border-color 150ms ease;
}
.card-interactive:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-hover);
  border-color: var(--border-emphasis);
}
```

**Terminal Card** (for code/formula displays):

```
┌─────────────────────────────┐
│ ● ● ●  FORMULA              │  ← Header bar with traffic lights
├─────────────────────────────┤
│                             │
│  Ry₂ · Sv₁ · Cp₁            │  ← Monospace content
│                             │
└─────────────────────────────┘
```

Background: `--bg-paper` (slightly darker than card). Traffic lights: red/yellow/green small circles. Header uses `--label-section` styling.

### Category Tabs (My Bar)

Horizontal tab navigation for filtering inventory by category.

```
┌─────────┬─────────┬─────────┬─────────┬─────────┐
│  ALL    │ SPIRITS │ LIQUEUR │ MIXERS  │  ...    │
└─────────┴─────────┴─────────┴─────────┴─────────┘
```

| Property | Value |
|----------|-------|
| Border | `1px solid --border-hairline` |
| Border Radius | `--radius-card` |
| Button Padding | `8px 16px` |
| Font | `--font-sans`, 12px, `font-weight: 500` |
| Active State | `background: --fg-primary`, `color: white` |
| Inactive State | `background: transparent`, `color: --fg-secondary` |
| Hover (inactive) | `background: --hover-overlay` |

**Categories**: All, Spirits, Liqueur, Wine/Vermouth, Mixers, Bitters, Syrups, Fresh, Tools

---

## 4. Layout Strategy

### Application Structure

**Pages** (Next.js App Router):
- `/login` - Authentication
- `/dashboard` - Lab overview with stats
- `/bar` - Inventory (My Bar) with Periodic Table
- `/recipes` - Recipe management with collections
- `/ai` - AI Bartender chat
- `/favorites` - Saved recipes
- `/shopping-list` - Smart shopping recommendations
- `/account` - User settings, export/import
- `/settings` - Theme and preferences

### Grid System

**Container**: `max-width: 1400px`, centered, `padding: 0 24px`

**Periodic Table Grid** (6×6):
- Desktop: `grid-template-columns: repeat(6, 1fr)`, `gap: 8px`
- Tablet: `grid-template-columns: repeat(3, 1fr)`
- Mobile: `grid-template-columns: repeat(2, 1fr)`

**Main Layout**:
```
┌─────────────────────────────────────────────────────┐
│  TopNav (Logo + Nav Links + User Dropdown)          │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Page Content (full width)                          │
│                                                     │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**TopNav Navigation**: Dashboard, My Bar, Recipes, AI Bartender, Favorites, Shopping List

### Section Spacing

- Between major sections: `--space-16` to `--space-24` (64-96px)
- Section internal padding: `--space-12` (48px)
- Card internal padding: `--space-6` (24px)
- Tight element spacing: `--space-2` (8px)

### Alignment Philosophy

EVERYTHING ALIGNS. Use the 8px grid religiously. Numbers should use `tabular-nums` so decimal points align in columns. The UI should feel like it was laid out with a ruler.

---

## 5. Non-Genericness (THE PRECISION FACTOR)

**MANDATORY DESIGN CHOICES** — These are non-negotiable to maintain the scientific aesthetic:

### 1. The Periodic Table of Mixology
A 6×6 grid visualizing ingredient TYPES by function (group) and origin (period).

**Groups (Columns)** - Functional role in cocktails:
| Group | Function | Examples |
|-------|----------|----------|
| Base | Primary spirit | Gin, Rum, Whiskey, Tequila |
| Bridge | Secondary spirit/modifier | Vermouth, Sherry, Amaro |
| Modifier | Flavor enhancer | Chartreuse, Bénédictine, Maraschino |
| Sweetener | Sugar/sweetness | Syrups, Liqueurs, Honey |
| Reagent | Acid/balance | Citrus, Vinegar |
| Catalyst | Enhancers | Bitters, Soda, Egg White |

**Periods (Rows)** - Spirit origin/base:
| Period | Origin | Examples |
|--------|--------|----------|
| Agave | Agave plant | Tequila, Mezcal |
| Cane | Sugarcane | Rum, Cachaça |
| Grain | Grain-based | Whiskey, Vodka, Gin |
| Grape | Grape/fruit | Brandy, Cognac, Pisco |
| Fruit | Fresh fruit | Citrus, Berries, Tropical |
| Botanic | Herbs/botanicals | Bitters, Vermouth, Amaro |

Each cell shows a predefined element TYPE with the user's inventory items counted against it.

### 2. Leading Zeros on All Measurements
Never `1.5 oz`. Always `01.50 oz`. This is a laboratory. Precision matters. Use `font-variant-numeric: tabular-nums` so columns align.

### 3. Chemical Formula Notation
Display recipes as formulas: `Ry₂ · Sv₁ · Cp₁` (with proper subscripts). The interpunct (·) separates components. This appears in card headers, not just the molecule view.

### 4. Recipes Are Molecular Diagrams
Never display a recipe as just a list. Always show the node-link molecular structure. The list is secondary/supplementary.

### 5. Color Coding by Chemical Group
Every ingredient belongs to a "group" with a specific color. This color appears as:
- Top border on Element cards
- Fill color on molecular nodes
- Pip/dot next to ingredient names in lists

### 6. The Balance Check
Every recipe view includes a "Stoichiometric Balance" visualization—showing the ratio of Spirit/Bitter/Sweet/Acid. This isn't decorative; it's functional.

### 7. Force-Directed Layout
Molecular diagrams use d3-force for physics-based node positioning. Nodes repel each other while bonds pull connected nodes together, creating organic-looking molecule structures.

### 8. Hairline Everything
1px borders define all structural elements. The UI should feel drawn with a technical pen.

### 9. Monospace for Data
ALL data (numbers, measurements, element symbols, formulas) uses the monospace font. ALL prose (names, descriptions, labels) uses the sans-serif font. No mixing.

### 10. Terminal Prefix
Text inputs have a `>` prefix character. This creates the "command line" feel of interacting with laboratory software.

---

## 6. Effects & Animation

**Motion Feel**: "Magnetic" and "Viscous." Elements should feel like they have mass and are suspended in liquid. Not bouncy, not snappy—*deliberate*.

### Molecule Animations (d3-force)

The `@alchemix/recipe-molecule` package uses d3-force for physics-based node positioning:

```typescript
// Force simulation for molecule layout
const simulation = forceSimulation(nodes)
  .force('charge', forceManyBody().strength(-150))
  .force('link', forceLink(bonds).distance(60))
  .force('center', forceCenter(width / 2, height / 2))
  .force('collision', forceCollide().radius(30));
```

**Transition Defaults**:

```css
/* Standard transition */
transition: all 150ms ease;

/* For hover transforms */
transition: transform 150ms ease, box-shadow 150ms ease;

/* For color/opacity changes */
transition: color 100ms ease, opacity 100ms ease;
```

**Hover Behaviors**:

| Element | Hover Effect |
|---------|--------------|
| Element Card | `scale(1.05)`, lift shadow, z-index bump |
| Card | `translateY(-2px)`, subtle shadow |
| Button | Color shift, no transform |
| Molecular Node | `scale(1.1)`, highlight stroke |
| Table Row | Background highlight (`--hover-overlay`) |

**Keyframe Animations**:

```css
/* Pulse for low stock warning */
@keyframes pulse-warning {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* Smooth number counting (for inventory updates) */
@keyframes count-up {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Spinner rotation */
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
```

**Reduced Motion**:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 7. Iconography

**Library**: Lucide React (or Heroicons as fallback)

**Configuration**:

| Property | Value |
|----------|-------|
| Stroke Width | `1.5px` (thin, technical feel) |
| Default Size | `20px × 20px` |
| Color | `currentColor` (inherits from text) |

**Icon Usage Guidelines**:

- Icons are FUNCTIONAL, not decorative
- Always pair with text labels in buttons (icon-only buttons need aria-label)
- Use icons sparingly—this is a text-heavy, data-dense interface
- No icon backgrounds or containers unless absolutely necessary

**Suggested Icons**:

| Concept | Icon |
|---------|------|
| Search | `Search` |
| Add/Create | `Plus` |
| Remove | `Minus` or `X` |
| Settings/Tune | `SlidersHorizontal` |
| Filter | `Filter` |
| Stock/Inventory | `Package` |
| Recipe/Formula | `FlaskConical` |
| Favorites | `Star` |
| Navigation | `ChevronRight`, `ChevronDown` |

---

## 8. Responsive Strategy

### Breakpoints

```css
/* Standard breakpoints */
sm: 640px
md: 768px
lg: 1024px
xl: 1280px
```

### Mobile Adaptations

**Typography Scaling**: Minimal changes. The type scale is already compact. Hero titles may drop one size.

**Periodic Table** (6×6 grid):
- lg+: 6 columns (full grid)
- md: 3 columns (scrollable)
- sm: 2 columns (scrollable)

**Main Layout**:
- Full-width content with TopNav
- Modals become full-screen on mobile

**Molecule Diagram**:
- Scales with container via viewBox
- Maintains proportions at all sizes

**TopNav**:
- Desktop: Full horizontal navigation
- Mobile: Hamburger menu or reduced nav

**Touch Targets**:
- All interactive elements: minimum 44px touch target
- Element cards: naturally large enough
- Stepper buttons: ensure adequate size

### Maintained Elements Across All Sizes

- Hairline borders (1px)
- Monospace data formatting
- Color-coded group indicators
- Chemical notation
- Leading zeros on measurements

---

## 9. Accessibility

### Color Contrast

All color combinations meet WCAG AA (4.5:1 for normal text, 3:1 for large text):

| Combination | Ratio | Status |
|-------------|-------|--------|
| `--fg-primary` on `--bg-paper` | 13.5:1 | ✓ AAA |
| `--fg-secondary` on `--bg-paper` | 5.2:1 | ✓ AA |
| `--bond-agave` on `--bg-elevated` | 4.6:1 | ✓ AA |
| White on `--bond-agave` | 4.6:1 | ✓ AA |

### Focus States

```css
.focusable:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--bg-paper), 0 0 0 4px var(--focus-ring);
}
```

Focus ring is ALWAYS visible on keyboard navigation. Never remove outlines without providing alternative.

### Screen Reader Considerations

- Element cards: `role="button"`, `aria-label="[Full Name], [Group], [Stock Status]"`
- Molecule diagram: `role="img"`, `aria-label` describing the recipe structure
- Mode toggle: `role="tablist"` with `role="tab"` for each option
- Balance bars: `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`

### Reduced Motion

Respect `prefers-reduced-motion`:
- Disable Brownian motion on nodes
- Keep transforms but make them instant
- Maintain all functionality

### Keyboard Navigation

- Periodic Table: Arrow key navigation between elements
- Tab order: Logical flow through interactive elements
- Escape: Close modals/panels
- Enter/Space: Activate buttons and cards

---

## 10. Page-Specific Behaviors

### Dashboard

**Focus**: Overview of bar composition and recipe mastery

**Components**:
- Bar composition stats (spirit categories)
- Recipe mastery progress
- Collections sidebar
- Quick actions

### My Bar (Inventory)

**Focus**: Inventory management with Periodic Table visualization

**Components**:
- Category tabs (9 categories)
- BottleCard grid or Periodic Table view
- ItemDetailModal (view/edit modes)
- CSV import modal

### Recipes

**Focus**: Recipe management with collections

**Components**:
- Collection folders
- RecipeCard grid with molecule visualization
- Bulk operations (select/delete)
- CSV import
- RecipeDetailModal

### AI Bartender

**Focus**: AI-powered cocktail recommendations

**Components**:
- Chat interface
- Recipe recommendations with craftability markers
- Clickable recipe links

### Shopping List

**Focus**: Smart shopping recommendations

**Components**:
- Persistent items CRUD
- Recipe buckets (6 slots)
- Near-miss algorithm suggestions
- Ranked recommendations

---

## 11. Data Structures

The AI must understand these types to render components correctly:

```typescript
// Individual ingredient
type IngredientNode = {
  id: string;
  type: 'base' | 'modifier' | 'garnish' | 'ice';
  symbol: string;      // e.g., "Ry" for Rye
  name: string;        // e.g., "Rye Whiskey"
  group: ChemicalGroup;
  volume?: number;     // in oz, e.g., 2.0
  unit?: 'oz' | 'dash' | 'barspoon' | 'rinse' | 'twist' | 'wheel';
  abv?: number;        // alcohol by volume, e.g., 0.40
  cost?: number;       // cost per oz
  stock?: number;      // current inventory in oz
  par?: number;        // par level in oz
};

type ChemicalGroup = 
  | 'agave'      // Tequila, Mezcal
  | 'grain'      // Whiskey, Bourbon, Rye, Scotch
  | 'cane'       // Rum, Cachaça
  | 'juniper'    // Gin
  | 'grape'      // Brandy, Cognac, Pisco
  | 'neutral'    // Vodka
  | 'botanical'  // Vermouth, Amaro, Bitters
  | 'acid'       // Citrus
  | 'sugar'      // Syrups, Liqueurs
  | 'dairy'      // Cream, Eggs
  | 'carbonation'; // Soda, Tonic

// Recipe as a molecule
type RecipeMolecule = {
  id: string;
  name: string;
  formula: string;           // e.g., "Ry₂ · Sv₁ · Cp₁"
  method: 'stirred' | 'shaken' | 'built' | 'blended';
  centralAtom: IngredientNode;
  bonds: IngredientNode[];
  garnish?: IngredientNode;
  glassware?: string;
  totalVolume?: number;      // calculated
  totalCost?: number;        // calculated
  abv?: number;              // calculated
  balance?: {
    spirit: number;   // 0-100
    bitter: number;
    sweet: number;
    acid: number;
  };
};

// Inventory item (extends IngredientNode for Logistics)
type InventoryItem = IngredientNode & {
  stock: number;
  par: number;
  lastUpdated: Date;
  supplier?: string;
  reorderPoint?: number;
};
```

---

## 12. Implementation Notes

### Technical Considerations

1. **CSS Modules**: All styling uses CSS Modules (`.module.css` files) with design system variables from `globals.css`.

2. **SVG for Molecules**: The `@alchemix/recipe-molecule` package uses SVG for molecular diagrams. Easier to style, better accessibility, works with d3-force.

3. **d3-force**: Used for physics-based molecule layout. Force simulation positions nodes and bonds.

4. **Font Loading**: Inter and JetBrains Mono loaded via Google Fonts in `globals.css`. Uses `font-display: swap`.

5. **Dark Mode**: CSS variables defined for dark mode. Toggle via class on `<html>` or `prefers-color-scheme`.

6. **State Management**: Zustand with slices (auth, inventory, recipes, chat). LocalStorage persistence for user data.

7. **Performance**:
   - Molecule rendering: SVG with viewBox scaling
   - Large grids: Consider virtualization for >100 items
   - API caching: SWR-style fetch with Zustand

### Actual File Structure

```
src/
├── app/                      # Next.js App Router pages
│   ├── login/
│   ├── dashboard/
│   ├── bar/
│   ├── recipes/
│   ├── ai/
│   ├── favorites/
│   ├── shopping-list/
│   ├── account/
│   └── settings/
├── components/
│   ├── ui/                   # Base UI components
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Modal.tsx
│   │   ├── Card.tsx
│   │   ├── Toast.tsx
│   │   ├── Spinner.tsx
│   │   ├── StepperInput.tsx
│   │   └── ElementCard.tsx
│   ├── modals/               # Modal dialogs
│   │   ├── AddBottleModal.tsx
│   │   ├── AddRecipeModal.tsx
│   │   ├── EditBottleModal.tsx
│   │   ├── ItemDetailModal.tsx
│   │   ├── RecipeDetailModal.tsx
│   │   ├── CSVUploadModal.tsx
│   │   └── DeleteConfirmModal.tsx
│   ├── layout/               # Layout components
│   │   └── TopNav.tsx
│   ├── BottleCard/           # Inventory item card
│   ├── RecipeCard/           # Recipe card with molecule
│   ├── PeriodicTableV2/      # 6×6 periodic table
│   ├── GlassSelector/        # Glassware picker
│   └── RecipeMolecule.tsx    # Molecule wrapper
├── lib/
│   ├── api.ts                # API client
│   ├── store/                # Zustand slices
│   ├── periodicTable/        # Table logic
│   └── formatters.ts         # Scientific formatters
├── hooks/
│   ├── useAuthGuard.ts
│   └── useSettings.ts
├── styles/
│   └── globals.css           # Design system tokens
└── types/
    └── index.ts

packages/
├── recipe-molecule/          # Molecule visualization
│   └── src/
│       ├── core/             # Parser, classifier, layout, bonds
│       └── components/       # Molecule, Node, Bond components
└── types/                    # Shared TypeScript types
```

### Testing Checklist

- [ ] All interactive elements have visible focus states
- [ ] Contrast ratios verified with browser devtools
- [ ] Reduced motion preference respected
- [ ] Keyboard navigation works throughout
- [ ] Touch targets are adequate on mobile
- [ ] Numbers align properly in columns
- [ ] Chemical formulas render subscripts correctly
- [ ] Dark mode colors all work
- [ ] Molecule diagrams scale responsively

---

## 13. Logo & Branding

### AlcheMix Logo

The AlcheMix logo is a Y-shaped molecular structure representing the fusion of chemistry and mixology.

**Component**: `src/components/ui/AlcheMixLogo.tsx`

### Logo Geometry

```
       [Green]         [Blue]
        (25,18)        (75,18)
           \            /
            \          /
             \        /
              \      /
               [Pink]      ← Center Junction (50, 45)
              (50,45)
                 |
                 |
                 |
              [Amber]
              (50,78)
```

**SVG ViewBox**: `0 0 100 100`

**Node Positions**:
| Node | Position | Radius (md) | Color Variable |
|------|----------|-------------|----------------|
| Top-Left | (25, 18) | 10px | `--bond-cane` (Green #65A30D) |
| Top-Right | (75, 18) | 10px | `--bond-juniper` (Sky Blue #0EA5E9) |
| Bottom | (50, 78) | 10px | `--bond-grain` (Amber #D97706) |
| Center | (50, 45) | 7px | `--bond-botanical` (Pink #EC4899) |

**Bonds**: 3 lines connecting center to each terminal node
- Stroke: `#3D3D3D` (light mode), `#888888` (dark mode)
- Stroke width: 4px (md size)

### Logo Size Variants

| Size | Icon | Gap | Wordmark | Use Case |
|------|------|-----|----------|----------|
| `sm` | 40×40 | 8px | 1.25rem | Compact navigation |
| `md` | 48×48 | 10px | 1.75rem | Default navigation |
| `lg` | 80×80 | 12px | 2.25rem | Login page, hero |

### Wordmark Typography

```
ALCHE  MIX
  ↑      ↑
Inter  JetBrains Mono
400    700
Gray   Black
```

| Part | Font | Weight | Color (Light) | Color (Dark) |
|------|------|--------|---------------|--------------|
| "ALCHE" | Inter | 400 | #6B6B6B | #777777 |
| "MIX" | JetBrains Mono | 700 | #1A1A1A | #F0F0F0 |

**Tagline**: "MOLECULAR OS V1.0"
- Font: JetBrains Mono
- Size: 0.875rem (lg), 0.6875rem (md), 0.5625rem (sm)
- Color: #6B6B6B (matches "ALCHE")
- Letter spacing: 0.2em
- Text transform: uppercase

### Logo Animation

On hover, terminal nodes exhibit subtle Brownian motion:

```css
@keyframes drift1 {
  0%, 100% { transform: translate3d(0, 0, 0); }
  25% { transform: translate3d(1.5px, -1px, 0); }
  50% { transform: translate3d(2px, -2px, 0); }
  75% { transform: translate3d(-0.5px, 1px, 0); }
}
```

- **Green node**: `drift1` at 8s
- **Blue node**: `drift2` at 9s
- **Amber node**: `drift3` at 7s
- **Easing**: `cubic-bezier(0.4, 0, 0.2, 1)`

Disabled when `prefers-reduced-motion: reduce`.

### Logo Props

```typescript
interface AlcheMixLogoProps {
  size?: 'sm' | 'md' | 'lg';      // Default: 'md'
  showText?: boolean;             // Default: true
  showTagline?: boolean;          // Default: false
  className?: string;
}
```

### Logo Files

**Location**: `public/`

| File | Content | Use Case |
|------|---------|----------|
| `icon.svg` | Y-molecule only (no text) | Favicon, app icon |
| `logo.svg` | Full logo with wordmark | Headers, about pages |
| `logo-text.svg` | Wordmark only (no icon) | Footer, text-only contexts |

### Color Meaning in Logo

The logo nodes use recipe mastery indicator colors (matching dashboard):

| Node | Color | Mastery Level |
|------|-------|---------------|
| Green | `--bond-cane` | Craftable (have all ingredients) |
| Blue | `--bond-juniper` | Almost There (missing 1-2) |
| Amber | `--bond-grain` | Need Few (missing 3-5) |
| Pink | `--bond-botanical` | Major Gaps (missing 6+) |

This creates a visual connection between the logo and the app's core functionality.
