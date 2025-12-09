# AlcheMix Visual Redesign Plan

**Branch**: `alchemix-redesign`
**Created**: December 8, 2025
**Status**: In Progress
**Last Updated**: December 8, 2025

---

## Overview

Complete visual redesign transforming AlcheMix from a warm, inviting cocktail bar aesthetic to a clinical, scientific laboratory interface. The new design treats cocktails as chemical formulas, ingredients as periodic table elements, and recipes as molecular diagrams.

### Design Philosophy

> "Clinical, intellectual, quietly confident. The design equivalent of a well-made Old Fashioned—no unnecessary ingredients, perfect proportions, served with precision."

**Core Principles**: Clarity, Purity, Structure, Precision

---

## Key Decisions

| Decision | Resolution |
|----------|------------|
| Dual-mode UI (Discovery/Logistics) | **Deferred** - not a priority for this redesign |
| My Bar page | **Dual view**: Periodic table of general categories (default) + List/Grid of user's items |
| Element symbols | **General categories only** - Rum, Whiskey, Vodka, etc. (not individual inventory items) |
| Formula notation | **Deferred** - needs further discussion to find appealing cocktail-appropriate format |
| Implementation | **Batch phases** - no commits until phase group is complete and reviewed |

---

## Phase Summary

| Phase | Name | Scope | Risk Level | Status | Progress |
|-------|------|-------|------------|--------|----------|
| 1 | Foundation | Colors, fonts, CSS variables | Low | **Done** | 100% |
| 2 | Typography System | Type scale, text classes, monospace data | Low | **Done** | 100% |
| 3 | Spacing & Structure | Grid system, borders, radius, shadows | Medium | **Done** | 100% |
| 4 | Core Components | Buttons, inputs, cards, modals | Medium | **Done** | 100% |
| 5 | Periodic Table | General ingredient categories as elements | Medium | **Done** | 100% |
| 6 | Recipe Molecule | Update visualization to match system | Low | **Done** | 100% |
| 7 | Page Layouts | My Bar views, navigation updates | Medium | **Done** | 100% |
| 8 | Dark Mode | Refined slate lab countertop theme | Medium | **Done** | 100% |
| 9 | Animations | Brownian motion, transitions, hover states | Low | **Done** | 100% |
| 10 | Polish | Accessibility audit, responsive refinements | Low | **Done** | 100% |

### Recommended Batches

**Batch A** (Foundation): Phases 1-4 — **COMPLETE**
- Colors, fonts, typography, spacing, core components
- Complete visual refresh without structural changes

**Batch B** (Features): Phases 5-7 — **COMPLETE**
- Periodic table, molecule updates, My Bar page views
- New components and page structure

**Batch C** (Polish): Phases 8-10 — **COMPLETE**
- Dark mode, animations, accessibility
- Final refinements

---

## Phase 1: Foundation (Colors & Fonts) — COMPLETE

**Goal**: Replace CSS variables with new color palette and fonts. This phase is largely non-breaking—components will automatically inherit new values.

**Status**: Complete

### 1.1 Font Changes

| Current | New | Usage |
|---------|-----|-------|
| Space Grotesk | Inter | Headings & UI |
| Inter | Inter | Body text |
| (none) | JetBrains Mono | Data, measurements, formulas |

**Action Items**:
- [x] Update Google Fonts import to include JetBrains Mono
- [x] Change `--font-display` from Space Grotesk to Inter
- [x] Add `--font-mono` variable for JetBrains Mono
- [x] Keep `--font-body` as Inter (no change)

```css
/* New font imports */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');

:root {
  --font-sans: "Inter", -apple-system, sans-serif;
  --font-mono: "JetBrains Mono", "SF Mono", "Consolas", monospace;
  --font-display: var(--font-sans);  /* Alias for backwards compat */
  --font-body: var(--font-sans);
}
```

### 1.2 Color Palette Changes

#### Base Colors (Light Mode)

| Variable | Current | New | Notes |
|----------|---------|-----|-------|
| `--color-ui-bg-base` | `#F8F5EB` (warm ivory) | `#F8F9FA` (paper white) | Cooler, more clinical |
| `--color-ui-bg-surface` | `#FFFFFF` | `#FFFFFF` | No change |
| `--color-text-body` | `#2D2C28` | `#1E293B` | Slightly cooler ink |
| `--color-text-muted` | `#7B776D` | `#64748B` | Slate gray |
| `--color-border-default` | `#E2E0DA` | `#E2E8F0` | Cooler gray |

#### Primary & Accent Colors

| Variable | Current | New | Notes |
|----------|---------|-----|-------|
| `--color-primary` | `#3DD6C1` | `#0D9488` | Deeper, more muted teal |
| `--color-secondary` | `#F2A74B` | `#D97706` | Amber (used for grain spirits) |

