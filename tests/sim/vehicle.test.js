import { describe, it, expect } from 'vitest';
import { createVehicle, VEHICLE_STATES } from '../../src/sim/vehicle.js';
import { buildLanes } from '../../src/sim/lanes.js';
import { createPool } from '../../src/sim/pool.js';
import { layout } from '../../src/layout.js';
import { stubMaterials } from '../helpers/stubs.js';

const lanes = buildLanes(layout);
const carType = layout.traffic.types.find((t) => t.key === 'car');

function world({ bays = layout.sim.bays, pedestrian = true } = {}) {
  const pool = createPool(bays);
  return {
    lanes,
    bays: pool,
    leaderFor: () => null,
    laneIsClear: () => true,
    takePedestrian: () => (pedestrian ? { start() {}, isDone: () => true } : null),
    releasePedestrian: () => {},
  };
}

function run(vehicle, w, seconds, dt = 1 / 60, onStep) {
  for (let t = 0; t < seconds; t += dt) {
    vehicle.update(dt, w);
    if (onStep) onStep();
  }
}

const makeCar = () =>
  createVehicle(stubMaterials(), layout, { index: 0, type: carType, horn: { play() {} } });

describe('createVehicle', () => {
  it('is inactive until spawned', () => {
    const v = makeCar();
    expect(v.isActive()).toBe(false);
    expect(v.group.visible).toBe(false);
  });

  it('drives the length of the road and then deactivates', () => {
    const v = makeCar();
    const w = world();
    v.spawn(lanes[0], lanes[0].spawnX, false);
    expect(v.isActive()).toBe(true);
    run(v, w, 40);
    expect(v.isActive()).toBe(false);
  });

  it('keeps to its lane centre while cruising', () => {
    const v = makeCar();
    const w = world();
    v.spawn(lanes[2], lanes[2].spawnX, false);
    run(v, w, 5, 1 / 60, () => {
      expect(v.z).toBeCloseTo(lanes[2].z, 5);
    });
  });

  it('never steps further than its speed allows', () => {
    const v = makeCar();
    const w = world();
    const dt = 1 / 60;
    v.spawn(lanes[0], lanes[0].spawnX, true);
    let previous = { x: v.x, z: v.z };
    run(v, w, 60, dt, () => {
      const step = Math.hypot(v.x - previous.x, v.z - previous.z);
      expect(step).toBeLessThanOrEqual(carType.cruise * dt * 1.5 + 1e-6);
      previous = { x: v.x, z: v.z };
    });
  });

  it('parks when it wants pizza and a bay is free', () => {
    const v = makeCar();
    const w = world();
    v.spawn(lanes[0], lanes[0].spawnX, true);
    let parked = false;
    run(v, w, 60, 1 / 60, () => {
      if (v.state === 'PARKED') parked = true;
    });
    expect(parked).toBe(true);
  });

  it('honks and gives up when every bay is taken', () => {
    const v = makeCar();
    const w = world({ bays: [] });
    v.spawn(lanes[0], lanes[0].spawnX, true);
    let honkedFor = 0;
    const dt = 1 / 60;
    run(v, w, 60, dt, () => {
      if (v.state === 'WAITING') honkedFor += dt;
    });
    expect(honkedFor).toBeGreaterThan(layout.traffic.waitSeconds - 1);
    expect(honkedFor).toBeLessThan(layout.traffic.waitSeconds + 1);
  });

  it('clears its intent after balking, so it never tries again', () => {
    const v = makeCar();
    const w = world({ bays: [] });
    v.spawn(lanes[0], lanes[0].spawnX, true);
    run(v, w, 60);
    expect(v.wantsPizza).toBe(false);
  });

  it('stays in a valid state throughout', () => {
    const v = makeCar();
    const w = world();
    v.spawn(lanes[0], lanes[0].spawnX, true);
    run(v, w, 90, 1 / 60, () => {
      expect(VEHICLE_STATES).toContain(v.state);
    });
  });

  it('slows for a stopped leader instead of driving through it', () => {
    const v = makeCar();
    const stopped = { x: lanes[0].spawnX - 20, speed: 0, length: 4.2 };
    const w = { ...world(), leaderFor: () => stopped };
    v.spawn(lanes[0], lanes[0].spawnX, false);
    run(v, w, 20);
    const gap = Math.abs(v.x - stopped.x) - (v.length + stopped.length) / 2;
    expect(gap).toBeGreaterThanOrEqual(-1e-6);
  });
});
