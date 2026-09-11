import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createPlayer } from '../../src/sim/player.js';
import { layout } from '../../src/layout.js';
import { stubMaterials } from '../helpers/stubs.js';

const spawn = layout.queue.cashier;
const speed = layout.sim.speeds.walk;
const ground = layout.envelopes.ground;

function player() {
  return createPlayer(stubMaterials(), layout);
}

function hold(p, keys, seconds, dt = 1 / 60) {
  const set = new Set(keys);
  for (let t = 0; t < seconds; t += dt) p.update(dt, set);
}

describe('createPlayer', () => {
  it('stands at the cashier spawn facing the customers', () => {
    const p = player();
    expect(p.figure.position.x).toBeCloseTo(spawn.x, 5);
    expect(p.figure.position.z).toBeCloseTo(spawn.z, 5);
    expect(p.figure.rotation.y).toBeCloseTo(spawn.facing, 5);
  });

  it('walks camera-forward on W, into the isometric view', () => {
    const p = player();
    hold(p, ['w'], 1);
    // Camera sits at (-X, +Z); W walks the opposite way on the ground: +X, -Z.
    const step = speed / Math.sqrt(2);
    expect(p.figure.position.x).toBeCloseTo(spawn.x + step, 3);
    expect(p.figure.position.z).toBeCloseTo(spawn.z - step, 3);
  });

  it('strafes camera-right on D and camera-left on A', () => {
    const right = player();
    hold(right, ['d'], 0.15);
    // Screen-right is +X, +Z: look × up for a camera sitting at (-X, +Z).
    const step = speed / Math.sqrt(2) * 0.15;
    expect(right.figure.position.x).toBeCloseTo(spawn.x + step, 3);
    expect(right.figure.position.z).toBeCloseTo(spawn.z + step, 3);

    const left = player();
    hold(left, ['a'], 0.15);
    expect(left.figure.position.x).toBeCloseTo(spawn.x - step, 3);
    expect(left.figure.position.z).toBeCloseTo(spawn.z - step, 3);
  });

  it('does not go faster when two keys are held', () => {
    const p = player();
    hold(p, ['w', 'd'], 1);
    const dx = p.figure.position.x - spawn.x;
    const dz = p.figure.position.z - spawn.z;
    expect(Math.hypot(dx, dz)).toBeCloseTo(speed, 3);
  });

  it('stops when the keys are released', () => {
    const p = player();
    hold(p, ['w'], 0.5);
    const x = p.figure.position.x;
    const z = p.figure.position.z;
    p.update(1, new Set());
    expect(p.figure.position.x).toBeCloseTo(x, 5);
    expect(p.figure.position.z).toBeCloseTo(z, 5);
  });

  it('faces the direction of travel', () => {
    const p = player();
    hold(p, ['w'], 0.2);
    expect(p.figure.rotation.y).toBeCloseTo(Math.atan2(1, -1), 5);
  });

  it('swings its limbs while walking and settles when idle', () => {
    const p = player();
    const { legL, armR } = p.figure.userData.limbs;
    expect(legL.rotation.x).toBe(0);
    hold(p, ['s'], 0.3);
    expect(Math.abs(legL.rotation.x)).toBeGreaterThan(0.05);
    expect(Math.abs(armR.rotation.x)).toBeGreaterThan(0.02);
    hold(p, [], 2);
    expect(Math.abs(legL.rotation.x)).toBeLessThan(0.01);
  });

  it('stays inside the lot when walking into the edge', () => {
    const p = player();
    hold(p, ['w'], 60);
    expect(p.figure.position.x).toBeGreaterThanOrEqual(ground.min[0]);
    expect(p.figure.position.x).toBeLessThanOrEqual(ground.max[0]);
    expect(p.figure.position.z).toBeGreaterThanOrEqual(ground.min[2]);
    expect(p.figure.position.z).toBeLessThanOrEqual(ground.max[2]);
  });

  it('cannot walk through the service counter', () => {
    const p = player();
    hold(p, ['s', 'd'], 4);
    expect(p.figure.position.z).toBeLessThan(layout.counter.main.z[0]);
    const stopped = p.figure.position.z;
    hold(p, ['s', 'd'], 1);
    expect(p.figure.position.z).toBeCloseTo(stopped, 3);
  });

  it('slides along the counter when walking diagonally into it', () => {
    const p = player();
    hold(p, ['d'], 1);
    expect(p.figure.position.x).toBeGreaterThan(spawn.x + 0.5);
    expect(p.figure.position.z).toBeLessThan(layout.counter.main.z[0]);
  });
});

describe('carrying pizzas', () => {
  const { carryMax } = layout.sim.pizza;

  it('starts empty-handed', () => {
    expect(player().carried).toBe(0);
  });

  it('keeps the carried count between zero and the carry limit', () => {
    const p = player();
    for (let i = 0; i < carryMax + 5; i++) p.receive();
    expect(p.carried).toBe(carryMax);
    for (let i = 0; i < carryMax + 5; i++) p.handOver();
    expect(p.carried).toBe(0);
  });

  it('holds the stack in front of its chest, above the counter top', () => {
    const p = player();
    expect(p.stack.parent).toBe(p.figure);
    const slot = p.stack.userData.slotPosition(0, new THREE.Vector3());
    // The cashier spawns facing +Z, so in front means larger z.
    expect(slot.z).toBeGreaterThan(p.figure.position.z + 0.2);
    expect(slot.y).toBeGreaterThan(layout.counter.topHeight);
  });

  it('holds both arms forward while carrying, even when walking', () => {
    const p = player();
    p.receive();
    hold(p, ['s'], 0.5);
    const { armL, armR, legL } = p.figure.userData.limbs;
    expect(armL.rotation.x).toBeCloseTo(-Math.PI / 2, 5);
    expect(armR.rotation.x).toBeCloseTo(-Math.PI / 2, 5);
    expect(Math.abs(legL.rotation.x)).toBeGreaterThan(0.05);
  });

  it('swings its arms again once its hands are empty', () => {
    const p = player();
    p.receive();
    hold(p, ['s'], 0.2);
    p.handOver();
    const keys = new Set(['s']);
    let swinging = 0;
    for (let t = 0; t < 0.6; t += 1 / 60) {
      p.update(1 / 60, keys);
      const armR = p.figure.userData.limbs.armR.rotation.x;
      if (Math.abs(armR + Math.PI / 2) > 0.5) swinging++;
    }
    expect(swinging).toBeGreaterThan(10);
  });

  it('puts the stack where the tips of the carrying arms meet', () => {
    const p = player();
    p.receive();
    p.update(1 / 60, new Set());
    p.figure.updateMatrixWorld(true);
    const arm = new THREE.Box3().setFromObject(p.figure.userData.limbs.armR);
    const stack = p.stack.getWorldPosition(new THREE.Vector3());
    expect(arm.max.z).toBeCloseTo(stack.z, 3);
    expect((arm.min.y + arm.max.y) / 2).toBeCloseTo(stack.y, 3);
  });
});
