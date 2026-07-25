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
export declare const SPIRIT_FAMILIES: SpiritFamily[];
export declare const SPIRIT_FAMILY_LABELS: Record<SpiritFamily, string>;
/**
 * The authority: canonical family → variant keywords (merged superset of every list
 * that previously encoded this knowledge). Extend this map, never a local copy.
 */
export declare const SPIRIT_FAMILY_KEYWORDS: Record<SpiritFamily, string[]>;
/** Flat, de-duplicated variant list (e.g. for scanning a free-text query). */
export declare const SPIRIT_VARIANTS: string[];
/**
 * Word-boundary keyword match (prevents "gin" matching "ginger").
 * Case-insensitive; accepts multi-word keywords like "london dry".
 */
export declare function matchesSpiritFamily(text: string, family: SpiritFamily): boolean;
/** Normalize a spirit-type string to its canonical family, or null if unrecognized. */
export declare function normalizeSpiritType(input: string | null | undefined): SpiritFamily | null;
/** The variant keywords for a family (its "synonyms"). */
export declare function getSpiritSynonyms(family: SpiritFamily): string[];
/**
 * Does a recipe's ingredient text satisfy a required base-spirit family?
 *
 * Returns true when: there is no constraint; the required family is present; or no
 * identifiable base spirit is present at all. Returns false only when a *different*
 * base spirit is present (a genuine conflict).
 */
export declare function recipeMatchesSpiritConstraint(ingredientsText: string, required: SpiritFamily | null): boolean;
//# sourceMappingURL=index.d.ts.map