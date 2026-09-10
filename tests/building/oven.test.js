import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createOven } from '../../src/building/oven.js';
import { layout } from '../../src/layout.js';
import { boundsOf, expectFinite, expectWithin } from '../helpers/bounds.js';
import { stubMaterials } from '../helpers/stubs.js';

const group = createOven(stubMaterials(), layout);

describe('createOven', () => {
  it('returns a named group with children', () => {
    expect(group).toBeInstanceOf(THREE.Group);
    expect(group.name).toBe('oven');
    expect(group.children.length).toBeGreaterThan(0);
  });

  it('has finite bounds inside its envelope', () => {
    const bounds = boundsOf(group);
    expectFinite(bounds);
    expectWithin(bounds, layout.envelopes.oven);
  });

  it('exposes a fire light that is part of the group', () => {
    const light = group.userData.fireLight;
    expect(light).toBeInstanceOf(THREE.PointLight);
    expect(group.children).toContain(light);
    expect(light.userData.baseIntensity).toBe(layout.lighting.fire.intensity);
  });

  it('carries the flue above the dome', () => {
    const bounds = boundsOf(group);
    expect(bounds.max.y).toBeGreaterThan(layout.oven.dome.center[1] + layout.oven.dome.radius);
  });

  it('faces the mouth toward the shop interior', () => {
    expect(layout.oven.mouth.x).toBeLessThan(layout.oven.dome.center[0]);
  });
});
