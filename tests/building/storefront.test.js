import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createStorefront } from '../../src/building/storefront.js';
import { layout } from '../../src/layout.js';
import { boundsOf, expectFinite, expectWithin } from '../helpers/bounds.js';
import { stubMaterials } from '../helpers/stubs.js';

const group = createStorefront(stubMaterials(), layout);

describe('createStorefront', () => {
  it('returns a named group with children', () => {
    expect(group).toBeInstanceOf(THREE.Group);
    expect(group.name).toBe('storefront');
    expect(group.children.length).toBeGreaterThan(0);
  });

  it('has finite bounds inside its envelope', () => {
    const bounds = boundsOf(group);
    expectFinite(bounds);
    expectWithin(bounds, layout.envelopes.storefront);
  });

  it('publishes one lamp anchor per lamp', () => {
    expect(group.userData.lampAnchors).toHaveLength(layout.storefront.lamps.xs.length);
    for (const anchor of group.userData.lampAnchors) {
      expect(anchor).toBeInstanceOf(THREE.Vector3);
    }
  });

  it('raises the signboard above the awning', () => {
    expect(layout.storefront.sign.y[0]).toBeGreaterThanOrEqual(layout.storefront.awning.wallY);
  });

  it('keeps the door bay inside the facade span', () => {
    const { door, x } = layout.storefront;
    expect(door.x[0]).toBeGreaterThan(x[0]);
    expect(door.x[1]).toBeLessThan(x[1]);
  });
});
