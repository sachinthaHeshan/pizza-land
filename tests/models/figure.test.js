import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createFigure, LEG_PROPORTIONS } from '../../src/models/figure.js';
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

  // Limbs hang off pivot groups now, so material names come from a traversal
  // rather than the direct children.
  const materialNames = (figure) => {
    const names = [];
    figure.traverse((o) => {
      if (o.material) names.push(o.material.name);
    });
    return names;
  };

  it('dresses the torso in the requested colour', () => {
    const figure = createFigure(materials, spec);
    const names = materialNames(figure);
    expect(names).toContain('clothBlue');
    expect(names).toContain('hairDark');
    expect(names).toContain('skin');
    expect(names).toContain('denim');
  });

  it('swaps hair for a cap when asked', () => {
    const capped = createFigure(materials, { ...spec, cap: true });
    const names = materialNames(capped);
    expect(names.filter((n) => n === 'hairDark').length).toBeLessThan(2);
    const plain = createFigure(materials, spec);
    expect(boundsOf(capped).max.y).toBeGreaterThan(0);
    expect(boundsOf(plain).max.y).toBeGreaterThan(0);
  });

  it('faces the given direction', () => {
    const figure = createFigure(materials, { ...spec, facing: Math.PI });
    expect(figure.rotation.y).toBeCloseTo(Math.PI, 5);
  });

  it('exposes four limb pivots', () => {
    const figure = createFigure(materials, spec);
    const limbs = figure.userData.limbs;
    expect(Object.keys(limbs).sort()).toEqual(['armL', 'armR', 'legL', 'legR']);
    for (const pivot of Object.values(limbs)) {
      expect(pivot).toBeInstanceOf(THREE.Group);
    }
  });

  it('hangs each limb below its pivot so it swings from the joint', () => {
    const figure = createFigure(materials, spec);
    for (const [name, pivot] of Object.entries(figure.userData.limbs)) {
      expect(pivot.children.length, name).toBeGreaterThan(0);
      for (const child of pivot.children) {
        expect(child.position.y, `${name} child`).toBeLessThan(0);
      }
    }
  });

  it('swings a foot forward when its pivot rotates', () => {
    const still = createFigure(materials, spec);
    const swung = createFigure(materials, spec);
    swung.userData.limbs.legL.rotation.x = -0.6;
    still.updateMatrixWorld(true);
    swung.updateMatrixWorld(true);
    const at = (figure) => {
      const shoe = figure.userData.limbs.legL.children.find(
        (c) => c.material.name === 'shoe'
      );
      return new THREE.Vector3().setFromMatrixPosition(shoe.matrixWorld);
    };
    expect(at(swung).z).toBeGreaterThan(at(still).z + 0.05);
  });

  it('still stands with its feet on the ground', () => {
    const bounds = boundsOf(createFigure(materials, spec));
    expect(bounds.min.y).toBeCloseTo(0, 3);
  });

  it('exposes the hip height so a seated pose can be derived', () => {
    const figure = createFigure(stubMaterials(), { height: 1.7, cloth: 'clothBlue', hair: 'hairDark' });
    const hip = figure.userData.limbs.legL.position.y;
    expect(LEG_PROPORTIONS.hip * 1.7).toBeCloseTo(hip, 6);
  });
});
