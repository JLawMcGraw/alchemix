# Shopping List Debug - Sidewinder's Fang

## Recipe Analysis

**Recipe:** Sidewinder's Fang
**Expected:** Should appear in "Near Misses" (missing only passionfruit syrup)

### Ingredient Parsing Trace

| Raw Ingredient | After Parsing | Should Match In Inventory |
|---------------|---------------|---------------------------|
| `1½ ounces fresh lime juice` | `lime juice` | ✅ Lime Juice |
| `1½ ounces fresh orange juice` | `orange juice` | ✅ Orange Juice |
| `1½ ounces SC Passion Fruit Syrup` | `passion fruit syrup` | ❌ **MISSING** |
| `3 ounces seltzer` | `seltzer` | ✅ Sparkling Water (via synonyms) |
| `1 ounce blended aged rum` | `rum` | ✅ Any Rum bottle |
| `1 ounce black blended rum` | `dark rum` | ✅ Dark Rum (via synonyms) |

### Expected Behavior

1. **Lime Juice** - Should match any bottle containing "lime juice"
2. **Orange Juice** - Should match any bottle containing "orange juice"
3. **Passion Fruit Syrup** - Should NOT match (this is the missing ingredient)
4. **Seltzer** - Should NOW match "sparkling water", "club soda", etc. (just added synonyms)
5. **Rum** - After stripping "blended aged" modifiers, matches any rum
6. **Dark Rum** - After synonym mapping "black blended rum" → "dark rum"

### Debugging Steps

1. ✅ **Added Synonym Mappings** - seltzer ↔ sparkling water ↔ club soda ↔ carbonated water ↔ soda water

2. **Verify Inventory Contents:**
   - Do you have "Sparkling Water" or similar in your inventory?
   - Do you have any rum bottles? (light, dark, or generic)
   - Do you have lime juice and orange juice?

3. **Test the Endpoint:**
   ```bash
   # After restarting the server, test the shopping list
   curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/api/shopping-list/smart
   ```

4. **Check Console Logs:**
   - Look for `[TRACE-v2]` logs showing how each ingredient is parsed
   - Look for `[MATCH-TRACE]` logs showing which bottles matched

### Potential Issues to Check

1. **Juice Names:** Do your inventory items say "Lime Juice" or "Lime" only?
   - Parser expects "lime juice" to match items containing "lime" + "juice"

2. **Rum Types:** Do you have rum bottles in inventory?
   - Parser strips "blended aged" → matches any "rum"
   - Parser maps "black blended rum" → "dark rum" via synonyms

3. **Passion Fruit Syrup:** This should correctly be identified as missing
   - Parser strips "SC" prefix → "passion fruit syrup"
   - Should NOT match generic "simple syrup" or other syrups

### Next Steps

1. Restart your backend server to load the new synonym mappings
2. Test the shopping list endpoint
3. Share the console output showing the TRACE logs
4. Verify the recipe appears in `nearMissRecipes` with `missingIngredient: "passion fruit syrup"`
