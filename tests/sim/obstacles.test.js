import { describe, it, expect } from 'vitest';
import { playerObstacles, slideMove, hitsObstacle, PLAYER_RADIUS } from '../../src/sim/obstacles.js';
import { layout } from '../../src/layout.js';
import { planTown } from '../../src/town/planTown.js';

const r = PLAYER_RADIUS;

function walk(startX, startZ, dx, dz, meters) {
  const obstacles = playerObstacles(layout);
  const dist = Math.hypot(dx, dz);
  const ux = dx / dist;
  const uz = dz / dist;
  const step = 0.02;
  let x = startX;
  let z = startZ;
  for (let travelled = 0; travelled < meters; travelled += step) {
    ({ x, z } = slideMove(x, z, ux * step, uz * step, r, obstacles));
  }
  return { x, z };
}

describe('playerObstacles', () => {
  it('stops a walker at the service counter', () => {
    const end = walk(2, 3, 0, 1, 3);
    expect(end.z).toBeLessThan(layout.counter.main.z[0]);
    expect(end.z).toBeGreaterThan(2.9);
  });

  it('lets them slide along the counter instead of sticking', () => {
    const end = walk(2, 3.2, 1, 1, 2);
    expect(end.x).toBeGreaterThan(3);
    expect(end.z).toBeLessThan(layout.counter.main.z[0]);
  });

  it('lets them walk through the storefront door', () => {
    const doorX = (layout.storefront.door.x[0] + layout.storefront.door.x[1]) / 2;
    const end = walk(doorX, 4, 0, -1, 4);
    expect(end.z).toBeLessThan(layout.storefront.z);
  });

  it('blocks the storefront wall beside the door', () => {
    const end = walk(-9, 4, 0, -1, 4);
    expect(end.z).toBeGreaterThan(layout.storefront.z);
  });

  it('stops them at the kitchen island', () => {
    const island = layout.kitchen.island;
    const end = walk(1, -2, 0, -1, 4);
    expect(end.z).toBeGreaterThan(island.z[1]);
  });

  // Guards that the oven pickup loop is actually walkable, not just that the
  // two zone centres happen to sit on open floor. A flood fill over the shop
  // at player scale is the only way a future kitchen prop couldn't sneak in
  // and sever the route without any test noticing.
  it('reaches the oven pickup zone on foot from the sell zone', () => {
    const obstacles = playerObstacles(layout);
    const cell = 0.1;
    const xMin = -12;
    const xMax = 10;
    const zMin = -8;
    const zMax = 9;
    const cols = Math.round((xMax - xMin) / cell) + 1;
    const rows = Math.round((zMax - zMin) / cell) + 1;

    const open = (col, row) =>
      !hitsObstacle(xMin + col * cell, zMin + row * cell, PLAYER_RADIUS, obstacles);
    const toCell = (x, z) => [
      Math.round((x - xMin) / cell),
      Math.round((z - zMin) / cell),
    ];

    const sellZone = layout.queue.sellZone;
    const pickupZone = layout.oven.pickupZone;
    const start = toCell((sellZone.x[0] + sellZone.x[1]) / 2, (sellZone.z[0] + sellZone.z[1]) / 2);
    const goal = toCell((pickupZone.x[0] + pickupZone.x[1]) / 2, (pickupZone.z[0] + pickupZone.z[1]) / 2);

    const visited = new Uint8Array(cols * rows);
    const index = (col, row) => row * cols + col;
    const queue = [start];
    visited[index(...start)] = 1;
    let reached = false;
    for (let head = 0; head < queue.length; head++) {
      const [col, row] = queue[head];
      if (col === goal[0] && row === goal[1]) {
        reached = true;
        break;
      }
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nc = col + dc;
        const nr = row + dr;
        if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;
        if (visited[index(nc, nr)]) continue;
        if (!open(nc, nr)) continue;
        visited[index(nc, nr)] = 1;
        queue.push([nc, nr]);
      }
    }

    expect(reached).toBe(true);
  });

  it('stops a walker at a town building', () => {
    const lot = planTown(layout).lots.find((l) => l.row === 'first');
    const middle = (lot.x[0] + lot.x[1]) / 2;
    const end = walk(middle, lot.z[0] - 4, 0, 1, 5);
    expect(end.z).toBeLessThan(lot.z[0]);
    expect(end.z).toBeGreaterThan(lot.z[0] - 0.6);
  });

  it('stops a walker at a kerb tree', () => {
    const tree = planTown(layout).trees.find((t) => t.z === layout.town.kerbStrip.treeZ);
    const end = walk(tree.x, tree.z - 1.5, 0, 1, 2);
    expect(end.z).toBeLessThan(tree.z - 0.25);
  });

  it('stops a walker at a kerb bench', () => {
    const bench = planTown(layout).props.find((p) => p.kind === 'bench' && p.z === layout.town.kerbStrip.benchZ);
    const end = walk(bench.x, bench.z - 1.5, 0, 1, 2);
    expect(end.z).toBeLessThan(bench.z - bench.size.d / 2);
  });

  // x 20 is a deliberate gap in the kerb line: the nearest lamp is at 18, the
  // nearest tree at 24, the nearest bench at 15. Walking the kerb top works
  // because every kerb footprint starts at z 41.35 or beyond, and a walker at
  // z 40.95 only reaches 41.20.
  it('lets a walker cross the road and follow the kerb', () => {
    const kerbTop = layout.ground.kerbs[1].z[1];
    const crossed = walk(20, 30, 0, 1, 11);
    expect(crossed.z).toBeGreaterThan(kerbTop);
    const along = walk(20, kerbTop + 0.05, 1, 0, 20);
    expect(along.x).toBeGreaterThan(39);
  });

  it('stops a walker at a dining table', () => {
    const spot = layout.dining.tables[0];
    const half = layout.dining.top.size / 2;
    // 3 m, not 2: a 2 m walk ends exactly on the table edge, so the test
    // could not tell being blocked from running out of distance.
    const end = walk(spot.x, spot.z + 2.5, 0, -1, 3);
    expect(end.z).toBeGreaterThan(spot.z + half);
    expect(end.z).toBeLessThan(spot.z + half + 0.6);
  });

  it('leaves every delivery zone reachable', () => {
    const obstacles = playerObstacles(layout);
    for (const [i, spot] of layout.dining.tables.entries()) {
      const cx = (spot.zone.x[0] + spot.zone.x[1]) / 2;
      const cz = (spot.zone.z[0] + spot.zone.z[1]) / 2;
      expect(hitsObstacle(cx, cz, r, obstacles), `zone ${i}`).toBe(false);
    }
  });
});
