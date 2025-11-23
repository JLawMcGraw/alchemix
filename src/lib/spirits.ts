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

export function categorizeSpirit(type?: string | null): SpiritCategory {
  if (!type) return 'Other Spirits';
  const normalized = type.toLowerCase().trim();

  for (const [category, keywords] of Object.entries(spiritKeywords) as Array<[SpiritCategory, string[]]>) {
    if (keywords.some((keyword) => normalized.includes(keyword))) {
      return category;
    }
  }

  return 'Other Spirits';
}

export function matchesSpiritCategory(type: string | undefined, targetCategory: SpiritCategory): boolean {
  // Catch-all: "Other Spirits" should match anything that does not fit a defined category
  if (targetCategory === 'Other Spirits') {
    if (!type) return true;
    const normalized = type.toLowerCase().trim();
    const matchesAnyOther = (Object.entries(spiritKeywords) as Array<[SpiritCategory, string[]]>)
      .filter(([category]) => category !== 'Other Spirits')
      .some(([, keywords]) => keywords.some((keyword) => normalized.includes(keyword)));
    return !matchesAnyOther || spiritKeywords['Other Spirits'].some((keyword) => normalized.includes(keyword));
  }

  if (!type) return false;
  const normalized = type.toLowerCase().trim();
  const keywords = spiritKeywords[targetCategory];
  return keywords.some((keyword) => normalized.includes(keyword));
}

export function getSpiritCategories() {
  return Object.keys(spiritKeywords) as SpiritCategory[];
}
