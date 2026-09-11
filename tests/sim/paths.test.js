import { describe, it, expect } from 'vitest';
import {
  lotEntryPath,
  lotExitPath,
  walkInPath,
  walkOutPath,
  doorPosition,
  slotPosition,
  pathLength,
} from '../../src/sim/paths.js';
import { layout } from '../../src/layout.js';

const rowA = layout.sim.bays.find((b) => b.row === 0);
const rowB = layout.sim.bays.find((b) => b.row === 1);
const slot = layout.queue.slots[0];

function onDrivable(point) {
  const P = layout.parking;
  const inLot =
    point.x >= P.lot.x[0] && point.x <= P.lot.x[1] &&
    point.z >= P.lot.z[0] && point.z <= P.lot.z[1];
  const inGap = [P.entrance, P.exit].some(
    (g) => point.x >= g.x[0] && point.x <= g.x[1] &&
           point.z >= P.island.z[0] && point.z <= P.island.z[1]
  );
  const onRoad =
    point.z >= layout.ground.road.z[0] && point.z <= layout.ground.road.z[1];
  return inLot || inGap || onRoad;
}

function inSomeBay(point) {
  const P = layout.parking;
  const half = P.baySpacing / 2;
  return layout.sim.bays.some((bay) => {
    const row = P.rows[bay.row];
    return (
      Math.abs(point.x - bay.x) < half - 1e-9 &&
      point.z > row.z[0] && point.z < row.z[1]
    );
  });
}

describe('paths', () => {
  it('enters the lot from the kerb lane and stops in the bay', () => {
    const path = lotEntryPath(layout, rowA);
    expect(path[0].x).toBeCloseTo(layout.parking.entrance.centreX, 5);
    expect(path[0].z).toBeCloseTo(layout.ground.lanes[0].z, 5);
    const last = path[path.length - 1];
    expect(last.x).toBeCloseTo(rowA.x, 5);
    expect(last.z).toBeCloseTo(rowA.z, 5);
  });

  it('leaves the bay through the exit gap onto the kerb lane', () => {
    const path = lotExitPath(layout, rowA);
    expect(path[0].z).toBeCloseTo(rowA.z, 5);
    expect(path[1].reverse).toBe(true);
    expect(path[path.length - 1].x).toBeCloseTo(layout.parking.exit.centreX, 5);
    expect(path[path.length - 1].z).toBeCloseTo(layout.ground.lanes[0].z, 5);
  });

  it('keeps every driving waypoint on the lot, a gap, or the road', () => {
    for (const bay of layout.sim.bays) {
      for (const point of [...lotEntryPath(layout, bay), ...lotExitPath(layout, bay)]) {
        expect(onDrivable(point), `(${point.x}, ${point.z})`).toBe(true);
      }
    }
  });

  it('walks row A straight out the front of its bay', () => {
    const path = walkInPath(layout, rowA, slot);
    expect(path).toHaveLength(4);
    expect(path[1].z).toBeCloseTo(layout.sim.walk.sidewalkZ, 5);
  });

  it('walks row B along the aisle and down the walkway', () => {
    const path = walkInPath(layout, rowB, slot);
    expect(path.some((p) => p.x === layout.parking.walkwayX)).toBe(true);
    expect(path.some((p) => p.z === layout.parking.aisle.centreZ)).toBe(true);
  });

  it('never routes a pedestrian through a bay they do not own', () => {
    for (const bay of layout.sim.bays) {
      const path = walkInPath(layout, bay, slot);
      for (const point of path.slice(1)) {
        if (!inSomeBay(point)) continue;
        expect(Math.abs(point.x - bay.x), `(${point.x}, ${point.z})`)
          .toBeLessThan(layout.parking.baySpacing / 2);
      }
    }
  });

  it('walks back out along the reverse of the way in', () => {
    const inward = walkInPath(layout, rowB, slot);
    const outward = walkOutPath(layout, rowB, slot);
    expect(outward.map((p) => [p.x, p.z])).toEqual(inward.map((p) => [p.x, p.z]).reverse());
  });

  it('puts the door beside the car, inside its own bay', () => {
    for (const bay of layout.sim.bays) {
      const door = doorPosition(layout, bay);
      expect(Math.abs(door.x - bay.x)).toBeGreaterThan(layout.sim.car.width / 2);
      expect(Math.abs(door.x - bay.x)).toBeLessThan(layout.parking.baySpacing / 2);
    }
  });

  it('gives every path a positive length', () => {
    for (const bay of layout.sim.bays) {
      expect(pathLength(lotEntryPath(layout, bay))).toBeGreaterThan(0);
      expect(pathLength(lotExitPath(layout, bay))).toBeGreaterThan(0);
      expect(pathLength(walkInPath(layout, bay, slot))).toBeGreaterThan(0);
    }
  });

  it('measures length as the sum of its segments', () => {
    expect(pathLength([{ x: 0, z: 0 }, { x: 3, z: 4 }, { x: 3, z: 8 }])).toBeCloseTo(9, 6);
  });

  it('extends overflow slots along the same line as the marked queue', () => {
    const marked = layout.queue.slots;
    expect(slotPosition(layout, 0)).toEqual(marked[0]);
    expect(slotPosition(layout, marked.length - 1)).toEqual(marked[marked.length - 1]);
    const extra = slotPosition(layout, marked.length);
    const last = marked[marked.length - 1];
    const prev = marked[marked.length - 2];
    expect(extra[0] - last[0]).toBeCloseTo(last[0] - prev[0], 5);
    expect(extra[1] - last[1]).toBeCloseTo(last[1] - prev[1], 5);
  });
});
