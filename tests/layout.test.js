import { describe, it, expect } from 'vitest';
import { layout } from '../src/layout.js';

const rects = [
  ...layout.ground.terracotta,
  ...layout.ground.plaza,
  { x: layout.ground.diningFloor.x, z: layout.ground.diningFloor.z },
];

function area(r) {
  return (r.x[1] - r.x[0]) * (r.z[1] - r.z[0]);
}

function overlaps(a, b) {
  return a.x[0] < b.x[1] && b.x[0] < a.x[1] && a.z[0] < b.z[1] && b.z[0] < a.z[1];
}

describe('layout', () => {
  it('gives every envelope a positive span on all three axes', () => {
    for (const [name, env] of Object.entries(layout.envelopes)) {
      for (let axis = 0; axis < 3; axis++) {
        expect(env.max[axis], `${name} axis ${axis}`).toBeGreaterThan(env.min[axis]);
      }
    }
  });

  it('tiles the lot with floor rectangles that do not overlap', () => {
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        expect(overlaps(rects[i], rects[j]), `rect ${i} overlaps rect ${j}`).toBe(false);
      }
    }
  });

  it('covers the whole lot area with floor rectangles', () => {
    const lotArea = (9 - -11) * (8 - -8);
    const covered = rects.reduce((sum, r) => sum + area(r), 0);
    expect(covered).toBeCloseTo(lotArea, 5);
  });

  it('places every perimeter pillar on a lot corner', () => {
    for (const [px, pz] of layout.perimeter.pillars) {
      expect(Math.abs(px) === 11 || px === 9).toBe(true);
      expect(Math.abs(pz) === 8 || pz === 6 || pz === 2).toBe(true);
    }
  });
});

describe('layout.sim', () => {
  it('gives every customer a parking bay', () => {
    expect(layout.sim.bays.length).toBeGreaterThanOrEqual(layout.sim.customers);
  });

  it('has more queue slots than customers so the line never overflows', () => {
    expect(layout.queue.slots.length).toBeGreaterThanOrEqual(layout.sim.customers);
  });

  it('orders queue slots front to back, away from the counter', () => {
    const slots = layout.queue.slots;
    for (let i = 1; i < slots.length; i++) {
      expect(slots[i][1]).toBeGreaterThan(slots[i - 1][1]);
    }
    expect(slots[0][1]).toBeGreaterThan(layout.counter.main.z[1]);
  });

  it('keeps parked cars clear of the kerb and the travel lane', () => {
    const half = layout.sim.car.length / 2;
    expect(layout.sim.bayZ - half).toBeGreaterThan(layout.ground.curb.z[1]);
    expect(layout.sim.bayZ + half).toBeLessThan(layout.sim.lane.z);
  });

  it('puts every parking bay on the road', () => {
    for (const bay of layout.sim.bays) {
      expect(bay).toBeGreaterThan(layout.ground.road.x[0]);
      expect(bay).toBeLessThan(layout.ground.road.x[1]);
    }
  });

  it('gives every speed and dwell a positive value', () => {
    const { speeds, serveSeconds, boardSeconds, spawnGap } = layout.sim;
    for (const v of [speeds.car, speeds.walk, serveSeconds, boardSeconds, spawnGap]) {
      expect(v).toBeGreaterThan(0);
    }
  });
});
