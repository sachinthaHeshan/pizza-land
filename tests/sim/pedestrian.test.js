import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createPedestrian, PEDESTRIAN_STATES } from '../../src/sim/pedestrian.js';
import { layout } from '../../src/layout.js';
import { stubMaterials } from '../helpers/stubs.js';

const bay = layout.sim.bays[0];

// Hands out slot 1 as if someone were already at the counter, so a lone
// pedestrian still exercises QUEUEING and the shuffle forward into slot 0.
function world() {
  return {
    isSlotFree: () => true,
    queueLength: () => 1,
    enqueueSlot: () => 1,
    canServe: () => true,
    recordSale(pedestrian) {
      pedestrian.showBox();
    },
  };
}

function run(pedestrian, w, seconds, dt = 1 / 60, onStep) {
  for (let t = 0; t < seconds; t += dt) {
    pedestrian.update(dt, w);
    if (onStep) onStep();
  }
}

describe('createPedestrian', () => {
  it('starts idle and hidden', () => {
    const p = createPedestrian(stubMaterials(), layout, { index: 0 });
    expect(p.state).toBe('IDLE');
    expect(p.group.visible).toBe(false);
    expect(p.isDone()).toBe(false);
  });

  it('walks in, queues, buys and walks out, in order', () => {
    const p = createPedestrian(stubMaterials(), layout, { index: 0 });
    const w = world();
    const seen = [];
    p.start(bay);
    run(p, w, 90, 1 / 60, () => {
      if (seen[seen.length - 1] !== p.state) seen.push(p.state);
    });
    for (const state of ['WALKING_IN', 'QUEUEING', 'AT_COUNTER', 'WALKING_OUT', 'DONE']) {
      expect(seen, `missing ${state}`).toContain(state);
    }
    const order = seen.map((s) => PEDESTRIAN_STATES.indexOf(s));
    for (let i = 1; i < order.length; i++) expect(order[i]).toBeGreaterThan(order[i - 1]);
  });

  it('finishes back at the car door', () => {
    const p = createPedestrian(stubMaterials(), layout, { index: 0 });
    const w = world();
    p.start(bay);
    run(p, w, 90);
    expect(p.isDone()).toBe(true);
    const end = p.figurePosition();
    expect(end.x).toBeCloseTo(bay.x + layout.sim.walk.doorOffset, 1);
    expect(end.z).toBeCloseTo(bay.z, 1);
  });

  it('carries the box only after the counter', () => {
    const p = createPedestrian(stubMaterials(), layout, { index: 0 });
    const w = world();
    p.start(bay);
    run(p, w, 90, 1 / 60, () => {
      if (['IDLE', 'WALKING_IN', 'QUEUEING'].includes(p.state)) expect(p.hasBox).toBe(false);
      if (p.state === 'WALKING_OUT') expect(p.hasBox).toBe(true);
    });
  });

  it('records a sale when the pizza is handed over', () => {
    let sales = 0;
    const w = world();
    w.recordSale = () => sales++;
    const p = createPedestrian(stubMaterials(), layout, { index: 0 });
    p.start(bay);
    run(p, w, 90, 1 / 60, () => {
      if (['WALKING_IN', 'QUEUEING', 'AT_COUNTER'].includes(p.state)) expect(sales).toBe(0);
    });
    expect(sales).toBe(1);
  });

  it('holds the sale while the cashier is away from the sell zone', () => {
    let sales = 0;
    const w = world();
    w.canServe = () => false;
    w.recordSale = () => sales++;
    const p = createPedestrian(stubMaterials(), layout, { index: 0 });
    p.start(bay);
    run(p, w, 90);
    expect(p.state).toBe('AT_COUNTER');
    expect(p.hasBox).toBe(false);
    expect(sales).toBe(0);
  });

  it('keeps serving progress when the cashier steps away and comes back', () => {
    let sales = 0;
    let cashierIn = true;
    const w = world();
    w.canServe = () => cashierIn;
    w.recordSale = () => sales++;
    const serve = layout.sim.serveSeconds;
    const p = createPedestrian(stubMaterials(), layout, { index: 0 });
    p.start(bay);
    for (let t = 0; t < 90 && p.state !== 'AT_COUNTER'; t += 1 / 60) p.update(1 / 60, w);
    expect(p.state).toBe('AT_COUNTER');

    run(p, w, serve * 0.6);
    cashierIn = false;
    run(p, w, 10);
    expect(p.state).toBe('AT_COUNTER');
    expect(sales).toBe(0);

    // Short of a full serve on its own, so this only sells if the first
    // stint's progress was kept rather than reset.
    cashierIn = true;
    run(p, w, serve * 0.5);
    expect(sales).toBe(1);
  });

  it('never teleports', () => {
    const p = createPedestrian(stubMaterials(), layout, { index: 0 });
    const w = world();
    const dt = 1 / 60;
    const cap = layout.sim.speeds.walk * dt * 1.5;
    p.start(bay);
    let previous = null;
    run(p, w, 90, dt, () => {
      const at = p.figurePosition();
      if (previous && p.group.visible) {
        expect(at.distanceTo(previous)).toBeLessThanOrEqual(cap + 1e-6);
      }
      previous = at;
    });
  });

  it('can be restarted for another trip', () => {
    const p = createPedestrian(stubMaterials(), layout, { index: 0 });
    const w = world();
    p.start(bay);
    run(p, w, 90);
    expect(p.isDone()).toBe(true);
    p.start(layout.sim.bays[1]);
    expect(p.state).toBe('WALKING_IN');
    expect(p.isDone()).toBe(false);
  });

  it('passes itself to the sale and shows its box only when handed one', () => {
    const w = world();
    let buyer = null;
    w.recordSale = (pedestrian) => {
      buyer = pedestrian;
    };
    const p = createPedestrian(stubMaterials(), layout, { index: 0 });
    p.start(bay);
    for (let t = 0; t < 90 && p.state !== 'WALKING_OUT'; t += 1 / 60) p.update(1 / 60, w);
    expect(p.state).toBe('WALKING_OUT');
    expect(buyer).toBe(p);
    expect(p.hasBox).toBe(false);
    p.showBox();
    expect(p.hasBox).toBe(true);
  });

  it('reports where its hands hold the box', () => {
    const p = createPedestrian(stubMaterials(), layout, { index: 0 });
    p.start(bay);
    const at = p.boxPosition(new THREE.Vector3());
    const feet = p.figurePosition();
    expect(at.y).toBeGreaterThan(0.5);
    expect(Math.hypot(at.x - feet.x, at.z - feet.z)).toBeLessThan(0.5);
  });
});
