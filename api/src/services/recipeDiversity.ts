/**
 * Diversity-aware selection for recipe recommendations.
 *
 * The candidate list handed to the LLM was previously a craftable-first slice, so a
 * user whose bar makes 20 rum drinks craftable saw the same rum cluster every time —
 * even with 700 recipes. This selects up to `limit` items while capping how many can
 * share a spirit family or category, so the shown set spreads across the collection.
 *
 * The input is assumed to already be in priority order (e.g. craftable first). We keep
 * that order: the caps only decide which items to SKIP when a bucket is full, and a
 * relaxed second pass backfills any leftover slots so we never starve the list.
 */

export interface DiversityCaps {
  /** Max items sharing one spirit family. Default: max(3, ceil(limit/5)). */
  maxPerSpirit?: number;
  /** Max items sharing one category. Default: max(3, ceil(limit/4)). */
  maxPerCategory?: number;
}

export function selectDiverse<T>(
  items: T[],
  limit: number,
  getKey: (item: T) => { spirit: string; category: string },
  caps: DiversityCaps = {}
): T[] {
  if (items.length <= limit) return items.slice();

  const maxPerSpirit = caps.maxPerSpirit ?? Math.max(3, Math.ceil(limit / 5));
  const maxPerCategory = caps.maxPerCategory ?? Math.max(3, Math.ceil(limit / 4));

  const selected: T[] = [];
  const chosen = new Set<T>();
  const spiritCount = new Map<string, number>();
  const categoryCount = new Map<string, number>();

  // Pass 1: honor the diversity caps, preserving input priority order.
  for (const item of items) {
    if (selected.length >= limit) break;
    const { spirit, category } = getKey(item);
    if ((spiritCount.get(spirit) ?? 0) >= maxPerSpirit) continue;
    if ((categoryCount.get(category) ?? 0) >= maxPerCategory) continue;
    selected.push(item);
    chosen.add(item);
    spiritCount.set(spirit, (spiritCount.get(spirit) ?? 0) + 1);
    categoryCount.set(category, (categoryCount.get(category) ?? 0) + 1);
  }

  // Pass 2: backfill remaining slots from what the caps skipped (still in order),
  // so a lopsided collection never leaves the list short.
  if (selected.length < limit) {
    for (const item of items) {
      if (selected.length >= limit) break;
      if (chosen.has(item)) continue;
      selected.push(item);
      chosen.add(item);
    }
  }

  return selected;
}
