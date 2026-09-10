import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createSimulation } from '../../src/sim/simulation.js';
import { layout } from '../../src/layout.js';
import { stubMaterials } from '../helpers/stubs.js';

describe('createSimulation', () => {
  it('returns a named group with one child per pedestrian', () => {
    const sim = createSimulation(stubMaterials(), layout);
    expect(sim.group).toBeInstanceOf(THREE.Group);
    expect(sim.group.name).toBe('simulation');
    expect(sim.pedestrians).toHaveLength(layout.sim.pedestrians);
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
  // dead code while every other test passed.
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
    expect(maxParked).toBe(layout.sim.bays.length);
    expect(waited).toBe(true);
    expect(honks).toBeGreaterThan(0);
  });
});
