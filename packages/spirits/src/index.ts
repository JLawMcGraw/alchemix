/**
 * @alchemix/spirits — the single source of truth for spirit-family identity.
 *
 * "Which base-spirit family does this variant belong to?" was previously answered by
 * six independent keyword lists across the frontend and backend that had silently
 * drifted (cachaça, ron, genever, calvados, grappa each present in some and missing
 * from others). This module owns the vocabulary AND the matching algorithm so every
 * consumer agrees on what "the same spirit family" means.
 *
 * Matching is word-boundary based everywhere (not substring): "gin" must not match
 * "ginger" and "ron" must not match "citron".
 */

export type SpiritFamily = 'rum' | 'whiskey' | 'gin' | 'vodka' | 'tequila' | 'brandy';

/** Canonical families, in display/precedence order. */
export const SPIRIT_FAMILIES: SpiritFamily[] = [
  'whiskey',
  'rum',
  'gin',
  'vodka',
  'tequila',
  'brandy',
];

export const SPIRIT_FAMILY_LABELS: Record<SpiritFamily, string> = {
  whiskey: 'Whiskey',
  rum: 'Rum',
  gin: 'Gin',
  vodka: 'Vodka',
  tequila: 'Tequila',
  brandy: 'Brandy',
};

/**
 * The authority: canonical family → variant keywords (merged superset of every list
 * that previously encoded this knowledge). Extend this map, never a local copy.
 */
export const SPIRIT_FAMILY_KEYWORDS: Record<SpiritFamily, string[]> = {
  whiskey: ['whiskey', 'whisky', 'bourbon', 'rye', 'scotch', 'irish whiskey', 'japanese whisky'],
  rum: ['rum', 'rhum', 'ron', 'cachaça', 'cachaca', 'agricole', 'white rum', 'dark rum', 'spiced rum'],
  gin: ['gin', 'genever', 'london dry', 'plymouth', 'navy strength', 'sloe gin', 'old tom'],
  vodka: ['vodka'],
  tequila: ['tequila', 'mezcal', 'blanco', 'reposado', 'anejo', 'añejo'],
  brandy: ['brandy', 'cognac', 'armagnac', 'pisco', 'calvados', 'grappa'],
};

/** Flat, de-duplicated variant list (e.g. for scanning a free-text query). */
export const SPIRIT_VARIANTS: string[] = Array.from(
  new Set(SPIRIT_FAMILIES.flatMap((family) => SPIRIT_FAMILY_KEYWORDS[family]))
);

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Word-boundary keyword match (prevents "gin" matching "ginger").
 * Case-insensitive; accepts multi-word keywords like "london dry".
 */
export function matchesSpiritFamily(text: string, family: SpiritFamily): boolean {
  if (!text) return false;
  return SPIRIT_FAMILY_KEYWORDS[family].some((keyword) =>
    new RegExp(`\\b${escapeRegex(keyword)}\\b`, 'i').test(text)
  );
}

/** Normalize a spirit-type string to its canonical family, or null if unrecognized. */
export function normalizeSpiritType(input: string | null | undefined): SpiritFamily | null {
  if (!input) return null;
  const text = input.trim();
  if (!text) return null;
  for (const family of SPIRIT_FAMILIES) {
    if (matchesSpiritFamily(text, family)) return family;
  }
  return null;
}

/** The variant keywords for a family (its "synonyms"). */
export function getSpiritSynonyms(family: SpiritFamily): string[] {
  return SPIRIT_FAMILY_KEYWORDS[family];
}

/**
 * Does a recipe's ingredient text satisfy a required base-spirit family?
 *
 * Returns true when: there is no constraint; the required family is present; or no
 * identifiable base spirit is present at all. Returns false only when a *different*
 * base spirit is present (a genuine conflict).
 */
export function recipeMatchesSpiritConstraint(
  ingredientsText: string,
  required: SpiritFamily | null
): boolean {
  if (!required) return true;
  if (matchesSpiritFamily(ingredientsText, required)) return true;

  for (const family of SPIRIT_FAMILIES) {
    if (family === required) continue;
    if (matchesSpiritFamily(ingredientsText, family)) return false; // different base spirit
  }
  return true; // no clear base spirit — allow it
}
