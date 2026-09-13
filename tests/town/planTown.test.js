import { describe, it, expect } from 'vitest';
import { planTown } from '../../src/town/planTown.js';
import { layout } from '../../src/layout.js';

const t = layout.town;
const plan = planTown(layout);
const first = plan.lots.filter((lot) => lot.row === 'first');
const second = plan.lots.filter((lot) => lot.row === 'second');
const kerbTrees = plan.trees.filter((tree) => tree.z === t.kerbStrip.treeZ);
const lineTrees = plan.trees.filter((tree) => tree.z >= t.treeLine.z[0]);
const ofKind = (kind) => plan.props.filter((p) => p.kind === kind);

function overlaps(a, b) {
  const eps = 1e-9;
  return a.x[0] < b.x[1] - eps && b.x[0] < a.x[1] - eps && a.z[0] < b.z[1] - eps && b.z[0] < a.z[1] - eps;
}

describe('planTown', () => {
  it('builds the same town every time from the same seed', () => {
    expect(planTown(layout)).toEqual(plan);
  });

  it('builds a different town from a different seed', () => {
    const other = planTown({ ...layout, town: { ...t, seed: t.seed + 1 } });
    expect(other.lots.map((lot) => lot.x)).not.toEqual(plan.lots.map((lot) => lot.x));
  });

  it('fills each row across the town with lots 10 to 14 m wide', () => {
    for (const row of [first, second]) {
      expect(row.length).toBeGreaterThanOrEqual(8);
      for (const lot of row) {
        const width = lot.x[1] - lot.x[0];
        expect(width).toBeGreaterThanOrEqual(t.lot.minWidth - 1e-9);
        expect(width).toBeLessThanOrEqual(t.lot.maxWidth + 1e-9);
        expect(lot.x[0]).toBeGreaterThanOrEqual(t.x[0]);
        expect(lot.x[1]).toBeLessThanOrEqual(t.x[1]);
      }
      // Whatever is left after the last lot is too narrow for another one.
      expect(t.x[1] - row.at(-1).x[1]).toBeLessThan(t.lot.minWidth + t.lot.alleyWidth[1]);
    }
  });

  it('keeps each row in its band, with no two lots overlapping', () => {
    for (const lot of first) expect(lot.z).toEqual([t.firstRow.back, t.firstRow.front]);
    for (const lot of second) expect(lot.z).toEqual([t.secondRow.back, t.secondRow.front]);
    for (let i = 0; i < plan.lots.length; i++) {
      for (let j = i + 1; j < plan.lots.length; j++) {
        expect(overlaps(plan.lots[i], plan.lots[j]), `lots ${i} and ${j}`).toBe(false);
      }
    }
  });

  it('mixes shops and houses in the first row and keeps the second row to houses', () => {
    expect(first.some((lot) => lot.kind === 'shop')).toBe(true);
    expect(first.some((lot) => lot.kind === 'house')).toBe(true);
    expect(second.every((lot) => lot.kind === 'house')).toBe(true);
  });

  it('gives buildings the heights in the spec table', () => {
    const allowed = {
      'shop-1': [3.8],
      'shop-2': [6.8],
      'house-1': [5.0, 5.4],
      'house-2': [8.4, 8.8],
    };
    for (const lot of plan.lots) {
      const options = allowed[`${lot.kind}-${lot.storeys}`];
      const label = `${lot.row} ${lot.kind}, ${lot.storeys} storeys, ${lot.height} m`;
      expect(options.some((h) => Math.abs(h - lot.height) < 1e-9), label).toBe(true);
    }
  });

  it('keeps every building low enough that the road stays in view', () => {
    for (const lot of first) expect(lot.height).toBeLessThanOrEqual(t.firstRow.maxHeight);
    for (const lot of second) expect(lot.height).toBeLessThanOrEqual(t.secondRow.maxHeight);
  });

  it('lines the kerb with trees 12 m apart and a lamp or the bus stop between each pair', () => {
    expect(kerbTrees.length).toBeGreaterThanOrEqual(10);
    for (let i = 1; i < kerbTrees.length; i++) {
      expect(kerbTrees[i].x - kerbTrees[i - 1].x).toBeCloseTo(t.kerbStrip.treeSpacing, 9);
    }
    const posts = [...ofKind('lamp'), ...ofKind('busStop')];
    expect(posts).toHaveLength(kerbTrees.length - 1);
    for (let i = 1; i < kerbTrees.length; i++) {
      const mid = (kerbTrees[i - 1].x + kerbTrees[i].x) / 2;
      expect(posts.some((p) => Math.abs(p.x - mid) < 1e-9), `post at x ${mid}`).toBe(true);
    }
  });

  it('puts exactly one bus stop at x −6, at least 1.5 m clear of every kerb tree', () => {
    const stops = ofKind('busStop');
    expect(stops).toHaveLength(1);
    const [stop] = stops;
    expect(stop.x).toBeCloseTo(t.kerbStrip.busStopX, 9);
    for (const tree of kerbTrees) {
      const gap = Math.max(stop.x - stop.size.w / 2 - tree.x, tree.x - (stop.x + stop.size.w / 2));
      expect(gap, `tree at x ${tree.x}`).toBeGreaterThanOrEqual(1.5);
    }
  });

  it('spaces the tree line at least 10 m apart and at most 6 m tall', () => {
    const xs = lineTrees.map((tree) => tree.x).sort((a, b) => a - b);
    expect(xs.length).toBeGreaterThanOrEqual(10);
    for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1]).toBeGreaterThanOrEqual(10 - 1e-9);
    for (const tree of lineTrees) {
      expect(tree.height).toBeLessThanOrEqual(6);
      expect(tree.z).toBeGreaterThanOrEqual(t.treeLine.treeZ[0]);
      expect(tree.z).toBeLessThanOrEqual(t.treeLine.treeZ[1]);
    }
  });

  it('places nothing on the road or the kerb', () => {
    for (const box of plan.obstacles) expect(box.z[0]).toBeGreaterThanOrEqual(t.kerbStrip.z[0]);
    for (const lawn of plan.lawns) expect(lawn.z[0]).toBeGreaterThanOrEqual(t.kerbStrip.z[0]);
  });

  it('gives each second-row house a lawn and a hedge with a gap at its door', () => {
    expect(plan.lawns).toHaveLength(second.length);
    const hedges = ofKind('hedge');
    expect(hedges).toHaveLength(second.length * 2);
    for (const lot of second) {
      const door = (lot.x[0] + lot.x[1]) / 2;
      const own = hedges.filter((h) => h.x > lot.x[0] && h.x < lot.x[1]);
      expect(own).toHaveLength(2);
      for (const h of own) {
        const left = h.x - h.size.w / 2;
        const right = h.x + h.size.w / 2;
        const clear = right <= door - t.gardenHedge.doorGap / 2 + 1e-9 || left >= door + t.gardenHedge.doorGap / 2 - 1e-9;
        expect(clear, `hedge at x ${h.x}`).toBe(true);
      }
    }
  });

  it('turns every lot, tree trunk and prop into an obstacle', () => {
    expect(plan.obstacles).toHaveLength(plan.lots.length + plan.trees.length + plan.props.length);
    for (const lot of plan.lots) expect(plan.obstacles).toContainEqual({ x: lot.x, z: lot.z });
  });
});
