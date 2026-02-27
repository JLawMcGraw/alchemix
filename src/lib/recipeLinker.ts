/**
 * Recipe Linking Logic
 *
 * Pure functions for finding, matching, and marking recipe names in AI response text.
 * Extracted from ai/page.tsx to separate logic from rendering.
 */

/** Normalize all apostrophe variants to straight ' (U+0027) */
export function normalizeApostrophes(text: string): string {
  return text.replace(/[\u0027\u2018\u2019\u0060\u00B4\u02BC\u02BB\u055A\u05F3\uA78C\uFF07]/g, "'");
}

/** Escape a string for use in a regex, with apostrophe-flexible matching */
export function escapeForRegex(name: string): string {
  return name
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(
      /[\u0027\u2018\u2019\u0060\u00B4\u02BC\u02BB\u055A\u05F3\uA78C\uFF07]/g,
      '[\u0027\u2018\u2019\u0060\u00B4\u02BC\u02BB\u055A\u05F3\uA78C\uFF07]',
    );
}

/** Match recipe names with flexible fuzzy logic (prefix stripping, parenthetical variations) */
export function fuzzyRecipeMatch(aiName: string, dbName: string): boolean {
  const cleanAI = normalizeApostrophes(aiName).replace(/\s*#\d+\s*$/i, '').trim().toLowerCase();
  const cleanDB = normalizeApostrophes(dbName).replace(/\s*#\d+\s*$/i, '').trim().toLowerCase();

  if (cleanDB === cleanAI) return true;

  // Strip common prefixes and check exact match
  const prefixes = /^(sc|classic|traditional|original|the|a)\s+/i;
  const strippedAI = cleanAI.replace(prefixes, '');
  const strippedDB = cleanDB.replace(prefixes, '');

  if (strippedDB === strippedAI) return true;

  // Handle parenthetical variations
  const baseNamePattern = /^([^(]+)/;
  const aiBaseMatch = cleanAI.match(baseNamePattern);
  const dbBaseMatch = cleanDB.match(baseNamePattern);

  if (aiBaseMatch && dbBaseMatch) {
    const aiBase = aiBaseMatch[1].trim();
    const dbBase = dbBaseMatch[1].trim();

    if (aiBase === dbBase && cleanAI.includes('(')) {
      const aiParenMatch = cleanAI.match(/\(([^)]+)\)/);
      const dbParenMatch = cleanDB.match(/\(([^)]+)\)/);

      if (aiParenMatch && dbParenMatch) {
        const aiParen = aiParenMatch[1].toLowerCase();
        const dbParen = dbParenMatch[1].toLowerCase();
        if (dbParen.includes(aiParen) || aiParen.includes(dbParen)) {
          return true;
        }
      }
    }
  }

  // Only allow DB to contain AI name (AI might use shorter form)
  if (cleanDB.includes(cleanAI) && cleanAI.length > 3) return true;
  if (strippedDB.includes(strippedAI) && strippedAI.length > 3) return true;

  return false;
}

interface RecipeRef {
  name: string;
}

/**
 * Find all recipe names that appear in the given text.
 * Checks recommendations first, then scans for any recipe name from the database.
 */
export function findLinkableRecipes(
  text: string,
  recommendations: string[],
  recipesArray: RecipeRef[],
): Set<string> {
  const linkableRecipes = new Set<string>();
  const normalizedText = normalizeApostrophes(text).toLowerCase();

  // Add recipes from RECOMMENDATIONS line
  recommendations.forEach((name) => {
    const normalizedRec = normalizeApostrophes(name).toLowerCase();
    let recipe = recipesArray.find(
      (r) => normalizeApostrophes(r.name).toLowerCase() === normalizedRec,
    );
    if (!recipe) {
      recipe = recipesArray.find((r) => fuzzyRecipeMatch(name, r.name));
    }
    if (recipe) {
      linkableRecipes.add(recipe.name);
    }
  });

  // Scan text for recipe names from database
  recipesArray.forEach((recipe) => {
    const normalizedName = normalizeApostrophes(recipe.name).toLowerCase();

    // Simple substring check (most reliable)
    if (normalizedText.includes(normalizedName)) {
      linkableRecipes.add(recipe.name);
      return;
    }

    // Check with trailing suffixes stripped
    const baseName = normalizedName
      .replace(/\s+(new|old|original|modern|classic|revised|updated)$/i, '')
      .replace(/\s+#\d+$/i, '')
      .trim();

    if (baseName !== normalizedName && normalizedText.includes(baseName)) {
      linkableRecipes.add(recipe.name);
      return;
    }

    // Fallback: regex word boundary matching
    const escapedName = normalizedName
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/'/g, "[\\u0027\\u2018\\u2019\\u0060\\u00B4\\u02BC\\u02BB]?");
    const nameRegex = new RegExp(`(?:^|[^\\w])${escapedName}(?:[^\\w]|$)`, 'i');

    if (nameRegex.test(normalizedText)) {
      linkableRecipes.add(recipe.name);
      return;
    }

    // Fuzzy matching for parenthetical variations
    const baseNameMatch = normalizedName.match(/^([^(]+)\s*\(/);
    if (baseNameMatch) {
      const base = baseNameMatch[1].trim();
      const escapedBase = base
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/'/g, "[\\u0027\\u2018\\u2019\\u0060\\u00B4\\u02BC\\u02BB]?");

      const baseWithParenRegex = new RegExp(
        `(?:^|[^\\w])${escapedBase}\\s*\\(([^)]+)\\)`,
        'gi',
      );
      const matches = normalizedText.matchAll(baseWithParenRegex);

      for (const match of matches) {
        const aiParen = match[1].toLowerCase();
        const dbParenMatch = normalizedName.match(/\(([^)]+)\)/);
        if (dbParenMatch) {
          const dbParen = dbParenMatch[1].toLowerCase();
          if (dbParen.includes(aiParen) || aiParen.includes(dbParen)) {
            linkableRecipes.add(recipe.name);
            return;
          }
        }
      }
    }
  });

  return linkableRecipes;
}

/**
 * Filter out shorter recipe names when a longer name containing them
 * actually appears in the text (e.g., remove "Grog" if "Navy Grog" is present).
 */
export function filterSubstringCollisions(
  recipes: string[],
  text: string,
): string[] {
  const normalizedText = normalizeApostrophes(text).toLowerCase();

  return recipes.filter((name) => {
    const lowerName = normalizeApostrophes(name).toLowerCase();
    const longerRecipes = recipes.filter((other) => {
      if (other === name) return false;
      const lowerOther = normalizeApostrophes(other).toLowerCase();
      return lowerOther.length > lowerName.length && lowerOther.includes(lowerName);
    });

    const shouldFilter = longerRecipes.some((longer) => {
      const lowerLonger = normalizeApostrophes(longer).toLowerCase();
      const escapedLonger = lowerLonger.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const longerRegex = new RegExp(`(?:^|[^\\w])${escapedLonger}(?:[^\\w]|$)`, 'i');
      return longerRegex.test(normalizedText);
    });

    return !shouldFilter;
  });
}

/**
 * Insert __RECIPE__name__RECIPE__ markers around recipe names in text.
 * Returns the marked text and the sorted recipe list used for marking.
 */
export function markRecipeNames(
  text: string,
  recipes: string[],
): { markedText: string; sortedRecipes: string[] } {
  let displayText = text;

  // Sort by length (longest first) to prevent partial matches
  const sortedRecipes = [...recipes].sort((a, b) => b.length - a.length);

  sortedRecipes.forEach((recipeName) => {
    const escapedFullName = escapeForRegex(recipeName);
    const fullNameRegex = new RegExp(
      `(^|[^\\w])(${escapedFullName})([^\\w]|$)`,
      'gi',
    );

    let didMatch = false;

    displayText = displayText.replace(
      fullNameRegex,
      (match, before, name, after, offset) => {
        const beforeMatch = displayText.substring(0, offset);
        const markerCount = (beforeMatch.match(/__RECIPE__/g) || []).length;
        if (markerCount % 2 === 1) {
          return match;
        }
        didMatch = true;
        return `${before}__RECIPE__${recipeName}__RECIPE__${after}`;
      },
    );

    // Flexible matching for parenthetical variations
    if (!didMatch && recipeName.includes('(')) {
      const baseMatch = normalizeApostrophes(recipeName).match(/^([^(]+)\s*\(/);
      const dbParenMatch = normalizeApostrophes(recipeName).match(/\(([^)]+)\)/);

      if (baseMatch && dbParenMatch) {
        const dbParen = dbParenMatch[1].toLowerCase();
        const escapedBase = escapeForRegex(baseMatch[1].trim());
        const flexibleRegex = new RegExp(
          `(^|[^\\w])(${escapedBase}\\s*\\([^)]+\\))([^\\w]|$)`,
          'gi',
        );

        displayText = displayText.replace(
          flexibleRegex,
          (match, before, name, after, offset) => {
            const beforeMatch = displayText.substring(0, offset);
            const markerCount = (beforeMatch.match(/__RECIPE__/g) || []).length;
            if (markerCount % 2 === 1) {
              return match;
            }
            const aiParenMatch = normalizeApostrophes(name).match(/\(([^)]+)\)/);
            if (aiParenMatch) {
              const aiParen = aiParenMatch[1].toLowerCase();
              if (dbParen.includes(aiParen) || aiParen.includes(dbParen)) {
                return `${before}__RECIPE__${name}__RECIPE__${after}`;
              }
            }
            return match;
          },
        );
      }
    }
  });

  return { markedText: displayText, sortedRecipes };
}
