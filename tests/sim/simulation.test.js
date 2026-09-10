import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createSimulation } from '../../src/sim/simulation.js';
import { STATES } from '../../src/sim/customer.js';
import { layout } from '../../src/layout.js';
import { stubMaterials } from '../helpers/stubs.js';

function stepped(seconds, dt = 1 / 60, onStep) {
  const sim = createSimulation(stubMaterials(), layout);
  for (let t = 0; t < seconds; t += dt) {
    sim.update(dt);
    if (onStep) onStep(sim);
  }
  return sim;
}

describe('createSimulation', () => {
  it('returns a named group holding one child per customer', () => {
    const sim = createSimulation(stubMaterials(), layout);
    expect(sim.group).toBeInstanceOf(THREE.Group);
    expect(sim.group.name).toBe('simulation');
    expect(sim.group.children).toHaveLength(layout.sim.customers);
    expect(sim.customers).toHaveLength(layout.sim.customers);
  });

  it('never lets two customers hold the same bay', () => {
    stepped(240, 1 / 60, (sim) => {
      const held = sim.customers.map((c) => c.bay).filter((b) => b !== null);
      expect(new Set(held).size).toBe(held.length);
    });
  });

  it('never lets two customers hold the same queue slot', () => {
    stepped(240, 1 / 60, (sim) => {
      const held = sim.customers.map((c) => c.slot).filter((s) => s !== null);
      expect(new Set(held).size).toBe(held.length);
    });
  });

  it('keeps every customer in a valid state', () => {
    stepped(240, 1 / 60, (sim) => {
      for (const customer of sim.customers) {
        expect(STATES).toContain(customer.state);
      }
    });
  });

  it('does not grow the scene graph over time', () => {
    const sim = createSimulation(stubMaterials(), layout);
    const count = () => {
      let n = 0;
      sim.group.traverse(() => n++);
      return n;
    };
    const before = count();
    for (let t = 0; t < 240; t += 1 / 60) sim.update(1 / 60);
    expect(count()).toBe(before);
  });

  it('gets everyone served at least once over a long run', () => {
    const served = new Set();
    stepped(300, 1 / 60, (sim) => {
      sim.customers.forEach((c, i) => {
        if (c.state === 'AT_COUNTER') served.add(i);
      });
    });
    expect(served.size).toBe(layout.sim.customers);
  });

  it('has somebody visible most of the time once warmed up', () => {
    let visibleSteps = 0;
    let total = 0;
    const sim = createSimulation(stubMaterials(), layout);
    for (let t = 0; t < 300; t += 1 / 60) {
      sim.update(1 / 60);
      if (t > 30) {
        total++;
        if (sim.customers.some((c) => c.group.visible)) visibleSteps++;
      }
    }
    expect(visibleSteps / total).toBeGreaterThan(0.9);
  });
});
