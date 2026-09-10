import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createGround } from '../../src/building/ground.js';
import { layout } from '../../src/layout.js';
import { boundsOf, expectFinite, expectWithin } from '../helpers/bounds.js';
import { stubMaterials } from '../helpers/stubs.js';

const group = createGround(stubMaterials(), layout);

describe('createGround', () => {
  it('returns a named group with children', () => {
    expect(group).toBeInstanceOf(THREE.Group);
    expect(group.name).toBe('ground');
    expect(group.children.length).toBeGreaterThan(0);
  });

  it('has finite bounds inside its envelope', () => {
    const bounds = boundsOf(group);
    expectFinite(bounds);
    expectWithin(bounds, layout.envelopes.ground);
  });

  it('draws one stripe per parking bay', () => {
    const painted = group.children.filter((c) => c.material.name === 'roadPaint');
    expect(painted.length).toBeGreaterThanOrEqual(layout.ground.parking.count);
  });

  it('lays the terracotta floor above the paving so it wins the seam', () => {
    expect(layout.ground.floorY.terracotta).toBeGreaterThan(layout.ground.floorY.paving);
  });
});