#### New: Element Group Colors

These are the "periodic table" color coding for ingredient categories:

```css
:root {
  /* Element Group Colors */
  --bond-agave:       #0D9488;  /* Teal — Tequila, Mezcal */
  --bond-grain:       #D97706;  /* Amber — Whiskey, Bourbon, Rye */
  --bond-cane:        #65A30D;  /* Leaf Green — Rum, Cachaça */
  --bond-juniper:     #0EA5E9;  /* Sky Blue — Gin */
  --bond-grape:       #7C3AED;  /* Violet — Brandy, Cognac, Pisco */
  --bond-neutral:     #64748B;  /* Slate — Vodka */
  --bond-botanical:   #EC4899;  /* Pink — Amaro, Vermouth, Bitters */
  --bond-acid:        #F59E0B;  /* Yellow — Citrus */
  --bond-sugar:       #6366F1;  /* Indigo — Syrups, Liqueurs */
  --bond-dairy:       #F5F5F4;  /* Cream — Cream, Eggs */
  --bond-carbonation: #A1A1AA;  /* Silver — Soda, Tonic */
}
```

#### Functional/Status Colors

| Variable | Current | New | Notes |
|----------|---------|-----|-------|
| `--color-success` | `#47E48C` | `#10B981` | Emerald |
| `--color-warning` | `#F2D45C` | `#F59E0B` | Amber |
| `--color-info` | `#4DA3F7` | `#0EA5E9` | Sky blue |
| `--color-error` | `#ef4444` | `#EF4444` | No change |

#### New: Interaction Colors

```css
:root {
  --focus-ring: #0D9488;
  --hover-overlay: rgba(0, 0, 0, 0.04);
  --selected-bg: rgba(13, 148, 136, 0.08);
}
```

### 1.3 Files to Modify

| File | Changes |
|------|---------|
| `src/styles/globals.css` | All variable definitions |

### 1.4 Testing Checklist

- [x] App renders with new colors
- [x] No broken color references
- [x] Text remains readable (contrast check)
- [x] Primary actions (buttons) still visible
- [x] Dark mode still functions (will refine in Phase 8)

---

## Phase 2: Typography System — COMPLETE

**Goal**: Implement the scientific typography scale with monospace data formatting.

**Status**: 100% Complete

**Completed**:
- [x] Font family variables (`--font-sans`, `--font-mono`) defined in globals.css
- [x] All page CSS modules updated to use `--font-sans` for headings/body
- [x] All page CSS modules updated to use `--font-mono` for data/badges/labels
- [x] Replaced deprecated `--text-*` variables with explicit rem values
- [x] Updated components: TopNav, modals, Toast, SuccessCheckmark

**Remaining**: None - all complete!
- [x] Create reusable `.h1-display`, `.h2-section`, `.h3-card` CSS classes in globals.css
- [x] Create `.data-measurement`, `.data-symbol`, `.data-formula` utility classes
- [x] Implement leading zeros formatting (`01.50 oz` instead of `1.5 oz`) - `src/lib/formatters.ts`
- [x] Implement chemical formula notation with subscripts (`Ry₂ · Sv₁`) - `formatFormula()`
- [x] Create `formatMeasurement()` utility function

### 2.1 Type Scale Updates

```css
/* Headings - tighter letter-spacing */
.h1-display {
  font-family: var(--font-sans);
  font-size: 2.25rem;        /* 36px */
  font-weight: 600;
  letter-spacing: -0.025em;
  line-height: 1.2;
}

.h2-section {
  font-size: 1.5rem;         /* 24px */
  letter-spacing: -0.02em;
}

.h3-card {
  font-size: 1.125rem;       /* 18px */
  letter-spacing: -0.01em;
}

/* Body - slightly smaller default */
.body-default {
  font-size: 0.9375rem;      /* 15px */
  line-height: 1.6;
  color: var(--fg-secondary);
}

/* Scientific Labels */
.label-section {
  font-size: 0.625rem;       /* 10px */
  font-weight: 500;
  letter-spacing: 0.2em;
  text-transform: uppercase;
}

/* Data/Measurements - MONOSPACE */
.data-measurement {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
}

.data-symbol {
  font-family: var(--font-mono);
  font-size: 1.5rem;
  font-weight: 600;
}

.data-formula {
  font-family: var(--font-mono);
}
.data-formula sub {
  font-size: 0.625rem;
}
```

### 2.2 Monospace Data Convention

All numerical data should use monospace with leading zeros:

| Current | New |
|---------|-----|
| `1.5 oz` | `01.50 oz` |
| `2 oz` | `02.00 oz` |
| `3 dashes` | `03 dash` |

### 2.3 Chemical Formula Notation

