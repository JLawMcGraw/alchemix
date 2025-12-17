# Chemical Formula Notation System

**Version:** 2.0
**Last Updated:** December 17, 2025

---

## Overview

AlcheMix uses a chemistry-inspired notation system to represent cocktail recipes as compact formulas. The notation mirrors real chemical compound conventions while being adapted for mixology.

---

## Notation Structure

```
[coefficient]Symbol[subscript]
```

- **Coefficient** (leading number): Count of different ingredients of that type
- **Symbol**: 2-letter element symbol from the Periodic Table of Mixology
- **Subscript**: Combined ratio amount (whole numbers only)

### Examples

| Notation | Meaning |
|----------|---------|
| `Rm₄` | 1 rum, ratio of 4 |
| `3Rm₆` | 3 different rums, combined ratio of 6 |
| `Gn` | 1 gin, ratio of 1 (subscript omitted) |
| `2Ac₃` | 2 acids combined, ratio of 3 |

---

## Ratio Calculation

Formulas use **whole-number ratios** (no decimals), calculated as follows:

### Step 1: Convert to Common Unit

All volumes are converted to quarter-ounces (0.25 oz):
- 2 oz = 8 quarter-oz
- 1 oz = 4 quarter-oz
- 0.75 oz = 3 quarter-oz
- 0.5 oz = 2 quarter-oz

### Step 2: Find GCD and Simplify

Divide all values by their Greatest Common Divisor to get the smallest whole-number ratio.

**Example - Daiquiri:**
- 2 oz rum : 1 oz lime : 0.75 oz simple
- → 8 : 4 : 3 (quarter-oz)
- GCD = 1, so ratio stays 8 : 4 : 3
- → `Rm₈Li₄Ss₃`

### Step 3: Apply Ratio Cap

If any number exceeds the cap (default: 8), scale all values down proportionally and round to nearest whole numbers.

**Example - Complex Recipe:**
- Ratio 12 : 6 : 4 : 3
- Max is 12 > cap of 8
- Scale by 8/12 = 0.667
- → 8 : 4 : 3 : 2
- → `Rm₈Ac₄Sw₃Bt₂`

---

## Symbol Specificity Rules

### Single vs. Multiple Ingredients

When a recipe has **one ingredient** of a type, use the **specific symbol**:
- Single acid (lime only) → `Li`
- Single sweetener (honey only) → `Hn`

When a recipe has **multiple ingredients** of a type, use the **grouped symbol** with a coefficient:
- Lime + grapefruit → `2Ac`
- Simple syrup + honey → `2Sw`

### Grouped Symbols

| Group | Symbol | Combines |
|-------|--------|----------|
| Acids | `Ac` | Lime, lemon, grapefruit, orange, pineapple, passion fruit |
| Sweets | `Sw` | Simple syrup, honey, agave, demerara, maple, sugar |
| Bitters | `Bt` | Angostura, orange bitters, Peychaud's |
| Dairy | `Dy` | Cream, egg white, egg yolk, milk |
| Spirits | `Sp` | Used when 4+ different base spirits combined |

### Signature Ingredients

Certain ingredients are **always specific** and never grouped, as they define the cocktail's character:

- **Liqueurs:** Orgeat (Og), Chartreuse (Ch), Maraschino (Ms), Elderflower (El), Falernum (Fl)
- **Amari:** Campari (Cp), Aperol (Ap), Fernet (Fe)
- **Vermouths:** Sweet vermouth (Sv), Dry vermouth (Dv)
- **Specialty:** Absinthe (Ab), Grenadine (Gr)

---

## Formula Constraints

### Maximum 5 Elements

Formulas display a maximum of 5 elements to maintain readability.

### Priority Hierarchy

When more than 5 ingredients exist, include by priority:

1. **Spirits** - Base of the drink (always included)
2. **Signature** - Defining/unique flavors
3. **Acids** - Citrus and sours
4. **Sweets** - Syrups and liqueurs
5. **Bitters** - Trace amounts (lowest priority)

### Subscript Display

- Subscript shown when ratio > 1
- Subscript omitted when ratio = 1 (implied)
- Coefficient of 1 is always omitted

---

## Element Separator

Elements are separated by the **interpunct** (middle dot): ` · `

This matches chemical notation for associated compounds (like hydrates: CuSO₄·5H₂O).

---

## Complete Examples

### Simple Cocktails

| Cocktail | Ingredients | Formula |
|----------|-------------|---------|
| Daiquiri | 2oz rum, 1oz lime, 0.75oz simple | `Rm₈Li₄Ss₃` |
| Negroni | 1oz gin, 1oz Campari, 1oz sweet vermouth | `Gn·Cp·Sv` |
| Old Fashioned | 2oz bourbon, sugar, bitters | `Bb₂·Sw·Bt` |
| Gimlet | 2oz gin, 0.75oz lime, 0.75oz simple | `Gn₈Li₃Ss₃` |

### Cocktails with Multiple Ingredients of Same Type

| Cocktail | Ingredients | Formula |
|----------|-------------|---------|
| Zombie | 3 rums, lime, grapefruit, falernum, grenadine | `3Rm₆·Fl·Gr·2Ac₂` |
| Long Island | vodka, gin, rum, tequila, triple sec, lemon | `4Sp₄·Ol·Le` |
| Jungle Bird | rum, Campari, lime, pineapple, simple | `Rm₄·Cp₂·2Ac₃·Ss` |

### Cocktails with Signature Ingredients

| Cocktail | Ingredients | Formula |
|----------|-------------|---------|
| Mai Tai | 2oz rum, 0.5oz orgeat, 0.5oz curaçao, lime | `Rm₄·Og·Ol·Li₂` |
| Last Word | gin, chartreuse, maraschino, lime | `Gn·Ch·Ms·Li` |
| Sazerac | rye, absinthe, sugar, bitters | `Ry₂·Ab·Sw·Bt` |

---

## Implementation Notes

### Subscript Characters

```
₀ ₁ ₂ ₃ ₄ ₅ ₆ ₇ ₈ ₉
```

### Parser Requirements

The formula generator must:
1. Parse ingredient quantities and units
2. Convert to quarter-ounce base unit
3. Count ingredients per type
4. Determine symbol specificity (single vs. grouped)
5. Calculate whole-number ratios with GCD
6. Apply ratio cap
7. Sort by type hierarchy
8. Limit to 5 elements
9. Format with coefficients, symbols, and subscripts

### Edge Cases

- **No measurable amounts:** Use ratio of 1 (e.g., "dash of bitters" → `Bt`)
- **Trace ingredients:** Bitters, rinses, sprays are ratio 1 with no subscript
- **Unknown ingredients:** Omit from formula rather than use generic symbol
- **Equal parts:** All subscripts will be 1 (omitted), e.g., `Gn·Cp·Sv`
