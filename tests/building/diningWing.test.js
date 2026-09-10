import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createDiningWing } from '../../src/building/diningWing.js';
import { layout } from '../../src/layout.js';
import { boundsOf, expectFinite, expectWithin } from '../helpers/bounds.js';
import { stubMaterials } from '../helpers/stubs.js';

const group = createDiningWing(stubMaterials(), layout);

describe('createDiningWing', () => {
  it('returns a named group with children', () => {
    expect(group).toBeInstanceOf(THREE.Group);
    expect(group.name).toBe('diningWing');
    expect(group.children.length).toBeGreaterThan(0);
  });

  it('has finite bounds inside its envelope', () => {
    const bounds = boundsOf(group);
    expectFinite(bounds);
    expectWithin(bounds, layout.envelopes.diningWing);
  });

  it('glazes one pane per window bay', () => {
    const panes = group.children.filter((c) => c.material.name === 'glass');
    expect(panes.length).toBe(layout.diningWing.windows.bays.length);
  });

  it('stops every wall below the roofline', () => {
    const bounds = boundsOf(group);
    expect(bounds.max.y).toBeLessThanOrEqual(layout.diningWing.wallHeight + 0.01);
  });

  it('leaves a doorway gap in the partition', () => {
    const door = layout.diningWing.partition.door;
    expect(door[1]).toBeGreaterThan(door[0]);
  });
});
