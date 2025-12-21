/**
 * Shared utility functions
 */

/**
 * Parse ingredients from recipe - handles various formats
 * @param ingredients - Can be string, string[], or undefined
 * @returns Array of ingredient strings
 */
export function parseIngredients(ingredients: string | string[] | undefined): string[] {
  if (!ingredients) return [];
  if (Array.isArray(ingredients)) return ingredients;
  try {
    const parsed = JSON.parse(ingredients);
    return Array.isArray(parsed) ? parsed : [ingredients];
  } catch {
    return ingredients.split(',').map(i => i.trim());
  }
}