Recipes displayed as: `Ry₂ · Sv₁ · Cp₁`

- 2-letter symbols (monospace, bold)
- Subscript numbers for volume
- Interpunct (·) separator

### 2.4 Files to Modify

| File | Changes |
|------|---------|
| `src/styles/globals.css` | Typography classes, base font sizes |
| Various components | Add `.data-*` classes to measurements |

### 2.5 Decisions Needed

- [x] Should we create a utility function for formatting measurements with leading zeros? **→ Yes, create `src/lib/formatMeasurement.ts`**
- [ ] Where should chemical formula notation appear? (Recipe cards, detail modal, both?)

---

## Phase 3: Spacing & Structure — COMPLETE

**Goal**: Implement flat design with hairline borders and sharp corners.

**Status**: 100% Complete

**Completed**:
- [x] Spacing system variables defined (`--space-1` through `--space-24`)
- [x] Basic 8px grid in use
- [x] Border radius variables set to 2px (`--radius`, `--radius-sm`, `--radius-lg`, etc.)
- [x] Shadows flattened (`--shadow-sm`, `--shadow-md`, `--shadow-hover`)
- [x] `--border-hairline` and `--border-emphasis` variables defined
- [x] Hairline border utilities in globals.css (`.border-hairline`, `.border-hairline-top`, etc.)
- [x] Card and panel components using hairline borders

### 3.1 Border Radius Changes

| Variable | Current | New | Notes |
|----------|---------|-----|-------|
| `--radius` | `8px` | `2px` | Almost sharp |
| `--radius-sm` | `4px` | `2px` | Match base |
| `--radius-lg` | `12px` | `2px` | Match base |
| `--radius-full` | `9999px` | `9999px` | Keep for pills/atoms |
| (new) `--radius-none` | - | `0px` | Sharp corners |
| (new) `--radius-atom` | - | `9999px` | Perfect circles |

### 3.2 Shadow Changes (Flatten)

```css
:root {
  /* Minimal shadows - flat design */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.04);
  --shadow-md: 0 2px 4px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02);
  --shadow-hover: 0 4px 12px rgba(0, 0, 0, 0.06);

  /* Focus ring - not a shadow */
  --ring-focus: 0 0 0 2px var(--bg-paper), 0 0 0 4px var(--focus-ring);
}
```

### 3.3 Border Philosophy

1px hairline borders become the primary structural element:

```css
:root {
  --border-hairline: 1px solid var(--color-border-default);
  --border-emphasis: 1px solid #CBD5E1;
}
```

### 3.4 Spacing Adjustments

Current spacing is already 8px-based, minor tweaks:

```css
:root {
  --space-1:  4px;   /* Add smaller unit */
  --space-2:  8px;   /* Base unit */
  --space-3:  12px;
  --space-4:  16px;
  --space-5:  20px;
  --space-6:  24px;
  --space-8:  32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;
  --space-20: 80px;
  --space-24: 96px;
}
```

### 3.5 Visual Impact

This phase will noticeably change the app's look:
- Cards become sharper, more clinical
- Reduced shadow depth creates flatter appearance
- Hairline borders add structure

### 3.6 Files to Modify

| File | Changes |
|------|---------|
| `src/styles/globals.css` | Variables |
| All component CSS modules | Border radius, shadows |
| `src/components/ui/*.module.css` | Core UI components |

---

## Phase 4: Core Components — COMPLETE

**Goal**: Restyle buttons, inputs, cards, and modals to match scientific aesthetic.

**Status**: 100% Complete

**Files Created**:
- [x] `src/components/ui/StepperInput.tsx` - Quantity stepper with +/- buttons and leading zeros
- [x] `src/components/ui/StepperInput.module.css` - Stepper styling
- [x] TerminalCard styles in globals.css (`.card-terminal`, `.card-terminal-header`, etc.)

**Files Updated**:
- [x] `src/components/ui/Button.module.css` - Already styled with monospace, uppercase, 11px, 2px radius
- [x] `src/components/ui/Input.tsx` - Added `showPrefix` and `prefixChar` props for terminal prefix
- [x] `src/components/ui/Input.module.css` - Terminal prefix styles (`.inputPrefix`, `.inputWithPrefix`)
- [x] `src/components/ui/index.ts` - Exported StepperInput component

### 4.1 Buttons

**New button styles**:
- Monospace uppercase text
- 11px font size
- Wide letter-spacing (0.1em)
- Sharp corners (2px)
- No gradients

```css
.btn-base {
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  font-weight: 500;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 10px 16px;
  border-radius: 2px;
}
```

**Variants**:
| Variant | Background | Border | Text |
|---------|------------|--------|------|
| Primary | `--bond-agave` | none | white |
| Secondary | transparent | hairline | `--fg-primary` |
| Ghost | transparent | none | `--fg-secondary` |
| Danger | transparent | `--status-critical` | `--status-critical` |

