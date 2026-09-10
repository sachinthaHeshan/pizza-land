import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createParking } from '../../src/building/parking.js';
import { layout } from '../../src/layout.js';
import { boundsOf, expectFinite, expectWithin } from '../helpers/bounds.js';
import { stubMaterials } from '../helpers/stubs.js';

const group = createParking(stubMaterials(), layout);
const named = (name) => group.children.filter((c) => c.material && c.material.name === name);

describe('createParking', () => {
  it('returns a named group with children', () => {
    expect(group).toBeInstanceOf(THREE.Group);
    expect(group.name).toBe('parking');
    expect(group.children.length).toBeGreaterThan(0);
  });

  it('has finite bounds inside its envelope', () => {
    const bounds = boundsOf(group);
    expectFinite(bounds);
    expectWithin(bounds, layout.envelopes.parking);
  });

  it('draws five divider lines per row, ten in all', () => {
    expect(named('roadPaint')).toHaveLength((layout.parking.bayX.length + 1) * 2);
  });

  it('builds one kerb and one planting bed per island segment', () => {
    expect(named('stone')).toHaveLength(layout.parking.segments.length);
    expect(named('planting')).toHaveLength(layout.parking.segments.length);
  });

  it('leaves both island gaps unbuilt', () => {
    const { entrance, exit } = layout.parking;
    for (const kerb of named('stone')) {
      const half = kerb.geometry.parameters.width / 2;
      const span = [kerb.position.x - half, kerb.position.x + half];
      for (const gap of [entrance, exit]) {
        const overlaps = span[0] < gap.x[1] && gap.x[0] < span[1];
        expect(overlaps, `kerb ${span} covers gap ${gap.x}`).toBe(false);
      }
    }
  });

  it('surfaces the lot at road level, below the paving', () => {
    const asphalt = named('asphalt');
    expect(asphalt.length).toBeGreaterThan(0);
    expect(asphalt[0].position.y).toBeCloseTo(layout.ground.floorY.asphalt, 5);
  });

  it('paves the two island gaps so cars drive on asphalt', () => {
    const asphalt = named('asphalt');
    const covers = (gap) =>
      asphalt.some((mesh) => {
        const half = mesh.geometry.parameters.width / 2;
        return (
          mesh.position.x - half <= gap.x[0] + 1e-6 &&
          mesh.position.x + half >= gap.x[1] - 1e-6
        );
      });
    expect(covers(layout.parking.entrance)).toBe(true);
    expect(covers(layout.parking.exit)).toBe(true);
  });
});
