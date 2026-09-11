import { describe, it, expect } from 'vitest';
import { layout } from '../src/layout.js';
import { playerObstacles, hitsObstacle, PLAYER_RADIUS } from '../src/sim/obstacles.js';

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
  it('stretches the ground 160 m along z so the other isometric axis can be panned', () => {
    const z = [-65, 95];
    expect(layout.ground.apron.z).toEqual(z);
    expect(layout.envelopes.ground.min[2]).toBe(-65);
    expect(layout.envelopes.ground.max[2]).toBe(95);
    const farWalk = layout.ground.sidewalk.find((r) => r.z[0] === 40.9);
    expect(farWalk.z[1]).toBe(95);
    const backWalk = layout.ground.sidewalk.find((r) => r.z[0] === -65);
    expect(backWalk.z[1]).toBe(-8);
    expect(backWalk.x).toEqual([-80, 80]);
  });

  it('stretches the ground 160 m along x so the road can be panned', () => {
    const x = [-80, 80];
    expect(layout.ground.apron.x).toEqual(x);
    expect(layout.ground.road.x).toEqual(x);
    expect(layout.ground.laneMarks.x).toEqual(x);
    for (const kerb of layout.ground.kerbs) expect(kerb.x).toEqual(x);
    expect(layout.parking.segments[0].x[0]).toBe(-80);
    expect(layout.parking.segments.at(-1).x[1]).toBe(80);
    expect(layout.envelopes.ground.min[0]).toBe(-80);
    expect(layout.envelopes.ground.max[0]).toBe(80);
    expect(layout.envelopes.parking.min[0]).toBe(-80);
    expect(layout.envelopes.parking.max[0]).toBe(80);
    expect(layout.envelopes.traffic.min[0]).toBe(-80);
    expect(layout.envelopes.traffic.max[0]).toBe(80);
  });

  it('spawns traffic just inside the new road ends', () => {
    expect(layout.traffic.spawnX).toBe(68);
    expect(layout.traffic.spawnX).toBeLessThan(layout.ground.road.x[1]);
    expect(-layout.traffic.spawnX).toBeGreaterThan(layout.ground.road.x[0]);
  });

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

  it('keeps shop walls only a little taller than a person, leaving the oven taller', () => {
    const tallestPerson = Math.max(
      layout.queue.cashier.height,
      ...layout.sim.people.map((person) => person.height)
    );
    const shopWalls = [
      layout.diningWing.wallHeight,
      layout.sideWing.wallHeight,
      layout.storefront.header[1],
      layout.kitchen.tileWall.y[1],
    ];
    for (const height of shopWalls) {
      expect(height).toBeGreaterThan(tallestPerson);
      expect(height - tallestPerson).toBeLessThanOrEqual(0.55);
      expect(height).toBeLessThan(layout.oven.flue.y[1]);
    }
  });
});

describe('layout.sim', () => {
  it('gives every customer a parking bay', () => {
    expect(layout.sim.bays.length).toBeGreaterThanOrEqual(layout.sim.pedestrians);
  });

  it('gives every bay a pedestrian, so the lot is what fills up', () => {
    expect(layout.sim.pedestrians).toBe(layout.sim.bays.length);
  });

  it('orders queue slots front to back, away from the counter', () => {
    const slots = layout.queue.slots;
    for (let i = 1; i < slots.length; i++) {
      expect(slots[i][1]).toBeGreaterThan(slots[i - 1][1]);
    }
    expect(slots[0][1]).toBeGreaterThan(layout.counter.main.z[1]);
  });

  it('lays the shop-front queue in a straight line, not a diagonal', () => {
    const slots = layout.queue.slots;
    const x = slots[0][0];
    for (const [slotX] of slots) {
      expect(slotX).toBeCloseTo(x, 5);
    }
  });

  it('keeps parked cars clear of the kerb and the travel lane', () => {
    const half = layout.sim.car.length / 2;
    for (const row of layout.parking.rows) {
      expect(row.carZ - half).toBeGreaterThan(layout.parking.lot.z[0]);
      expect(row.carZ + half).toBeLessThan(layout.parking.island.z[0]);
    }
  });

  it('puts every parking bay inside the lot, not on the road', () => {
    for (const bay of layout.sim.bays) {
      expect(bay.z).toBeLessThan(layout.ground.road.z[0]);
      expect(bay.z).toBeGreaterThan(layout.parking.lot.z[0]);
    }
  });

  it('gives every speed and dwell a positive value', () => {
    const { speeds, serveSeconds, boardSeconds, spawnGap } = layout.sim;
    for (const v of [speeds.car, speeds.walk, serveSeconds, boardSeconds, spawnGap]) {
      expect(v).toBeGreaterThan(0);
    }
  });
});

