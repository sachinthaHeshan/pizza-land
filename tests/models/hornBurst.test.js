import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createHornBurst } from '../../src/models/hornBurst.js';
import { boundsOf, expectFinite } from '../helpers/bounds.js';
import { stubMaterials } from '../helpers/stubs.js';

describe('createHornBurst', () => {
  it('returns a hidden named group', () => {
    const burst = createHornBurst(stubMaterials());
    expect(burst).toBeInstanceOf(THREE.Group);
    expect(burst.name).toBe('hornBurst');
    expect(burst.visible).toBe(false);
  });

  it('has finite bounds', () => {
    const burst = createHornBurst(stubMaterials());
    burst.visible = true;
    expectFinite(boundsOf(burst));
  });

  it('pulses its arcs as the phase advances', () => {
    const burst = createHornBurst(stubMaterials());
    burst.userData.setPhase(0);
    const small = burst.children[0].scale.x;
    burst.userData.setPhase(Math.PI / 2);
    const large = burst.children[0].scale.x;
    expect(large).not.toBeCloseTo(small, 3);
  });
});
