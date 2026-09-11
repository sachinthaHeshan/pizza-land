import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createSimulation } from '../../src/sim/simulation.js';
import { slotPosition } from '../../src/sim/paths.js';
import { layout } from '../../src/layout.js';
import { stubMaterials } from '../helpers/stubs.js';

// Walks the cashier out of the sell zone, then runs until a customer is
// standing at the counter with nobody there to serve them.
function leaveCustomerWaiting(sim) {
  const step = 1 / 60;
  for (let t = 0; t < 1; t += step) sim.update(step, new Set(['w']));
  const waiting = () => sim.pedestrians.some((p) => p.state === 'AT_COUNTER');
  for (let t = 0; t < 90 && !waiting(); t += step) sim.update(step);
  expect(waiting()).toBe(true);
}

const STEP = 1 / 60;

function run(sim, seconds, keys) {
  for (let t = 0; t < seconds - 1e-9; t += STEP) sim.update(STEP, keys);
}

function standIn(sim, zone) {
  sim.player.figure.position.set((zone.x[0] + zone.x[1]) / 2, 0, (zone.z[0] + zone.z[1]) / 2);
}

function waitForCustomer(sim) {
  const atCounter = () => sim.pedestrians.find((p) => p.state === 'AT_COUNTER');
  for (let t = 0; t < 90 && !atCounter(); t += STEP) sim.update(STEP);
  expect(atCounter()).toBeTruthy();
  return atCounter();
}

const zoneBanner = (point) => point.getObjectByName('zoneBanner');

// Runs the loop and reports how far a marker's beam opacity swung.
function glowSwing(sim, point, seconds = 2) {
  const beam = point.getObjectByName('zoneBeam');
  const seen = [];
  for (let t = 0; t < seconds; t += STEP) {
    sim.update(STEP);
    seen.push(beam.material.opacity);
  }
  return Math.max(...seen) - Math.min(...seen);
}

