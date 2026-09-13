import { describe, it, expect } from 'vitest';
import { createRoundTree, createPine } from '../../src/town/nature.js';
import { boundsOf } from '../helpers/bounds.js';
import { stubMaterials } from '../helpers/stubs.js';

describe('town trees', () => {
  it('builds a round tree on the ground at its planned height, centred on its spot', () => {
    const tree = createRoundTree(stubMaterials(), { kind: 'round', x: -12, z: 42.6, height: 5 });
    expect(tree.name).toBe('roundTree');
    const b = boundsOf(tree);
    expect(b.min.y).toBeCloseTo(0, 5);
    expect(b.max.y).toBeCloseTo(5, 5);
    expect((b.min.x + b.max.x) / 2).toBeCloseTo(-12, 5);
    expect((b.min.z + b.max.z) / 2).toBeCloseTo(42.6, 5);
  });

  it('builds a pine on the ground at its planned height, centred on its spot', () => {
    const tree = createPine(stubMaterials(), { kind: 'pine', x: 30, z: 91, height: 6 });
    expect(tree.name).toBe('pine');
    const b = boundsOf(tree);
    expect(b.min.y).toBeCloseTo(0, 5);
    expect(b.max.y).toBeCloseTo(6, 5);
    expect((b.min.x + b.max.x) / 2).toBeCloseTo(30, 5);
    expect((b.min.z + b.max.z) / 2).toBeCloseTo(91, 5);
  });

  it('keeps each trunk inside the 0.5 m square the plan blocks', () => {
    for (const [build, height] of [[createRoundTree, 5.2], [createPine, 6]]) {
      const trunks = [];
      build(stubMaterials(), { x: 0, z: 0, height }).traverse((o) => {
        if (o.isMesh && o.material.name === 'bark') trunks.push(boundsOf(o));
      });
      expect(trunks).toHaveLength(1);
      expect(trunks[0].max.x - trunks[0].min.x).toBeLessThanOrEqual(0.5);
      expect(trunks[0].max.z - trunks[0].min.z).toBeLessThanOrEqual(0.5);
    }
  });
});