describe('layout.parking', () => {
  const P = layout.parking;

  it('lays eight bays in two rows of four', () => {
    expect(P.bayX).toHaveLength(4);
    expect(P.rows).toHaveLength(2);
    expect(layout.sim.bays).toHaveLength(8);
  });

  it('keeps every bay inside the lot surface', () => {
    const half = P.baySpacing / 2;
    for (const bay of layout.sim.bays) {
      expect(bay.x - half).toBeGreaterThanOrEqual(P.lot.x[0]);
      expect(bay.x + half).toBeLessThanOrEqual(P.lot.x[1]);
      expect(bay.z).toBeGreaterThan(P.lot.z[0]);
      expect(bay.z).toBeLessThan(P.lot.z[1]);
    }
  });

  it('separates the two rows with the aisle, overlapping neither', () => {
    const [rowA, rowB] = P.rows;
    expect(rowA.z[1]).toBeLessThanOrEqual(P.aisle.z[0]);
    expect(rowB.z[0]).toBeGreaterThanOrEqual(P.aisle.z[1]);
  });

  it('faces the two rows in opposite directions', () => {
    const [rowA, rowB] = P.rows;
    expect(rowA.facing).toBeCloseTo(Math.PI, 5);
    expect(rowB.facing).toBeCloseTo(0, 5);
  });

  it('gives every bay room for a car', () => {
    const [rowA] = P.rows;
    expect(P.baySpacing).toBeGreaterThan(layout.sim.car.width);
    expect(rowA.z[1] - rowA.z[0]).toBeGreaterThan(layout.sim.car.length);
  });

  it('makes both island gaps wider than a car', () => {
    for (const gap of [P.entrance, P.exit]) {
      expect(gap.x[1] - gap.x[0]).toBeGreaterThan(layout.sim.car.width);
    }
  });

  it('puts the entrance and exit gaps on opposite sides', () => {
    expect(P.entrance.centreX).toBeGreaterThan(0);
    expect(P.exit.centreX).toBeLessThan(0);
  });

  it('keeps the walkway off every bay', () => {
    const half = P.baySpacing / 2;
    for (const bay of layout.sim.bays) {
      expect(Math.abs(P.walkwayX - bay.x)).toBeGreaterThanOrEqual(half - 1e-9);
    }
  });

  it('keeps the walkway clear of the entrance driving path', () => {
    const halfCar = layout.sim.car.width / 2;
    expect(Math.abs(P.walkwayX - P.entrance.centreX)).toBeGreaterThan(halfCar + 0.5);
  });

  it('spaces four lanes evenly inside the road band', () => {
    const lanes = layout.ground.lanes;
    expect(lanes).toHaveLength(4);
    for (const lane of lanes) {
      expect(lane.z).toBeGreaterThan(layout.ground.road.z[0]);
      expect(lane.z).toBeLessThan(layout.ground.road.z[1]);
    }
    const gaps = lanes.slice(1).map((l, i) => l.z - lanes[i].z);
    for (const gap of gaps) expect(gap).toBeCloseTo(gaps[0], 5);
  });

  it('runs the two inner lanes toward -X and the outer two toward +X', () => {
    const dirs = layout.ground.lanes.map((l) => l.direction);
    expect(dirs).toEqual([-1, -1, 1, 1]);
  });

  it('leaves the island between the lot and the road', () => {
    expect(layout.parking.island.z[0]).toBeGreaterThanOrEqual(layout.parking.lot.z[1]);
    expect(layout.parking.island.z[1]).toBeLessThanOrEqual(layout.ground.road.z[0]);
  });
});

describe('layout.queue.sellZone', () => {
  const zone = layout.queue.sellZone;
  const { cashier } = layout.queue;
  const { counter } = layout;

  it('starts the cashier inside the sell zone, so the shop sells from the first frame', () => {
    expect(cashier.x).toBeGreaterThan(zone.x[0]);
    expect(cashier.x).toBeLessThan(zone.x[1]);
    expect(cashier.z).toBeGreaterThan(zone.z[0]);
    expect(cashier.z).toBeLessThan(zone.z[1]);
  });

  it('sits on the kitchen side of the counter, clear of the return leg and the island', () => {
    expect(zone.z[1]).toBeLessThanOrEqual(counter.main.z[0]);
    expect(zone.x[0]).toBeGreaterThanOrEqual(counter.main.x[0]);
    expect(zone.x[1]).toBeLessThanOrEqual(counter.ret.x[0] - counter.overhang);
    expect(zone.z[0]).toBeGreaterThan(layout.kitchen.island.z[1]);
  });
});

describe('layout.oven.pickupZone', () => {
  const zone = layout.oven.pickupZone;
  const centre = [(zone.x[0] + zone.x[1]) / 2, (zone.z[0] + zone.z[1]) / 2];

  it('lets the player stand in the middle of the pickup zone', () => {
    expect(hitsObstacle(centre[0], centre[1], PLAYER_RADIUS, playerObstacles(layout))).toBe(false);
  });

  it('sits in front of the oven mouth, clear of the oven and the island', () => {
    expect(zone.x[1]).toBeLessThanOrEqual(layout.oven.base.x[0]);
    expect(zone.x[0]).toBeGreaterThan(layout.kitchen.island.x[1]);
    const mouthZ = layout.oven.dome.center[2];
    expect(mouthZ).toBeGreaterThan(zone.z[0]);
    expect(mouthZ).toBeLessThan(zone.z[1]);
  });

  it('gives every pizza timing and limit a positive value', () => {
    const p = layout.sim.pizza;
    const values = [
      p.bakeSeconds, p.ovenCapacity, p.pickupSeconds, p.carryMax,
      p.hopSeconds, p.carriedBox.size, p.carriedBox.thickness,
    ];
    for (const v of values) expect(v).toBeGreaterThan(0);
  });
});
