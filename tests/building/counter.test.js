import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createCounter } from '../../src/building/counter.js';
import { layout } from '../../src/layout.js';
import { boundsOf, expectFinite, expectWithin } from '../helpers/bounds.js';
import { stubMaterials } from '../helpers/stubs.js';

const group = createCounter(stubMaterials(), layout);

describe('createCounter', () => {
  it('returns a named group with children', () => {
    expect(group).toBeInstanceOf(THREE.Group);
    expect(group.name).toBe('counter');
    expect(group.children.length).toBeGreaterThan(0);
  });

  it('has finite bounds inside its envelope', () => {
    const bounds = boundsOf(group);
    expectFinite(bounds);
    expectWithin(bounds, layout.envelopes.counter);
  });

  it('overhangs the wooden top past the brick base', () => {
    const bounds = boundsOf(group);
    expect(bounds.min.x).toBeLessThan(layout.counter.main.x[0]);
    expect(bounds.max.z).toBeGreaterThan(layout.counter.main.z[1]);
  });

  it('tops out at counter height', () => {
    const bounds = boundsOf(group);
    expect(bounds.max.y).toBeCloseTo(layout.counter.topHeight, 5);
  });

  it('joins the return leg to the main run', () => {
    const { main, ret } = layout.counter;
    expect(ret.z[1]).toBeCloseTo(main.z[1], 5);
  });
});
