import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createCar } from '../../src/models/car.js';
import { layout } from '../../src/layout.js';
import { boundsOf, expectFinite } from '../helpers/bounds.js';
import { stubMaterials } from '../helpers/stubs.js';

const spec = { colour: 'carRed', ...layout.sim.car };
const car = createCar(stubMaterials(), spec);

describe('createCar', () => {
  it('returns a named group with children', () => {
    expect(car).toBeInstanceOf(THREE.Group);
    expect(car.name).toBe('car');
    expect(car.children.length).toBeGreaterThan(4);
  });

  it('matches the declared footprint', () => {
    const bounds = boundsOf(car);
    expectFinite(bounds);
    expect(bounds.max.z - bounds.min.z).toBeCloseTo(spec.length, 1);
    expect(bounds.max.x - bounds.min.x).toBeCloseTo(spec.width, 1);
    expect(bounds.max.y).toBeCloseTo(spec.height, 1);
  });

  it('sits on the ground', () => {
    expect(boundsOf(car).min.y).toBeCloseTo(0, 2);
  });

  it('has four wheels', () => {
    expect(car.userData.wheels).toHaveLength(4);
    for (const wheel of car.userData.wheels) {
      expect(wheel).toBeInstanceOf(THREE.Mesh);
    }
  });

  it('paints the body in the requested colour', () => {
    const names = car.children.map((c) => c.material && c.material.name);
    expect(names).toContain('carRed');
  });

  it('puts its headlights at the front', () => {
    const lights = car.children.filter((c) => c.material && c.material.name === 'headlight');
    expect(lights.length).toBeGreaterThan(0);
    for (const light of lights) {
      expect(light.position.z).toBeGreaterThan(0);
    }
  });
});
