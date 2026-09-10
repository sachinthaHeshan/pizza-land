import { describe, it, expect } from 'vitest';
import { createCustomer, STATES } from '../../src/sim/customer.js';
import { createPool } from '../../src/sim/pool.js';
import { layout } from '../../src/layout.js';
import { stubMaterials } from '../helpers/stubs.js';

// Hands out slot 1 as if someone were already at the counter, then reports
// every slot free — so a lone customer still exercises QUEUEING and the
// shuffle forward into slot 0.
function world() {
  return {
    bays: createPool(layout.sim.bays),
    isSlotFree() {
      return true;
    },
    firstFreeSlot() {
      return 1;
    },
  };
}

function run(customer, w, seconds, dt = 1 / 60, onStep) {
  for (let t = 0; t < seconds; t += dt) {
    customer.update(dt, w);
    if (onStep) onStep();
  }
}

describe('createCustomer', () => {
  it('starts idle and hidden', () => {
    const customer = createCustomer(stubMaterials(), layout, { index: 0 });
    expect(customer.state).toBe('IDLE');
    expect(customer.group.visible).toBe(false);
  });

  it('visits every state in cycle order across one loop', () => {
    const customer = createCustomer(stubMaterials(), layout, { index: 0 });
    const w = world();
    const seen = [];
    customer.start(0);
    run(customer, w, 120, 1 / 60, () => {
      if (seen[seen.length - 1] !== customer.state) seen.push(customer.state);
    });
    const ordered = seen.filter((s) => s !== 'IDLE');
    for (const state of STATES.filter((s) => s !== 'IDLE')) {
      expect(ordered, `missing ${state}`).toContain(state);
    }
    const indices = ordered.map((s) => STATES.indexOf(s));
    for (let i = 1; i < indices.length; i++) {
      expect(indices[i] === indices[i - 1] + 1 || indices[i] < indices[i - 1]).toBe(true);
    }
  });

  it('never teleports the car or the figure', () => {
    const customer = createCustomer(stubMaterials(), layout, { index: 0 });
    const w = world();
    customer.start(0);
    const dt = 1 / 60;
    // The group itself sits at the origin; the car and figure are what travel,
    // so watching group.position would pass vacuously.
    const capCar = layout.sim.speeds.car * dt * 1.5;
    const capWalk = layout.sim.speeds.walk * dt * 1.5;
    const driving = ['APPROACHING', 'DEPARTING'];
    const walking = ['WALKING_IN', 'QUEUEING', 'WALKING_OUT'];
    let lastCar = null;
    let lastFigure = null;
    run(customer, w, 120, dt, () => {
      if (driving.includes(customer.state)) {
        const p = customer.car.position.clone();
        if (lastCar) expect(p.distanceTo(lastCar)).toBeLessThanOrEqual(capCar + 1e-6);
        lastCar = p;
      } else {
        lastCar = null;
      }
      if (walking.includes(customer.state)) {
        const p = customer.figure.position.clone();
        if (lastFigure) expect(p.distanceTo(lastFigure)).toBeLessThanOrEqual(capWalk + 1e-6);
        lastFigure = p;
      } else {
        lastFigure = null;
      }
    });
  });

  it('carries the box only between the counter and boarding', () => {
    const customer = createCustomer(stubMaterials(), layout, { index: 0 });
    const w = world();
    customer.start(0);
    run(customer, w, 120, 1 / 60, () => {
      if (['IDLE', 'APPROACHING', 'PARKING', 'WALKING_IN', 'QUEUEING'].includes(customer.state)) {
        expect(customer.hasBox, `box during ${customer.state}`).toBe(false);
      }
      if (customer.state === 'WALKING_OUT') {
        expect(customer.hasBox, 'no box while walking out').toBe(true);
      }
    });
  });

  it('completes more than one full loop and frees its bay each time', () => {
    const customer = createCustomer(stubMaterials(), layout, { index: 0 });
    const w = world();
    customer.start(0);
    let loops = 0;
    let previous = null;
    run(customer, w, 200, 1 / 60, () => {
      if (previous === 'DEPARTING' && customer.state === 'IDLE') {
        loops++;
        expect(customer.bay).toBeNull();
        expect(customer.slot).toBeNull();
      }
      previous = customer.state;
    });
    expect(loops).toBeGreaterThanOrEqual(1);
  });

  it('reaches the counter slot while being served', () => {
    const customer = createCustomer(stubMaterials(), layout, { index: 0 });
    const w = world();
    customer.start(0);
    let servedAt = null;
    run(customer, w, 120, 1 / 60, () => {
      if (customer.state === 'AT_COUNTER' && !servedAt) {
        servedAt = customer.figurePosition();
      }
    });
    expect(servedAt).not.toBeNull();
    expect(servedAt.x).toBeCloseTo(layout.queue.slots[0][0], 1);
    expect(servedAt.z).toBeCloseTo(layout.queue.slots[0][1], 1);
  });

  it('swings its legs while walking and settles them when still', () => {
    const customer = createCustomer(stubMaterials(), layout, { index: 0 });
    const w = world();
    customer.start(0);
    let swungWhileWalking = 0;
    let restAtCounter = null;
    run(customer, w, 120, 1 / 60, () => {
      const legs = customer.figure.userData.limbs.legL.rotation.x;
      if (customer.state === 'WALKING_IN' && Math.abs(legs) > 0.05) swungWhileWalking++;
      if (customer.state === 'AT_COUNTER') restAtCounter = legs;
    });
    expect(swungWhileWalking).toBeGreaterThan(10);
    expect(Math.abs(restAtCounter)).toBeLessThan(0.2);
  });
});
