import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createSimulation } from '../../src/sim/simulation.js';
import { slotPosition } from '../../src/sim/paths.js';
import { layout } from '../../src/layout.js';
import { stubMaterials } from '../helpers/stubs.js';

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

  it('adds $5 each time a pizza is sold at the counter', () => {
    const sim = createSimulation(stubMaterials(), layout);
    sim.world.recordSale();
    expect(sim.balance).toBe(5);
    sim.world.recordSale();
    expect(sim.balance).toBe(10);
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
