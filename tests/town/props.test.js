import { describe, it, expect } from 'vitest';
import { PROP_BUILDERS } from '../../src/town/props.js';
import { boundsOf } from '../helpers/bounds.js';
import { stubMaterials } from '../helpers/stubs.js';

const cases = [
  { kind: 'lamp', x: 2, z: 41.6, facing: -1, size: { w: 0.3, d: 0.3, h: 3.8 } },
  { kind: 'bench', x: -9, z: 43.2, facing: -1, size: { w: 1.6, d: 0.5, h: 0.9 } },
  { kind: 'bin', x: 5, z: 41.6, facing: -1, size: { w: 0.5, d: 0.5, h: 0.9 } },
  { kind: 'busStop', x: -6, z: 42.35, facing: -1, size: { w: 3.2, d: 1.8, h: 2.6 } },
  { kind: 'hedge', x: 30, z: 87.8, facing: 1, size: { w: 4.2, d: 0.4, h: 0.8 } },
  { kind: 'fence', x: 12, z: 48.25, facing: 1, size: { w: 0.1, d: 7.5, h: 0.9 } },
  { kind: 'planter', x: 17.6, z: 62.2, facing: 1, size: { w: 0.8, d: 0.8, h: 1.1 } },
];

function meshBounds(group, materialName) {
  const found = [];
  group.traverse((o) => {
    if (o.isMesh && o.material.name === materialName) found.push(boundsOf(o));
  });
  return found;
}

describe('town props', () => {
  it('has a builder for every prop kind the plan uses', () => {
    expect(Object.keys(PROP_BUILDERS).sort()).toEqual(['bench', 'bin', 'busStop', 'fence', 'hedge', 'lamp', 'planter']);
  });

  for (const prop of cases) {
    it(`builds a ${prop.kind} on the ground, inside its footprint, at its height`, () => {
      const model = PROP_BUILDERS[prop.kind](stubMaterials(), prop);
      expect(model.name).toBe(prop.kind);
      const b = boundsOf(model);
      expect(b.min.y).toBeGreaterThanOrEqual(0);
      expect(b.min.y).toBeLessThanOrEqual(0.02);
      expect(b.max.y).toBeCloseTo(prop.size.h, 5);
      expect(b.min.x).toBeGreaterThanOrEqual(prop.x - prop.size.w / 2 - 1e-6);
      expect(b.max.x).toBeLessThanOrEqual(prop.x + prop.size.w / 2 + 1e-6);
      expect(b.min.z).toBeGreaterThanOrEqual(prop.z - prop.size.d / 2 - 1e-6);
      expect(b.max.z).toBeLessThanOrEqual(prop.z + prop.size.d / 2 + 1e-6);
    });
  }

  it('puts a bench backrest on the side away from the way it faces', () => {
    const bench = cases[1];
    for (const facing of [-1, 1]) {
      const rest = meshBounds(PROP_BUILDERS.bench(stubMaterials(), { ...bench, facing }), 'wood').find((b) => b.max.y > 0.6);
      const restZ = (rest.min.z + rest.max.z) / 2;
      expect(Math.sign(restZ - bench.z)).toBe(-facing);
    }
  });

  it('puts the bus stop glass on the side away from the road', () => {
    const stop = cases[3];
    const glass = meshBounds(PROP_BUILDERS.busStop(stubMaterials(), stop), 'glass');
    expect(glass).toHaveLength(1);
    expect(glass[0].min.z).toBeGreaterThan(stop.z);
  });
});
