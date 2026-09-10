import { describe, it, expect } from 'vitest';
import { safeSpeed } from '../../src/sim/following.js';

const base = { cruise: 9, minGap: 1.6, headway: 0.9 };

describe('safeSpeed', () => {
  it('cruises with no leader ahead', () => {
    expect(safeSpeed({ ...base, gap: Infinity, leaderSpeed: 0 })).toBe(9);
  });

  it('stops when the gap is down to the minimum', () => {
    expect(safeSpeed({ ...base, gap: 1.6, leaderSpeed: 0 })).toBe(0);
    expect(safeSpeed({ ...base, gap: 0.4, leaderSpeed: 0 })).toBe(0);
  });

  it('cruises again once the gap exceeds the desired headway', () => {
    const desired = base.minGap + base.cruise * base.headway;
    expect(safeSpeed({ ...base, gap: desired + 5, leaderSpeed: 0 })).toBe(9);
  });

  it('eases toward a stopped leader as the gap closes', () => {
    const near = safeSpeed({ ...base, gap: 2.5, leaderSpeed: 0 });
    const far = safeSpeed({ ...base, gap: 6, leaderSpeed: 0 });
    expect(near).toBeGreaterThan(0);
    expect(near).toBeLessThan(far);
  });

  it('never exceeds cruise and is never negative', () => {
    for (let gap = 0; gap < 40; gap += 0.25) {
      for (const leaderSpeed of [0, 4, 9, 20]) {
        const v = safeSpeed({ ...base, gap, leaderSpeed });
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(base.cruise);
      }
    }
  });

  it('rises monotonically with the gap', () => {
    let previous = -1;
    for (let gap = base.minGap; gap < 30; gap += 0.25) {
      const v = safeSpeed({ ...base, gap, leaderSpeed: 0 });
      expect(v).toBeGreaterThanOrEqual(previous - 1e-9);
      previous = v;
    }
  });

  it('matches the leader when following nose to tail', () => {
    expect(safeSpeed({ ...base, gap: base.minGap, leaderSpeed: 5 })).toBe(0);
  });
});
