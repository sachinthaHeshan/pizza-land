import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createVan } from '../../src/models/van.js';
import { layout } from '../../src/layout.js';
import { boundsOf, expectFinite } from '../helpers/bounds.js';
import { stubMaterials } from '../helpers/stubs.js';

const spec = layout.traffic.types.find((t) => t.key === 'van');
const van = createVan(stubMaterials(), spec);

describe('createVan', () => {
  it('returns a named group standing on the ground', () => {
    expect(van).toBeInstanceOf(THREE.Group);
    expect(van.name).toBe('van');
    const bounds = boundsOf(van);
    expectFinite(bounds);
    expect(bounds.min.y).toBeCloseTo(0, 2);
  });

  it('matches its declared footprint', () => {
    const bounds = boundsOf(van);
    expect(bounds.max.z - bounds.min.z).toBeCloseTo(spec.length, 1);
    expect(bounds.max.x - bounds.min.x).toBeCloseTo(spec.width, 1);
    expect(bounds.max.y).toBeCloseTo(spec.height, 1);
  });

  it('has four wheels', () => {
    expect(van.userData.wheels).toHaveLength(4);
  });

  it('sits between a car and a bus in size', () => {
    const car = layout.traffic.types.find((t) => t.key === 'car');
    const bus = layout.traffic.types.find((t) => t.key === 'bus');
    expect(spec.length).toBeGreaterThan(car.length);
    expect(spec.length).toBeLessThan(bus.length);
  });
});