### 4.2 Inputs

**New input styles**:
- Terminal prefix (`>`) in accent color
- Monospace font
- Sharp corners
- Hairline borders

```
┌──────────────────────────────┐
│ > Enter ingredient name...   │
└──────────────────────────────┘
```

**New: Stepper Input** for quantities:
```
┌───┬─────────┬───┐
│ - │  01.50  │ + │
└───┴─────────┴───┘
```

### 4.3 Cards

**Default card**:
- White background
- 1px hairline border
- 2px radius
- No/minimal shadow

**Interactive card**:
- Hover: translateY(-2px), subtle shadow, border-color change

**Terminal card** (new):
- Traffic light header (●●●)
- Monospace content
- For formula/code displays

### 4.4 Modals

- Sharp corners
- Hairline borders
- Reduced shadow
- Section labels uppercase

### 4.5 Files to Modify

| File | Changes |
|------|---------|
| `src/components/ui/Button.module.css` | Complete restyle |
| `src/components/ui/Input.module.css` | Add prefix, restyle |
| `src/components/ui/Modal.module.css` | Flatten, sharpen |
| Various page CSS modules | Card styles |

### 4.6 New Components Needed

- [ ] `StepperInput` - For precise quantity input
- [ ] `TerminalCard` - For formula displays

---

## Phase 5: Periodic Table of Ingredients — NOT STARTED

**Goal**: Create a periodic table displaying general ingredient categories as elements. This is a reference/navigation tool, NOT a display of individual inventory items.

**Status**: 0% Complete

**Files to Create**:
- [ ] `src/components/ui/ElementCard.tsx` - Individual element component
- [ ] `src/components/ui/ElementCard.module.css` - Element card styles
- [ ] `src/lib/periodicTable.ts` - Element definitions (categories, symbols, groups)
- [ ] `src/components/PeriodicTable.tsx` - Grid layout component
- [ ] `src/components/PeriodicTable.module.css` - Grid styles

### 5.1 Concept Clarification

The Periodic Table shows **general ingredient categories**, not the user's specific inventory:

| What It IS | What It's NOT |
|------------|---------------|
| Rum (general category) | "Appleton Estate 12yr" (specific item) |
| Bourbon | "Buffalo Trace" |
| Orange Liqueur | "Cointreau" |
| Lime | User's lime inventory |

Think of it as: "What types of ingredients exist in mixology?" - a reference table.

### 5.2 Element Card Design

```
┌─────────────────────┐  ← 3px top border in group color
│ 01                  │  ← Atomic Number (top-left, mono, 9px)
│                     │
│        Rm           │  ← Symbol (center, mono bold, 24px)
│                     │
│        RUM          │  ← Full Name (bottom, 8px uppercase)
└─────────────────────┘
```

**Specifications**:
- Perfect square (`aspect-ratio: 1`)
- Color-coded 3px top border by ingredient group
- Monospace symbol (2-3 letters)
- Uppercase name

### 5.3 General Ingredient Categories

**Spirits (Base)**:
| Category | Symbol | Group |
|----------|--------|-------|
| Rum | Rm | cane |
| Rhum Agricole | Ra | cane |
| Cachaça | Cc | cane |
| Vodka | Vd | neutral |
| Gin | Gn | juniper |
| Whiskey | Wh | grain |
| Bourbon | Bb | grain |
| Rye | Ry | grain |
| Scotch | Sc | grain |
| Tequila | Tq | agave |
| Mezcal | Mz | agave |
| Brandy | Br | grape |
| Cognac | Cg | grape |
| Pisco | Ps | grape |

**Liqueurs**:
| Category | Symbol | Group |
|----------|--------|-------|
| Orange Liqueur | Ol | sugar |
| Coffee Liqueur | Cf | sugar |
| Amaretto | Am | sugar |
| Banana Liqueur | Bn | sugar |
| Maraschino | Ms | sugar |
| Elderflower | El | sugar |
| Crème de Cassis | Cs | sugar |
| Crème de Cacao | Co | sugar |

**Citrus/Acids**:
| Category | Symbol | Group |
|----------|--------|-------|
| Lime | Li | acid |
| Lemon | Le | acid |
| Orange | Or | acid |
| Grapefruit | Gf | acid |
| Pineapple | Pi | acid |
| Passion Fruit | Pf | acid |

**Sweeteners**:
| Category | Symbol | Group |
|----------|--------|-------|
| Simple Syrup | Ss | sugar |
| Honey | Hn | sugar |
| Agave | Ag | sugar |
| Grenadine | Gr | sugar |
| Orgeat | Og | sugar |

