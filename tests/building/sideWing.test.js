import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createSideWing } from '../../src/building/sideWing.js';
import { layout } from '../../src/layout.js';
import { boundsOf, expectFinite, expectWithin } from '../helpers/bounds.js';
import { stubMaterials } from '../helpers/stubs.js';

const group = createSideWing(stubMaterials(), layout);

describe('createSideWing', () => {
  it('returns a named group with children', () => {
    expect(group).toBeInstanceOf(THREE.Group);
    expect(group.name).toBe('sideWing');
    expect(group.children.length).toBeGreaterThan(0);
  });

  it('has finite bounds inside its envelope', () => {
    const bounds = boundsOf(group);
    expectFinite(bounds);
    expectWithin(bounds, layout.envelopes.sideWing);
  });

  it('publishes a window anchor for the interior light', () => {
    expect(group.userData.windowAnchor).toBeInstanceOf(THREE.Vector3);
  });

  it('projects the awning past the front face', () => {
    expect(layout.sideWing.awning.frontZ).toBeGreaterThan(layout.sideWing.window.z);
  });

  it('glazes exactly one window', () => {
    const panes = group.children.filter((c) => c.material && c.material.name === 'glass');
    expect(panes).toHaveLength(1);
  });
});
