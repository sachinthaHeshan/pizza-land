import { describe, it, expect } from 'vitest';
import { playerObstacles, slideMove, PLAYER_RADIUS } from '../../src/sim/obstacles.js';
import { layout } from '../../src/layout.js';

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
});