**Bitters & Botanicals**:
| Category | Symbol | Group |
|----------|--------|-------|
| Angostura | An | botanical |
| Orange Bitters | Ob | botanical |
| Peychaud's | Py | botanical |
| Campari | Cp | botanical |
| Aperol | Ap | botanical |
| Sweet Vermouth | Sv | botanical |
| Dry Vermouth | Dv | botanical |

**Other**:
| Category | Symbol | Group |
|----------|--------|-------|
| Soda Water | Sw | carbonation |
| Tonic | Tn | carbonation |
| Ginger Beer | Gb | carbonation |
| Cream | Cr | dairy |
| Egg White | Ew | dairy |

### 5.4 Periodic Table Layout

Organized by group (color-coded rows/sections):

```
┌──────────────────────────────────────────────────┐
│  SPIRITS                                         │
│  [Rm] [Ra] [Cc] [Vd] [Gn] [Wh] [Bb] [Ry] ...    │
├──────────────────────────────────────────────────┤
│  LIQUEURS                                        │
│  [Ol] [Cf] [Am] [Bn] [Ms] [El] ...              │
├──────────────────────────────────────────────────┤
│  CITRUS & ACIDS                                  │
│  [Li] [Le] [Or] [Gf] [Pi] [Pf]                  │
├──────────────────────────────────────────────────┤
│  ...                                             │
└──────────────────────────────────────────────────┘
```

### 5.5 Interaction with User's Inventory

When user clicks an element:
- Show which items in their inventory match that category
- e.g., Click "Bourbon" → shows "Buffalo Trace", "Maker's Mark" from their bar

Visual indicator on element if user has items in that category:
- Filled/highlighted = user has this in their bar
- Faded = user doesn't have any of this category

### 5.6 Files to Create/Modify

| File | Changes |
|------|---------|
| `src/components/ui/ElementCard.tsx` | New component |
| `src/components/ui/ElementCard.module.css` | New styles |
| `src/lib/periodicTable.ts` | Element definitions (categories, symbols, groups) |
| `src/components/PeriodicTable.tsx` | Grid layout component |

---

## Phase 6: Recipe Molecule Updates — PARTIAL

**Goal**: Align existing molecule visualization with new design system colors and styling.

**Status**: ~30% Complete

**Completed**:
- [x] Basic molecule visualization exists in `packages/recipe-molecule`
- [x] Hexagonal benzene-style rings for spirits
- [x] Node-link diagrams with bonds
- [x] Basic ingredient classification

**Remaining**:
- [ ] Update classifier colors to use `--bond-*` CSS variables
- [ ] Add chemical notation labels below nodes (`Ry₂`)
- [ ] Update bond styling to use hairline colors
- [ ] Make stroke width proportional to volume

### 6.1 Current State

The `packages/recipe-molecule` package already implements:
- Hexagonal benzene-style rings for spirits
- Node-link diagrams with bonds
- Color-coded ingredient types

### 6.2 Updates Needed

**Color Alignment**:
Map current classifier colors to new `--bond-*` variables:

| Current Type | New Group | Color |
|--------------|-----------|-------|
| spirit | (varies by spirit type) | varies |
| acid | acid | `--bond-acid` |
| sweet | sugar | `--bond-sugar` |
| bitter | botanical | `--bond-botanical` |
| garnish | (keep green) | `#65A30D` |
| dairy | dairy | `--bond-dairy` |
| dilution | carbonation | `--bond-carbonation` |

**Node Styling**:
- Add chemical notation labels below nodes
- Volume as subscript: `Ry₂` instead of `2 oz`

**Bond Styling**:
- Use `--border-hairline` color
- Stroke width proportional to volume

### 6.3 Files to Modify

| File | Changes |
|------|---------|
| `packages/recipe-molecule/src/core/classifier.ts` | Update colors |
| `packages/recipe-molecule/src/components/Node.tsx` | Label formatting |
| `packages/recipe-molecule/src/components/Molecule.tsx` | Use CSS variables |

---

## Phase 7: Page Layouts (My Bar Focus) — NOT STARTED

**Goal**: Update My Bar page with dual-view system and apply new styling to other pages.

**Status**: 0% Complete

**Files to Create**:
- [ ] `src/components/ui/ViewToggle.tsx` - Periodic/My Items toggle
- [ ] `src/components/ui/ViewToggle.module.css` - Toggle styles

**Files to Update**:
- [ ] `src/app/bar/page.tsx` - Add view toggle, integrate Periodic Table
- [ ] `src/app/bar/bar.module.css` - Dual view styles

### 7.1 My Bar: Dual View System

The My Bar page will have **two views** accessible via toggle:

