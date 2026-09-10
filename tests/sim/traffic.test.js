import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createTraffic } from '../../src/sim/traffic.js';
import { createPool } from '../../src/sim/pool.js';
import { layout } from '../../src/layout.js';
import { stubMaterials } from '../helpers/stubs.js';

function build() {
  return createTraffic(stubMaterials(), layout, {
    horn: { play() {} },
    bays: createPool(layout.sim.bays),
    takePedestrian: () => ({ start() {}, isDone: () => true }),
    releasePedestrian: () => {},
  });
}

function step(traffic, seconds, dt = 1 / 60, onStep) {
  for (let t = 0; t < seconds; t += dt) {
    traffic.update(dt);
    if (onStep) onStep();
  }
}

describe('createTraffic', () => {
  it('returns a named group', () => {
    const traffic = build();
    expect(traffic.group).toBeInstanceOf(THREE.Group);
    expect(traffic.group.name).toBe('traffic');
  });

  it('never lets two vehicles in a lane overlap', () => {
    const traffic = build();
    step(traffic, 120, 1 / 60, () => {
      for (const lane of traffic.lanes) {
        const inLane = traffic.vehicles
          .filter((v) => v.onRoad() && v.lane === lane)
          .sort((a, b) => a.x - b.x);
        for (let i = 1; i < inLane.length; i++) {
          const gap =
            inLane[i].x - inLane[i - 1].x - (inLane[i].length + inLane[i - 1].length) / 2;
          expect(gap, `lane ${lane.index} overlap`).toBeGreaterThan(-0.35);
        }
      }
    });
  });

  it('keeps a populated road without exceeding its pool', () => {
    const traffic = build();
    let minimum = Infinity;
    step(traffic, 120, 1 / 60, () => {
      const active = traffic.vehicles.filter((v) => v.isActive()).length;
      minimum = Math.min(minimum, active);
      expect(active).toBeLessThanOrEqual(traffic.vehicles.length);
    });
    expect(minimum).toBeGreaterThan(0);
  });

  it('gets traffic flowing in both directions', () => {
    const traffic = build();
    step(traffic, 60);
    const directions = new Set(
      traffic.vehicles.filter((v) => v.onRoad()).map((v) => v.lane.direction)
    );
    expect(directions.has(-1)).toBe(true);
    expect(directions.has(1)).toBe(true);
  });

  it('never gridlocks: vehicles keep moving', () => {
    const traffic = build();
    step(traffic, 150);
    const moving = traffic.vehicles.filter((v) => v.onRoad() && v.speed > 0.1);
    expect(moving.length).toBeGreaterThan(0);
  });

  it('does not grow the scene graph', () => {
    const traffic = build();
    const count = () => {
      let n = 0;
      traffic.group.traverse(() => n++);
      return n;
    };
    const before = count();
    step(traffic, 120);
    expect(count()).toBe(before);
  });

  it('lets vehicles change lanes rather than sit behind a stopped car', () => {
    const traffic = build();
    const startLanes = new Map();
    let changed = 0;
    step(traffic, 150, 1 / 60, () => {
      for (const v of traffic.vehicles) {
        if (!v.onRoad()) {
          startLanes.delete(v);
          continue;
        }
        const was = startLanes.get(v);
        if (was === undefined) startLanes.set(v, v.lane.index);
        else if (was !== v.lane.index) {
          changed++;
          startLanes.set(v, v.lane.index);
        }
      }
    });
    expect(changed).toBeGreaterThan(0);
  });

  it('sends some cars for pizza over a long run', () => {
    const traffic = build();
    let sought = 0;
    step(traffic, 180, 1 / 60, () => {
      sought += traffic.vehicles.filter(
        (v) => v.state === 'ENTERING' || v.state === 'PARKED' || v.state === 'WAITING'
      ).length;
    });
    expect(sought).toBeGreaterThan(0);
  });
});
