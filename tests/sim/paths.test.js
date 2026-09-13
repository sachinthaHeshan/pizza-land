import { describe, it, expect } from 'vitest';
import {
  lotEntryPath,
  lotExitPath,
  walkInPath,
  walkOutPath,
  doorPosition,
  slotPosition,
  pathLength,
  seatPosition,
  walkToSeatPath,
  walkFromSeatPath,
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

describe('walking to a seat', () => {
  const bay = layout.sim.bays[0];

  it('puts seat 0 on the +z side of its table and seat 1 on the -z side', () => {
    const spot = layout.dining.tables[2];
    expect(seatPosition(layout, 2, 0)).toEqual({ x: spot.x, z: spot.z + layout.dining.chair.offset });
    expect(seatPosition(layout, 2, 1)).toEqual({ x: spot.x, z: spot.z - layout.dining.chair.offset });
  });

  it('starts at the car door and ends on the seat', () => {
    const path = walkToSeatPath(layout, bay, 1, 0);
    const seat = seatPosition(layout, 1, 0);
    expect(path[0]).toEqual(doorPosition(layout, bay));
    expect(path[path.length - 1]).toEqual({ x: seat.x, z: seat.z });
  });

  it('goes in through the storefront door', () => {
    const path = walkToSeatPath(layout, bay, 3, 1);
    const door = layout.storefront.door.x;
    const threshold = path.find((point) => Math.abs(point.z - layout.storefront.z) < 1e-9);
    expect(threshold, 'a waypoint on the door threshold').toBeDefined();
    expect(threshold.x).toBeGreaterThan(door[0]);
    expect(threshold.x).toBeLessThan(door[1]);
  });

  it('never doubles back on itself and has finite points', () => {
    const path = walkToSeatPath(layout, bay, 0, 0);
    for (const point of path) {
      expect(Number.isFinite(point.x)).toBe(true);
      expect(Number.isFinite(point.z)).toBe(true);
    }
    for (let i = 1; i < path.length; i++) {
      const same = path[i].x === path[i - 1].x && path[i].z === path[i - 1].z;
      expect(same, `duplicate waypoint at ${i}`).toBe(false);
    }
  });

  it('walks back out the way it came', () => {
    const inward = walkToSeatPath(layout, bay, 2, 1);
    expect(walkFromSeatPath(layout, bay, 2, 1)).toEqual([...inward].reverse());
  });

  // Liang–Barsky clipping: does the segment a->b spend any length inside the
  // axis-aligned rectangle? Exact, so a leg that only grazes an edge passes.
  function crossesRect(a, b, rect) {
    const d = { x: b.x - a.x, z: b.z - a.z };
    let t0 = 0;
    let t1 = 1;
    const clip = (p, q) => {
      if (Math.abs(p) < 1e-12) return q > 0;
      const r = q / p;
      if (p < 0) {
        if (r > t1) return false;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return false;
        if (r < t1) t1 = r;
      }
      return true;
    };
    const ok =
      clip(-d.x, a.x - rect.x[0]) &&
      clip(d.x, rect.x[1] - a.x) &&
      clip(-d.z, a.z - rect.z[0]) &&
      clip(d.z, rect.z[1] - a.z);
    return ok && t1 - t0 > 1e-9;
  }

  it('never routes a diner through a table or its chairs', () => {
    const d = layout.dining;
    const half = d.top.size / 2;
    const tops = d.tables.map((spot, i) => ({
      label: `table ${i}`,
      x: [spot.x - half, spot.x + half],
      z: [spot.z - half, spot.z + half],
    }));
    // Every chair except the one being walked to: a diner may of course
    // arrive at their own seat.
    const chairsExcept = (table, seat) => {
      const c = d.chair.size / 2;
      const out = [];
      d.tables.forEach((spot, i) => {
        for (let s = 0; s < d.seatsPerTable; s++) {
          if (i === table && s === seat) continue;
          const at = seatPosition(layout, i, s);
          out.push({
            label: `chair ${i}/${s}`,
            x: [at.x - c, at.x + c],
            z: [at.z - c, at.z + c],
          });
        }
      });
      return out;
    };

    for (let table = 0; table < d.tables.length; table++) {
      for (let seat = 0; seat < d.seatsPerTable; seat++) {
        const path = walkToSeatPath(layout, bay, table, seat);
        const blockers = [...tops, ...chairsExcept(table, seat)];
        for (let i = 1; i < path.length; i++) {
          for (const rect of blockers) {
            const leg = `seat ${table}/${seat} leg ${i} through ${rect.label}`;
            expect(crossesRect(path[i - 1], path[i], rect), leg).toBe(false);
          }
        }
      }
    }
  });
});
