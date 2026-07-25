/**
 * Shared spirit keyword helpers for consistent fuzzy matching across pages.
 *
 * The base-spirit vocabulary and matching now come from the shared
 * @alchemix/spirits authority so bar categorization can never drift from AI search,
 * recipe filters, or card colors. "Other Spirits" is a frontend-only catch-all bucket
 * (not a base family), so it stays local.
 */

import {
  SPIRIT_FAMILIES,
  SPIRIT_FAMILY_LABELS,
  matchesSpiritFamily,
  type SpiritFamily,
} from '@alchemix/spirits';

export type SpiritCategory =
  | 'Whiskey'
  | 'Rum'
  | 'Gin'
  | 'Vodka'
  | 'Tequila'
  | 'Brandy'
  | 'Other Spirits';

/** Keywords for the frontend-only catch-all bucket (not a base-spirit family). */
const OTHER_SPIRIT_KEYWORDS = ['other', 'spirit', 'liquor'];

const CATEGORY_BY_FAMILY: Record<SpiritFamily, SpiritCategory> = {
  whiskey: 'Whiskey',
  rum: 'Rum',
  gin: 'Gin',
  vodka: 'Vodka',
  tequila: 'Tequila',
  brandy: 'Brandy',
};

const FAMILY_BY_CATEGORY: Partial<Record<SpiritCategory, SpiritFamily>> = {
  Whiskey: 'whiskey',
  Rum: 'rum',
  Gin: 'gin',
  Vodka: 'vodka',
  Tequila: 'tequila',
  Brandy: 'brandy',
};

/**
 * Check if keyword matches at word boundary (prevents "gin" matching "ginger")
 */
function isWordMatch(text: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`\\b${escaped}\\b`, 'i');
  return regex.test(text);
}

export function categorizeSpirit(type?: string | null, name?: string | null): SpiritCategory {
  // Combine type and name for matching (name often contains spirit type)
  const combined = `${type || ''} ${name || ''}`.trim();

  if (!combined) return 'Other Spirits';

  for (const family of SPIRIT_FAMILIES) {
    if (matchesSpiritFamily(combined, family)) {
      return CATEGORY_BY_FAMILY[family];
    }
  }

  return 'Other Spirits';
}

export function matchesSpiritCategory(type: string | undefined, targetCategory: SpiritCategory, name?: string | null): boolean {
  // Combine type and name for matching
  const combined = `${type || ''} ${name || ''}`.trim();

  // Catch-all: "Other Spirits" should match anything that does not fit a defined category
  if (targetCategory === 'Other Spirits') {
    if (!combined) return true;
    const matchesAnyFamily = SPIRIT_FAMILIES.some((family) => matchesSpiritFamily(combined, family));
    return !matchesAnyFamily || OTHER_SPIRIT_KEYWORDS.some((keyword) => isWordMatch(combined, keyword));
  }

  if (!combined) return false;
  const family = FAMILY_BY_CATEGORY[targetCategory];
  return family ? matchesSpiritFamily(combined, family) : false;
}

export function getSpiritCategories(): SpiritCategory[] {
  return [...SPIRIT_FAMILIES.map((family) => CATEGORY_BY_FAMILY[family]), 'Other Spirits'];
}
