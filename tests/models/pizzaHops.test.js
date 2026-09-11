import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createPizzaHops } from '../../src/models/pizzaHops.js';
import { layout } from '../../src/layout.js';
import { stubMaterials } from '../helpers/stubs.js';

const dt = 1 / 60;
const { hopSeconds } = layout.sim.pizza;
const flying = (hops) => hops.group.children.filter((box) => box.visible);

function run(hops, seconds) {
  for (let t = 0; t < seconds - 1e-9; t += dt) hops.update(dt);
}

describe('createPizzaHops', () => {
  it('returns a named group with nothing in flight', () => {
    const hops = createPizzaHops(stubMaterials(), layout);
    expect(hops.group).toBeInstanceOf(THREE.Group);
    expect(hops.group.name).toBe('pizzaHops');
    expect(flying(hops)).toHaveLength(0);
  });

  it('flies a box from its start to the target and lands it once', () => {
    const hops = createPizzaHops(stubMaterials(), layout);
    const from = new THREE.Vector3(0, 1, 0);
    let landed = 0;
    hops.launch(from, () => new THREE.Vector3(3, 1, -2), () => landed++);
    const [box] = flying(hops);
    expect(box.position.distanceTo(from)).toBeLessThan(1e-6);

    run(hops, hopSeconds * 0.5);
    expect(landed).toBe(0);
    run(hops, hopSeconds);
    expect(landed).toBe(1);
    expect(flying(hops)).toHaveLength(0);
    run(hops, 1);
    expect(landed).toBe(1);
  });

  it('follows a target that moves while the box is in the air', () => {
    const hops = createPizzaHops(stubMaterials(), layout);
    const oldTarget = new THREE.Vector3(1, 1, 0);
    const target = oldTarget.clone();
    hops.launch(new THREE.Vector3(0, 1, 0), () => target, () => {});
    const [box] = flying(hops);
    run(hops, hopSeconds * 0.5);
    target.set(4, 1, 4);
    let last = null;
    for (let t = 0; t < hopSeconds; t += dt) {
      hops.update(dt);
      if (box.visible) last = box.position.clone();
    }
    expect(last.distanceTo(target)).toBeLessThan(last.distanceTo(oldTarget));
  });

  it('arcs above the straight line between its ends', () => {
    const hops = createPizzaHops(stubMaterials(), layout);
    hops.launch(new THREE.Vector3(0, 1, 0), () => new THREE.Vector3(2, 1, 0), () => {});
    const [box] = flying(hops);
    run(hops, hopSeconds * 0.5);
    expect(box.position.y).toBeGreaterThan(1.3);
  });

  it('reuses its boxes rather than adding new ones', () => {
    const hops = createPizzaHops(stubMaterials(), layout);
    const count = hops.group.children.length;
    let landed = 0;
    for (let i = 0; i < 40; i++) {
      hops.launch(new THREE.Vector3(), () => new THREE.Vector3(1, 0, 0), () => landed++);
      run(hops, hopSeconds + dt);
    }
    expect(landed).toBe(40);
    expect(hops.group.children.length).toBe(count);
  });

  it('still lands a pizza at once when every box is already flying', () => {
    const hops = createPizzaHops(stubMaterials(), layout);
    const launches = hops.group.children.length + 1;
    let landed = 0;
    for (let i = 0; i < launches; i++) {
      hops.launch(new THREE.Vector3(), () => new THREE.Vector3(1, 0, 0), () => landed++);
    }
    expect(landed).toBe(1);
    run(hops, hopSeconds + dt);
    expect(landed).toBe(launches);
  });
});
