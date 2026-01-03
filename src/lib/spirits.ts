/**
 * Shared spirit keyword helpers for consistent fuzzy matching across pages.
 */

export type SpiritCategory =
  | 'Whiskey'
  | 'Rum'
  | 'Gin'
  | 'Vodka'
  | 'Tequila'
  | 'Brandy'
  | 'Other Spirits';

const spiritKeywords: Record<SpiritCategory, string[]> = {
  Whiskey: ['whiskey', 'whisky', 'bourbon', 'scotch', 'rye', 'irish whiskey', 'japanese whisky'],
  Rum: ['rum', 'rhum', 'ron', 'cachaça', 'cachaca'],
  Gin: ['gin', 'genever'],
  Vodka: ['vodka'],
  Tequila: ['tequila', 'mezcal'],
  Brandy: ['brandy', 'cognac', 'armagnac', 'pisco', 'calvados'],
  'Other Spirits': ['other', 'spirit', 'liquor'],
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
  const combined = `${type || ''} ${name || ''}`.toLowerCase().trim();

  if (!combined) return 'Other Spirits';

  for (const [category, keywords] of Object.entries(spiritKeywords) as Array<[SpiritCategory, string[]]>) {
    if (category === 'Other Spirits') continue; // Check this last
    if (keywords.some((keyword) => isWordMatch(combined, keyword))) {
      return category;
    }
  }

  return 'Other Spirits';
}

export function matchesSpiritCategory(type: string | undefined, targetCategory: SpiritCategory, name?: string | null): boolean {
  // Combine type and name for matching
  const combined = `${type || ''} ${name || ''}`.toLowerCase().trim();

  // Catch-all: "Other Spirits" should match anything that does not fit a defined category
  if (targetCategory === 'Other Spirits') {
    if (!combined) return true;
    const matchesAnyOther = (Object.entries(spiritKeywords) as Array<[SpiritCategory, string[]]>)
      .filter(([category]) => category !== 'Other Spirits')
      .some(([, keywords]) => keywords.some((keyword) => isWordMatch(combined, keyword)));
    return !matchesAnyOther || spiritKeywords['Other Spirits'].some((keyword) => isWordMatch(combined, keyword));
  }

  if (!combined) return false;
  const keywords = spiritKeywords[targetCategory];
  return keywords.some((keyword) => isWordMatch(combined, keyword));
}

export function getSpiritCategories() {
  return Object.keys(spiritKeywords) as SpiritCategory[];
}
