import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createShop } from '../src/scene.js';
import { createMaterials } from '../src/materials.js';
import { createTextures } from '../src/textures.js';
import { layout } from '../src/layout.js';
import { stubCanvasFactory } from './helpers/stubs.js';
import { boundsOf, expectFinite } from './helpers/bounds.js';
import { planTown } from '../src/town/planTown.js';
import { shopSignCentre, houseDoorCentre } from '../src/town/buildings.js';

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
      'town',
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
    const shopOnly = new THREE.Box3();
    for (const part of shop.children) {
      if (part.name !== 'town') shopOnly.union(boundsOf(part));
    }
    expect(shopOnly.max.y).toBeLessThanOrEqual(chimneyTop + 0.01);
  });

  it('forwards the sun for the render loop', () => {
    expect(shop.userData.sun.isDirectionalLight).toBe(true);
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

  // The town faces away from the road on purpose: this camera only ever sees
  // faces pointing +z or −x. A front that ends up hidden is the mistake this
  // catches, the same way the zone outline test catches a hidden marker.
  it('keeps town shop signs and second-row doors where the game camera can see them', () => {
    shop.updateMatrixWorld(true);
    const toCamera = new THREE.Vector3(...layout.camera.direction).normalize();
    const skip = /^(sellPoint|ovenPoint|cashier|pedestrian-|pizzaHops)/;
    // Foliage is exempt. The tree line stands nearer the camera than the second
    // row, so a 6 m tree at z 89 crosses the sight line to a door at y 1.2 — a
    // house glimpsed through a tree is the look we want. Solid building fronts
    // hidden by other buildings are what this test is for.
    const foliage = new Set(['foliage', 'pine', 'bark']);
    const blockers = [];
    shop.traverse((o) => {
      if (!o.isMesh || o.material.transparent || foliage.has(o.material.name)) return;
      for (let p = o; p; p = p.parent) if (skip.test(p.name) || !p.visible) return;
      blockers.push(o);
    });

    const plan = planTown(layout);
    const fronts = [
      ...plan.lots.filter((lot) => lot.kind === 'shop').map(shopSignCentre),
      ...plan.lots.filter((lot) => lot.row === 'second').map(houseDoorCentre),
    ];
    expect(fronts.length).toBeGreaterThan(10);

    const ray = new THREE.Raycaster();
    for (const front of fronts) {
      ray.set(front.clone().addScaledVector(toCamera, 200), toCamera.clone().negate());
      // Stop short of the front itself, which sits on the town's own mesh.
      ray.far = 200 - 0.05;
      const label = `front at (${front.x.toFixed(1)}, ${front.z.toFixed(1)})`;
      expect(ray.intersectObjects(blockers, false), label).toHaveLength(0);
    }
  });

  // The measurement that chose the table positions, kept as a test. This
  // camera only sees faces pointing +z or -x, and the west wall, storefront
  // plinth and sign each hide part of the dining floor.
  it('keeps every tabletop, diner, banner and delivery zone in view', () => {
    shop.updateMatrixWorld(true);
    const toCamera = new THREE.Vector3(...layout.camera.direction).normalize();
    const skip = /^(sellPoint|ovenPoint|tablePoint-|cashier|pedestrian-|pizzaHops|town)/;
    const blockers = [];
    shop.traverse((o) => {
      if (!o.isMesh || o.material.transparent) return;
      for (let p = o; p; p = p.parent) if (skip.test(p.name) || !p.visible) return;
      blockers.push(o);
    });

    const d = layout.dining;
    const ray = new THREE.Raycaster();
    const hidden = (point) => {
      ray.set(point.clone().addScaledVector(toCamera, 200), toCamera.clone().negate());
      ray.far = 200 - 0.02;
      return ray.intersectObjects(blockers, false).length > 0;
    };

    // A hair above the slab: the height a delivered box sits at, and clear of
    // the slab's own surface so the ray cannot graze it.
    const topY = d.top.height + d.top.thickness + layout.surfaceEps;
    const half = d.top.size / 2;
    const points = shop.userData.simulation.tablePoints;
    expect(points).toHaveLength(d.tables.length);

    d.tables.forEach((spot, i) => {
      for (const dx of [-half, half]) {
        for (const dz of [-half, half]) {
          const at = new THREE.Vector3(spot.x + dx, topY, spot.z + dz);
          expect(hidden(at), `tabletop (${at.x.toFixed(2)}, ${at.z.toFixed(2)})`).toBe(false);
        }
      }
      for (const side of [-1, 1]) {
        const at = new THREE.Vector3(spot.x, 1.22, spot.z + side * d.chair.offset);
        expect(hidden(at), `diner at (${at.x.toFixed(2)}, ${at.z.toFixed(2)})`).toBe(false);
      }

      // The banner is centred on the zone, not on the table, so that is where
      // the sight line has to be checked.
      const zoneX = (spot.zone.x[0] + spot.zone.x[1]) / 2;
      const zoneZ = (spot.zone.z[0] + spot.zone.z[1]) / 2;
      expect(hidden(new THREE.Vector3(zoneX, d.banner.y, zoneZ)), `banner ${i}`).toBe(false);

      // Read the outline height out of the built marker rather than
      // recomputing it here: a test that derives the number from the layout
      // never sees what the simulation actually passed to createZoneMarker.
      // The outline must sit on the tabletop, not on the dining floor — on
      // the floor the table itself hides it from this camera.
      const edge = points[i].getObjectByName('zoneEdge');
      expect(edge, `zoneEdge ${i}`).toBeDefined();
      const bounds = new THREE.Box3().setFromObject(edge);
      expect(bounds.min.y, `outline height ${i}`).toBeCloseTo(topY, 6);

      for (const zx of spot.zone.x) {
        for (const zz of spot.zone.z) {
          const at = new THREE.Vector3(zx, bounds.min.y, zz);
          expect(hidden(at), `zone corner (${zx.toFixed(2)}, ${zz.toFixed(2)})`).toBe(false);
        }
      }
    });
  });
});