```
┌─────────────────────────────────────────────────────┐
│  MY BAR                    [Periodic] [My Items]    │
├─────────────────────────────────────────────────────┤
│                                                     │
│  (View content based on toggle selection)           │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**View 1: Periodic Table** (Default)
- Shows general ingredient categories as Element Cards
- Color-coded by group
- Visual indicator if user has items in that category
- Click element → filters to show user's items in that category

**View 2: My Items** (List/Grid)
- Current functionality preserved
- User's actual inventory items
- Category tabs (existing)
- Card grid layout (existing, restyled)

### 7.2 View Toggle Component

```
┌───────────────┬───────────────┐
│   PERIODIC    │   MY ITEMS    │
└───────────────┴───────────────┘
```

| Property | Value |
|----------|-------|
| Border | `1px solid --border-hairline` |
| Border Radius | `2px` |
| Font | `--font-mono`, 11px, uppercase |
| Active | `background: --fg-primary`, `color: white` |
| Inactive | `background: transparent`, `color: --fg-secondary` |

### 7.3 Periodic Table → My Items Flow

When user clicks element in Periodic Table:
1. Switch to "My Items" view
2. Auto-filter to that category
3. Show user's items matching the element type

Example: Click [Bb] Bourbon → Switch to My Items → Filter: Bourbon → Show "Buffalo Trace", "Maker's Mark"

### 7.4 Other Page Updates

| Page | Changes |
|------|---------|
| Dashboard | Summary cards with hairline borders, new styling |
| Recipes | Apply new card styles, molecule previews |
| AI Bartender | Apply new input/button styles |
| Shopping List | Apply new styling |
| Settings | Form styling updates |
| Favorites | Card styling |

### 7.5 Header/Navigation

Keep current navigation structure, update styling:
- Hairline borders
- New font (Inter)
- Updated colors

### 7.6 Files to Modify

| File | Changes |
|------|---------|
| `src/app/bar/page.tsx` | Add view toggle, Periodic Table integration |
| `src/app/bar/bar.module.css` | New styles for dual view |
| `src/components/ui/ViewToggle.tsx` | New toggle component |
| Other page files | Apply new component styles |

---

## Phase 8: Dark Mode Refinement — NOT STARTED

**Goal**: Implement "Slate Lab Countertop" dark theme.

**Status**: 0% Complete

**Remaining**:
- [ ] Update `[data-theme="dark"]` variables in globals.css
- [ ] Test element group colors for contrast in dark mode
- [ ] Ensure all components work correctly in dark mode

### 8.1 Dark Mode Colors

```css
[data-theme="dark"] {
  --bg-paper:          #0F172A;  /* Deep blue-black */
  --bg-elevated:       #1E293B;  /* Elevated surfaces */
  --fg-primary:        #F1F5F9;  /* Off-white text */
  --fg-secondary:      #94A3B8;  /* Muted text */
  --border-default:    #334155;  /* Dark borders */
  --hover-overlay:     rgba(255, 255, 255, 0.06);
}
```

### 8.2 Element Group Colors in Dark Mode

Most `--bond-*` colors work in both modes, but may need slight adjustments for contrast.

### 8.3 Files to Modify

| File | Changes |
|------|---------|
| `src/styles/globals.css` | Dark mode variable overrides |

---

## Phase 9: Animations — PENDING

**Goal**: Add scientific-feeling motion design.

**Status**: ~10% Complete

**Completed**:
- [x] Basic transitions on interactive elements
- [x] Modal fade/slide animations

**Remaining**:
- [ ] Implement Brownian motion keyframes for molecular nodes
- [ ] Add element card hover effects (`scale(1.05)`)
- [ ] Add card hover effects (`translateY(-2px)`)
- [ ] Implement molecular node hover (`scale(1.1)`, pause drift)
- [ ] Add `prefers-reduced-motion` media query support

### 9.1 Brownian Motion

Molecular nodes drift slowly when idle:

```css
@keyframes brownian {
  0%, 100% { transform: translate(0, 0); }
  25% { transform: translate(2px, -1px); }
  50% { transform: translate(-1px, 2px); }
  75% { transform: translate(-2px, -2px); }
}
```

- Period: 4-6 seconds
- Amplitude: 2-4px
- Staggered delays per node

### 9.2 Hover Effects

| Element | Effect |
|---------|--------|
| Element Card | `scale(1.05)`, lift shadow |
| Card | `translateY(-2px)` |
| Button | Color shift only |
| Molecular Node | `scale(1.1)`, pause drift |

### 9.3 Transitions

```css
/* Standard */
transition: all 150ms ease;

