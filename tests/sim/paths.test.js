import { describe, it, expect } from 'vitest';
import {
  arrivalPath,
  departurePath,
  walkInPath,
  walkOutPath,
  doorPosition,
  pathLength,
} from '../../src/sim/paths.js';
import { layout } from '../../src/layout.js';

const bayX = layout.sim.bays[0];
const slot = layout.queue.slots[0];

function onPaving(point) {
  const rects = [
    ...layout.ground.sidewalk,
    ...layout.ground.plaza,
    { x: layout.ground.road.x, z: layout.ground.road.z },
    { x: layout.ground.apron.x, z: layout.ground.apron.z },
  ];
  return rects.some(
    (r) => point.x >= r.x[0] && point.x <= r.x[1] && point.z >= r.z[0] && point.z <= r.z[1]
  );
}

describe('paths', () => {
  it('drives in from the entry x and stops in the bay', () => {
    const path = arrivalPath(layout, bayX);
    expect(path[0].x).toBe(layout.sim.lane.enterX);
    expect(path[0].z).toBe(layout.sim.lane.z);
    const last = path[path.length - 1];
    expect(last.x).toBeCloseTo(bayX, 5);
    expect(last.z).toBeCloseTo(layout.sim.bayZ, 5);
  });

  it('backs out of the bay before turning into the lane', () => {
    const path = departurePath(layout, bayX);
    expect(path[0].z).toBeCloseTo(layout.sim.bayZ, 5);
    expect(path[1].reverse).toBe(true);
    expect(path[path.length - 1].x).toBe(layout.sim.lane.exitX);
  });

  it('walks from the car door to the queue slot', () => {
    const path = walkInPath(layout, bayX, slot);
    const door = doorPosition(layout, bayX);
    expect(path[0].x).toBeCloseTo(door.x, 5);
    expect(path[0].z).toBeCloseTo(door.z, 5);
    const last = path[path.length - 1];
    expect(last.x).toBeCloseTo(slot[0], 5);
    expect(last.z).toBeCloseTo(slot[1], 5);
  });

  it('walks back out along the reverse of the way in', () => {
    const inward = walkInPath(layout, bayX, slot);
    const outward = walkOutPath(layout, bayX, slot);
    expect(outward.map((p) => [p.x, p.z])).toEqual(
      inward.map((p) => [p.x, p.z]).reverse()
    );
  });

  it('keeps every walking waypoint on paved ground', () => {
    for (const bay of layout.sim.bays) {
      for (const s of layout.queue.slots) {
        for (const point of walkInPath(layout, bay, s)) {
          expect(onPaving(point), `(${point.x}, ${point.z})`).toBe(true);
        }
      }
    }
  });

  it('walks monotonically toward the counter', () => {
    const path = walkInPath(layout, bayX, slot);
    for (let i = 1; i < path.length; i++) {
      expect(path[i].z).toBeLessThanOrEqual(path[i - 1].z + 1e-9);
    }
  });

  it('gives every path a positive length', () => {
    for (const bay of layout.sim.bays) {
      expect(pathLength(arrivalPath(layout, bay))).toBeGreaterThan(0);
      expect(pathLength(departurePath(layout, bay))).toBeGreaterThan(0);
      expect(pathLength(walkInPath(layout, bay, slot))).toBeGreaterThan(0);
    }
  });

  it('measures length as the sum of its segments', () => {
    expect(pathLength([{ x: 0, z: 0 }, { x: 3, z: 4 }, { x: 3, z: 8 }])).toBeCloseTo(9, 6);
  });
});
