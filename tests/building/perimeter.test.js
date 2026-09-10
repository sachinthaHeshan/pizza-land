import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createPerimeter } from '../../src/building/perimeter.js';
import { layout } from '../../src/layout.js';
import { boundsOf, expectFinite, expectWithin } from '../helpers/bounds.js';
import { stubMaterials } from '../helpers/stubs.js';

const group = createPerimeter(stubMaterials(), layout);

describe('createPerimeter', () => {
  it('returns a named group with children', () => {
    expect(group).toBeInstanceOf(THREE.Group);
    expect(group.name).toBe('perimeter');
    expect(group.children.length).toBeGreaterThan(0);
  });

  it('has finite bounds inside its envelope', () => {
    const bounds = boundsOf(group);
    expectFinite(bounds);
    expectWithin(bounds, layout.envelopes.perimeter);
  });

  it('builds a wall and a cap for every run', () => {
    const capped = group.children.filter((c) => c.material.name === 'stone');
    expect(capped.length).toBe(layout.perimeter.runs.length + layout.perimeter.pillars.length);
  });

  it('raises pillars above the wall runs', () => {
    expect(layout.perimeter.pillarHeight).toBeGreaterThan(layout.wall.height);
  });

  it('leaves the west face to the dining wing', () => {
    const left = layout.perimeter.runs.find((r) => r.axis === 'z' && r.x === -11);
    expect(left).toBeUndefined();
  });
});
