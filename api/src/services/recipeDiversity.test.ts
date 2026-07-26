import { describe, it, expect } from 'vitest';
import { selectDiverse } from './recipeDiversity';

interface R { name: string; spirit: string; category: string }
const key = (r: R) => ({ spirit: r.spirit, category: r.category });

function rums(n: number, category = 'sour'): R[] {
  return Array.from({ length: n }, (_, i) => ({ name: `rum${i}`, spirit: 'rum', category }));
}

describe('recipeDiversity.selectDiverse', () => {
  it('returns items unchanged when under the limit', () => {
    const items = [
      { name: 'a', spirit: 'rum', category: 'sour' },
      { name: 'b', spirit: 'gin', category: 'highball' },
    ];
    expect(selectDiverse(items, 10, key).map(r => r.name)).toEqual(['a', 'b']);
  });

  it('caps how many of one spirit family fill the slots', () => {
    // 20 rums + 6 gins (varied categories so only the spirit cap bites). With enough
    // diversity to fill the limit, the per-spirit cap holds: rum can't crowd out gin.
    const gins: R[] = Array.from({ length: 6 }, (_, i) => ({ name: `gin${i}`, spirit: 'gin', category: `c${i}` }));
    const rumsVaried: R[] = Array.from({ length: 20 }, (_, i) => ({ name: `rum${i}`, spirit: 'rum', category: `c${i}` }));
    const picked = selectDiverse([...rumsVaried, ...gins], 8, key, { maxPerSpirit: 4, maxPerCategory: 99 });
    expect(picked.filter(r => r.spirit === 'rum').length).toBe(4); // capped
    expect(picked.filter(r => r.spirit === 'gin').length).toBe(4); // gins get the freed slots
  });

  it('caps per category too', () => {
    // 10 sour (varied spirits so only the category cap bites) + 2 tiki; limit fits in pass 1.
    const sour: R[] = Array.from({ length: 10 }, (_, i) => ({ name: `s${i}`, spirit: `sp${i}`, category: 'sour' }));
    const items = [...sour,
      { name: 'x', spirit: 'gin', category: 'tiki' },
      { name: 'y', spirit: 'whiskey', category: 'tiki' }];
    const picked = selectDiverse(items, 5, key, { maxPerSpirit: 99, maxPerCategory: 3 });
    expect(picked.filter(r => r.category === 'sour').length).toBe(3);
  });

  it('preserves priority order of the input (tier order kept)', () => {
    const items = [
      { name: 'craftable1', spirit: 'rum', category: 'sour' },
      { name: 'craftable2', spirit: 'gin', category: 'highball' },
      { name: 'nearmiss1', spirit: 'whiskey', category: 'stirred' },
    ];
    const picked = selectDiverse(items, 3, key);
    expect(picked.map(r => r.name)).toEqual(['craftable1', 'craftable2', 'nearmiss1']);
  });

  it('fills remaining slots (relaxed pass) rather than starving when caps cannot be met', () => {
    // Only rums exist; a strict per-spirit cap must not leave slots empty.
    const picked = selectDiverse(rums(10), 5, key, { maxPerSpirit: 2, maxPerCategory: 99 });
    expect(picked.length).toBe(5); // relaxed fill kicks in
  });

  it('never exceeds the limit', () => {
    expect(selectDiverse(rums(50), 12, key).length).toBe(12);
  });

  it('does not duplicate items', () => {
    const picked = selectDiverse(rums(10), 5, key, { maxPerSpirit: 2 });
    expect(new Set(picked.map(r => r.name)).size).toBe(picked.length);
  });
});
