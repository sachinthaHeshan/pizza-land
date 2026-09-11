import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createPizzaBox } from '../../src/models/pizzaBox.js';
import { boundsOf, expectFinite } from '../helpers/bounds.js';
import { stubMaterials } from '../helpers/stubs.js';

describe('createPizzaBox', () => {
  it('returns a named group centred on its origin', () => {
    const boxGroup = createPizzaBox(stubMaterials(), 0.42);
    expect(boxGroup).toBeInstanceOf(THREE.Group);
    expect(boxGroup.name).toBe('pizzaBox');
    const bounds = boundsOf(boxGroup);
    expectFinite(bounds);
    expect((bounds.min.x + bounds.max.x) / 2).toBeCloseTo(0, 5);
    expect((bounds.min.z + bounds.max.z) / 2).toBeCloseTo(0, 5);
  });

  it('is flat and square, the size requested', () => {
    const bounds = boundsOf(createPizzaBox(stubMaterials(), 0.42));
    expect(bounds.max.x - bounds.min.x).toBeCloseTo(0.42, 2);
    expect(bounds.max.z - bounds.min.z).toBeCloseTo(0.42, 2);
    expect(bounds.max.y - bounds.min.y).toBeLessThan(0.42 / 3);
  });

  it('takes an explicit thickness for chunkier carried boxes', () => {
    const bounds = boundsOf(createPizzaBox(stubMaterials(), 0.42, 0.1));
    expect(bounds.max.y - bounds.min.y).toBeCloseTo(0.1, 5);
    expect(bounds.max.x - bounds.min.x).toBeCloseTo(0.42, 5);
  });
});
