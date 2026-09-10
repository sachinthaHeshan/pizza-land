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
      'perimeter',
      'diningWing',
      'storefront',
      'kitchen',
      'oven',
      'counter',
      'sideWing',
      'queue',
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

  it('keeps every part inside the lot plus its street apron', () => {
    const bounds = boundsOf(shop);
    expect(bounds.min.x).toBeGreaterThanOrEqual(-40.01);
    expect(bounds.max.x).toBeLessThanOrEqual(40.01);
  });
});