describe('createSimulation', () => {
  it('returns a named group with one child per pedestrian', () => {
    const sim = createSimulation(stubMaterials(), layout);
    expect(sim.group).toBeInstanceOf(THREE.Group);
    expect(sim.group.name).toBe('simulation');
    expect(sim.pedestrians).toHaveLength(layout.sim.pedestrians);
  });

  it('owns the cashier as the player, standing behind the counter', () => {
    const sim = createSimulation(stubMaterials(), layout);
    expect(sim.player.figure.parent).toBe(sim.group);
    expect(sim.player.figure.position.x).toBeCloseTo(layout.queue.cashier.x, 5);
    expect(sim.player.figure.position.z).toBeCloseTo(layout.queue.cashier.z, 5);
  });

  it('moves the player when update is given WASD keys', () => {
    const sim = createSimulation(stubMaterials(), layout);
    const startX = sim.player.figure.position.x;
    for (let t = 0; t < 1; t += 1 / 60) sim.update(1 / 60, new Set(['w']));
    expect(sim.player.figure.position.x).toBeGreaterThan(startX + 0.5);
  });

  it('starts with a $0 balance', () => {
    const sim = createSimulation(stubMaterials(), layout);
    expect(sim.balance).toBe(0);
  });

  it('takes $5 and one carried pizza for each sale', () => {
    const sim = createSimulation(stubMaterials(), layout);
    const [customer] = sim.pedestrians;
    sim.player.receive();
    sim.player.receive();
    sim.world.recordSale(customer);
    expect(sim.balance).toBe(5);
    expect(sim.player.carried).toBe(1);
  });

  it('marks the sell and oven zones in the scene', () => {
    const sim = createSimulation(stubMaterials(), layout);
    expect(sim.sellPoint.parent).toBe(sim.group);
    expect(sim.ovenPoint.parent).toBe(sim.group);
    expect(sim.hops.group.parent).toBe(sim.group);
  });

  it('serves only from inside the sell zone with a pizza in hand', () => {
    const sim = createSimulation(stubMaterials(), layout);
    expect(sim.world.canServe()).toBe(false);
    sim.player.receive();
    expect(sim.world.canServe()).toBe(true);
    run(sim, 1, new Set(['w']));
    expect(sim.world.canServe()).toBe(false);
  });

  it('holds every sale until the cashier walks back into the sell zone', () => {
    const sim = createSimulation(stubMaterials(), layout);
    sim.player.receive();
    leaveCustomerWaiting(sim);
    run(sim, 10);
    expect(sim.balance).toBe(0);

    standIn(sim, layout.queue.sellZone);
    run(sim, layout.sim.serveSeconds + 0.5);
    expect(sim.balance).toBe(5);
    expect(sim.player.carried).toBe(0);
  });

  it('never sells from empty hands, even inside the sell zone', () => {
    const sim = createSimulation(stubMaterials(), layout);
    waitForCustomer(sim);
    run(sim, 10);
    expect(sim.balance).toBe(0);
  });

  it('bakes, hands pizzas over one by one, and sells them at the cashier', () => {
    const sim = createSimulation(stubMaterials(), layout);
    const { bakeSeconds, pickupSeconds } = layout.sim.pizza;
    run(sim, bakeSeconds * 2 + 0.5);
    expect(sim.oven.stock).toBe(2);

    standIn(sim, layout.oven.pickupZone);
    sim.update(STEP);
    expect(sim.player.carried).toBe(1);
    run(sim, pickupSeconds + 0.1);
    expect(sim.player.carried).toBe(2);
    expect(sim.oven.stock).toBe(0);

    standIn(sim, layout.queue.sellZone);
    for (let t = 0; t < 90 && sim.balance === 0; t += STEP) sim.update(STEP);
    expect(sim.balance).toBe(5);
    expect(sim.player.carried).toBe(1);
  });

  it('stops handing pizzas over once the hands are full', () => {
    const sim = createSimulation(stubMaterials(), layout);
    const { carryMax, bakeSeconds } = layout.sim.pizza;
    for (let i = 0; i < carryMax - 1; i++) sim.player.receive();
    standIn(sim, layout.oven.pickupZone);
    run(sim, bakeSeconds * 2 + 0.5);
    expect(sim.player.carried).toBe(carryMax);
    expect(sim.oven.stock).toBe(1);
  });

  it('lands each picked-up pizza on the stack after its hop', () => {
    const sim = createSimulation(stubMaterials(), layout);
    const shown = () => sim.player.stack.children.filter((box) => box.visible).length;
    run(sim, layout.sim.pizza.bakeSeconds + 0.5);
    standIn(sim, layout.oven.pickupZone);
    sim.update(STEP);
    expect(sim.player.carried).toBe(1);
    expect(shown()).toBe(0);
    run(sim, layout.sim.pizza.hopSeconds + 0.05);
    expect(shown()).toBe(1);
  });

  it('flies the sold box to the customer before it reaches their hands', () => {
    const sim = createSimulation(stubMaterials(), layout);
    sim.player.receive();
    const customer = waitForCustomer(sim);
    for (let t = 0; t < 10 && sim.balance === 0; t += STEP) sim.update(STEP);
    expect(sim.balance).toBe(5);
    expect(customer.hasBox).toBe(false);
    run(sim, layout.sim.pizza.hopSeconds + 0.05);
    expect(customer.hasBox).toBe(true);
  });

  it('points an empty-handed player at the oven while customers wait', () => {
    const sim = createSimulation(stubMaterials(), layout);
    leaveCustomerWaiting(sim);
    expect(glowSwing(sim, sim.ovenPoint)).toBeGreaterThan(0.1);
    expect(glowSwing(sim, sim.sellPoint)).toBeLessThan(1e-6);
    expect(zoneBanner(sim.sellPoint).visible).toBe(false);
  });

  it('points a player carrying pizzas at the cashier while customers wait', () => {
    const sim = createSimulation(stubMaterials(), layout);
    sim.player.receive();
    leaveCustomerWaiting(sim);
    expect(zoneBanner(sim.sellPoint).visible).toBe(true);
    expect(glowSwing(sim, sim.sellPoint)).toBeGreaterThan(0.1);
    expect(glowSwing(sim, sim.ovenPoint)).toBeLessThan(1e-6);
  });

  it('calls nobody over when no one waits or the player is already selling', () => {
    const sim = createSimulation(stubMaterials(), layout);
    sim.update(STEP);
    expect(zoneBanner(sim.sellPoint).visible).toBe(false);
    expect(glowSwing(sim, sim.ovenPoint, 1)).toBeLessThan(1e-6);

    for (let i = 0; i < 3; i++) sim.player.receive();
    waitForCustomer(sim);
    expect(zoneBanner(sim.sellPoint).visible).toBe(false);
    expect(glowSwing(sim, sim.sellPoint, 1)).toBeLessThan(1e-6);
    expect(glowSwing(sim, sim.ovenPoint, 1)).toBeLessThan(1e-6);
  });

  it('always shows the oven banner with its current count', () => {
    const sim = createSimulation(stubMaterials(), layout);
    const banner = zoneBanner(sim.ovenPoint);
    run(sim, layout.sim.pizza.bakeSeconds * 2 + 0.5);
    expect(banner.visible).toBe(true);
    expect(sim.oven.stock).toBe(2);
    expect(banner.material.map.userData.count).toBe(2);
  });

  it('keeps every pedestrian in a valid state while traffic runs', () => {
    const sim = createSimulation(stubMaterials(), layout);
    const valid = ['IDLE', 'WALKING_IN', 'QUEUEING', 'AT_COUNTER', 'WALKING_OUT', 'DONE'];
    for (let t = 0; t < 60; t += 1 / 60) {
      sim.update(1 / 60);
      for (const p of sim.pedestrians) expect(valid).toContain(p.state);
    }
  });

  it('never lets two pedestrians hold the same slot', () => {
    const sim = createSimulation(stubMaterials(), layout);
    sim.pedestrians.forEach((p, i) => p.start(layout.sim.bays[i]));
    for (let t = 0; t < 90; t += 1 / 60) {
      sim.update(1 / 60);
      const held = sim.pedestrians.map((p) => p.slot).filter((s) => s !== null);
      expect(new Set(held).size).toBe(held.length);
      for (const p of sim.pedestrians) {
        if (p.state === 'WALKING_IN') expect(p.slot).toBeNull();
      }
    }
  });

  it('does not let a walker from the car cut in front of people already in line', () => {
    const sim = createSimulation(stubMaterials(), layout);
    const dt = 1 / 60;
    const [inLine, walker] = sim.pedestrians;
    const bays = layout.sim.bays;

    inLine.start(bays[0]);
    for (let t = 0; t < 60 && inLine.state !== 'AT_COUNTER'; t += dt) sim.update(dt);
    expect(inLine.state).toBe('AT_COUNTER');
    expect(inLine.slot).toBe(0);

    walker.start(bays[1]);
    for (let t = 0; t < 20 && walker.state === 'WALKING_IN'; t += dt) {
      sim.update(dt);
      if (walker.state === 'WALKING_IN') expect(walker.slot).toBeNull();
      if (inLine.slot !== null && walker.slot !== null) {
        expect(walker.slot).toBeGreaterThan(inLine.slot);
      }
    }
  });

  it('does not freeze a customer beside the car when the marked slots are full', () => {
    const sim = createSimulation(stubMaterials(), layout);
    const dt = 1 / 60;
    const bays = layout.sim.bays;
    const waiting = sim.pedestrians[layout.queue.slots.length];

    sim.pedestrians.slice(0, layout.queue.slots.length).forEach((p, i) => p.start(bays[i]));
    for (let t = 0; t < 1; t += dt) sim.update(dt);

    waiting.start(bays[layout.queue.slots.length]);
    const door = waiting.figurePosition().clone();
    for (let t = 0; t < 2; t += dt) sim.update(dt);

    expect(waiting.state).toBe('WALKING_IN');
    expect(waiting.figurePosition().distanceTo(door)).toBeGreaterThan(0.5);
  });

  it('keeps the queue packed near the shop instead of drifting into the lot', () => {
    const sim = createSimulation(stubMaterials(), layout);
    const dt = 1 / 60;
    const lotZ = layout.parking.lot.z[0];
    sim.pedestrians.forEach((p, i) => p.start(layout.sim.bays[i]));
    for (let t = 0; t < 45; t += dt) {
      sim.update(dt);
      sim.pedestrians.forEach((p, i) => {
        if (p.isDone()) p.start(layout.sim.bays[i]);
      });
      for (const p of sim.pedestrians) {
        if (p.slot === null) continue;
        expect(p.slot).toBeLessThan(layout.sim.pedestrians);
        const dest = slotPosition(layout, p.slot);
        expect(dest[1], `slot ${p.slot} at z=${dest[1]}`).toBeLessThan(lotZ);
      }
    }
  });

  it('drives traffic and pedestrians together without throwing', () => {
    const sim = createSimulation(stubMaterials(), layout);
    for (let t = 0; t < 120; t += 1 / 60) sim.update(1 / 60);
    expect(sim.traffic.vehicles.some((v) => v.isActive())).toBe(true);
  });

  it('never hands one pedestrian to two vehicles', () => {
    const sim = createSimulation(stubMaterials(), layout);
    for (let t = 0; t < 180; t += 1 / 60) {
      sim.update(1 / 60);
      const busy = sim.pedestrians.filter((p) => p.state !== 'IDLE' && !p.isDone());
      expect(new Set(busy).size).toBe(busy.length);
    }
  });

  // This exists because the honk-and-balk behaviour was, at first, unreachable:
  // seekers arrived too slowly to ever fill the lot, so the whole feature was
  // dead code while every other test passed. A packed FIFO queue turns cars
  // around faster than walking to a far overflow slot, so the lot peaks at
  // seven of eight bays — still enough to force waiting and honking.
  it('fills the lot and makes somebody honk over a long run', () => {
    let honks = 0;
    const sim = createSimulation(stubMaterials(), layout, { horn: { play: () => honks++ } });
    let maxParked = 0;
    let waited = false;
    for (let t = 0; t < 480; t += 1 / 60) {
      sim.update(1 / 60);
      const parked = sim.traffic.vehicles.filter((v) => v.state === 'PARKED').length;
      maxParked = Math.max(maxParked, parked);
      if (sim.traffic.vehicles.some((v) => v.state === 'WAITING')) waited = true;
    }
    expect(maxParked).toBeGreaterThanOrEqual(layout.sim.bays.length - 1);
    expect(waited).toBe(true);
    expect(honks).toBeGreaterThan(0);
  });
});
