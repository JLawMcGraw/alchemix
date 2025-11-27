# CSV Import Auto-Categorization Fix

## Problem
When importing a CSV of bar stock (45 items), all items were being categorized as "other" instead of being properly tagged as spirits, liqueurs, mixers, syrups, garnishes, wine, or beer.

## Root Cause
The CSV import was looking for an explicit `category` column in the CSV. If the column didn't exist, it defaulted everything to `'other'`.

```typescript
// Old code (line 899)
category: safeString(findField(record, ['category', 'Category', 'CATEGORY'])) || 'other',
```

## Solution
Created an intelligent auto-categorization system that analyzes the `Liquor Type` and `Detailed Spirit Classification` fields to automatically assign the correct category.

### Implementation

**1. Added `autoCategorize()` Function** (inventory.ts:865-964)

This function checks keywords in the type and classification fields to determine the category:

| Category | Keywords |
|----------|----------|
| **spirit** | whiskey, bourbon, rye, scotch, rum, vodka, gin, tequila, mezcal, brandy, cognac, etc. |
| **liqueur** | liqueur, amaro, triple sec, cointreau, chambord, chartreuse, campari, aperol, etc. |
| **wine** | wine, vermouth, sherry, port, madeira, champagne, prosecco |
| **beer** | beer, ale, lager, stout, ipa |
| **syrup** | syrup, grenadine, orgeat, falernum, honey, agave |
| **mixer** | juice, tonic, soda, cola, ginger beer, bitters, angostura, cream |
| **garnish** | garnish, cherry, olive, salt, sugar, mint, herb |
| **other** | Default if no keywords match |

**2. Updated `validateBottleData()` Function** (inventory.ts:1001-1007)

Now extracts type/classification first, then:
1. Checks for explicit `category` column in CSV
2. If not found, calls `autoCategorize(type, classification)`
3. Falls back to 'other' only if both are null

```typescript
// New code
const type = safeString(findField(record, ['type', 'Type', 'Liquor Type', 'liquor type']));
const classification = safeString(findField(record, ['Detailed Spirit Classification', ...]));

const explicitCategory = safeString(findField(record, ['category', 'Category', 'CATEGORY']));
const category = explicitCategory || autoCategorize(type, classification);
```

**3. Benefits All Endpoints**

Since `validateBottleData()` is shared, auto-categorization now works for:
- ✅ CSV import (`POST /api/inventory/import`)
- ✅ Manual add bottle (`POST /api/inventory`)
- ✅ Update bottle (`PUT /api/inventory/:id`)

## Testing

**1. Restart Backend Server:**
```bash
# Stop current server (Ctrl+C)
npm run dev:all
```

**2. Re-import Your CSV:**
- Navigate to My Bar page
- Click "Import CSV"
- Upload your 45-item bar stock CSV
- Items should now be properly categorized!

**3. Verify Categories:**
- Check the category tabs on My Bar page
- Each tab should show accurate counts:
  - Spirits: Bourbon, Rum, Vodka, Gin, etc.
  - Liqueurs: Cointreau, Chambord, Campari, etc.
  - Mixers: Juices, Bitters, Tonic Water, etc.
  - Syrups: Simple Syrup, Grenadine, etc.
  - Wine: Vermouth, Sherry, etc.
  - Beer: Any beer items
  - Other: Items that don't match any keywords

## Example Categorizations

**Spirits:**
- "Maker's Mark" (Liquor Type: "Bourbon") → `spirit`
- "Mount Gay Eclipse" (Type: "Rum") → `spirit`
- "Hendrick's Gin" (Classification: "Gin") → `spirit`

**Liqueurs:**
- "Cointreau" (Type: "Triple Sec") → `liqueur`
- "Campari" (Type: "Bitter Liqueur") → `liqueur`
- "St-Germain" (Type: "Elderflower Liqueur") → `liqueur`

**Mixers:**
- "Angostura Bitters" (Type: "Bitters") → `mixer`
- "Lime Juice" (Type: "Juice") → `mixer`
- "Fever-Tree Tonic" (Type: "Tonic Water") → `mixer`

**Syrups:**
- "Simple Syrup" → `syrup`
- "Grenadine" → `syrup`
- "Orgeat" → `syrup`

**Wine:**
- "Dolin Dry Vermouth" (Type: "Vermouth") → `wine`
- "Tio Pepe Sherry" (Type: "Sherry") → `wine`

## Edge Cases Handled

1. **Missing Type/Classification:** Falls back to 'other'
2. **Empty Strings:** Treated as null, falls back to 'other'
3. **Case Insensitive:** "BOURBON" = "bourbon" = "Bourbon"
4. **Combined Fields:** Checks both type AND classification (e.g., Type: "Liquor", Classification: "Bourbon")
5. **Priority Order:** Spirits checked first (most common), then liqueurs, wine, beer, syrups, mixers, garnishes

## Future Improvements

If you find items being miscategorized, you can:

1. **Add Keywords:** Edit `autoCategorize()` to add more keywords for each category
2. **Manual Override:** Include a `category` column in your CSV for specific items
3. **Hybrid Approach:** CSV category takes precedence, auto-categorization fills gaps

## Files Changed

- `api/src/routes/inventory.ts`:
  - Added `autoCategorize()` function (lines 865-964)
  - Updated `validateBottleData()` to use auto-categorization (lines 1001-1007)