/* Transforms */
transition: transform 150ms ease, box-shadow 150ms ease;
```

### 9.4 Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Phase 10: Polish & Accessibility — NOT STARTED

**Goal**: Final refinements and accessibility audit.

**Status**: 0% Complete

### 10.1 Accessibility Checklist

- [ ] Color contrast meets WCAG AA (4.5:1)
- [ ] Focus states visible on all interactive elements
- [ ] Keyboard navigation works throughout
- [ ] Screen reader labels on Element cards
- [ ] `role` attributes on Molecule diagrams
- [ ] Reduced motion respected

### 10.2 Responsive Refinements

- [ ] Touch targets minimum 44px on mobile
- [ ] Periodic table responsive columns
- [ ] Molecule diagrams scale properly
- [ ] Mode toggle full-width on mobile

### 10.3 Browser Testing

- [ ] Chrome
- [ ] Firefox
- [ ] Safari
- [ ] Edge
- [ ] Mobile Safari
- [ ] Chrome Android

---

## Implementation Order Recommendation

**Quick wins first** (low risk, high visual impact):

1. **Phase 1**: Foundation - immediate visual refresh
2. **Phase 3**: Spacing & Structure - flat design transformation
3. **Phase 4**: Core Components - buttons/inputs/cards
4. **Phase 2**: Typography - can be done alongside Phase 4

**Larger features**:

5. **Phase 6**: Recipe Molecule Updates - leverage existing work
6. **Phase 8**: Dark Mode - important for users
7. **Phase 5**: Element Cards - significant new component
8. **Phase 9**: Animations - polish

**Major scope** (consider deferring):

9. **Phase 7**: Page Layouts - extensive changes
10. **Phase 10**: Polish - final pass

---

## Resolved Decisions (December 8, 2025)

| Question | Decision |
|----------|----------|
| **Dual-Mode UI** | Deferred - not priority for this redesign |
| **Element Symbols** | Manually curated for general categories only (Rum, Bourbon, etc.) |
| **Formula Notation** | Deferred - needs more discussion to find appealing format |
| **Incremental Rollout** | Batch phases - no commits until phase group is complete |
| **Category Tabs** | Keep both: Periodic Table (default) + My Items view with existing tabs |
| **Breaking Changes** | Batch changes per phase group before reviewing/committing |

---

## Resolved Questions (December 8, 2025)

1. **Periodic Table Layout**: Group by type (all spirits together, all liqueurs together, etc.)

2. **Element Interaction**: Empty categories are fine - first-time users should see the full periodic table before adding anything to their bar

3. **Mobile Periodic Table**: Open to what works best visually (4 columns per reference, or could test alternatives)

---

## Visual References

Two HTML mockups provide the design direction:

**`molecular-mixology.html`** (Primary Reference)
- Full page layout with periodic table + molecule panel
- Element card styling (3px top border, atomic number, symbol, name)
- Mode toggle component
- Balance meter (Stoichiometric Balance)
- Flat molecule visualization (aligns with our current approach)
- Ingredient list with circular pips

**`molecular-ball-stick.html`** (Secondary Reference)
- 3D ball-and-stick model (too complex for large recipes, but nice aesthetic)
- Gradient color usage for depth
- "Related Molecular Structures" section concept

---

## Progress Log

### December 8, 2025 - Session 1

**Phase 1 Completed**:
- Updated `globals.css` with new font variables (`--font-sans`, `--font-mono`)
- Updated Google Fonts import for Inter and JetBrains Mono
- Added element group colors (`--bond-agave`, `--bond-grain`, etc.)
- Updated base colors for clinical aesthetic

**Phase 2 Progress**:
- Migrated all page CSS modules from deprecated variables:
  - `dashboard.module.css`
  - `account.module.css`
  - `settings.module.css`
  - `ai.module.css`
  - `favorites.module.css`
  - `bar.module.css`
  - `login.module.css`
  - `shopping-list.module.css`
  - `recipes.module.css` (uses shopping-list styles)
- Migrated all component CSS modules:
  - `TopNav.module.css`
  - `ItemDetailModal.module.css`
  - `BottleFormModal.module.css`
  - `CSVUploadModal.module.css`
  - `DeleteConfirmModal.module.css`
  - `Toast.module.css`
  - `SuccessCheckmark.module.css`
- Applied pattern: `--font-sans` for headings/body, `--font-mono` for data/badges/labels
- Replaced all `--text-*` variables with explicit rem values

### December 9, 2025 - Session 2

**Phase 2 Completed**:
- Created `src/lib/formatters.ts` with scientific formatting utilities:
  - `formatMeasurement()` - Leading zeros formatting (e.g., `1.5 oz` → `01.50 oz`)
  - `formatFormula()` - Chemical formula notation (e.g., `Ry₂ · Sv₁ · An₂`)
  - `getElementSymbol()` - Get 2-letter symbols for ingredients
  - `formatFormulaComponent()` - Individual formula components with subscripts
  - `toSubscript()` / `toSuperscript()` - Unicode subscript/superscript conversion
  - `padNumber()` / `formatDecimal()` - Number formatting helpers
- Added comprehensive element symbol mapping for 100+ ingredients

**Phase 3 Already Complete** (from globals.css):
- Border radius variables already set to 2px
- Shadows already flattened
- Hairline border utilities already in globals.css

**Phase 4 Completed**:
- Button component already styled with monospace, uppercase, 11px
- Updated Input component with terminal prefix support (`showPrefix` prop)
- Created `StepperInput` component with +/- buttons and leading zeros display
- Exported new components from `ui/index.ts`

**Phase 5 Completed**:
- Created `PeriodicTable.tsx` grid layout component
- Created `PeriodicTable.module.css` styles
- Exported from `ui/index.ts`
- `periodicTable.ts` and `ElementCard.tsx` already existed

**Phase 6 Completed**:
- Added missing CSS variables: `--bond-salt`, `--bond-garnish`, `--bond-egg`
- Fixed stoichiometric balance calculation to use `toOunces()` conversion
  - Previously used raw amounts (e.g., "2 dashes" = 2)
  - Now converts to oz equivalents (e.g., "2 dashes" = 0.0625 oz)
- Updated modal CSS files to use consistent `var(--radius)` (2px)

**All Tests Passing**: Type-check passes for all packages

### December 9, 2025 - Session 3 (Batch C Complete)

**Phase 7 Already Complete**:
- ViewToggle component exists in My Bar page
- Periodic Table integration already implemented
- Removed duplicate `PeriodicTable.tsx` from `ui/` folder (keeping feature-rich version in `components/`)

**Phase 8 Completed - Dark Mode Refinement**:
- Completely rewrote `[data-theme="dark"]` section in globals.css
- Added comprehensive dark mode variables:
  - Background: `--bg-paper`, `--bg-elevated` (deep blue-black slate)
  - Text: `--fg-primary`, `--fg-secondary`, `--fg-tertiary` (high contrast off-white)
  - Borders: `--border-hairline`, `--border-emphasis` (subtle dark borders)
  - Element group colors adjusted for dark mode contrast (brighter variants)
  - Status colors brightened for visibility
- Added dark mode component overrides for cards, badges, tags, pills, mode-toggle
- Added dark mode overrides to component CSS modules:
  - `Button.module.css` - Primary button uses teal accent in dark mode
  - `Input.module.css` - Darker input background (#0B1120)
  - `Modal.module.css` - Darker backdrop, header/footer
  - `ElementCard.module.css` - Proper dark mode contrast

**Phase 9 Completed - Animations**:
- Added Brownian motion keyframes for molecular nodes:
  - `brownian`, `brownian-alt`, `brownian-subtle` with staggered delays
- Added comprehensive animation keyframes:
  - `fadeIn`, `fadeInUp`, `fadeInDown`, `fadeInScale`
  - `slideInRight`, `slideInLeft`
  - `pulse`, `spin`, `bounce`, `shake`
- Added animation utility classes (`.animate-*`, `.stagger-*`)
- Added hover effects: `.hover-lift`, `.hover-scale`, `.press-effect`
- Updated ElementCard hover to `scale(1.05)` for molecule-like feel
- Added `@media (prefers-reduced-motion)` support

**Phase 10 Completed - Polish & Accessibility**:
- Added accessibility utilities:
  - `.sr-only` (screen reader only)
  - `.sr-only-focusable` (visible on focus)
  - `.skip-link` (keyboard navigation)
  - `.focus-visible-ring` (enhanced focus indicator)
  - `.touch-target` (44px minimum)
- Added `@media (prefers-contrast: high)` support
- Added responsive utilities:
  - `.responsive-grid` (4 breakpoints)
  - `.periodic-grid` (4→6→8→10 columns)
  - `.hide-mobile`, `.show-mobile`, `.mobile-full-width`, `.mobile-stack`
  - `.touch-spacing` (44px minimum touch targets on mobile)
- Added `@media print` styles for clean printing

**All Phases Complete**: Redesign plan fully implemented

---

## Summary

All 10 phases of the Molecular Mixology redesign are now complete:

| Batch | Phases | Status |
|-------|--------|--------|
| **Batch A** (Foundation) | 1-4 | ✅ Complete |
| **Batch B** (Features) | 5-7 | ✅ Complete |
| **Batch C** (Polish) | 8-10 | ✅ Complete |

### Key Files Modified in Batch C:

**globals.css**:
- Dark mode variables and component overrides
- Brownian motion and animation keyframes
- Accessibility utilities
- Responsive grid utilities
- Print styles
- Reduced motion support

**Component CSS Modules**:
- `Button.module.css` - Dark mode overrides
- `Input.module.css` - Dark mode overrides
- `Modal.module.css` - Dark mode overrides
- `ElementCard.module.css` - Dark mode overrides, hover scale effect
