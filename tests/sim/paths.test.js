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
  it('enters from the road and stops in the bay', () => {
    const path = arrivalPath(layout, rowA);
    expect(path[0].x).toBe(layout.sim.lane.enterX);
    expect(path[0].z).toBeCloseTo(layout.sim.lane.z, 5);
    const last = path[path.length - 1];
    expect(last.x).toBeCloseTo(rowA.x, 5);
    expect(last.z).toBeCloseTo(rowA.z, 5);
  });

  it('turns in through the entrance gap, never the exit', () => {
    for (const bay of layout.sim.bays) {
      const xs = arrivalPath(layout, bay).map((p) => p.x);
      expect(xs).toContain(layout.parking.entrance.centreX);
      expect(xs).not.toContain(layout.parking.exit.centreX);
    }
  });

  it('backs out of the bay and leaves through the exit gap', () => {
    const path = departurePath(layout, rowA);
    expect(path[0].z).toBeCloseTo(rowA.z, 5);
    expect(path[1].reverse).toBe(true);
    expect(path.some((p) => Math.abs(p.x - layout.parking.exit.centreX) < 1e-9)).toBe(true);
    expect(path[path.length - 1].x).toBe(layout.sim.lane.exitX);
  });

  it('keeps every driving waypoint on the lot, a gap, or the road', () => {
    for (const bay of layout.sim.bays) {
      for (const point of [...arrivalPath(layout, bay), ...departurePath(layout, bay)]) {
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
      expect(pathLength(arrivalPath(layout, bay))).toBeGreaterThan(0);
      expect(pathLength(departurePath(layout, bay))).toBeGreaterThan(0);
      expect(pathLength(walkInPath(layout, bay, slot))).toBeGreaterThan(0);
    }
  });

  it('measures length as the sum of its segments', () => {
    expect(pathLength([{ x: 0, z: 0 }, { x: 3, z: 4 }, { x: 3, z: 8 }])).toBeCloseTo(9, 6);
  });
});
