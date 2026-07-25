"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SPIRIT_VARIANTS = exports.SPIRIT_FAMILY_KEYWORDS = exports.SPIRIT_FAMILY_LABELS = exports.SPIRIT_FAMILIES = void 0;
exports.matchesSpiritFamily = matchesSpiritFamily;
exports.normalizeSpiritType = normalizeSpiritType;
exports.getSpiritSynonyms = getSpiritSynonyms;
exports.recipeMatchesSpiritConstraint = recipeMatchesSpiritConstraint;
/** Canonical families, in display/precedence order. */
exports.SPIRIT_FAMILIES = [
    'whiskey',
    'rum',
    'gin',
    'vodka',
    'tequila',
    'brandy',
];
exports.SPIRIT_FAMILY_LABELS = {
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
exports.SPIRIT_FAMILY_KEYWORDS = {
    whiskey: ['whiskey', 'whisky', 'bourbon', 'rye', 'scotch', 'irish whiskey', 'japanese whisky'],
    rum: ['rum', 'rhum', 'ron', 'cachaça', 'cachaca', 'agricole', 'white rum', 'dark rum', 'spiced rum'],
    gin: ['gin', 'genever', 'london dry', 'plymouth', 'navy strength', 'sloe gin', 'old tom'],
    vodka: ['vodka'],
    tequila: ['tequila', 'mezcal', 'blanco', 'reposado', 'anejo', 'añejo'],
    brandy: ['brandy', 'cognac', 'armagnac', 'pisco', 'calvados', 'grappa'],
};
/** Flat, de-duplicated variant list (e.g. for scanning a free-text query). */
exports.SPIRIT_VARIANTS = Array.from(new Set(exports.SPIRIT_FAMILIES.flatMap((family) => exports.SPIRIT_FAMILY_KEYWORDS[family])));
function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
/**
 * Word-boundary keyword match (prevents "gin" matching "ginger").
 * Case-insensitive; accepts multi-word keywords like "london dry".
 */
function matchesSpiritFamily(text, family) {
    if (!text)
        return false;
    return exports.SPIRIT_FAMILY_KEYWORDS[family].some((keyword) => new RegExp(`\\b${escapeRegex(keyword)}\\b`, 'i').test(text));
}
/** Normalize a spirit-type string to its canonical family, or null if unrecognized. */
function normalizeSpiritType(input) {
    if (!input)
        return null;
    const text = input.trim();
    if (!text)
        return null;
    for (const family of exports.SPIRIT_FAMILIES) {
        if (matchesSpiritFamily(text, family))
            return family;
    }
    return null;
}
/** The variant keywords for a family (its "synonyms"). */
function getSpiritSynonyms(family) {
    return exports.SPIRIT_FAMILY_KEYWORDS[family];
}
/**
 * Does a recipe's ingredient text satisfy a required base-spirit family?
 *
 * Returns true when: there is no constraint; the required family is present; or no
 * identifiable base spirit is present at all. Returns false only when a *different*
 * base spirit is present (a genuine conflict).
 */
function recipeMatchesSpiritConstraint(ingredientsText, required) {
    if (!required)
        return true;
    if (matchesSpiritFamily(ingredientsText, required))
        return true;
    for (const family of exports.SPIRIT_FAMILIES) {
        if (family === required)
            continue;
        if (matchesSpiritFamily(ingredientsText, family))
            return false; // different base spirit
    }
    return true; // no clear base spirit — allow it
}
