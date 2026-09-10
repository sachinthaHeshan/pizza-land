import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createBus } from '../../src/models/bus.js';
import { layout } from '../../src/layout.js';
import { boundsOf, expectFinite } from '../helpers/bounds.js';
import { stubMaterials } from '../helpers/stubs.js';

const spec = layout.traffic.types.find((t) => t.key === 'bus');
const bus = createBus(stubMaterials(), spec);

describe('createBus', () => {
  it('returns a named group standing on the ground', () => {
    expect(bus).toBeInstanceOf(THREE.Group);
    expect(bus.name).toBe('bus');
    const bounds = boundsOf(bus);
    expectFinite(bounds);
    expect(bounds.min.y).toBeCloseTo(0, 2);
  });

  it('matches its declared footprint', () => {
    const bounds = boundsOf(bus);
    expect(bounds.max.z - bounds.min.z).toBeCloseTo(spec.length, 1);
    expect(bounds.max.x - bounds.min.x).toBeCloseTo(spec.width, 1);
    expect(bounds.max.y).toBeCloseTo(spec.height, 1);
  });

  it('has six wheels, being long', () => {
    expect(bus.userData.wheels).toHaveLength(6);
  });

  it('is longer and taller than a car', () => {
    const car = layout.traffic.types.find((t) => t.key === 'car');
    expect(spec.length).toBeGreaterThan(car.length);
    expect(spec.height).toBeGreaterThan(car.height);
  });
});
