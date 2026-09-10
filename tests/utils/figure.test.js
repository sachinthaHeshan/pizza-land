import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createFigure } from '../../src/utils/figure.js';
import { boundsOf, expectFinite } from '../helpers/bounds.js';
import { stubMaterials } from '../helpers/stubs.js';

const materials = stubMaterials();
const spec = { x: 1.2, z: 5.1, height: 1.72, cloth: 'clothBlue', hair: 'hairDark', skin: 'skin' };

describe('createFigure', () => {
  it('returns a named group with children', () => {
    const figure = createFigure(materials, spec);
    expect(figure).toBeInstanceOf(THREE.Group);
    expect(figure.name).toBe('figure');
    expect(figure.children.length).toBeGreaterThan(5);
  });

  it('stands with its feet on the ground', () => {
    const bounds = boundsOf(createFigure(materials, spec));
    expectFinite(bounds);
    expect(bounds.min.y).toBeCloseTo(0, 4);
  });

  it('reaches the requested height', () => {
    for (const height of [1.28, 1.72]) {
      const bounds = boundsOf(createFigure(materials, { ...spec, height }));
      expect(bounds.max.y).toBeGreaterThan(height * 0.88);
      expect(bounds.max.y).toBeLessThanOrEqual(height + 0.001);
    }
  });

  it('stands at the requested spot on the plaza', () => {
    const figure = createFigure(materials, spec);
    expect(figure.position.x).toBeCloseTo(1.2, 5);
    expect(figure.position.y).toBeCloseTo(0, 5);
    expect(figure.position.z).toBeCloseTo(5.1, 5);
  });

  it('is narrower than it is tall', () => {
    const bounds = boundsOf(createFigure(materials, spec));
    expect(bounds.max.x - bounds.min.x).toBeLessThan(spec.height * 0.6);
  });

  it('dresses the torso in the requested colour', () => {
    const figure = createFigure(materials, spec);
    const names = figure.children.map((c) => c.material.name);
    expect(names).toContain('clothBlue');
    expect(names).toContain('hairDark');
    expect(names).toContain('skin');
    expect(names).toContain('denim');
  });

  it('swaps hair for a cap when asked', () => {
    const capped = createFigure(materials, { ...spec, cap: true });
    const names = capped.children.map((c) => c.material.name);
    expect(names.filter((n) => n === 'hairDark').length).toBeLessThan(2);
    const plain = createFigure(materials, spec);
    expect(boundsOf(capped).max.y).toBeGreaterThan(0);
    expect(boundsOf(plain).max.y).toBeGreaterThan(0);
  });

  it('faces the given direction', () => {
    const figure = createFigure(materials, { ...spec, facing: Math.PI });
    expect(figure.rotation.y).toBeCloseTo(Math.PI, 5);
  });
});
