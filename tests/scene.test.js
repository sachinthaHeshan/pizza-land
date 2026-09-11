import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createShop } from '../src/scene.js';
import { createMaterials } from '../src/materials.js';
import { createTextures } from '../src/textures.js';
import { layout } from '../src/layout.js';
import { stubCanvasFactory } from './helpers/stubs.js';
import { boundsOf, expectFinite } from './helpers/bounds.js';

const materials = createMaterials(createTextures(stubCanvasFactory()));
const shop = createShop(materials, layout);

describe('createShop', () => {
  it('assembles every part in order', () => {
    expect(shop.children.map((c) => c.name)).toEqual([
      'ground',
      'parking',
      'perimeter',
      'diningWing',
      'storefront',
      'kitchen',
      'oven',
      'counter',
      'sideWing',
      'queue',
      'simulation',
      'lighting',
    ]);
  });

  it('has finite bounds', () => {
    expectFinite(boundsOf(shop));
  });

  it('forwards the oven fire light for the flicker loop', () => {
    expect(shop.userData.fireLight).toBeInstanceOf(THREE.PointLight);
  });

  it('builds no roof above the tallest wall except the chimney', () => {
    const chimneyTop = layout.oven.flue.y[1] + 0.1;
    expect(boundsOf(shop).max.y).toBeLessThanOrEqual(chimneyTop + 0.01);
  });

  it('exposes the simulation for the render loop', () => {
    expect(shop.userData.simulation).toBeTruthy();
    expect(typeof shop.userData.simulation.update).toBe('function');
  });

  it('advances without throwing', () => {
    for (let t = 0; t < 60; t += 1 / 60) shop.userData.simulation.update(1 / 60);
    expect(shop.userData.simulation.pedestrians).toHaveLength(layout.sim.pedestrians);
  });

  it('keeps every part inside the lot plus its street apron', () => {
    const bounds = boundsOf(shop);
    const [minX, ,] = layout.envelopes.ground.min;
    const [maxX, ,] = layout.envelopes.ground.max;
    expect(bounds.min.x).toBeGreaterThanOrEqual(minX - 0.01);
    expect(bounds.max.x).toBeLessThanOrEqual(maxX + 0.01);
  });

  // The first sell marker sat on the floor behind the counter, where the
  // fixed camera could not see any of it. This casts a ray from each outline
  // dash toward the camera and fails if anything solid is in the way.
  it('keeps both zone outlines where the game camera can see them', () => {
    shop.updateMatrixWorld(true);
    const toCamera = new THREE.Vector3(...layout.camera.direction).normalize();
    const skip = /^(sellPoint|ovenPoint|cashier|pedestrian-|pizzaHops)/;
    const blockers = [];
    shop.traverse((o) => {
      if (!o.isMesh) return;
      for (let p = o; p; p = p.parent) if (skip.test(p.name) || !p.visible) return;
      blockers.push(o);
    });

    const ray = new THREE.Raycaster();
    const { sellPoint, ovenPoint } = shop.userData.simulation;
    for (const point of [sellPoint, ovenPoint]) {
      for (const dash of point.getObjectByName('zoneEdge').children) {
        const b = new THREE.Box3().setFromObject(dash);
        const top = new THREE.Vector3((b.min.x + b.max.x) / 2, b.max.y, (b.min.z + b.max.z) / 2);
        ray.set(top.clone().addScaledVector(toCamera, 200), toCamera.clone().negate());
        ray.far = 200 - 1e-3;
        const label = `${point.name} dash at (${top.x.toFixed(2)}, ${top.z.toFixed(2)})`;
        expect(ray.intersectObjects(blockers, false), label).toHaveLength(0);
      }
    }
  });
});
