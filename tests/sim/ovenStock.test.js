import { describe, it, expect } from 'vitest';
import { createOvenStock } from '../../src/sim/ovenStock.js';
import { layout } from '../../src/layout.js';

const dt = 1 / 60;
const away = { inZone: false, room: 10 };
const inZone = { inZone: true, room: 10 };

function run(oven, seconds, state = away) {
  let released = 0;
  for (let t = 0; t < seconds - 1e-9; t += dt) released += oven.update(dt, state);
  return released;
}

describe('createOvenStock', () => {
  it('starts empty', () => {
    expect(createOvenStock(layout).stock).toBe(0);
  });

  it('bakes one pizza every 5 seconds', () => {
    const oven = createOvenStock(layout);
    run(oven, 4.9);
    expect(oven.stock).toBe(0);
    run(oven, 0.2);
    expect(oven.stock).toBe(1);
    run(oven, 5);
    expect(oven.stock).toBe(2);
  });

  it('stops at 10 and needs a full bake after one is taken', () => {
    const oven = createOvenStock(layout);
    run(oven, 60);
    expect(oven.stock).toBe(10);
    expect(oven.update(dt, inZone)).toBe(1);
    expect(oven.stock).toBe(9);
    run(oven, 4.8);
    expect(oven.stock).toBe(9);
    run(oven, 0.4);
    expect(oven.stock).toBe(10);
  });

  it('hands out one pizza on entering, then one every 0.3 seconds', () => {
    const oven = createOvenStock(layout);
    run(oven, 55);
    expect(oven.update(dt, inZone)).toBe(1);
    expect(run(oven, 0.25, inZone)).toBe(0);
    expect(run(oven, 0.1, inZone)).toBe(1);
  });

  it('hands out nothing when the oven is empty or the hands are full', () => {
    const empty = createOvenStock(layout);
    expect(empty.update(dt, inZone)).toBe(0);

    const full = createOvenStock(layout);
    run(full, 6);
    expect(full.update(dt, { inZone: true, room: 0 })).toBe(0);
    expect(full.stock).toBe(1);
  });

  it('stops handing out when the player leaves, and starts again at once on return', () => {
    const oven = createOvenStock(layout);
    run(oven, 55);
    expect(oven.update(dt, inZone)).toBe(1);
    expect(run(oven, 2)).toBe(0);
    expect(oven.update(dt, inZone)).toBe(1);
  });

  it('hands a pizza over as soon as it bakes while the player waits', () => {
    const oven = createOvenStock(layout);
    expect(run(oven, 4.9, inZone)).toBe(0);
    expect(run(oven, 0.2, inZone)).toBe(1);
    expect(oven.stock).toBe(0);
  });
});
