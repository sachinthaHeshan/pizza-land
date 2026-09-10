import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createKitchen } from '../../src/building/kitchen.js';
import { layout } from '../../src/layout.js';
import { boundsOf, expectFinite, expectWithin } from '../helpers/bounds.js';
import { stubMaterials } from '../helpers/stubs.js';

const group = createKitchen(stubMaterials(), layout);

describe('createKitchen', () => {
  it('returns a named group with children', () => {
    expect(group).toBeInstanceOf(THREE.Group);
    expect(group.name).toBe('kitchen');
    expect(group.children.length).toBeGreaterThan(0);
  });

  it('has finite bounds inside its envelope', () => {
    const bounds = boundsOf(group);
    expectFinite(bounds);
    expectWithin(bounds, layout.envelopes.kitchen);
  });

  it('raises the tiled wall above the perimeter wall it sits on', () => {
    expect(layout.kitchen.tileWall.y[0]).toBeGreaterThanOrEqual(layout.wall.height);
    expect(layout.kitchen.tileWall.y[1]).toBeGreaterThan(layout.kitchen.tileWall.y[0]);
  });

  it('keeps the prep island clear of the back counter', () => {
    expect(layout.kitchen.island.z[0]).toBeGreaterThan(layout.kitchen.backCounter.z[1]);
  });

  it('hangs the wall shelf above the counter tops', () => {
    expect(layout.kitchen.wallShelf.y).toBeGreaterThan(layout.kitchen.backCounter.height);
  });
});
