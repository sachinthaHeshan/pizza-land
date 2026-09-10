import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createGround } from '../../src/building/ground.js';
import { layout } from '../../src/layout.js';
import { boundsOf, expectFinite, expectWithin } from '../helpers/bounds.js';
import { stubMaterials } from '../helpers/stubs.js';

const group = createGround(stubMaterials(), layout);
const named = (name) => group.children.filter((c) => c.material && c.material.name === name);

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

  it('builds a kerb for every declared kerb band', () => {
    expect(named('stone').length).toBeGreaterThanOrEqual(layout.ground.kerbs.length);
  });

  it('marks both dashed lane dividers', () => {
    const marks = named('roadPaint');
    for (const z of layout.ground.laneMarks.dashed) {
      const onThisLine = marks.filter(
        (m) => Math.abs(m.position.z - (z + layout.ground.laneMarks.width / 2)) < 0.3
      );
      expect(onThisLine.length, `dashes at z=${z}`).toBeGreaterThan(4);
    }
  });

  it('draws a solid double centre line', () => {
    const centre = named('laneCentre');
    expect(centre).toHaveLength(2);
    const zs = centre.map((c) => c.position.z).sort((a, b) => a - b);
    expect(zs[1] - zs[0]).toBeCloseTo(layout.ground.laneMarks.centreGap, 2);
  });

  it('lays the road below the paving so the kerb reads as a step', () => {
    expect(layout.ground.road.y).toBeLessThan(layout.ground.floorY.paving);
  });

  it('paves either side of the parking lot so no gap shows', () => {
    const sides = layout.ground.sidewalk.filter((r) => r.z[0] === 10.9);
    expect(sides).toHaveLength(2);
    expect(sides[0].x[1]).toBeCloseTo(layout.parking.lot.x[0], 5);
    expect(sides[1].x[0]).toBeCloseTo(layout.parking.lot.x[1], 5);
  });
});
